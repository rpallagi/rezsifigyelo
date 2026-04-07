import { api } from "@/trpc/server";

export default async function DashboardPage() {
  const user = await api.user.me();

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Szia, {user.firstName ?? user.email}!
      </h1>
      <p className="mt-2 text-muted-foreground">
        Üdvözlünk a Rezsi Figyelőben.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Ingatlanok
          </h3>
          <p className="mt-2 text-3xl font-bold">—</p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Aktív bérlők
          </h3>
          <p className="mt-2 text-3xl font-bold">—</p>
        </div>
        <div className="rounded-lg border border-border p-6">
          <h3 className="text-sm font-medium text-muted-foreground">
            Fizetetlen számlák
          </h3>
          <p className="mt-2 text-3xl font-bold">—</p>
        </div>
      </div>
    </div>
  );
}
