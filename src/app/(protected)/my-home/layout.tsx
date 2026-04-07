import Link from "next/link";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* Tenant sub-navigation */}
      <nav className="mb-6 flex gap-2 border-b border-border pb-3">
        <Link
          href="/my-home"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Áttekintés
        </Link>
        <Link
          href="/my-home/readings"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Mérőállás
        </Link>
        <Link
          href="/my-home/history"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Előzmények
        </Link>
        <Link
          href="/my-home/chat"
          className="rounded-md px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Üzenetek
        </Link>
      </nav>
      {children}
    </div>
  );
}
