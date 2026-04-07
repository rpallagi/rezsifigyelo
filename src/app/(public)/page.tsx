import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Rezsi Figyelő</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Közüzemi mérőállás nyilvántartó webapp bérlők és ingatlan tulajdonosok
          számára.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/sign-in"
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground hover:bg-primary/90"
        >
          Bejelentkezés
        </Link>
        <Link
          href="/sign-up"
          className="rounded-lg border border-border px-6 py-3 hover:bg-secondary"
        >
          Regisztráció
        </Link>
      </div>
    </main>
  );
}
