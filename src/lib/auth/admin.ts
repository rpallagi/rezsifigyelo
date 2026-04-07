import { clerkClient } from "@clerk/nextjs/server";
import { ADMIN_EMAILS } from "./admin-emails";

export { ADMIN_EMAILS };

export async function isAdmin(userId: string): Promise<boolean> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress;

  return primaryEmail != null && ADMIN_EMAILS.includes(primaryEmail as typeof ADMIN_EMAILS[number]);
}
