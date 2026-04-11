import { z } from "zod";
import { eq, and, desc, ne } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { requirePropertyAccess } from "@/server/api/access";
import { chatMessages, properties, tenancies } from "@/server/db/schema";
import { sendEmail } from "@/server/email/send";

export const chatRouter = createTRPCRouter({
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
