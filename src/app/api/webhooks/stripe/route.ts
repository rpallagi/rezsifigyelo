import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { env } from "@/env";
import { db } from "@/server/db";
import { stripe } from "@/server/stripe";
import { subscriptions, users } from "@/server/db/schema";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Webhook verification failed", { status: 400 });
  }

  const upsertSubscription = async (
    sub: Stripe.Subscription,
  ) => {
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer.id;

    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return;

    const clerkId = (customer.metadata as { clerkId?: string }).clerkId;
    if (!clerkId) return;

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });
    if (!dbUser) return;

    const statusMap: Record<string, typeof subscriptions.$inferInsert.status> =
      {
        active: "active",
        canceled: "canceled",
        incomplete: "incomplete",
        past_due: "past_due",
        trialing: "trialing",
        unpaid: "unpaid",
        paused: "paused",
      };

    const firstItem = sub.items.data[0];
    const currentPeriodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000)
      : null;
    const currentPeriodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null;

    await db
      .insert(subscriptions)
      .values({
        userId: dbUser.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        stripePriceId: firstItem?.price.id,
        status: statusMap[sub.status] ?? "incomplete",
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      })
      .onConflictDoUpdate({
        target: subscriptions.stripeSubscriptionId,
        set: {
          stripePriceId: firstItem?.price.id,
          status: statusMap[sub.status] ?? "incomplete",
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await upsertSubscription(sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await db
        .update(subscriptions)
        .set({ status: "canceled" })
        .where(
          eq(
            subscriptions.stripeSubscriptionId,
            event.data.object.id,
          ),
        );
      break;
    case "invoice.payment_failed": {
      const invoice = event.data.object as unknown as { subscription?: string };
      if (invoice.subscription) {
        await db
          .update(subscriptions)
          .set({ status: "past_due" })
          .where(
            eq(
              subscriptions.stripeSubscriptionId,
              invoice.subscription,
            ),
          );
      }
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
