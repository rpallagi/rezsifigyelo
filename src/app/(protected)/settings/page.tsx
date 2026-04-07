import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Beállítások</h1>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Link
          href="/settings/home-assistant"
          className="rounded-lg border border-border p-6 hover:bg-secondary/50"
        >
          <h3 className="font-semibold">Home Assistant</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Okos mérők csatlakoztatása HA-n keresztül
          </p>
        </Link>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Profil</h2>
      <UserProfile />
    </div>
  );
}
