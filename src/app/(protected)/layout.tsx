import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r border-border bg-sidebar p-4">
        <div className="mb-6">
          <Link href="/dashboard" className="text-xl font-bold">
            Rezsi Figyelő
          </Link>
        </div>
        <nav className="flex flex-col gap-0.5 text-sm">
          <span className="mb-1 mt-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Kezelés
          </span>
          <Link href="/dashboard" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Dashboard
          </Link>
          <Link href="/properties" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Ingatlanok
          </Link>
          <Link href="/readings" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Leolvasások
          </Link>
          <Link href="/payments" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Befizetések
          </Link>
          <Link href="/tenants" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Bérlők
          </Link>
          <Link href="/todos" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Feladatok
          </Link>
          <Link href="/messages" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Üzenetek
          </Link>

          <span className="mb-1 mt-4 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Elemzés
          </span>
          <Link href="/tariffs" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Tarifák
          </Link>
          <Link href="/roi" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            ROI
          </Link>

          <div className="my-3 border-t border-border" />

          <Link href="/billing" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Számlázás
          </Link>
          <Link href="/settings" className="rounded-md px-3 py-2 hover:bg-sidebar-accent">
            Beállítások
          </Link>
        </nav>
        <div className="mt-auto pt-6">
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
