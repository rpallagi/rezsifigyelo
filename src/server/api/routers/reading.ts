import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, lt, lte } from "drizzle-orm";

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
    return rows;
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
