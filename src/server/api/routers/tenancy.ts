import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
  tenancies,
  tenantHistory,
  users,
  handoverChecklists,
} from "@/server/db/schema";

export const tenancyRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.tenancies.findMany({
        where: eq(tenancies.propertyId, input.propertyId),
        with: { tenant: true },
        orderBy: [desc(tenancies.createdAt)],
      });
    }),

  // Move-in: create tenancy + checklist
  moveIn: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        tenantEmail: z.string().email(),
        tenantName: z.string().optional(),
        moveInDate: z.string(),
        depositAmount: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find or note the tenant (they'll be created via Clerk when they sign up)
      // For now, create a placeholder checklist
      const steps = [
        "meter_readings",
        "handover_protocol",
        "key_handover",
        "contract_upload",
      ];

      // Create checklist items
      for (const step of steps) {
        await ctx.db.insert(handoverChecklists).values({
          propertyId: input.propertyId,
          checklistType: "move_in",
          step,
        });
      }

      return { success: true, message: "Beköltözés indítva" };
    }),

  // Move-out: end tenancy + archive + checklist
  moveOut: protectedProcedure
    .input(
      z.object({
        tenancyId: z.number(),
        moveOutDate: z.string(),
        depositReturned: z.number().optional(),
        depositDeductions: z.number().optional(),
        depositNotes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenancy = await ctx.db.query.tenancies.findFirst({
        where: eq(tenancies.id, input.tenancyId),
        with: { tenant: true, property: true },
      });

      if (!tenancy) throw new Error("Tenancy not found");

      // Archive to tenant history
      await ctx.db.insert(tenantHistory).values({
        propertyId: tenancy.propertyId,
        tenantId: tenancy.tenantId,
        tenantName: `${tenancy.tenant.firstName ?? ""} ${tenancy.tenant.lastName ?? ""}`.trim() || null,
        tenantEmail: tenancy.tenant.email,
        moveInDate: tenancy.moveInDate,
        moveOutDate: input.moveOutDate,
        depositAmount: tenancy.depositAmount,
        depositReturned: input.depositReturned,
        depositDeductions: input.depositDeductions,
        depositNotes: input.depositNotes,
      });

      // Deactivate tenancy
      await ctx.db
        .update(tenancies)
        .set({
          active: false,
          moveOutDate: input.moveOutDate,
        })
        .where(eq(tenancies.id, input.tenancyId));

      // Create move-out checklist
      const steps = [
        "final_readings",
        "condition_assessment",
        "deposit_settlement",
        "key_return",
      ];

      for (const step of steps) {
        await ctx.db.insert(handoverChecklists).values({
          propertyId: tenancy.propertyId,
          tenantId: tenancy.tenantId,
          checklistType: "move_out",
          step,
        });
      }

      return { success: true };
    }),

  // Get tenant history for a property
  history: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.tenantHistory.findMany({
        where: eq(tenantHistory.propertyId, input.propertyId),
        orderBy: [desc(tenantHistory.createdAt)],
      });
    }),
});
