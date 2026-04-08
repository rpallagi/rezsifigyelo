import { and, asc, eq } from "drizzle-orm";

import type { db } from "@/server/db";
import {
  handoverChecklists,
  tenantInvitations,
  tenancies,
  users,
} from "@/server/db/schema";

const moveInChecklistSteps = [
  "meter_readings",
  "handover_protocol",
  "key_handover",
  "contract_upload",
] as const;

export async function createMoveInChecklist(
  database: typeof db,
  propertyId: number,
  tenantId: number,
) {
  for (const step of moveInChecklistSteps) {
    await database.insert(handoverChecklists).values({
      propertyId,
      tenantId,
      checklistType: "move_in",
      step,
    });
  }
}

export async function activatePendingTenantInvitations(
  database: typeof db,
  dbUser: typeof users.$inferSelect,
) {
  let invitations: Awaited<
    ReturnType<typeof database.query.tenantInvitations.findMany>
  > = [];

  try {
    invitations = await database.query.tenantInvitations.findMany({
      where: and(
        eq(tenantInvitations.tenantEmail, dbUser.email),
        eq(tenantInvitations.status, "pending"),
      ),
      orderBy: [asc(tenantInvitations.createdAt)],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("tenant_invitation")) {
      return dbUser;
    }
    throw error;
  }

  if (invitations.length === 0) {
    return dbUser;
  }

  let activeUser = dbUser;
  if (dbUser.role !== "tenant") {
    const [updatedUser] = await database
      .update(users)
      .set({ role: "tenant" })
      .where(eq(users.id, dbUser.id))
      .returning();

    if (updatedUser) {
      activeUser = updatedUser;
    }
  }

  for (const invitation of invitations) {
    const existingTenancy = await database.query.tenancies.findFirst({
      where: and(
        eq(tenancies.propertyId, invitation.propertyId),
        eq(tenancies.active, true),
      ),
    });

    if (!existingTenancy) {
      await database.insert(tenancies).values({
        propertyId: invitation.propertyId,
        tenantId: activeUser.id,
        moveInDate: invitation.moveInDate,
        depositAmount: invitation.depositAmount,
        active: true,
      });

      await createMoveInChecklist(database, invitation.propertyId, activeUser.id);
    }

    await database
      .update(tenantInvitations)
      .set({
        invitedUserId: activeUser.id,
        status: "accepted",
        acceptedAt: new Date(),
      })
      .where(eq(tenantInvitations.id, invitation.id));
  }

  return activeUser;
}
