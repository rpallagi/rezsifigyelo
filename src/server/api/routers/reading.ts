import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, lt, lte, inArray } from "drizzle-orm";

import {
  createTRPCRouter,
  landlordProcedure,
  protectedProcedure,
} from "@/server/api/trpc";
import { requirePropertyAccess } from "@/server/api/access";
import { meterReadings, meterInfo, properties, tariffs } from "@/server/db/schema";

export const readingRouter = createTRPCRouter({
  listAll: landlordProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: meterReadings.id,
        propertyId: meterReadings.propertyId,
        propertyName: properties.name,
        utilityType: meterReadings.utilityType,
        meterInfoId: meterReadings.meterInfoId,
        meterSerialNumber: meterInfo.serialNumber,
        meterLocation: meterInfo.location,
        meterType: meterInfo.meterType,
        tariffGroupId: meterInfo.tariffGroupId,
        value: meterReadings.value,
        consumption: meterReadings.consumption,
        costHuf: meterReadings.costHuf,
        readingDate: meterReadings.readingDate,
        source: meterReadings.source,
      })
      .from(meterReadings)
      .innerJoin(properties, eq(meterReadings.propertyId, properties.id))
      .leftJoin(meterInfo, eq(meterReadings.meterInfoId, meterInfo.id))
      .where(eq(properties.landlordId, ctx.dbUser.id))
      .orderBy(desc(meterReadings.readingDate))
      .limit(200);

    // Enrich virtual meter readings with calculated consumption
    const virtualMeters = await ctx.db.query.meterInfo.findMany({
      where: eq(meterInfo.meterType, "virtual"),
    });
    if (virtualMeters.length > 0) {
      // Build a map of meterInfoId → virtual meter config
      const vmMap = new Map(virtualMeters.map((vm) => [vm.id, vm]));

      // Get all subtract meter readings for date matching
      const subtractMeterIds = new Set<number>();
      for (const vm of virtualMeters) {
        if (Array.isArray(vm.subtractMeterIds)) {
          (vm.subtractMeterIds as number[]).forEach((id) => subtractMeterIds.add(id));
        }
      }
      const subtractReadings = subtractMeterIds.size > 0
        ? await ctx.db
            .select({
              meterInfoId: meterReadings.meterInfoId,
              readingDate: meterReadings.readingDate,
              consumption: meterReadings.consumption,
            })
            .from(meterReadings)
            .where(inArray(meterReadings.meterInfoId, [...subtractMeterIds]))
        : [];

      // Index subtract readings by meterId+date AND meterId+month
      const subByDate = new Map<string, number>();
      const subByMonth = new Map<string, number>();
      for (const sr of subtractReadings) {
        if (sr.meterInfoId && sr.consumption != null) {
          subByDate.set(`${sr.meterInfoId}:${sr.readingDate}`, sr.consumption);
          // Also index by month (YYYY-MM) — use the latest reading for the month
          const month = sr.readingDate.substring(0, 7);
          const monthKey = `${sr.meterInfoId}:${month}`;
          const existing = subByMonth.get(monthKey);
          if (!existing || sr.readingDate > (existing ? sr.readingDate : "")) {
            subByMonth.set(monthKey, sr.consumption);
          }
        }
      }

      // Get tariff rates for virtual meters
      const tariffRates = new Map<number, number>();
      for (const vm of virtualMeters) {
        if (vm.tariffGroupId) {
          const t = await ctx.db.query.tariffs.findFirst({
            where: and(
              eq(tariffs.tariffGroupId, vm.tariffGroupId),
              eq(tariffs.utilityType, vm.utilityType),
            ),
            orderBy: [desc(tariffs.validFrom)],
          });
          if (t) tariffRates.set(vm.id, t.rateHuf);
        }
      }

      return rows.map((r) => {
        const vm = r.meterInfoId ? vmMap.get(r.meterInfoId) : null;
        if (!vm || !r.consumption) return { ...r, virtualConsumption: null, virtualCostHuf: null };

        const sids = Array.isArray(vm.subtractMeterIds) ? (vm.subtractMeterIds as number[]) : [];
        let subtractTotal = 0;
        const readingMonth = r.readingDate.substring(0, 7);
        for (const sid of sids) {
          // Try exact date first, fallback to month
          subtractTotal += subByDate.get(`${sid}:${r.readingDate}`)
            ?? subByMonth.get(`${sid}:${readingMonth}`)
            ?? 0;
        }
        const calc = Math.max(0, r.consumption - subtractTotal);
        const rate = tariffRates.get(vm.id);
        return {
          ...r,
          virtualConsumption: Math.round(calc * 100) / 100,
          virtualCostHuf: rate ? Math.round(calc * rate * 100) / 100 : null,
        };
      });
    }

    return rows.map((r) => ({ ...r, virtualConsumption: null, virtualCostHuf: null }));
  }),

  list: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        utilityType: z
          .enum([
            "villany",
            "viz",
            "gaz",
            "csatorna",
            "internet",
            "kozos_koltseg",
            "egyeb",
          ])
          .optional(),
        meterInfoId: z.number().optional(),
        limit: z.number().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      const conditions = [eq(meterReadings.propertyId, input.propertyId)];
      if (input.utilityType) {
        conditions.push(eq(meterReadings.utilityType, input.utilityType));
      }
      if (input.meterInfoId !== undefined) {
        conditions.push(eq(meterReadings.meterInfoId, input.meterInfoId));
      }

      return ctx.db.query.meterReadings.findMany({
        where: and(...conditions),
        orderBy: [desc(meterReadings.readingDate)],
        limit: input.limit,
        with: { recorder: true, tariff: true, meterInfo: true },
      });
    }),

  record: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        utilityType: z.enum([
          "villany",
          "viz",
          "gaz",
          "csatorna",
          "internet",
          "kozos_koltseg",
          "egyeb",
        ]),
        meterInfoId: z.number().optional(),
        value: z.number(),
        readingDate: z.string(),
        photoUrl: z.string().optional(),
        photoUrls: z.array(z.string()).optional(),
        notes: z.string().optional(),
        source: z
          .enum(["manual", "tenant", "smart_ttn", "smart_mqtt", "home_assistant"])
          .default("manual"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      // Get previous reading for consumption calc — prefer meter-specific lookup
      const prevReadingConditions = [
        eq(meterReadings.propertyId, input.propertyId),
        eq(meterReadings.utilityType, input.utilityType),
        lt(meterReadings.readingDate, input.readingDate),
      ];
      if (input.meterInfoId !== undefined) {
        prevReadingConditions.push(eq(meterReadings.meterInfoId, input.meterInfoId));
      }

      const prevReading = await ctx.db.query.meterReadings.findFirst({
        where: and(...prevReadingConditions),
        orderBy: [desc(meterReadings.readingDate)],
      });

      const prevValue = prevReading?.value ?? null;
      const consumption =
        prevValue !== null ? input.value - prevValue : null;

      const property = await ctx.db.query.properties.findFirst({
        where: eq(properties.id, input.propertyId),
        columns: {
          tariffGroupId: true,
        },
      });

      // Prefer meter-specific tariff group, fallback to property's
      let effectiveTariffGroupId: number | null = property?.tariffGroupId ?? null;
      if (input.meterInfoId) {
        const meter = await ctx.db.query.meterInfo.findFirst({
          where: eq(meterInfo.id, input.meterInfoId),
          columns: { tariffGroupId: true },
        });
        if (meter?.tariffGroupId) {
          effectiveTariffGroupId = meter.tariffGroupId;
        }
      }

      let costHuf: number | null = null;
      let tariffId: number | null = null;
      if (effectiveTariffGroupId && consumption !== null && consumption >= 0) {
        const activeTariff = await ctx.db.query.tariffs.findFirst({
          where: and(
            eq(tariffs.tariffGroupId, effectiveTariffGroupId),
            eq(tariffs.utilityType, input.utilityType),
            lte(tariffs.validFrom, input.readingDate),
          ),
          orderBy: [desc(tariffs.validFrom)],
        });

        if (activeTariff) {
          tariffId = activeTariff.id;
          costHuf = consumption * activeTariff.rateHuf;
        }
      }

      const [reading] = await ctx.db
        .insert(meterReadings)
        .values({
          propertyId: input.propertyId,
          utilityType: input.utilityType,
          meterInfoId: input.meterInfoId,
          value: input.value,
          prevValue: prevValue,
          consumption,
          tariffId,
          costHuf,
          photoUrl: input.photoUrl ?? input.photoUrls?.[0],
          photoUrls: input.photoUrls,
          readingDate: input.readingDate,
          notes: input.notes,
          source: ctx.dbUser.role === "tenant" ? "tenant" : input.source,
          recordedBy: ctx.dbUser.id,
        })
        .returning();

      if (
        input.utilityType === "viz" &&
        property?.tariffGroupId &&
        consumption !== null &&
        consumption >= 0
      ) {
        const sewerTariff = await ctx.db.query.tariffs.findFirst({
          where: and(
            eq(tariffs.tariffGroupId, property.tariffGroupId),
            eq(tariffs.utilityType, "csatorna"),
            lte(tariffs.validFrom, input.readingDate),
          ),
          orderBy: [desc(tariffs.validFrom)],
        });

        if (sewerTariff) {
          await ctx.db.insert(meterReadings).values({
            propertyId: input.propertyId,
            utilityType: "csatorna",
            meterInfoId: input.meterInfoId,
            value: input.value,
            prevValue,
            consumption,
            tariffId: sewerTariff.id,
            costHuf: consumption * sewerTariff.rateHuf,
            readingDate: input.readingDate,
            notes: "Automatikusan számolva víz alapján",
            source: ctx.dbUser.role === "tenant" ? "tenant" : input.source,
            recordedBy: ctx.dbUser.id,
          });
        }
      }

      return reading;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const reading = await ctx.db.query.meterReadings.findFirst({
        where: eq(meterReadings.id, input.id),
        with: {
          recorder: true,
          tariff: true,
          meterInfo: true,
          property: { columns: { id: true, name: true, landlordId: true } },
        },
      });
      if (!reading) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reading not found" });
      }
      await requirePropertyAccess(ctx, reading.propertyId);
      return reading;
    }),

  update: landlordProcedure
    .input(
      z.object({
        id: z.number(),
        value: z.number().optional(),
        readingDate: z.string().optional(),
        notes: z.string().nullable().optional(),
        photoUrls: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.meterReadings.findFirst({
        where: eq(meterReadings.id, input.id),
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reading not found" });
      }
      await requirePropertyAccess(ctx, existing.propertyId);

      // If value changed, recalc consumption + cost
      const newValue = input.value ?? existing.value;
      const newDate = input.readingDate ?? existing.readingDate;

      let consumption: number | null = existing.consumption;
      let costHuf: number | null = existing.costHuf;
      if (input.value !== undefined || input.readingDate !== undefined) {
        const prevConditions = [
          eq(meterReadings.propertyId, existing.propertyId),
          eq(meterReadings.utilityType, existing.utilityType),
          lt(meterReadings.readingDate, newDate),
        ];
        if (existing.meterInfoId) {
          prevConditions.push(eq(meterReadings.meterInfoId, existing.meterInfoId));
        }
        const prev = await ctx.db.query.meterReadings.findFirst({
          where: and(...prevConditions),
          orderBy: [desc(meterReadings.readingDate)],
        });
        const prevValue = prev?.value ?? null;
        consumption = prevValue !== null ? newValue - prevValue : null;
        if (existing.tariffId && consumption !== null && consumption >= 0) {
          const tariff = await ctx.db.query.tariffs.findFirst({
            where: eq(tariffs.id, existing.tariffId),
          });
          if (tariff) costHuf = consumption * tariff.rateHuf;
        }
      }

      const [updated] = await ctx.db
        .update(meterReadings)
        .set({
          value: newValue,
          readingDate: newDate,
          notes: input.notes === null ? null : (input.notes ?? existing.notes),
          photoUrls: input.photoUrls ?? existing.photoUrls,
          consumption,
          costHuf,
        })
        .where(eq(meterReadings.id, input.id))
        .returning();
      return updated;
    }),

  delete: landlordProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const reading = await ctx.db.query.meterReadings.findFirst({
        where: eq(meterReadings.id, input.id),
      });

      if (!reading) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reading not found",
        });
      }

      await requirePropertyAccess(ctx, reading.propertyId);
      await ctx.db
        .delete(meterReadings)
        .where(eq(meterReadings.id, input.id));
    }),
});
