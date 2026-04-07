import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { appSettings } from "@/server/db/schema";

// HA entity_id prefix → utility_type heuristics
const UTILITY_HINTS: [string, string][] = [
  ["energy", "villany"],
  ["electricity", "villany"],
  ["power", "villany"],
  ["villany", "villany"],
  ["water", "viz"],
  ["viz", "viz"],
  ["gas", "gaz"],
  ["gaz", "gaz"],
];

function guessUtilityType(entityId: string): string {
  const lower = entityId.toLowerCase();
  for (const [hint, type] of UTILITY_HINTS) {
    if (lower.includes(hint)) return type;
  }
  return "egyeb";
}

async function haRequest(
  path: string,
  baseUrl: string,
  token: string,
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`HA API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const homeAssistantRouter = createTRPCRouter({
  // Get HA connection settings
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const url = await ctx.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "ha_base_url"),
    });
    const token = await ctx.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "ha_token"),
    });
    return {
      baseUrl: url?.value ?? "",
      hasToken: !!token?.value,
    };
  }),

  // Save HA connection settings
  saveSettings: protectedProcedure
    .input(
      z.object({
        baseUrl: z.string().url(),
        token: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      for (const [key, value] of [
        ["ha_base_url", input.baseUrl],
        ["ha_token", input.token],
      ] as const) {
        await ctx.db
          .insert(appSettings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: { value },
          });
      }
      return { success: true };
    }),

  // Test connection
  testConnection: protectedProcedure.mutation(async ({ ctx }) => {
    const url = await ctx.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "ha_base_url"),
    });
    const token = await ctx.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "ha_token"),
    });

    if (!url?.value || !token?.value) {
      throw new Error("HA settings not configured");
    }

    const data = (await haRequest("/api/", url.value, token.value)) as {
      message?: string;
    };
    return { success: true, message: data.message ?? "Connected" };
  }),

  // List sensor entities
  listEntities: protectedProcedure.query(async ({ ctx }) => {
    const url = await ctx.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "ha_base_url"),
    });
    const token = await ctx.db.query.appSettings.findFirst({
      where: eq(appSettings.key, "ha_token"),
    });

    if (!url?.value || !token?.value) return [];

    const states = (await haRequest(
      "/api/states",
      url.value,
      token.value,
    )) as { entity_id: string; state: string; attributes: Record<string, unknown> }[];

    // Filter to sensor entities with numeric state
    return states
      .filter(
        (s) =>
          s.entity_id.startsWith("sensor.") &&
          !isNaN(parseFloat(s.state)),
      )
      .map((s) => ({
        entityId: s.entity_id,
        state: s.state,
        unitOfMeasurement:
          (s.attributes.unit_of_measurement as string) ?? "",
        friendlyName:
          (s.attributes.friendly_name as string) ?? s.entity_id,
        guessedUtility: guessUtilityType(s.entity_id),
      }))
      .slice(0, 200);
  }),

  // Get current state of an entity
  getEntityState: protectedProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const url = await ctx.db.query.appSettings.findFirst({
        where: eq(appSettings.key, "ha_base_url"),
      });
      const token = await ctx.db.query.appSettings.findFirst({
        where: eq(appSettings.key, "ha_token"),
      });

      if (!url?.value || !token?.value)
        throw new Error("HA not configured");

      const state = (await haRequest(
        `/api/states/${input.entityId}`,
        url.value,
        token.value,
      )) as { state: string; attributes: Record<string, unknown> };

      return {
        state: state.state,
        unitOfMeasurement:
          (state.attributes.unit_of_measurement as string) ?? "",
        friendlyName:
          (state.attributes.friendly_name as string) ?? input.entityId,
      };
    }),
});
