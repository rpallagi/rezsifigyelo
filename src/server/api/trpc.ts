import { initTRPC, TRPCError } from "@trpc/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { isAdmin } from "@/lib/auth/admin";

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const { userId } = await auth();

  return {
    db,
    userId,
    ...opts,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const end = Date.now();

  if (end - start > 500) {
    console.log(`[TRPC] ${path} took ${end - start}ms (slow)`);
  }

  return result;
});

const ensureUserMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  let dbUser = await ctx.db.query.users.findFirst({
    where: eq(users.clerkId, ctx.userId),
  });

  if (!dbUser) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const primaryEmail =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress ?? "";

    const [inserted] = await ctx.db
      .insert(users)
      .values({
        clerkId: clerkUser.id,
        email: primaryEmail,
        firstName: clerkUser.firstName ?? null,
        lastName: clerkUser.lastName ?? null,
        imageUrl: clerkUser.imageUrl ?? null,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: {
          email: primaryEmail,
          firstName: clerkUser.firstName ?? null,
          lastName: clerkUser.lastName ?? null,
          imageUrl: clerkUser.imageUrl ?? null,
        },
      })
      .returning();

    dbUser = inserted;
  }

  if (!dbUser) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to ensure user record",
    });
  }

  return next({ ctx: { userId: ctx.userId, dbUser } });
});

export const publicProcedure = t.procedure.use(timingMiddleware);

export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(ensureUserMiddleware);

const ensureAdminMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const admin = await isAdmin(ctx.userId);
  if (!admin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }

  return next();
});

export const adminProcedure = t.procedure
  .use(timingMiddleware)
  .use(ensureUserMiddleware)
  .use(ensureAdminMiddleware);

/**
 * Landlord procedure — ensures user has role "landlord".
 */
const ensureLandlordMiddleware = t.middleware(async ({ ctx, next }) => {
  const dbUser = (ctx as { dbUser?: typeof users.$inferSelect }).dbUser;
  if (!dbUser || dbUser.role !== "landlord") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Landlord access required" });
  }
  return next();
});

export const landlordProcedure = t.procedure
  .use(timingMiddleware)
  .use(ensureUserMiddleware)
  .use(ensureLandlordMiddleware);

/**
 * Tenant procedure — ensures user has role "tenant".
 */
const ensureTenantMiddleware = t.middleware(async ({ ctx, next }) => {
  const dbUser = (ctx as { dbUser?: typeof users.$inferSelect }).dbUser;
  if (!dbUser || dbUser.role !== "tenant") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Tenant access required" });
  }
  return next();
});

export const tenantProcedure = t.procedure
  .use(timingMiddleware)
  .use(ensureUserMiddleware)
  .use(ensureTenantMiddleware);
