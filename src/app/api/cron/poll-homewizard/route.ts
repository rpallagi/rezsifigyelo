import { type NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";

import { db } from "@/server/db";
import {
  smartMeterDevices,
  smartMeterLogs,
  meterReadings,
  properties,
} from "@/server/db/schema";
import { getHomeWizardCredentials } from "@/server/api/routers/homewizard";
import { getToken, fetchHistory } from "@/server/homewizard/client";

/**
 * Vercel Cron — polls HomeWizard Cloud API for all active homewizard devices.
 * Runs daily at 07:00 UTC.
 * GET /api/cron/poll-homewizard
 */
export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets this header)
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const devices = await db.query.smartMeterDevices.findMany({
    where: and(
      eq(smartMeterDevices.source, "homewizard"),
      eq(smartMeterDevices.isActive, true),
    ),
  });

  if (devices.length === 0) {
    return Response.json({ message: "No active HomeWizard devices", polled: 0 });
  }

  let polled = 0;
  let errors = 0;

  for (const device of devices) {
    try {
      // Get property to find the landlord
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, device.propertyId),
        columns: { landlordId: true },
      });
      if (!property) continue;

      // Get credentials
      const creds = await getHomeWizardCredentials(db, property.landlordId);
      if (!creds) {
        await db
          .update(smartMeterDevices)
          .set({ lastError: "Nincs HomeWizard fiok beallitva" })
          .where(eq(smartMeterDevices.id, device.id));
        continue;
      }

      const token = await getToken(creds.email, creds.password);

      // Determine device type for the API
      const hwDeviceId = device.shellyDeviceId ?? device.deviceId;
      const hwType = hwDeviceId.startsWith("watermeter")
        ? "water"
        : "main_connection";

      // Fetch yesterday's data
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yyyy = yesterday.getFullYear();
      const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
      const dd = String(yesterday.getDate()).padStart(2, "0");
      const readingDate = `${yyyy}-${mm}-${dd}`;

      const history = await fetchHistory(
        token,
        hwDeviceId,
        `${yyyy}/${mm}/${dd}`,
        "days",
        hwType,
      );

      const consumption = history.total?.import ?? 0;
      if (consumption <= 0) {
        // Update last seen even if no consumption
        await db
          .update(smartMeterDevices)
          .set({ lastSeenAt: new Date(), lastError: null })
          .where(eq(smartMeterDevices.id, device.id));
        continue;
      }

      // Check if reading already exists for this date
      const existing = await db.query.meterReadings.findFirst({
        where: and(
          eq(meterReadings.propertyId, device.propertyId),
          eq(meterReadings.utilityType, device.utilityType),
          eq(meterReadings.readingDate, readingDate),
          eq(meterReadings.source, "smart_mqtt"),
        ),
      });

      if (!existing) {
        // Get previous reading
        const prev = await db.query.meterReadings.findFirst({
          where: and(
            eq(meterReadings.propertyId, device.propertyId),
            eq(meterReadings.utilityType, device.utilityType),
          ),
          orderBy: [desc(meterReadings.readingDate)],
        });

        const value = prev ? prev.value + consumption : consumption;

        const [reading] = await db
          .insert(meterReadings)
          .values({
            propertyId: device.propertyId,
            utilityType: device.utilityType,
            value: Math.round(value * 100) / 100,
            prevValue: prev?.value ?? null,
            consumption: Math.round(consumption * 100) / 100,
            readingDate,
            source: "smart_mqtt",
            meterInfoId: device.meterInfoId,
          })
          .returning();

        // Log
        await db.insert(smartMeterLogs).values({
          deviceId: device.deviceId,
          source: "homewizard",
          rawPayload: JSON.stringify(history.total),
          parsedValue: consumption,
          finalValue: value,
          status: "ok",
          readingId: reading?.id,
        });
      }

      // Update device state
      await db
        .update(smartMeterDevices)
        .set({
          lastSeenAt: new Date(),
          lastRawValue: consumption,
          lastError: null,
        })
        .where(eq(smartMeterDevices.id, device.id));

      polled++;
    } catch (err) {
      errors++;
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      await db
        .update(smartMeterDevices)
        .set({ lastError: errMsg })
        .where(eq(smartMeterDevices.id, device.id));
    }
  }

  return Response.json({
    message: `HomeWizard poll complete`,
    polled,
    errors,
    total: devices.length,
  });
}
