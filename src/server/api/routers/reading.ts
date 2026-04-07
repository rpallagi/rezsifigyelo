import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc, lt } from "drizzle-orm";

import {
  createTRPCRouter,
  landlordProcedure,
  protectedProcedure,
} from "@/server/api/trpc";
import { requirePropertyAccess } from "@/server/api/access";
import { meterReadings } from "@/server/db/schema";

export const readingRouter = createTRPCRouter({
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
        limit: z.number().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      const conditions = [eq(meterReadings.propertyId, input.propertyId)];
      if (input.utilityType) {
        conditions.push(eq(meterReadings.utilityType, input.utilityType));
      }

      return ctx.db.query.meterReadings.findMany({
        where: and(...conditions),
        orderBy: [desc(meterReadings.readingDate)],
        limit: input.limit,
        with: { recorder: true, tariff: true },
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
        value: z.number(),
        readingDate: z.string(),
        photoUrl: z.string().optional(),
        notes: z.string().optional(),
        source: z
          .enum(["manual", "tenant", "smart_ttn", "smart_mqtt", "home_assistant"])
          .default("manual"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      // Get previous reading for consumption calc
      const prevReading = await ctx.db.query.meterReadings.findFirst({
        where: and(
          eq(meterReadings.propertyId, input.propertyId),
          eq(meterReadings.utilityType, input.utilityType),
          lt(meterReadings.readingDate, input.readingDate),
        ),
        orderBy: [desc(meterReadings.readingDate)],
      });

      const prevValue = prevReading?.value ?? null;
      const consumption =
        prevValue !== null ? input.value - prevValue : null;

      // Try to find active tariff for cost calculation
      // (simplified — in full app this goes through tariff group)
      const costHuf: number | null = null;
      const tariffId: number | null = null;

      const [reading] = await ctx.db
        .insert(meterReadings)
        .values({
          propertyId: input.propertyId,
          utilityType: input.utilityType,
          value: input.value,
          prevValue: prevValue,
          consumption,
          tariffId,
          costHuf,
          photoUrl: input.photoUrl,
          readingDate: input.readingDate,
          notes: input.notes,
          source: ctx.dbUser.role === "tenant" ? "tenant" : input.source,
          recordedBy: ctx.dbUser.id,
        })
        .returning();

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
