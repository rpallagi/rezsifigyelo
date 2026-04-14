import { type NextRequest } from "next/server";
import { eq, and, desc } from "drizzle-orm";

import { db } from "@/server/db";
import {
  smartMeterDevices,
  smartMeterLogs,
  meterReadings,
  appSettings,
  properties,
} from "@/server/db/schema";
import { calculateReadingCost } from "@/server/api/tariff-calc";

/**
 * Vercel Cron — polls Shelly Cloud API for all active shelly_cloud devices.
 * Runs daily at 06:00 UTC.
 * - Updates live power for all devices
 * - Creates daily reading for yesterday's consumption
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
    const raw = await res.json() as Record<string, unknown>;
    // Shelly API returns either { data: [...] } or a direct array [...]
    const devices = Array.isArray(raw) ? raw : (raw.data as Array<Record<string, unknown>> | undefined);
    const device = devices?.[0] as { online?: number; status?: Record<string, unknown> } | undefined;
    if (!device) return null;
    const status = device.status ?? {};
    // Gen2: em:0 / emdata:0, Gen1: emeters[] / total_power
    const emStatus = (status["em:0"] as ShellyEmStatus | undefined) ?? (() => {
      // Gen1 SHEM-3: emeters array → synthesize emStatus
      const emeters = status["emeters"] as Array<{ power?: number; voltage?: number; current?: number }> | undefined;
      if (emeters) {
        return {
          total_act_power: emeters.reduce((s, e) => s + (e.power ?? 0), 0),
          a_act_power: emeters[0]?.power,
          b_act_power: emeters[1]?.power,
          c_act_power: emeters[2]?.power,
        } as ShellyEmStatus;
      }
      // Gen1 with total_power directly
      if (typeof status["total_power"] === "number") {
        return { total_act_power: status["total_power"] as number } as ShellyEmStatus;
      }
      return undefined;
    })();
    const emdataStatus = (status["emdata:0"] as ShellyEmdataStatus | undefined) ?? (() => {
      // Gen1: total energy in emeters[].total
      const emeters = status["emeters"] as Array<{ total?: number; total_returned?: number }> | undefined;
      if (emeters) {
        return {
          total_act: emeters.reduce((s, e) => s + (e.total ?? 0), 0),
          total_act_ret: emeters.reduce((s, e) => s + (e.total_returned ?? 0), 0),
        } as ShellyEmdataStatus;
      }
      return undefined;
    })();
    return {
      emStatus,
      emdataStatus,
      online: device.online === 1,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Find all active shelly_cloud devices
  const devices = await db.query.smartMeterDevices.findMany({
    where: and(
      eq(smartMeterDevices.source, "shelly_cloud"),
      eq(smartMeterDevices.isActive, true),
    ),
  });

  if (devices.length === 0) {
    return Response.json({ status: "ok", polled: 0 });
  }

  // Group devices by property owner to find credentials
  // We need to find the landlord for each property to get their Shelly Cloud auth key
  const results: { deviceId: string; status: string; value?: number }[] = [];

  // Cache credentials by userId
  const credentialsCache = new Map<number, { authKey: string; serverHost: string } | null>();

  for (const device of devices) {
    try {
      // Get property to find owner
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, device.propertyId),
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

      // ALWAYS update live power (lastRawValue) — this feeds the live widget
      const livePower = shellyData.emStatus?.total_act_power;
      if (livePower !== undefined) {
        await db.update(smartMeterDevices)
          .set({
            lastSeenAt: new Date(),
            lastRawValue: livePower,
            lastError: null,
          })
          .where(eq(smartMeterDevices.id, device.id));
      }

      // Create daily reading for yesterday's consumption using Shelly Cloud statistics API
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yyyy = yesterday.getFullYear();
      const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
      const dd = String(yesterday.getDate()).padStart(2, "0");
      const readingDate = `${yyyy}-${mm}-${dd}`;

      // Check if reading already exists for yesterday
      const existingReading = await db.query.meterReadings.findFirst({
        where: and(
          eq(meterReadings.propertyId, device.propertyId),
          eq(meterReadings.utilityType, device.utilityType),
          eq(meterReadings.readingDate, readingDate),
          ...(device.meterInfoId ? [eq(meterReadings.meterInfoId, device.meterInfoId)] : []),
        ),
      });

      if (existingReading) {
        results.push({ deviceId: device.deviceId, status: "power_only", value: livePower });
        continue;
      }

      // Fetch yesterday's consumption from Shelly Cloud statistics
      let dailyConsumption: number | null = null;
      try {
        const shellyId = device.shellyDeviceId ?? device.deviceId;
        const statsUrl = `https://${creds.serverHost}/v2/statistics/power-consumption/em-3p?auth_key=${creds.authKey}`;
        const statsRes = await fetch(statsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: shellyId,
            date_range: "day",
            date: `${yyyy}-${mm}-${dd}`,
            channel: device.shellyChannel ?? 0,
          }),
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json() as { data?: { total?: number }; total?: number };
          // total is in Wh, convert to kWh
          const totalWh = statsData.data?.total ?? statsData.total ?? 0;
          dailyConsumption = totalWh / 1000;
          // Handle reversed phases
          if (dailyConsumption < 0) dailyConsumption = Math.abs(dailyConsumption);
        }
      } catch {
        // Fallback to cumulative reading if stats API fails
      }

      // Fallback: use cumulative energy from device status
      if (dailyConsumption === null || dailyConsumption === 0) {
        const rawValue = shellyData.emdataStatus?.total_act;
        if (rawValue !== undefined) {
          const finalValue = rawValue * device.multiplier + device.offset;
          const prevReading = await db.query.meterReadings.findFirst({
            where: and(
              eq(meterReadings.propertyId, device.propertyId),
              eq(meterReadings.utilityType, device.utilityType),
            ),
            orderBy: [desc(meterReadings.readingDate)],
          });
          if (prevReading) {
            dailyConsumption = finalValue - prevReading.value;
            if (dailyConsumption < 0) dailyConsumption = 0;
          }
        }
      }

      if (!dailyConsumption || dailyConsumption <= 0) {
        results.push({ deviceId: device.deviceId, status: "no_consumption", value: livePower });
        continue;
      }

      // Get previous reading for cumulative value
      const prevReading = await db.query.meterReadings.findFirst({
        where: and(
          eq(meterReadings.propertyId, device.propertyId),
          eq(meterReadings.utilityType, device.utilityType),
        ),
        orderBy: [desc(meterReadings.readingDate)],
      });

      const value = prevReading ? prevReading.value + dailyConsumption : dailyConsumption;
      const consumption = Math.round(dailyConsumption * 100) / 100;

      const { costHuf, tariffId } = await calculateReadingCost(db, {
        propertyId: device.propertyId,
        utilityType: device.utilityType,
        meterInfoId: device.meterInfoId,
        consumption,
        readingDate,
      });

      const [reading] = await db
        .insert(meterReadings)
        .values({
          propertyId: device.propertyId,
          utilityType: device.utilityType,
          meterInfoId: device.meterInfoId,
          value: Math.round(value * 100) / 100,
          prevValue: prevReading?.value ?? null,
          consumption,
          costHuf,
          tariffId,
          readingDate,
          source: "smart_mqtt",
          notes: `Auto: Shelly Cloud · ${device.name ?? device.deviceId}`,
        })
        .returning();

      // Log
      await db.insert(smartMeterLogs).values({
        deviceId: device.deviceId,
        source: "shelly_cloud",
        rawPayload: JSON.stringify({ dailyConsumption, readingDate }),
        parsedValue: dailyConsumption,
        finalValue: value,
        status: "ok",
        readingId: reading?.id,
      });

      results.push({ deviceId: device.deviceId, status: "ok", value: consumption });
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

  return Response.json({ status: "ok", ...summary, results });
}
