import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";

import {
  createTRPCRouter,
  landlordProcedure,
  tenantProcedure,
} from "@/server/api/trpc";
import {
  normalizeEmailAddress,
  requireLandlordPropertyAccess,
} from "@/server/api/access";
import {
  tenancies,
  tenantHistory,
  users,
  handoverChecklists,
} from "@/server/db/schema";

export const tenancyRouter = createTRPCRouter({
  list: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.tenancies.findMany({
        where: eq(tenancies.propertyId, input.propertyId),
        with: { tenant: true },
        orderBy: [desc(tenancies.createdAt)],
      });
    }),

  myActive: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tenancies.findFirst({
      where: and(
        eq(tenancies.tenantId, ctx.dbUser.id),
        eq(tenancies.active, true),
      ),
      with: { property: true },
      orderBy: [desc(tenancies.createdAt)],
    });
  }),

  // Move-in: create tenancy + checklist
  moveIn: landlordProcedure
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
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      const tenantEmail = normalizeEmailAddress(input.tenantEmail);
      const existingActiveTenancy = await ctx.db.query.tenancies.findFirst({
        where: and(
          eq(tenancies.propertyId, input.propertyId),
          eq(tenancies.active, true),
        ),
      });
      if (existingActiveTenancy) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This property already has an active tenancy",
        });
      }

      const tenant = await ctx.db.query.users.findFirst({
        where: eq(users.email, tenantEmail),
      });
      if (!tenant) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The tenant must sign up before move-in can be started",
        });
      }

      if (tenant.role !== "tenant") {
        await ctx.db
          .update(users)
          .set({ role: "tenant" })
          .where(eq(users.id, tenant.id));
      }

      const [tenancy] = await ctx.db
        .insert(tenancies)
        .values({
          propertyId: input.propertyId,
          tenantId: tenant.id,
          moveInDate: input.moveInDate,
          depositAmount: input.depositAmount,
          active: true,
        })
        .returning();

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
          tenantId: tenant.id,
          checklistType: "move_in",
          step,
        });
      }

      return { success: true, message: "Beköltözés elindítva", tenancy };
    }),

  // Move-out: end tenancy + archive + checklist
  moveOut: landlordProcedure
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

      if (!tenancy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenancy not found" });
      }

      await requireLandlordPropertyAccess(ctx, tenancy.propertyId);

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
  history: landlordProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

      return ctx.db.query.tenantHistory.findMany({
        where: eq(tenantHistory.propertyId, input.propertyId),
        orderBy: [desc(tenantHistory.createdAt)],
      });
    }),
});
