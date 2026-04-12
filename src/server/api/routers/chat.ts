import { z } from "zod";
import { eq, and, desc, ne, inArray } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure, landlordProcedure } from "@/server/api/trpc";
import { requirePropertyAccess } from "@/server/api/access";
import { chatMessages, properties, tenancies } from "@/server/db/schema";
import { sendEmail } from "@/server/email/send";

export const chatRouter = createTRPCRouter({
  // Overview for the messages page — one row per property with last message + unread count
  listOverview: landlordProcedure.query(async ({ ctx }) => {
    const props = await ctx.db.query.properties.findMany({
      where: and(eq(properties.landlordId, ctx.dbUser.id), eq(properties.archived, false)),
      with: {
        tenancies: { where: (t, { eq }) => eq(t.active, true), with: { tenant: true } },
      },
      orderBy: (p, { asc }) => [asc(p.name)],
    });
    if (props.length === 0) return [];

    const propertyIds = props.map((p) => p.id);

    // All messages for these properties (landlord always has small N)
    const allMessages = await ctx.db.query.chatMessages.findMany({
      where: inArray(chatMessages.propertyId, propertyIds),
      orderBy: [desc(chatMessages.createdAt)],
    });

    // Aggregate per-property
    const byId = new Map<number, { lastMessage: string | null; lastAt: Date | null; unread: number; total: number }>();
    for (const m of allMessages) {
      const existing = byId.get(m.propertyId) ?? { lastMessage: null, lastAt: null, unread: 0, total: 0 };
      if (!existing.lastAt) {
        existing.lastMessage = m.message;
        existing.lastAt = m.createdAt;
      }
      existing.total += 1;
      if (!m.isRead && m.senderId !== ctx.dbUser.id) existing.unread += 1;
      byId.set(m.propertyId, existing);
    }

    return props.map((p) => {
      const l = byId.get(p.id);
      const tenancy = p.tenancies[0];
      const tenantName =
        [tenancy?.tenant?.firstName, tenancy?.tenant?.lastName].filter(Boolean).join(" ").trim() ||
        tenancy?.tenantName ||
        tenancy?.tenant?.email ||
        tenancy?.tenantEmail ||
        null;
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        avatarUrl: p.avatarUrl,
        tenantName,
        lastMessage: l?.lastMessage ?? null,
        lastAt: l?.lastAt ?? null,
        unread: Number(l?.unread ?? 0),
        total: Number(l?.total ?? 0),
      };
    });
  }),

  list: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      return ctx.db.query.chatMessages.findMany({
        where: eq(chatMessages.propertyId, input.propertyId),
        with: { sender: true },
        orderBy: [desc(chatMessages.createdAt)],
        limit: 100,
      });
    }),

  send: protectedProcedure
    .input(
      z.object({
        propertyId: z.number(),
        message: z.string().min(1),
        attachmentUrl: z.string().optional(),
        attachmentType: z.enum(["image", "document"]).optional(),
        attachmentName: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      const senderType =
        ctx.dbUser.role === "tenant" ? "tenant" : "admin";

      const [msg] = await ctx.db
        .insert(chatMessages)
        .values({
          propertyId: input.propertyId,
          senderId: ctx.dbUser.id,
          senderType,
          message: input.message,
          attachmentUrl: input.attachmentUrl ?? null,
          attachmentType: input.attachmentType ?? null,
          attachmentName: input.attachmentName ?? null,
        })
        .returning();

      // Send email notification to the other party (async, don't block)
      void notifyOtherParty(ctx.db, input.propertyId, senderType, input.message);

      return msg;
    }),

  markRead: protectedProcedure
    .input(z.object({ propertyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await requirePropertyAccess(ctx, input.propertyId);

      await ctx.db
        .update(chatMessages)
        .set({ isRead: true })
        .where(
          and(
            eq(chatMessages.propertyId, input.propertyId),
            eq(chatMessages.isRead, false),
            ne(chatMessages.senderId, ctx.dbUser.id),
          ),
        );
    }),
});

async function notifyOtherParty(
  database: typeof import("@/server/db").db,
  propertyId: number,
  senderType: string,
  messageText: string,
) {
  try {
    const property = await database.query.properties.findFirst({
      where: eq(properties.id, propertyId),
      with: { landlordProfile: true },
    });
    if (!property) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://rezsikovetes.hu";

    if (senderType === "admin") {
      // Landlord sent → email tenant
      const activeTenancy = await database.query.tenancies.findFirst({
        where: and(
          eq(tenancies.propertyId, propertyId),
          eq(tenancies.active, true),
        ),
      });
      const tenantEmail = activeTenancy?.tenantEmail;
      if (tenantEmail) {
        await sendEmail({
          to: tenantEmail,
          subject: `Új üzenet — ${property.name}`,
          html: `<p>Új üzenetet kaptál a <strong>${property.name}</strong> ingatlanhoz:</p><p>"${messageText.slice(0, 200)}"</p><p><a href="${baseUrl}/my-home/chat">Válaszolj itt →</a></p>`,
        });
      }
    } else {
      // Tenant sent → email landlord
      const landlordEmail = property.landlordProfile?.billingEmail ?? property.contactEmail;
      if (landlordEmail) {
        await sendEmail({
          to: landlordEmail,
          subject: `Bérlő üzenete — ${property.name}`,
          html: `<p>A bérlőd üzenetet küldött a <strong>${property.name}</strong> ingatlanhoz:</p><p>"${messageText.slice(0, 200)}"</p><p><a href="${baseUrl}/properties/${propertyId}/chat">Válaszolj itt →</a></p>`,
        });
      }
    }
  } catch (err) {
    console.error("[Chat] Email notification failed:", err);
  }
}
