"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Droplets,
  FileText,
  Home,
  KeyRound,
  Mail,
  Wallet,
  Zap,
} from "lucide-react";

import { api } from "@/trpc/react";

const steps = [
  { key: "tenant", label: "Bérlő", eyebrow: "01" },
  { key: "readings", label: "Mérőórák", eyebrow: "02" },
  { key: "contract", label: "Dokumentumok", eyebrow: "03" },
  { key: "keys", label: "Átadás", eyebrow: "04" },
];

function StepBadge({
  active,
  completed,
  index,
  label,
  eyebrow,
}: {
  active: boolean;
  completed: boolean;
  index: number;
  label: string;
  eyebrow: string;
}) {
  return (
    <div className="relative flex flex-1 items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
          completed || active
            ? "bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(99,102,241,0.25)]"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </p>
        <p className={`truncate text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
          {label}
        </p>
      </div>
    </div>
  );
}

function SurfaceCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_20px_50px_rgba(0,0,0,0.28)] ${className}`}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </span>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

function inputClassName() {
  return "h-12 w-full rounded-2xl border border-border/60 bg-background/80 px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10";
}

function PropertyCover({
  title,
  imageUrl,
}: {
  title: string;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" />;
  }

  return (
    <div className="h-full w-full bg-[linear-gradient(135deg,rgba(70,72,212,0.92),rgba(111,251,190,0.42)),radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_42%)]" />
  );
}

export default function MoveInWizardPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);
  const [step, setStep] = useState(0);

  const { data: property, isLoading } = api.property.get.useQuery({ id: propertyId });

  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState(new Date().toISOString().split("T")[0]!);
  const [depositAmount, setDepositAmount] = useState("");
  const [sendInvitation, setSendInvitation] = useState(false);

  const moveIn = api.tenancy.moveIn.useMutation({
    onSuccess: () => {
      router.refresh();
      router.push(`/properties/${propertyId}`);
    },
  });

  const handleFinish = () => {
    moveIn.mutate({
      propertyId,
      tenantEmail: tenantEmail || undefined,
      tenantName: tenantName || undefined,
      tenantPhone: tenantPhone || undefined,
      moveInDate,
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
      sendInvitation,
    });
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-10">
        <div className="h-10 w-52 animate-pulse rounded-full bg-muted" />
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="h-64 animate-pulse rounded-[32px] bg-muted" />
          <div className="h-64 animate-pulse rounded-[32px] bg-muted" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="mx-auto max-w-2xl">
        <SurfaceCard>
          <h1 className="text-2xl font-semibold tracking-tight">Átadás-átvétel</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Az ingatlan nem található, vagy nincs hozzáférésed.
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Vissza
          </button>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.10),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.74))] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(52,211,153,0.10),transparent_36%),linear-gradient(180deg,rgba(2,6,23,0.82),rgba(2,6,23,0.72))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.32)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                Átadás-átvételi folyamat
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                Beköltözési jegyzőkönyv
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Stitch-szerű, tiszta wizard a bérlő indításához: bérlői adatok,
                nyitó mérőállások, dokumentumok és kulcsátadás egy folyamatban.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] bg-background/80 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Ingtalan
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight">{property.name}</p>
              </div>
              <div className="rounded-[24px] bg-background/80 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Kezdés
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight">{moveInDate}</p>
              </div>
              <div className="rounded-[24px] bg-background/80 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Aktív bérlet
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight">
                  {property.tenancies.some((tenancy) => tenancy.active) ? "Van" : "Nincs"}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] bg-card/85 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
            <div className="relative aspect-[4/3]">
              <PropertyCover title={property.name} imageUrl={property.avatarUrl} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              <div className="absolute inset-x-5 bottom-5">
                <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
                  Ingatlan profil
                </div>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  {property.name}
                </p>
                <p className="mt-1 text-sm text-white/72">
                  {property.address || "Nincs cím megadva"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {steps.map((item, index) => (
            <div key={item.key} className="flex flex-1 items-center gap-3">
              <StepBadge
                active={index === step}
                completed={index < step}
                index={index}
                label={item.label}
                eyebrow={item.eyebrow}
              />
              {index < steps.length - 1 ? (
                <div className="hidden h-px flex-1 bg-border/60 sm:block" />
              ) : null}
            </div>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <SurfaceCard className="min-h-[420px]">
          {step === 0 ? (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Bérlői profil
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Ki fog beköltözni?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add meg a bérlő adatait. Az email opcionális — ha később
                  regisztrál az appba, automatikusan összekapcsoljuk.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Bérlő neve"
                  required
                >
                  <div className="relative">
                    <Home className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="Teljes név"
                      required
                      className={`${inputClassName()} pl-11`}
                    />
                  </div>
                </Field>

                <Field
                  label="Bérlő email"
                  hint="Ha megadod, később meghívhatod az appba."
                >
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={tenantEmail}
                      onChange={(e) => setTenantEmail(e.target.value)}
                      placeholder="berlo@email.com"
                      className={`${inputClassName()} pl-11`}
                    />
                  </div>
                </Field>

                <Field label="Telefonszám">
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="tel"
                      value={tenantPhone}
                      onChange={(e) => setTenantPhone(e.target.value)}
                      placeholder="+36 30 123 4567"
                      className={`${inputClassName()} pl-11`}
                    />
                  </div>
                </Field>

                <Field label="Beköltözés dátuma">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={moveInDate}
                      onChange={(e) => setMoveInDate(e.target.value)}
                      className={`${inputClassName()} pl-11`}
                    />
                  </div>
                </Field>

                <Field label="Kaució összege">
                  <div className="relative">
                    <Wallet className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0"
                      className={`${inputClassName()} pl-11`}
                    />
                  </div>
                </Field>
              </div>

              {tenantEmail && (
                <label className="mt-2 flex items-center gap-3 rounded-2xl bg-background/80 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={sendInvitation}
                    onChange={(e) => setSendInvitation(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">Meghívó küldése az appba</p>
                    <p className="text-xs text-muted-foreground">
                      A bérlő emailben kap regisztrációs linket és hozzáférést az ingatlanhoz.
                    </p>
                  </div>
                </label>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Nyitó mérőállások
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Rögzítsd az induló értékeket
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A beköltözés után azonnal vidd fel a nyitó mérőállásokat, hogy
                  tiszta legyen a bérlő első számlázási ciklusa.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Villany", icon: Zap },
                  { label: "Víz", icon: Droplets },
                  { label: "Gáz / egyéb", icon: Home },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-[24px] bg-background/80 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="mt-4 text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Nyitó állás rögzítése külön bejegyzésként.
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-[26px] bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
                  Ajánlott következő lépés
                </p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/88">
                  A wizard nem tárol itt mérőállást. Nyisd meg a mérőóra
                  rögzítést egy új lapon, és a mentés után gyere vissza ide.
                </p>
                <Link
                  href={`/properties/${propertyId}/readings/new`}
                  className="mt-5 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-primary transition hover:bg-white/90"
                >
                  Mérőállás rögzítése
                </Link>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Dokumentumok
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Szerződés és átadás-átvételi papírok
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  A bérleti szerződés és az átadás-átvétel ide tartozik. Ezeket
                  az ingatlan dokumentumai között érdemes azonnal feltölteni.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  "Bérleti szerződés",
                  "Átadás-átvételi jegyzőkönyv",
                  "Fotódokumentáció / melléklet",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-4 rounded-[22px] bg-background/78 px-4 py-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{item}</p>
                      <p className="text-xs text-muted-foreground">
                        Töltsd fel az ingatlan dokumentumai közé.
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href={`/properties/${propertyId}/documents/new`}
                className="inline-flex rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm font-semibold transition hover:bg-muted/60"
              >
                Dokumentum feltöltése
              </Link>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Záró ellenőrzés
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Kulcsátadás és indítás
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Itt már csak az összefoglaló marad. A beköltözés indításával
                  létrejön az aktív tenancy és a checklist.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] bg-background/78 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">Kulcsátadás</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    A fizikai kulcsátadás legyen meg a jegyzőkönyv és a nyitó
                    mérőállások után.
                  </p>
                </div>
                <div className="rounded-[24px] bg-background/78 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-sm font-semibold">Checklist</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    A rendszer automatikusan létrehozza a beköltözési checklistet.
                  </p>
                </div>
              </div>

              <div className="rounded-[26px] bg-background/70 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Összegzés
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    <span className="font-medium text-muted-foreground">Bérlő:</span>{" "}
                    {tenantName || "Nincs név megadva"}
                  </p>
                  <p>
                    <span className="font-medium text-muted-foreground">Email:</span>{" "}
                    {tenantEmail || "Nincs megadva"}
                  </p>
                  {tenantPhone && (
                    <p>
                      <span className="font-medium text-muted-foreground">Telefon:</span>{" "}
                      {tenantPhone}
                    </p>
                  )}
                  <p>
                    <span className="font-medium text-muted-foreground">Beköltözés:</span>{" "}
                    {moveInDate}
                  </p>
                  <p>
                    <span className="font-medium text-muted-foreground">Kaució:</span>{" "}
                    {depositAmount ? `${Number(depositAmount).toLocaleString("hu-HU")} Ft` : "Nincs megadva"}
                  </p>
                  <p>
                    <span className="font-medium text-muted-foreground">App meghívó:</span>{" "}
                    {sendInvitation && tenantEmail ? "Igen, küldés" : "Nem"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => (step > 0 ? setStep(step - 1) : router.back())}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-medium transition hover:bg-muted/60"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 0 ? "Mégse" : "Vissza"}
            </button>

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && !tenantName}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Tovább
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={moveIn.isPending || !tenantEmail}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {moveIn.isPending ? "Indítás..." : "Beköltözés indítása"}
              </button>
            )}
          </div>
        </SurfaceCard>

        <div className="space-y-6">
          <SurfaceCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Property brief
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{property.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {property.address || "Nincs cím megadva"}
            </p>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Havi bérleti díj</span>
                <span className="font-semibold">
                  {property.monthlyRent
                    ? `${property.monthlyRent.toLocaleString("hu-HU")} Ft`
                    : "Nincs megadva"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Aktív bérlet</span>
                <span className="font-semibold">
                  {property.tenancies.some((tenancy) => tenancy.active) ? "Van" : "Nincs"}
                </span>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Workflow
            </p>
            <div className="mt-4 space-y-3">
              {[
                "Bérlő meghívó email",
                "Nyitó mérőállások",
                "Szerződés feltöltés",
                "Kulcsátadás",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-3 text-sm">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      index <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className={index <= step ? "text-foreground" : "text-muted-foreground"}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
