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
      const creds = await getShellyCloudCredentials(ctx.db, ctx.dbUser.id);
      if (!creds) return null;

      try {
        const data = await shellyCloudRequest(
          creds.serverHost,
          creds.authKey,
          "/v2/devices/api/get",
          { ids: [input.deviceId], select: ["status"] },
        );
        const devices = (Array.isArray(data) ? data : (data as { data?: unknown }).data) as
          | Array<{
              id: string;
              online: number;
              status?: { "em:0"?: Record<string, number> };
            }>
          | undefined;
        const device = devices?.[0];
        if (!device || device.online !== 1) return null;

        const em = device.status?.["em:0"];
        if (!em) return null;

        return {
          totalPower: em.total_act_power ?? null,
          phaseA: { power: em.a_act_power ?? null, voltage: em.a_voltage ?? null, current: em.a_current ?? null },
          phaseB: { power: em.b_act_power ?? null, voltage: em.b_voltage ?? null, current: em.b_current ?? null },
          phaseC: { power: em.c_act_power ?? null, voltage: em.c_voltage ?? null, current: em.c_current ?? null },
          timestamp: new Date().toISOString(),
        };
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
