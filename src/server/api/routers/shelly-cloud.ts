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

    const data = await shellyCloudRequest(
      creds.serverHost,
      creds.authKey,
      "/v2/devices/api/get",
      { select: ["status"] },
    );

    const devices = data.data as Array<Record<string, unknown>> | undefined;
    return {
      success: true,
      deviceCount: Array.isArray(devices) ? devices.length : 0,
    };
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
    const creds = await getShellyCloudCredentials(ctx.db, ctx.dbUser.id);
    if (!creds) return [];

    const data = await shellyCloudRequest(
      creds.serverHost,
      creds.authKey,
      "/v2/devices/api/get",
      { select: ["status"] },
    );

    const devices = data.data as Array<{
      id: string;
      type: string;
      code: string;
      name?: string;
      online: number;
      status?: Record<string, unknown>;
    }> | undefined;

    if (!Array.isArray(devices)) return [];

    return devices.map((d) => ({
      id: d.id,
      type: d.type,
      code: d.code,
      name: d.name ?? d.id,
      online: d.online === 1,
      // Extract EM data if available
      emStatus: d.status?.["em:0"] as Record<string, number> | undefined,
    }));
  }),
});
