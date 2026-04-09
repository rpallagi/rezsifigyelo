import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

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
  tenantInvitations,
  handoverChecklists,
} from "@/server/db/schema";
import { createMoveInChecklist } from "@/server/tenancy/invitations";
import { parseLandlordProfileScopeFromHeader } from "@/lib/landlord-profile-scope";

function getBaseUrl(headers: Headers) {
  const origin = headers.get("origin");
  if (origin) return origin;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

export const tenancyRouter = createTRPCRouter({
  pendingInvitations: landlordProcedure.query(async ({ ctx }) => {
    const invitations = await ctx.db.query.tenantInvitations.findMany({
      where: and(
        eq(tenantInvitations.landlordId, ctx.dbUser.id),
        eq(tenantInvitations.status, "pending"),
      ),
      with: {
        property: true,
      },
      orderBy: [desc(tenantInvitations.invitedAt)],
    });

    const scopeProfileIds = parseLandlordProfileScopeFromHeader(
      ctx.headers.get("cookie"),
    );

    if (!scopeProfileIds) {
      return invitations;
    }

    return invitations.filter((invitation) =>
      invitation.property.landlordProfileId
        ? scopeProfileIds.includes(invitation.property.landlordProfileId)
        : false,
    );
  }),

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

  // Move-in: create tenancy + optionally invite
  moveIn: landlordProcedure
    .input(
      z.object({
        propertyId: z.number(),
        tenantEmail: z.string().email().optional(),
        tenantName: z.string().optional(),
        tenantPhone: z.string().optional(),
        moveInDate: z.string(),
        depositAmount: z.number().optional(),
        sendInvitation: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireLandlordPropertyAccess(ctx, input.propertyId);

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

      if (!input.tenantEmail && !input.tenantName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Legalább a bérlő nevét vagy email címét add meg",
        });
      }

      const tenantEmail = input.tenantEmail
        ? normalizeEmailAddress(input.tenantEmail)
        : undefined;

      // Check if tenant already exists as a user
      const tenant = tenantEmail
        ? await ctx.db.query.users.findFirst({
            where: eq(users.email, tenantEmail),
          })
        : undefined;

      // If tenant exists as user, link directly
      if (tenant) {
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
            tenantName: input.tenantName ?? (`${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || null),
            tenantEmail,
            tenantPhone: input.tenantPhone,
            moveInDate: input.moveInDate,
            depositAmount: input.depositAmount,
            active: true,
          })
          .returning();
        await createMoveInChecklist(ctx.db, input.propertyId, tenant.id);

        revalidatePath("/properties");
        revalidatePath(`/properties/${input.propertyId}`);
        return { success: true, message: "Beköltözés elindítva", tenancy };
      }

      // Create offline tenancy (no user account needed)
      const [tenancy] = await ctx.db
        .insert(tenancies)
        .values({
          propertyId: input.propertyId,
          tenantName: input.tenantName,
          tenantEmail,
          tenantPhone: input.tenantPhone,
          moveInDate: input.moveInDate,
          depositAmount: input.depositAmount,
          active: true,
        })
        .returning();
      await createMoveInChecklist(ctx.db, input.propertyId);

      // Optionally send invitation
      if (input.sendInvitation && tenantEmail) {
        const client = await clerkClient();
        const invitation = await client.invitations.createInvitation({
          emailAddress: tenantEmail,
          ignoreExisting: true,
          notify: true,
          redirectUrl: `${getBaseUrl(ctx.headers)}/sign-up`,
        });

        await ctx.db.insert(tenantInvitations).values({
          landlordId: ctx.dbUser.id,
          propertyId: input.propertyId,
          tenantEmail,
          tenantName: input.tenantName,
          moveInDate: input.moveInDate,
          depositAmount: input.depositAmount,
          clerkInvitationId: invitation.id,
          status: "pending",
        });
      }

      revalidatePath("/properties");
      revalidatePath(`/properties/${input.propertyId}`);
      return { success: true, message: "Bérlő felvéve", tenancy };
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
        tenantName: tenancy.tenant
          ? (`${tenancy.tenant.firstName ?? ""} ${tenancy.tenant.lastName ?? ""}`.trim() || null)
          : tenancy.tenantName ?? null,
        tenantEmail: tenancy.tenant?.email ?? tenancy.tenantEmail ?? "",
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

      revalidatePath("/properties");
      revalidatePath(`/properties/${tenancy.propertyId}`);
      return { success: true };
    }),

  // Revoke a pending invitation
  revokeInvitation: landlordProcedure
    .input(z.object({ invitationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.query.tenantInvitations.findFirst({
        where: and(
          eq(tenantInvitations.id, input.invitationId),
          eq(tenantInvitations.landlordId, ctx.dbUser.id),
        ),
      });
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meghívó nem található" });
      }
      await ctx.db
        .update(tenantInvitations)
        .set({ status: "revoked" })
        .where(eq(tenantInvitations.id, input.invitationId));
      revalidatePath("/tenants");
      return { success: true };
    }),

  // Resend invitation
  resendInvitation: landlordProcedure
    .input(z.object({ invitationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.query.tenantInvitations.findFirst({
        where: and(
          eq(tenantInvitations.id, input.invitationId),
          eq(tenantInvitations.landlordId, ctx.dbUser.id),
          eq(tenantInvitations.status, "pending"),
        ),
      });
      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meghívó nem található" });
      }
      const client = await clerkClient();
      await client.invitations.createInvitation({
        emailAddress: invitation.tenantEmail,
        ignoreExisting: true,
        notify: true,
        redirectUrl: `${getBaseUrl(ctx.headers)}/sign-up`,
      });
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
