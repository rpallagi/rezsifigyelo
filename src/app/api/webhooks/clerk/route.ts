import { Webhook } from "svix";
import { headers } from "next/headers";
import { type WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { env } from "@/env";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { stripe } from "@/server/stripe";
import { normalizeEmailAddress } from "@/server/api/access";

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Webhook verification failed", { status: 400 });
  }

  if (evt.type === "user.created") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const primaryEmail = normalizeEmailAddress(
      email_addresses.find((e) => e.id === evt.data.primary_email_address_id)
        ?.email_address ?? email_addresses[0]?.email_address ?? "",
    );

    const existingCustomers = await stripe.customers.search({
      query: `metadata['clerkId']:'${id}'`,
      limit: 1,
    });
    const stripeCustomer =
      existingCustomers.data[0] ??
      (await stripe.customers.create({
        email: primaryEmail,
        name: [first_name, last_name].filter(Boolean).join(" ") || undefined,
        metadata: { clerkId: id },
      }));

    await db
      .insert(users)
      .values({
        clerkId: id,
        email: primaryEmail,
        firstName: first_name ?? null,
        lastName: last_name ?? null,
        imageUrl: image_url ?? null,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: {
          email: primaryEmail,
          firstName: first_name ?? null,
          lastName: last_name ?? null,
          imageUrl: image_url ?? null,
        },
      });

    console.log(`[Clerk Webhook] Created user ${id} with Stripe customer ${stripeCustomer.id}`);
  }

  if (evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const primaryEmail = normalizeEmailAddress(
      email_addresses.find((e) => e.id === evt.data.primary_email_address_id)
        ?.email_address ?? email_addresses[0]?.email_address ?? "",
    );

    await db
      .insert(users)
      .values({
        clerkId: id,
        email: primaryEmail,
        firstName: first_name ?? null,
        lastName: last_name ?? null,
        imageUrl: image_url ?? null,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: {
          email: primaryEmail,
          firstName: first_name ?? null,
          lastName: last_name ?? null,
          imageUrl: image_url ?? null,
        },
      });
  }

  if (evt.type === "user.deleted") {
    const { id } = evt.data;
    if (id) {
      await db.delete(users).where(eq(users.clerkId, id));
    }
  }

  return new Response("OK", { status: 200 });
}
