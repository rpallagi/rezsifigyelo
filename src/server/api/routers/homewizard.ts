import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { appSettings, smartMeterDevices, meterReadings, meterInfo, smartMeterLogs } from "@/server/db/schema";
import {
  getToken,
  listLocations,
  fetchMonthlyHistory,
} from "@/server/homewizard/client";

function getHWSettingsKeys(userId: number) {
  return {
    email: `homewizard_email:${userId}`,
    password: `homewizard_password:${userId}`,
  };
}

export async function getHomeWizardCredentials(
  db: typeof import("@/server/db").db,
  userId: number,
) {
  const keys = getHWSettingsKeys(userId);
  const [emailRow, passwordRow] = await Promise.all([
    db.query.appSettings.findFirst({ where: eq(appSettings.key, keys.email) }),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, keys.password) }),
  ]);
  if (!emailRow?.value || !passwordRow?.value) return null;
  return { email: emailRow.value, password: passwordRow.value };
}

export const homewizardRouter = createTRPCRouter({
  /** Get saved credentials status (does NOT return the password) */
  getSettings: landlordProcedure.query(async ({ ctx }) => {
    const creds = await getHomeWizardCredentials(ctx.db, ctx.dbUser.id);
    return {
      hasCredentials: !!creds,
      email: creds?.email ?? null,
    };
  }),

  /** Save HomeWizard Energy credentials */
  saveSettings: landlordProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const keys = getHWSettingsKeys(ctx.dbUser.id);
      for (const [key, value] of [
        [keys.email, input.email],
        [keys.password, input.password],
      ] as const) {
        await ctx.db
          .insert(appSettings)
          .values({ key, value })
          .onConflictDoUpdate({ target: appSettings.key, set: { value } });
      }
      // Verify credentials work (non-blocking — save even if test fails)
      let verified = false;
      try {
        await getToken(input.email, input.password);
        verified = true;
      } catch {
        // Credentials saved but couldn't verify — might be a network issue
      }
      return { success: true, verified };
    }),

  /** Test connection with saved credentials */
  testConnection: landlordProcedure.mutation(async ({ ctx }) => {
    const creds = await getHomeWizardCredentials(ctx.db, ctx.dbUser.id);
    if (!creds) throw new Error("Nincs mentett HomeWizard fiók");
    const token = await getToken(creds.email, creds.password);
    const locations = await listLocations(token);
    const deviceCount = locations.reduce((n, l) => n + l.devices.length, 0);
    return { success: true, locationCount: locations.length, deviceCount };
  }),

  /** List all locations and devices from HomeWizard cloud */
  listDevices: landlordProcedure.query(async ({ ctx }) => {
    const creds = await getHomeWizardCredentials(ctx.db, ctx.dbUser.id);
    if (!creds) return [];
    try {
      const token = await getToken(creds.email, creds.password);
      return listLocations(token);
    } catch {
      return [];
    }
  }),

  /** Connect with provided credentials (without saving) — for device picker */
  connect: landlordProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const token = await getToken(input.email, input.password);
      const locations = await listLocations(token);
      return locations;
    }),

  /** Import historical data for a smart meter device (up to 12 months) */
  importHistory: landlordProcedure
    .input(
      z.object({
        smartMeterId: z.number(),
        monthsBack: z.number().min(1).max(12).default(12),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const device = await ctx.db.query.smartMeterDevices.findFirst({
        where: eq(smartMeterDevices.id, input.smartMeterId),
      });
      if (!device) throw new Error("Eszköz nem található");

      // Get credentials — try device-level first, then user-level
      let email: string;
      let password: string;
      const creds = await getHomeWizardCredentials(ctx.db, ctx.dbUser.id);
      if (creds) {
        email = creds.email;
        password = creds.password;
      } else {
        throw new Error("Nincs mentett HomeWizard fiók");
      }

      const token = await getToken(email, password);

      // Determine the HW device_id and type
      const hwDeviceId = device.shellyDeviceId ?? device.deviceId;
      const hwType = hwDeviceId.startsWith("watermeter")
        ? "water"
        : hwDeviceId.startsWith("energymeter")
          ? "main_connection"
          : "main_connection";

      const monthlyData = await fetchMonthlyHistory(
        token,
        hwDeviceId,
        input.monthsBack,
        hwType,
      );

      if (monthlyData.length === 0) {
        return { imported: 0 };
      }

      // Build cumulative readings from monthly consumption
      let cumulativeKwh = 0;
      let imported = 0;

      for (const entry of monthlyData) {
        cumulativeKwh += entry.importKwh;
        const readingDate = `${entry.month}-01`;

        // Check if reading already exists for this date+device
        const existing = await ctx.db.query.meterReadings.findFirst({
          where: and(
            eq(meterReadings.propertyId, device.propertyId),
            eq(meterReadings.utilityType, device.utilityType),
            eq(meterReadings.readingDate, readingDate),
            eq(meterReadings.source, "smart_mqtt"),
          ),
        });
        if (existing) continue;

        // Find prev reading for consumption calc
        const prev = await ctx.db.query.meterReadings.findFirst({
          where: and(
            eq(meterReadings.propertyId, device.propertyId),
            eq(meterReadings.utilityType, device.utilityType),
          ),
          orderBy: [desc(meterReadings.readingDate)],
        });

        const consumption = entry.importKwh;
        const value = prev ? prev.value + consumption : cumulativeKwh;

        await ctx.db.insert(meterReadings).values({
          propertyId: device.propertyId,
          utilityType: device.utilityType,
          value: Math.round(value * 100) / 100,
          prevValue: prev?.value ?? null,
          consumption: Math.round(consumption * 100) / 100,
          readingDate,
          source: "smart_mqtt",
          meterInfoId: device.meterInfoId,
        });

        imported++;
      }

      // Log import
      await ctx.db.insert(smartMeterLogs).values({
        deviceId: device.deviceId,
        source: "homewizard",
        rawPayload: JSON.stringify({ monthsBack: input.monthsBack, months: monthlyData.length }),
        parsedValue: cumulativeKwh,
        finalValue: cumulativeKwh,
        status: "ok",
      });

      return { imported, months: monthlyData.length };
    }),
});
