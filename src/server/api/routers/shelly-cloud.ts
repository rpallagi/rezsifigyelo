import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, landlordProcedure } from "@/server/api/trpc";
import { appSettings } from "@/server/db/schema";

function getShellySettingsKeys(userId: number) {
  return {
    authKey: `shelly_cloud_auth_key:${userId}`,
    serverHost: `shelly_cloud_server:${userId}`,
  };
}

export async function getShellyCloudCredentials(
  db: typeof import("@/server/db").db,
  userId: number,
) {
  const keys = getShellySettingsKeys(userId);
  const [authKeyRow, serverRow] = await Promise.all([
    db.query.appSettings.findFirst({ where: eq(appSettings.key, keys.authKey) }),
    db.query.appSettings.findFirst({ where: eq(appSettings.key, keys.serverHost) }),
  ]);
  if (!authKeyRow?.value || !serverRow?.value) return null;
  return { authKey: authKeyRow.value, serverHost: serverRow.value };
}

async function shellyCloudRequest(
  serverHost: string,
  authKey: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const url = `https://${serverHost}${path}?auth_key=${authKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Shelly Cloud API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

export const shellyCloudRouter = createTRPCRouter({
  // Import historical monthly consumption data from Shelly Cloud
  importHistory: landlordProcedure
    .input(z.object({
      smartMeterId: z.number(),
      yearsBack: z.number().int().min(1).max(10).default(3),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get smart meter device
      const device = await ctx.db.query.smartMeterDevices.findFirst({
        where: (d, { eq }) => eq(d.id, input.smartMeterId),
      });
      if (!device) throw new Error("Eszköz nem található");
      if (device.source !== "shelly_cloud" || !device.shellyDeviceId || !device.shellyAuthKey || !device.shellyServer) {
        throw new Error("Csak Shelly Cloud eszközhöz használható");
      }

      const host = device.shellyServer.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - input.yearsBack;

      // Determine reversed phases — compute per-channel and flip signs
      const reversed = new Set((device.shellyReversedPhases ?? "").split(",").map(s => s.trim().toUpperCase()).filter(Boolean));
      const hasReversedPhases = reversed.size > 0;

      const allMonthly = new Map<string, number>();

      for (let year = startYear; year <= currentYear; year++) {
        const dateFrom = `${year}-01-01`;
        const dateTo = year === currentYear
          ? new Date().toISOString().split("T")[0]
          : `${year}-12-31`;

        // Iterate per-channel if device has reversed phases; otherwise use sum
        const channels: Array<{ ch: number; phase: "A" | "B" | "C" }> = hasReversedPhases
          ? [{ ch: 0, phase: "A" }, { ch: 1, phase: "B" }, { ch: 2, phase: "C" }]
          : [{ ch: 0, phase: "A" }]; // channel 0 returns sum for 3-phase devices

        for (const { ch, phase } of channels) {
          const url = `https://${host}/v2/statistics/power-consumption/em-3p?id=${device.shellyDeviceId}&channel=${ch}&date_range=custom&date_from=${dateFrom}&date_to=${dateTo}&auth_key=${device.shellyAuthKey}`;

          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = (await res.json()) as {
              history?: Array<Array<{ datetime: string; consumption?: number; reversed?: number; missing?: boolean }>>;
              sum?: Array<{ datetime: string; consumption: number; reversed?: number }>;
            };

            // When querying per-channel, use history[0] (the requested channel)
            // When using sum mode, use sum if available
            const source = hasReversedPhases
              ? (data.history?.[0] ?? [])
              : (data.sum && data.sum.length > 0 ? data.sum : (data.history?.[0] ?? []));

            for (const rawEntry of source) {
              const entry = rawEntry as { datetime: string; consumption?: number; reversed?: number; missing?: boolean };
              if (entry.missing) continue;

              // For reversed phase, use 'reversed' field (what was "returned" to grid
              // is actually what was consumed); for normal phase, use consumption
              const wh = hasReversedPhases && reversed.has(phase)
                ? (entry.reversed ?? 0)
                : (entry.consumption ?? 0);

              if (wh <= 0) continue;
              const monthKey = entry.datetime.split(" ")[0]!;
              const kwh = Math.round((wh / 1000) * 100) / 100;
              const existing = allMonthly.get(monthKey) ?? 0;
              allMonthly.set(monthKey, existing + kwh);
            }
          } catch {
            // skip channel on error
          }

          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (allMonthly.size === 0) {
        return { imported: 0, message: "Nincs elérhető historikus adat." };
      }

      // Clear existing readings for this property+utility before inserting
      // (only auto-imported ones to avoid deleting manual entries)
      const { meterReadings } = await import("@/server/db/schema");
      const { eq, and, like } = await import("drizzle-orm");
      await ctx.db.delete(meterReadings).where(and(
        eq(meterReadings.propertyId, device.propertyId),
        eq(meterReadings.utilityType, device.utilityType),
        like(meterReadings.notes, "Shelly Cloud: %"),
      ));

      // Get current device total (for cumulative value)
      let currentTotalKwh = 0;
      try {
        const statusRes = await fetch(
          `https://${host}/v2/devices/api/get?auth_key=${device.shellyAuthKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: [device.shellyDeviceId], select: ["status"] }),
          },
        );
        if (statusRes.ok) {
          const statusData = (await statusRes.json()) as Array<{
            status?: {
              "emdata:0"?: { total_act?: number };
              total?: number; // Gen1
              emeters?: Array<{ total?: number }>;
            };
          }>;
          const s = statusData[0]?.status;
          const gen2Total = s?.["emdata:0"]?.total_act;
          const gen1Total = s?.emeters?.reduce((sum, e) => sum + (e.total ?? 0), 0);
          currentTotalKwh = (gen2Total ?? gen1Total ?? 0) / 1000;
        }
      } catch {
        // use sum of monthly as fallback
      }

      const sortedMonths = [...allMonthly.entries()].sort(([a], [b]) => a.localeCompare(b));
      const totalMonthlyKwh = sortedMonths.reduce((s, [, kwh]) => s + kwh, 0);

      // If we don't have current total, use sum of monthly as total
      const realTotal = currentTotalKwh > 0 ? currentTotalKwh : totalMonthlyKwh;
      let cumulative = realTotal - totalMonthlyKwh;

      let prevValue: number | null = null;
      for (const [date, kwh] of sortedMonths) {
        cumulative += kwh;
        const val = Math.round(cumulative * 100) / 100;
        await ctx.db.insert(meterReadings).values({
          propertyId: device.propertyId,
          utilityType: device.utilityType,
          value: val,
          prevValue,
          consumption: kwh,
          readingDate: date,
          source: "smart_mqtt",
          notes: `Shelly Cloud: ${date.slice(0, 7)}`,
        });
        prevValue = val;
      }

      return {
        imported: sortedMonths.length,
        firstMonth: sortedMonths[0]?.[0],
        lastMonth: sortedMonths[sortedMonths.length - 1]?.[0],
        totalKwh: Math.round(totalMonthlyKwh * 10) / 10,
      };
    }),

  // Test credentials and return device list — does NOT save anything
  connectShelly: landlordProcedure
    .input(z.object({ authKey: z.string().min(1), serverHost: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const host = input.serverHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const url = `https://${host}/interface/device/list?auth_key=${input.authKey}`;

      let res: Response;
      try {
        res = await fetch(url);
      } catch (err) {
        throw new Error(`Hálózati hiba: ${err instanceof Error ? err.message : "ismeretlen"}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = (await res.json()) as {
        isok?: boolean;
        data?: {
          devices?: Record<string, {
            id: string;
            name?: string;
            type?: string;
            cloud_online?: boolean;
          }>;
        };
      };
      if (!data.isok) throw new Error("Érvénytelen auth key vagy szerver");

      const devs = data.data?.devices;
      if (!devs || Object.keys(devs).length === 0) {
        throw new Error("Nincs eszköz a fiókban");
      }

      return Object.entries(devs).map(([id, dev]) => ({
        id,
        name: dev.name ?? id,
        type: dev.type ?? "unknown",
        online: Boolean(dev.cloud_online),
      }));
    }),

  getSettings: landlordProcedure.query(async ({ ctx }) => {
    const creds = await getShellyCloudCredentials(ctx.db, ctx.dbUser.id);
    return {
      serverHost: creds?.serverHost ?? "",
      hasAuthKey: !!creds?.authKey,
    };
  }),

  saveSettings: landlordProcedure
    .input(
      z.object({
        authKey: z.string().min(1),
        serverHost: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const keys = getShellySettingsKeys(ctx.dbUser.id);
      for (const [key, value] of [
        [keys.authKey, input.authKey],
        [keys.serverHost, input.serverHost],
      ] as const) {
        await ctx.db
          .insert(appSettings)
          .values({ key, value })
          .onConflictDoUpdate({ target: appSettings.key, set: { value } });
      }
      return { success: true };
    }),

  testConnection: landlordProcedure.mutation(async ({ ctx }) => {
    const creds = await getShellyCloudCredentials(ctx.db, ctx.dbUser.id);
    if (!creds) throw new Error("Shelly Cloud nincs konfigurálva");

    const url = `https://${creds.serverHost}/interface/device/list?auth_key=${creds.authKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Hiba: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as {
      isok?: boolean;
      data?: { devices?: Record<string, unknown> };
    };
    if (!data.isok) throw new Error("Érvénytelen API kulcs vagy szerver");

    const deviceCount = data.data?.devices ? Object.keys(data.data.devices).length : 0;
    return { success: true, deviceCount };
  }),

  getLivePower: landlordProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Try per-device credentials first (new approach)
      const device = await ctx.db.query.smartMeterDevices.findFirst({
        where: (d, { eq, and }) => and(
          eq(d.source, "shelly_cloud"),
          eq(d.shellyDeviceId, input.deviceId),
        ),
      });

      let authKey: string | undefined;
      let serverHost: string | undefined;
      if (device?.shellyAuthKey && device.shellyServer) {
        authKey = device.shellyAuthKey;
        serverHost = device.shellyServer;
      } else {
        // Fallback: user-level credentials
        const creds = await getShellyCloudCredentials(ctx.db, ctx.dbUser.id);
        if (creds) {
          authKey = creds.authKey;
          serverHost = creds.serverHost;
        }
      }
      if (!authKey || !serverHost) return null;

      try {
        const data = await shellyCloudRequest(
          serverHost,
          authKey,
          "/v2/devices/api/get",
          { ids: [input.deviceId], select: ["status"] },
        );
        const devices = (Array.isArray(data) ? data : (data as { data?: unknown }).data) as
          | Array<{
              id: string;
              online: number;
              status?: Record<string, unknown>;
            }>
          | undefined;
        const apiDevice = devices?.[0];
        if (!apiDevice || apiDevice.online !== 1) return null;

        // Determine which phases are physically reversed (CT flipped)
        const reversed = new Set((device?.shellyReversedPhases ?? "").split(",").map((s: string) => s.trim().toUpperCase()).filter(Boolean));
        const fix = (val: number | undefined, phase: "A" | "B" | "C") => {
          if (val === undefined || val === null) return null;
          return reversed.has(phase) ? Math.abs(val) : val;
        };

        // Gen2 (Shelly Pro 3EM): em:0 object with a/b/c fields
        const em = apiDevice.status?.["em:0"] as Record<string, number> | undefined;
        if (em) {
          const pA = fix(em.a_act_power, "A");
          const pB = fix(em.b_act_power, "B");
          const pC = fix(em.c_act_power, "C");
          const total = (pA ?? 0) + (pB ?? 0) + (pC ?? 0);
          return {
            totalPower: reversed.size > 0 ? total : (em.total_act_power ?? null),
            phaseA: { power: pA, voltage: em.a_voltage ?? null, current: em.a_current ?? null },
            phaseB: { power: pB, voltage: em.b_voltage ?? null, current: em.b_current ?? null },
            phaseC: { power: pC, voltage: em.c_voltage ?? null, current: em.c_current ?? null },
            timestamp: new Date().toISOString(),
          };
        }

        // Gen1 (Shelly EM/3EM): total_power + emeters[] array
        const emeters = apiDevice.status?.emeters as Array<{ power?: number; voltage?: number; current?: number }> | undefined;
        if (emeters) {
          const pA = fix(emeters[0]?.power, "A");
          const pB = fix(emeters[1]?.power, "B");
          const pC = fix(emeters[2]?.power, "C");
          const total = (pA ?? 0) + (pB ?? 0) + (pC ?? 0);
          return {
            totalPower: total,
            phaseA: { power: pA, voltage: emeters[0]?.voltage ?? null, current: emeters[0]?.current ?? null },
            phaseB: { power: pB, voltage: emeters[1]?.voltage ?? null, current: emeters[1]?.current ?? null },
            phaseC: { power: pC, voltage: emeters[2]?.voltage ?? null, current: emeters[2]?.current ?? null },
            timestamp: new Date().toISOString(),
          };
        }

        return null;
      } catch {
        return null;
      }
    }),

  listDevices: landlordProcedure.query(async ({ ctx }) => {
    console.log("[shellyCloud.listDevices] START userId=", ctx.dbUser.id);
    const creds = await getShellyCloudCredentials(ctx.db, ctx.dbUser.id);
    console.log("[shellyCloud.listDevices] creds:", creds ? "yes" : "no");
    if (!creds) return [];

    const host = creds.serverHost.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const url = `https://${host}/interface/device/list?auth_key=${creds.authKey.slice(0, 8)}...`;
    console.log("[shellyCloud.listDevices] URL:", url);

    let res: Response;
    try {
      res = await fetch(`https://${host}/interface/device/list?auth_key=${creds.authKey}`);
    } catch (fetchErr) {
      console.error("[shellyCloud.listDevices] fetch threw:", fetchErr);
      throw new Error(`Network error: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
    }

    console.log("[shellyCloud.listDevices] status:", res.status);
    if (!res.ok) {
      throw new Error(`Shelly Cloud API hiba (${res.status})`);
    }

    const listData = (await res.json()) as {
      isok?: boolean;
      data?: {
        devices?: Record<string, {
          id: string;
          name?: string;
          type?: string;
          gen?: number;
          cloud_online?: boolean;
        }>;
      };
    };

    console.log("[shellyCloud.listDevices] isok:", listData.isok, "count:", listData.data?.devices ? Object.keys(listData.data.devices).length : 0);

    if (!listData.isok || !listData.data?.devices) return [];

    return Object.entries(listData.data.devices).map(([id, dev]) => ({
      id,
      type: dev.type ?? "unknown",
      code: dev.type ?? "",
      name: dev.name ?? id,
      online: dev.cloud_online ?? false,
      emStatus: undefined as { total_act_power: number } | undefined,
    }));
  }),
});
