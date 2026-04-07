import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSignedInRedirectPath } from "@/lib/auth/redirect";

const features = [
  {
    title: "Fotós leolvasás",
    description:
      "Fényképezd le a mérőórádat — a rendszer automatikusan leolvassa az állást (OCR).",
  },
  {
    title: "Automatikus költségszámítás",
    description:
      "Azonnal kiszámolja a várható költséget az aktuális tarifák alapján.",
  },
  {
    title: "ROI kalkulátor",
    description:
      "Számold ki a befektetésed megtérülését és kövesd a break-even pontot.",
  },
  {
    title: "Villany · Víz · Gáz",
    description:
      "Minden közüzemi mérő egy helyen, egységes kezelőfelülettel.",
  },
  {
    title: "Számlázás és fizetés",
    description:
      "Szamlazz.hu integráció, fizetési felszólítások, online fizetés.",
  },
  {
    title: "Távleolvasás",
    description:
      "LoRaWAN, MQTT és Home Assistant integráció automatikus mérőleolvasáshoz.",
  },
];

export default async function LandingPage() {
  const { userId } = await auth();

  if (userId) {
    redirect(await getSignedInRedirectPath(userId));
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Rezsi Figyelő</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-md px-4 py-2 text-sm hover:bg-secondary"
            >
              Bérlő belépés
            </Link>
            <Link
              href="/sign-in"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Bérbeadó
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 pb-20 pt-32">
        <div className="mx-auto max-w-6xl text-center">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium">
              Közüzemi nyilvántartás, egyszerűen
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Tartsd kézben a{" "}
              <span className="bg-gradient-to-r from-green-500 to-blue-500 bg-clip-text text-transparent">
                rezsiköltségeket
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Mérőállás rögzítés, automatikus költségszámítás, bérlői
              kommunikáció és teljes ingatlankezelés — egy helyen,
              okostelefonról is.
            </p>
          </div>

          {/* Two big entry cards */}
          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
            <Link href="/sign-in" className="group">
              <div className="h-full rounded-2xl border border-border bg-card p-8 text-left transition-all hover:border-blue-400 hover:shadow-lg">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500">
                  <svg
                    className="h-7 w-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">Bérlő vagyok</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Rögzítsd a mérőállásaidat pillanatok alatt. Kövesd a
                  fogyasztásodat és költségeidet valós időben.
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary transition-all group-hover:gap-3">
                  Mérőállás rögzítés →
                </div>
              </div>
            </Link>

            <Link href="/sign-in" className="group">
              <div className="h-full rounded-2xl border border-border bg-card p-8 text-left transition-all hover:border-green-400 hover:shadow-lg">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500">
                  <svg
                    className="h-7 w-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold">Bérbeadó vagyok</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Kezeld az ingatlanportfóliódat, kövesd a bevételeidet,
                  számlákat és optimalizáld a hozamodat egyetlen felületen.
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary transition-all group-hover:gap-3">
                  Admin felület →
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/30 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Minden funkció, amire szükséged van
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Rezsikövetés, ingatlankezelés és pénzügyi nyilvántartás egy helyen.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-background p-6"
              >
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h3 className="text-3xl font-bold">Próbáld ki ingyen</h3>
        <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
          Az első ingatlan kezelése ingyenes. Korlátlan ingatlanhoz válaszd a
          Pro csomagot.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-block rounded-lg bg-primary px-8 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90"
        >
          Regisztráció
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>Rezsi Figyelő &copy; 2025 — Közüzemi nyilvántartás és ingatlankezelés, egyszerűen.</p>
      </footer>
    </div>
  );
}
