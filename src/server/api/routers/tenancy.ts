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
  meterReadings,
  landlordProfiles,
} from "@/server/db/schema";
import { createMoveInChecklist } from "@/server/tenancy/invitations";
import { parseLandlordProfileScopeFromHeader } from "@/lib/landlord-profile-scope";
import type { db as DbType } from "@/server/db";

function computeLeaseEndDate(moveInDate: string, leaseMonths: number | undefined): string | null {
  if (!leaseMonths || leaseMonths <= 0) return null;
  const d = new Date(moveInDate);
  d.setMonth(d.getMonth() + leaseMonths);
  return d.toISOString().split("T")[0]!;
}

async function saveHandoverData(
  database: typeof DbType,
  propertyId: number,
  input: {
    initialReadings?: Array<{ utilityType: string; value: number }>;
    conditionRating?: string;
    conditionNotes?: string;
    conditionPhotos?: string[];
    contractUrls?: string[];
    keyCount?: number;
    keyNotes?: string;
    moveInDate: string;
  },
) {
  // Save initial readings
  if (input.initialReadings?.length) {
    for (const reading of input.initialReadings) {
      if (reading.value > 0) {
        await database.insert(meterReadings).values({
          propertyId,
          utilityType: reading.utilityType as "villany",
          value: reading.value,
          readingDate: input.moveInDate,
          source: "manual",
        });
      }
    }
    // Mark checklist step completed
    await database
      .update(handoverChecklists)
      .set({ status: "completed", completedAt: new Date() })
      .where(
        and(
          eq(handoverChecklists.propertyId, propertyId),
          eq(handoverChecklists.step, "meter_readings"),
          eq(handoverChecklists.checklistType, "move_in"),
        ),
      );
  }

  // Save condition assessment in checklist dataJson
  if (input.conditionRating || input.conditionNotes || input.conditionPhotos?.length) {
    await database
      .update(handoverChecklists)
      .set({
        status: "completed",
        completedAt: new Date(),
        dataJson: {
          rating: input.conditionRating,
          notes: input.conditionNotes,
          photos: input.conditionPhotos,
        },
      })
      .where(
        and(
          eq(handoverChecklists.propertyId, propertyId),
          eq(handoverChecklists.step, "handover_protocol"),
          eq(handoverChecklists.checklistType, "move_in"),
        ),
      );
  }

  // Mark contract step if uploaded
  if (input.contractUrls?.length) {
    await database
      .update(handoverChecklists)
      .set({
        status: "completed",
        completedAt: new Date(),
        dataJson: { urls: input.contractUrls },
      })
      .where(
        and(
          eq(handoverChecklists.propertyId, propertyId),
          eq(handoverChecklists.step, "contract_upload"),
          eq(handoverChecklists.checklistType, "move_in"),
        ),
      );
  }

  // Save key handover
  if (input.keyCount != null || input.keyNotes) {
    await database
      .update(handoverChecklists)
      .set({
        status: "completed",
        completedAt: new Date(),
        dataJson: { count: input.keyCount, notes: input.keyNotes },
      })
      .where(
        and(
          eq(handoverChecklists.propertyId, propertyId),
          eq(handoverChecklists.step, "key_handover"),
          eq(handoverChecklists.checklistType, "move_in"),
        ),
      );
  }
}

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
        tenantAddress: z.string().optional(),
        tenantMotherName: z.string().optional(),
        tenantBirthPlace: z.string().optional(),
        tenantBirthDate: z.string().optional(),
        tenantType: z.enum(["individual", "company"]).default("individual"),
        tenantTaxNumber: z.string().optional(),
        // Billing override
        billingName: z.string().optional(),
        billingEmail: z.string().optional(),
        billingAddress: z.string().optional(),
        billingTaxNumber: z.string().optional(),
        billingBuyerType: z.enum(["individual", "company"]).optional(),
        moveInDate: z.string(),
        depositAmount: z.number().optional(),
        leaseMonths: z.number().optional(),
        sendInvitation: z.boolean().default(false),
        // Handover data
        initialReadings: z.array(z.object({
          utilityType: z.string(),
          value: z.number(),
        })).optional(),
        conditionRating: z.string().optional(),
        conditionNotes: z.string().optional(),
        conditionPhotos: z.array(z.string()).optional(),
        contractUrls: z.array(z.string()).optional(),
        keyCount: z.number().optional(),
        keyNotes: z.string().optional(),
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
            tenantAddress: input.tenantAddress,
            tenantMotherName: input.tenantMotherName,
            tenantBirthPlace: input.tenantBirthPlace,
            tenantBirthDate: input.tenantBirthDate,
            tenantType: input.tenantType,
            tenantTaxNumber: input.tenantTaxNumber,
            billingName: input.billingName,
            billingEmail: input.billingEmail,
            billingAddress: input.billingAddress,
            billingTaxNumber: input.billingTaxNumber,
            billingBuyerType: input.billingBuyerType,
            moveInDate: input.moveInDate,
            depositAmount: input.depositAmount,
            leaseMonths: input.leaseMonths,
            leaseEndDate: computeLeaseEndDate(input.moveInDate, input.leaseMonths),
            active: true,
          })
          .returning();
        await createMoveInChecklist(ctx.db, input.propertyId, tenant.id);

        await saveHandoverData(ctx.db, input.propertyId, input);
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
          tenantAddress: input.tenantAddress,
          tenantMotherName: input.tenantMotherName,
          tenantBirthPlace: input.tenantBirthPlace,
          tenantBirthDate: input.tenantBirthDate,
          tenantType: input.tenantType,
          tenantTaxNumber: input.tenantTaxNumber,
          billingName: input.billingName,
          billingEmail: input.billingEmail,
          billingAddress: input.billingAddress,
          billingTaxNumber: input.billingTaxNumber,
          billingBuyerType: input.billingBuyerType,
          moveInDate: input.moveInDate,
          depositAmount: input.depositAmount,
          leaseMonths: input.leaseMonths,
          leaseEndDate: computeLeaseEndDate(input.moveInDate, input.leaseMonths),
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

      await saveHandoverData(ctx.db, input.propertyId, input);
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

  // Update tenant info on an active tenancy
  updateTenant: landlordProcedure
    .input(
      z.object({
        tenancyId: z.number(),
        tenantName: z.string().optional(),
        tenantEmail: z.string().optional(),
        tenantPhone: z.string().optional(),
        tenantAddress: z.string().optional(),
        tenantMotherName: z.string().optional(),
        tenantBirthPlace: z.string().optional(),
        tenantBirthDate: z.string().optional(),
        tenantType: z.enum(["individual", "company"]).optional(),
        tenantTaxNumber: z.string().optional(),
        billingName: z.string().optional(),
        billingEmail: z.string().optional(),
        billingAddress: z.string().optional(),
        billingTaxNumber: z.string().optional(),
        billingBuyerType: z.enum(["individual", "company"]).optional(),
        depositAmount: z.number().optional(),
        leaseMonths: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenancy = await ctx.db.query.tenancies.findFirst({
        where: eq(tenancies.id, input.tenancyId),
      });
      if (!tenancy) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bérleti viszony nem található" });
      }
      await requireLandlordPropertyAccess(ctx, tenancy.propertyId);
      const { tenancyId, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (data.leaseMonths !== undefined && tenancy.moveInDate) {
        updateData.leaseEndDate = computeLeaseEndDate(tenancy.moveInDate, data.leaseMonths);
      }
      await ctx.db.update(tenancies).set(updateData).where(eq(tenancies.id, tenancyId));
      revalidatePath(`/properties/${tenancy.propertyId}`);
      revalidatePath("/tenants");
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

  // Lookup taxpayer by tax number via Számlázz.hu API
  lookupTaxNumber: landlordProcedure
    .input(z.object({ taxNumber: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      // Extract the 8-digit core (torzsszam) — user may enter "12345678" or "12345678-1-23"
      const torzsszam = input.taxNumber.replace(/\D/g, "").slice(0, 8);
      if (torzsszam.length < 8) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Legalább 8 számjegy szükséges" });
      }

      // Find an agent key from any landlord profile
      const profile = await ctx.db.query.landlordProfiles.findFirst({
        where: eq(landlordProfiles.ownerUserId, ctx.dbUser.id),
        columns: { agentKey: true },
      });

      let agentKey = profile?.agentKey ?? "";

      // Fallback to app settings
      if (!agentKey) {
        const { getInvoiceSettings } = await import("@/server/billing/settings");
        const settings = await getInvoiceSettings(ctx.db, ctx.dbUser.id);
        agentKey = settings.agentKey;
      }

      if (!agentKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Nincs Számlázz.hu Agent kulcs beállítva. Állítsd be a kiadói profilban.",
        });
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmltaxpayer xmlns="http://www.szamlazz.hu/xmltaxpayer" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmltaxpayer http://www.szamlazz.hu/docs/xsds/agent/xmltaxpayer.xsd">
  <beallitasok>
    <szamlaagentkulcs>${agentKey}</szamlaagentkulcs>
  </beallitasok>
  <torzsszam>${torzsszam}</torzsszam>
</xmltaxpayer>`;

      const formData = new FormData();
      formData.append(
        "action-szamla_agent_taxpayer",
        new Blob([xml], { type: "application/xml" }),
        "taxpayer.xml",
      );

      const res = await fetch("https://www.szamlazz.hu/szamla/", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Számlázz.hu API hiba (${res.status})`,
        });
      }

      const responseText = await res.text();

      // Parse the XML response
      const validity = responseText.match(/<taxpayerValidity>(.*?)<\/taxpayerValidity>/)?.[1];
      if (validity !== "true") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Érvénytelen adószám vagy nem található adóalany.",
        });
      }

      // Helper to match XML tags with any namespace prefix (ns2:, ns3:, or none)
      const tag = (name: string) => new RegExp(`<(?:\\w+:)?${name}>(.*?)<\\/(?:\\w+:)?${name}>`);

      const name = responseText.match(tag("taxpayerName"))?.[1] ?? "";
      const taxpayerId = responseText.match(tag("taxpayerId"))?.[1] ?? torzsszam;
      const vatCode = responseText.match(tag("vatCode"))?.[1] ?? "";
      const countyCode = responseText.match(tag("countyCode"))?.[1] ?? "";

      // Extract HQ address from first taxpayerAddressItem
      const hqBlock = responseText.match(/<(?:\w+:)?taxpayerAddressItem>[\s\S]*?<(?:\w+:)?taxpayerAddressType>HQ<\/(?:\w+:)?taxpayerAddressType>[\s\S]*?<(?:\w+:)?taxpayerAddress>([\s\S]*?)<\/(?:\w+:)?taxpayerAddress>/)?.[1] ?? "";
      const postalCode = hqBlock.match(tag("postalCode"))?.[1] ?? "";
      const city = hqBlock.match(tag("city"))?.[1] ?? "";
      const streetName = hqBlock.match(tag("streetName"))?.[1] ?? "";
      const publicPlaceCategory = hqBlock.match(tag("publicPlaceCategory"))?.[1] ?? "";
      const number = hqBlock.match(tag("number"))?.[1] ?? "";

      // Build full tax number: 8-1-2 format (e.g. 10537914-4-44)
      const fullTaxNumber = vatCode && countyCode
        ? `${taxpayerId}-${vatCode}-${countyCode}`
        : vatCode
          ? `${taxpayerId}-${vatCode}`
          : taxpayerId;

      // Build address, skip "N/A" public place category
      const place = publicPlaceCategory && publicPlaceCategory !== "N/A"
        ? `${streetName} ${publicPlaceCategory}`.trim()
        : streetName;
      const addressParts = [postalCode, city, place, number].filter(Boolean);
      const fullAddress = addressParts.join(" ").trim();

      return {
        name: name.trim(),
        taxNumber: fullTaxNumber,
        address: fullAddress,
      };
    }),
});
