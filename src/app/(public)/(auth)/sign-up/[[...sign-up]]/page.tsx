import { auth, currentUser } from "@clerk/nextjs/server";
import { SignUp, SignOutButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getSignedInRedirectPath } from "@/lib/auth/redirect";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ __clerk_ticket?: string; __clerk_status?: string }>;
}) {
  const params = await searchParams;
  const hasInvitation = !!params.__clerk_ticket;
  const { userId } = await auth();

  // If user is logged in AND there's no invitation ticket, route them home
  if (userId && !hasInvitation) {
    redirect(await getSignedInRedirectPath(userId));
  }

  // If user is logged in AND there's an invitation ticket, force logout first
  if (userId && hasInvitation) {
    const user = await currentUser();
    const currentEmail = user?.emailAddresses?.[0]?.emailAddress ?? "egy másik account";
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-border/60 bg-card/95 p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold tracking-tight">Másik felhasználóval vagy bejelentkezve</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A meghívó elfogadásához ki kell jelentkezned a jelenlegi fiókból:
          </p>
          <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium">
            {currentEmail}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Utána automatikusan visszajutsz erre az oldalra ahol elfogadhatod a meghívót.
          </p>
          <SignOutButton redirectUrl={`/sign-up?__clerk_ticket=${params.__clerk_ticket}${params.__clerk_status ? `&__clerk_status=${params.__clerk_status}` : ""}`}>
            <button
              type="button"
              className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Kijelentkezés és meghívó elfogadása
            </button>
          </SignOutButton>
        </div>
      </div>
    );
  }

  if (!hasInvitation) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-border/60 bg-card/95 p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold tracking-tight">Csak meghívóval lehet regisztrálni</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            A Rezsi Figyelő egy zárt platform. Bérlőként csak akkor tudsz regisztrálni, ha a bérbeadód
            meghívót küldött neked emailben. Kattints a meghívó linkre az emailedben.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Bérbeadói fiókhoz kérj meghívót az adminisztrátortól.
          </p>
          <Link
            href="/sign-in"
            className="mt-6 inline-flex rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Bejelentkezés
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
