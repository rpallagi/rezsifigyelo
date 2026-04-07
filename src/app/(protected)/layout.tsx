import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-border bg-sidebar p-4">
        <div className="mb-8">
          <Link href="/dashboard" className="text-xl font-bold">
            Rezsi Figyelő
          </Link>
        </div>
        <nav className="flex flex-col gap-1">
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            Dashboard
          </Link>
          <Link
            href="/properties"
            className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            Ingatlanok
          </Link>
          <Link
            href="/tenants"
            className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            Bérlők
          </Link>
          <Link
            href="/tariffs"
            className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            Tarifák
          </Link>
          <Link
            href="/messages"
            className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            Üzenetek
          </Link>
          <Link
            href="/settings"
            className="rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            Beállítások
          </Link>
        </nav>
        <div className="mt-auto pt-8">
          <UserButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
