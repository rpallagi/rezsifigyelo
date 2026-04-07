import Link from "next/link";

const features = [
  {
    title: "Mérőállás nyilvántartás",
    description:
      "Rögzítsd a gáz, víz, villany mérőállásokat. Fotóból automatikus leolvasás (OCR).",
  },
  {
    title: "Bérlő kezelés",
    description:
      "Bérlők meghívása, be/kiköltözés workflow, kaució kezelés, bérlő történet.",
  },
  {
    title: "Fizetés követés",
    description:
      "Bérleti díj, közüzemi költségek, készpénz és átutalás is. Automatikus számítás tarifák alapján.",
  },
  {
    title: "Közös költség & Adó",
    description:
      "Közös költség befizetések nyomon követése, ingatlanadó határidők és státusz.",
  },
  {
    title: "Okos mérők",
    description:
      "LoRaWAN (TTN), MQTT és Home Assistant integráció automatikus mérőleolvasáshoz.",
  },
  {
    title: "Karbantartás & Todo",
    description:
      "Karbantartási napló, feladatlista, dokumentum kezelés ingatlanonként.",
  },
  {
    title: "ROI Kalkulátor",
    description:
      "Befektetés megtérülés számítás: vételár, bérleti díj, költségek — egy helyen.",
  },
  {
    title: "Chat",
    description:
      "Közvetlen kommunikáció a bérlőkkel ingatlanonként. Nincs szükség külső appra.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold">Rezsi Figyelő</h1>
          <div className="flex gap-3">
            <Link
              href="/sign-in"
              className="rounded-md px-4 py-2 text-sm hover:bg-secondary"
            >
              Bejelentkezés
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Regisztráció
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
          Tartsd kézben az ingatlanaid rezsiköltségeit
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Közüzemi mérőállás nyilvántartó és bérlő kezelő webapp bérbeadók
          számára. Mérőállás rögzítés, fogyasztás számítás, fizetés követés —
          egy helyen, bárhonnan.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-lg bg-primary px-8 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ingyenes kezdés
          </Link>
          <a
            href="#features"
            className="rounded-lg border border-border px-8 py-3 text-lg hover:bg-secondary"
          >
            Funkciók
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-secondary/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h3 className="text-center text-3xl font-bold">
            Minden ami kell a bérbeadáshoz
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
            Akár 1, akár 50 ingatlant kezelsz — a Rezsi Figyelő skálázódik
            veled.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border bg-background p-6"
              >
                <h4 className="font-semibold">{f.title}</h4>
                <p className="mt-2 text-sm text-muted-foreground">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
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
        <p>
          Rezsi Figyelő — Közüzemi mérőállás nyilvántartó bérbeadóknak
        </p>
      </footer>
    </div>
  );
}
