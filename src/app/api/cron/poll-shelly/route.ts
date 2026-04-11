import { type NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";

import { db } from "@/server/db";
import {
  smartMeterDevices,
  smartMeterLogs,
  meterReadings,
  appSettings,
  users,
} from "@/server/db/schema";

/**
 * Vercel Cron — polls Shelly Cloud API for all active shelly_cloud devices.
 * Runs every 5 minutes.
 * GET /api/cron/poll-shelly
 */

interface ShellyEmStatus {
  total_act_power?: number;
  a_act_power?: number;
  b_act_power?: number;
  c_act_power?: number;
  a_voltage?: number;
  b_voltage?: number;
  c_voltage?: number;
}

interface ShellyEmdataStatus {
  total_act?: number;
  total_act_ret?: number;
}

async function fetchShellyDevice(
  serverHost: string,
  authKey: string,
  shellyDeviceId: string,
): Promise<{ emStatus?: ShellyEmStatus; emdataStatus?: ShellyEmdataStatus; online: boolean } | null> {
  try {
    const url = `https://${serverHost}/v2/devices/api/get?auth_key=${authKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: [shellyDeviceId],
        select: ["status"],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: Array<{ online: number; status?: Record<string, unknown> }> };
    const device = data.data?.[0];
    if (!device) return null;
    return {
      emStatus: device.status?.["em:0"] as ShellyEmStatus | undefined,
      emdataStatus: device.status?.["emdata:0"] as ShellyEmdataStatus | undefined,
      online: device.online === 1,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("[cron] poll-shelly started");

  // Find all active shelly_cloud devices
  const devices = await db.query.smartMeterDevices.findMany({
    where: and(
      eq(smartMeterDevices.source, "shelly_cloud"),
      eq(smartMeterDevices.isActive, true),
    ),
  });

  if (devices.length === 0) {
    console.log("[cron] poll-shelly: no active shelly_cloud devices");
    return Response.json({ status: "ok", polled: 0 });
  }

  // Group devices by property owner to find credentials
  // We need to find the landlord for each property to get their Shelly Cloud auth key
  const results: { deviceId: string; status: string; value?: number }[] = [];

  // Cache credentials by userId
  const credentialsCache = new Map<number, { authKey: string; serverHost: string } | null>();

  for (const device of devices) {
    try {
      // Deduplication: check min interval
      if (device.lastSeenAt) {
        const elapsed = (Date.now() - new Date(device.lastSeenAt).getTime()) / 1000 / 60;
        if (elapsed < device.minIntervalMinutes) {
          results.push({ deviceId: device.deviceId, status: "skipped" });
          continue;
        }
      }

      // Get property to find owner
      const property = await db.query.properties.findFirst({
        where: eq(
          (await import("@/server/db/schema")).properties.id,
          device.propertyId,
        ),
      });
      if (!property) {
        results.push({ deviceId: device.deviceId, status: "error", value: undefined });
        continue;
      }

      // Get Shelly Cloud credentials for this landlord
      let creds = credentialsCache.get(property.landlordId);
      if (creds === undefined) {
        const authKeyRow = await db.query.appSettings.findFirst({
          where: eq(appSettings.key, `shelly_cloud_auth_key:${property.landlordId}`),
        });
        const serverRow = await db.query.appSettings.findFirst({
          where: eq(appSettings.key, `shelly_cloud_server:${property.landlordId}`),
        });
        creds = authKeyRow?.value && serverRow?.value
          ? { authKey: authKeyRow.value, serverHost: serverRow.value }
          : null;
        credentialsCache.set(property.landlordId, creds);
      }

      if (!creds) {
        results.push({ deviceId: device.deviceId, status: "no_credentials" });
        continue;
      }

      const shellyId = device.shellyDeviceId ?? device.deviceId;
      const shellyData = await fetchShellyDevice(creds.serverHost, creds.authKey, shellyId);

      if (!shellyData) {
        await db.update(smartMeterDevices)
          .set({ lastError: "Shelly Cloud API error" })
          .where(eq(smartMeterDevices.id, device.id));
        results.push({ deviceId: device.deviceId, status: "api_error" });
        continue;
      }

      if (!shellyData.online) {
        await db.update(smartMeterDevices)
          .set({ lastError: "Device offline" })
          .where(eq(smartMeterDevices.id, device.id));
        results.push({ deviceId: device.deviceId, status: "offline" });
        continue;
      }

      // Extract energy value (total_act from emdata in Wh)
      // emdata:0.total_act is cumulative energy in Wh
      // em:0.total_act_power is current power in W
      let rawValue: number | undefined;

      if (shellyData.emdataStatus?.total_act !== undefined) {
        // Cumulative energy in Wh — this is a meter reading
        rawValue = shellyData.emdataStatus.total_act;
      } else if (shellyData.emStatus?.total_act_power !== undefined) {
        // Current power in W — not a cumulative reading, skip for meter readings
        // We could store this separately but for now we need cumulative data
        await db.update(smartMeterDevices)
          .set({
            lastSeenAt: new Date(),
            lastRawValue: shellyData.emStatus.total_act_power,
            lastError: null,
          })
          .where(eq(smartMeterDevices.id, device.id));
        results.push({
          deviceId: device.deviceId,
          status: "power_only",
          value: shellyData.emStatus.total_act_power,
        });
        continue;
      }

      if (rawValue === undefined) {
        await db.update(smartMeterDevices)
          .set({ lastError: "No EM data in response" })
          .where(eq(smartMeterDevices.id, device.id));
        results.push({ deviceId: device.deviceId, status: "no_em_data" });
        continue;
      }

      // Apply multiplier + offset (default: Wh → kWh = multiplier 0.001)
      const finalValue = rawValue * device.multiplier + device.offset;

      // Get previous reading for consumption
      const prevReading = await db.query.meterReadings.findFirst({
        where: and(
          eq(meterReadings.propertyId, device.propertyId),
          eq(meterReadings.utilityType, device.utilityType),
        ),
        orderBy: [desc(meterReadings.readingDate), desc(meterReadings.id)],
      });

      const prevValue = prevReading?.value ?? null;
      const consumption = prevValue !== null ? finalValue - prevValue : null;

      // Create reading
      const today = new Date().toISOString().split("T")[0]!;
      const [reading] = await db
        .insert(meterReadings)
        .values({
          propertyId: device.propertyId,
          utilityType: device.utilityType,
          value: finalValue,
          prevValue,
          consumption,
          readingDate: today,
          source: "smart_mqtt", // reuse existing source — webhook handler uses this
          notes: `Auto: Shelly Cloud · ${device.name ?? device.deviceId}`,
        })
        .returning();

      // Update device state
      await db.update(smartMeterDevices)
        .set({
          lastSeenAt: new Date(),
          lastRawValue: rawValue,
          lastError: null,
        })
        .where(eq(smartMeterDevices.id, device.id));

      // Log
      await db.insert(smartMeterLogs).values({
        deviceId: device.deviceId,
        source: "shelly_cloud",
        rawPayload: JSON.stringify(shellyData),
        parsedValue: rawValue,
        finalValue,
        status: "ok",
        readingId: reading?.id,
      });

      results.push({ deviceId: device.deviceId, status: "ok", value: finalValue });
    } catch (error) {
      console.error(`[cron] poll-shelly error for ${device.deviceId}:`, error);
      results.push({ deviceId: device.deviceId, status: "error" });
    }
  }

  const summary = {
    polled: devices.length,
    ok: results.filter((r) => r.status === "ok").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => ["error", "api_error", "no_em_data", "offline"].includes(r.status)).length,
  };

  console.log(`[cron] poll-shelly done — ${JSON.stringify(summary)}`);
  return Response.json({ status: "ok", ...summary, results });
}
