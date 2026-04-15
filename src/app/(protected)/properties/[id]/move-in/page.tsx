"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CurrencyInput } from "@/components/shared/currency-input";
import { TaxNumberInput } from "@/components/shared/tax-number-input";
import { PhoneInput } from "@/components/shared/phone-input";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Droplets,
  FileText,
  Flame,
  KeyRound,
  Upload,
  Wallet,
  Waves,
  X,
  Zap,
} from "lucide-react";

import { api } from "@/trpc/react";
import { PropertyCoverImage } from "@/components/properties/property-cover-image";
import { PhotoGallery } from "@/components/shared/photo-gallery";

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

const utilityMeta: Record<string, { label: string; icon: typeof Zap }> = {
  villany: { label: "Villany", icon: Zap },
  viz: { label: "Víz", icon: Droplets },
  gaz: { label: "Gáz", icon: Flame },
  csatorna: { label: "Csatorna", icon: Waves },
};

const conditionOptions = [
  { value: "excellent", label: "Kiváló" },
  { value: "good", label: "Jó" },
  { value: "average", label: "Átlagos" },
  { value: "needs_renovation", label: "Felújítandó" },
] as const;

async function uploadFile(file: File, folder: string): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) return null;
  const data = (await res.json()) as { url: string };
  return data.url;
}

function PropertyCover({
  title,
  imageUrl,
}: {
  title: string;
  imageUrl?: string | null;
}) {
  return (
    <PropertyCoverImage
      imageUrl={imageUrl}
      title={title}
      className="absolute inset-0 h-full w-full object-cover"
      placeholderClassName="h-full w-full"
      placeholderBackground="linear-gradient(135deg,rgba(70,72,212,0.92),rgba(111,251,190,0.42)),radial-gradient(circle at top right,rgba(255,255,255,0.24),transparent 42%)"
    />
  );
}

export default function MoveInWizardPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const propertyId = Number(params.id);
  const isEditMode = searchParams.get("edit") === "true";
  const [step, setStep] = useState(0);

  const { data: property, isLoading } = api.property.get.useQuery({ id: propertyId });

  const [tenantType, setTenantType] = useState<"individual" | "company">("individual");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantMotherName, setTenantMotherName] = useState("");
  const [tenantBirthPlace, setTenantBirthPlace] = useState("");
  const [tenantBirthDate, setTenantBirthDate] = useState("");
  const [tenantTaxNumber, setTenantTaxNumber] = useState("");
  const [moveInDate, setMoveInDate] = useState(new Date().toISOString().split("T")[0]!);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState<"HUF" | "EUR">("HUF");
  const [leaseMonths, setLeaseMonths] = useState("12");
  const [inflationTracking, setInflationTracking] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState("");
  const [rentCurrency, setRentCurrency] = useState<"HUF" | "EUR">("HUF");
  const [autoBilling, setAutoBilling] = useState(false);
  const [autoBillingDay, setAutoBillingDay] = useState("1");
  const [applySzj, setApplySzj] = useState(false);
  const [sendInvitation, setSendInvitation] = useState(false);
  const [billingSameAsTenant, setBillingSameAsTenant] = useState(true);
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingTaxNumber, setBillingTaxNumber] = useState("");
  const [billingBuyerType, setBillingBuyerType] = useState<"individual" | "company">("individual");

  // Step 1: Meter readings
  const [initialReadings, setInitialReadings] = useState<Record<string, string>>({});

  // Step 2: Condition + documents
  const [conditionRating, setConditionRating] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");
  const [conditionPhotos, setConditionPhotos] = useState<string[]>([]);
  const [contractUrls, setContractUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Step 3: Keys
  const [keyCount, setKeyCount] = useState("");
  const [keyNotes, setKeyNotes] = useState("");

  // Pre-fill from existing active tenancy when in edit mode
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!isEditMode || !property || prefilled) return;
    const activeTenancy = property.tenancies.find((t) => t.active);
    if (!activeTenancy) return;
    setTenantName(activeTenancy.tenantName ?? "");
    setTenantEmail(activeTenancy.tenantEmail ?? "");
    setTenantPhone(activeTenancy.tenantPhone ?? "");
    setTenantAddress(activeTenancy.tenantAddress ?? "");
    setTenantMotherName(activeTenancy.tenantMotherName ?? "");
    setTenantBirthPlace(activeTenancy.tenantBirthPlace ?? "");
    setTenantBirthDate(activeTenancy.tenantBirthDate ?? "");
    setTenantTaxNumber(activeTenancy.tenantTaxNumber ?? "");
    setTenantType((activeTenancy.tenantType as "individual" | "company") ?? "individual");
    setMoveInDate(activeTenancy.moveInDate ?? new Date().toISOString().split("T")[0]!);
    setDepositAmount(activeTenancy.depositAmount?.toString() ?? "");
    setDepositCurrency((activeTenancy.depositCurrency as "HUF" | "EUR") ?? "HUF");
    setLeaseMonths(activeTenancy.leaseMonths?.toString() ?? "12");
    setInflationTracking(activeTenancy.inflationTracking ?? false);
    setApplySzj(activeTenancy.applySzj ?? false);
    // Property-level fields
    setMonthlyRent(property.monthlyRent?.toString() ?? "");
    setRentCurrency((property.rentCurrency as "HUF" | "EUR") ?? "HUF");
    setAutoBilling(property.autoBilling ?? false);
    setAutoBillingDay(String(property.autoBillingDay ?? 1));
    if (activeTenancy.billingName) {
      setBillingSameAsTenant(false);
      setBillingName(activeTenancy.billingName ?? "");
      setBillingEmail(activeTenancy.billingEmail ?? "");
      setBillingAddress(activeTenancy.billingAddress ?? "");
      setBillingTaxNumber(activeTenancy.billingTaxNumber ?? "");
      setBillingBuyerType((activeTenancy.billingBuyerType as "individual" | "company") ?? "individual");
    }
    setPrefilled(true);
  }, [isEditMode, property, prefilled]);

  const contractInputRef = useRef<HTMLInputElement>(null);

  const [moveInError, setMoveInError] = useState("");
  const moveIn = api.tenancy.moveIn.useMutation({
    onSuccess: () => {
      setMoveInError("");
      router.refresh();
      router.push(`/properties/${propertyId}`);
    },
    onError: (err) => {
      setMoveInError(err.message);
    },
  });

  const updateProperty = api.property.update.useMutation();
  const updateTenant = api.tenancy.updateTenant.useMutation({
    onSuccess: () => {
      setMoveInError("");
      router.refresh();
      router.push(`/properties/${propertyId}`);
    },
    onError: (err) => {
      setMoveInError(err.message);
    },
  });

  const handleContractUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls = await Promise.all(
        Array.from(files).map((f) => uploadFile(f, "contracts")),
      );
      setContractUrls((prev) => [...prev, ...urls.filter((u): u is string => u !== null)]);
    } catch {
      // silently ignore
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = async () => {
    if (isEditMode) {
      const activeTenancy = property?.tenancies.find((t) => t.active);
      if (!activeTenancy) return;
      updateTenant.mutate({
        tenancyId: activeTenancy.id,
        tenantName: tenantName || undefined,
        tenantEmail: tenantEmail || undefined,
        tenantPhone: tenantPhone || undefined,
        tenantAddress: tenantAddress || undefined,
        tenantMotherName: tenantMotherName || undefined,
        tenantBirthPlace: tenantBirthPlace || undefined,
        tenantBirthDate: tenantBirthDate || undefined,
        tenantType,
        tenantTaxNumber: tenantTaxNumber || undefined,
        billingName: !billingSameAsTenant ? (billingName || undefined) : undefined,
        billingEmail: !billingSameAsTenant ? (billingEmail || undefined) : undefined,
        billingAddress: !billingSameAsTenant ? (billingAddress || undefined) : undefined,
        billingTaxNumber: !billingSameAsTenant ? (billingTaxNumber || undefined) : undefined,
        billingBuyerType: !billingSameAsTenant ? billingBuyerType : undefined,
        depositAmount: depositAmount ? Number(depositAmount) : undefined,
        depositCurrency,
        leaseMonths: leaseMonths && Number(leaseMonths) > 0 ? Number(leaseMonths) : undefined,
        inflationTracking,
        applySzj,
      });
      // Also update property-level fields (rent, auto-billing)
      if (monthlyRent || autoBilling) {
        await updateProperty.mutateAsync({
          id: propertyId,
          monthlyRent: monthlyRent ? Number(monthlyRent) : undefined,
          rentCurrency,
          autoBilling,
          autoBillingDay: Number(autoBillingDay || 1),
        });
      }
      return;
    }
    moveIn.mutate({
      propertyId,
      tenantEmail: tenantEmail || undefined,
      tenantName: tenantName || undefined,
      tenantPhone: tenantPhone || undefined,
      tenantAddress: tenantAddress || undefined,
      tenantMotherName: tenantMotherName || undefined,
      tenantBirthPlace: tenantBirthPlace || undefined,
      tenantBirthDate: tenantBirthDate || undefined,
      tenantType,
      tenantTaxNumber: tenantTaxNumber || undefined,
      billingName: !billingSameAsTenant ? (billingName || undefined) : undefined,
      billingEmail: !billingSameAsTenant ? (billingEmail || undefined) : undefined,
      billingAddress: !billingSameAsTenant ? (billingAddress || undefined) : undefined,
      billingTaxNumber: !billingSameAsTenant ? (billingTaxNumber || undefined) : undefined,
      billingBuyerType: !billingSameAsTenant ? billingBuyerType : undefined,
      moveInDate,
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
      depositCurrency,
      leaseMonths: leaseMonths && Number(leaseMonths) > 0 ? Number(leaseMonths) : undefined,
      sendInvitation,
      initialReadings: Object.entries(initialReadings)
        .filter(([, v]) => v && Number(v) > 0)
        .map(([utilityType, value]) => ({ utilityType, value: Number(value) })),
      conditionRating: conditionRating || undefined,
      conditionNotes: conditionNotes || undefined,
      conditionPhotos: conditionPhotos.length > 0 ? conditionPhotos : undefined,
      contractUrls: contractUrls.length > 0 ? contractUrls : undefined,
      keyCount: keyCount ? Number(keyCount) : undefined,
      keyNotes: keyNotes || undefined,
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
                  Ingatlan
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
                  {property.address ?? "Nincs cím megadva"}
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

              {/* ━━━ 1. BÉRLŐ ADATAI ━━━ */}
              <fieldset className="rounded-2xl border border-border/60 p-5 space-y-5">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bérlő adatai</legend>

              <div className="flex gap-2">
                {([
                  { value: "individual", label: "Magánszemély" },
                  { value: "company", label: "Cég" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTenantType(opt.value)}
                    className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                      tenantType === opt.value
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                        : "border-border hover:bg-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label={tenantType === "company" ? "Cégnév" : "Bérlő neve"}
                  required
                >
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder={tenantType === "company" ? "Példa Kft." : "Teljes név"}
                    required
                    className={inputClassName()}
                  />
                </Field>

                <Field
                  label="Email"
                  hint="Ha megadod, később meghívhatod az appba."
                >
                  <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder="berlo@email.com"
                    className={inputClassName()}
                  />
                </Field>

                <Field label="Telefonszám">
                  <PhoneInput
                    value={tenantPhone}
                    onChange={setTenantPhone}
                    className={inputClassName()}
                  />
                </Field>

                <Field label="Állandó lakcím / Székhely">
                  <input
                    type="text"
                    value={tenantAddress}
                    onChange={(e) => setTenantAddress(e.target.value)}
                    placeholder="1081 Budapest, Kálvária tér 1."
                    className={inputClassName()}
                  />
                </Field>

                {tenantType === "individual" ? (
                  <>
                    <Field label="Anyja neve">
                      <input
                        type="text"
                        value={tenantMotherName}
                        onChange={(e) => setTenantMotherName(e.target.value)}
                        placeholder="Anyja születési neve"
                        className={inputClassName()}
                      />
                    </Field>

                    <Field label="Születési hely">
                      <input
                        type="text"
                        value={tenantBirthPlace}
                        onChange={(e) => setTenantBirthPlace(e.target.value)}
                        placeholder="pl. Budapest"
                        className={inputClassName()}
                      />
                    </Field>

                    <Field label="Születési dátum">
                      <input
                        type="date"
                        value={tenantBirthDate}
                        onChange={(e) => setTenantBirthDate(e.target.value)}
                        className={inputClassName()}
                      />
                    </Field>
                  </>
                ) : (
                  <Field label="Adószám" required>
                    <TaxNumberInput
                      value={tenantTaxNumber}
                      onChange={setTenantTaxNumber}
                      onCompanyFound={(data) => {
                        setTenantName(data.name);
                        if (data.address) setTenantAddress(data.address);
                      }}
                      className={inputClassName()}
                    />
                  </Field>
                )}
              </div>

              </fieldset>

              {/* ━━━ 2. SZERZŐDÉS FELTÉTELEK ━━━ */}
              <fieldset className="rounded-2xl border border-border/60 p-5 space-y-5">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Szerződés feltételek</legend>
                <div className="grid gap-5 md:grid-cols-2">
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
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Wallet className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <CurrencyInput
                          value={depositAmount}
                          onChange={setDepositAmount}
                          placeholder="0"
                          className={`${inputClassName()} pl-11`}
                        />
                      </div>
                      <div className="flex gap-1 rounded-2xl border border-border/60 p-0.5">
                        {(["HUF", "EUR"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setDepositCurrency(c)}
                            className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition ${
                              depositCurrency === c
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {c === "HUF" ? "Ft" : "€"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Field>

                  <Field label="Szerződés időtartama (hónap)">
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="999"
                        value={leaseMonths}
                        onChange={(e) => setLeaseMonths(e.target.value)}
                        className="w-24 rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { value: "3", label: "3" },
                          { value: "6", label: "6" },
                          { value: "12", label: "12" },
                          { value: "24", label: "24" },
                          { value: "0", label: "∞" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setLeaseMonths(opt.value)}
                            className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                              leaseMonths === opt.value
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {leaseMonths === "0" && <p className="mt-1 text-xs text-muted-foreground">Határozatlan időtartam</p>}
                  </Field>
                </div>

              {/* Monthly rent + auto-billing (shown in edit mode — part of Szerződés) */}
              {isEditMode && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Havi bérleti díj">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={monthlyRent}
                          onChange={(e) => setMonthlyRent(e.target.value)}
                          placeholder="0"
                          className={inputClassName()}
                        />
                        <div className="flex gap-1 rounded-2xl border border-border p-1">
                          {(["HUF", "EUR"] as const).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setRentCurrency(c)}
                              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                                rentCurrency === c ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                              }`}
                            >
                              {c === "HUF" ? "Ft" : "€"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Field>
                  </div>

                  <label className="flex items-start gap-3 rounded-2xl bg-background/80 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={autoBilling}
                      onChange={(e) => setAutoBilling(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">Automatikus havi számlázás</p>
                      <p className="text-xs text-muted-foreground">
                        Minden hónap megadott napján automatikusan kiállítja a bérleti díj számlát.
                      </p>
                    </div>
                  </label>
                  {autoBilling && (
                    <Field label="Számlázás napja (1-28)">
                      <input
                        type="number"
                        min="1"
                        max="28"
                        value={autoBillingDay}
                        onChange={(e) => setAutoBillingDay(e.target.value)}
                        className={inputClassName()}
                      />
                    </Field>
                  )}

                  {/* SZJ toggle */}
                  <label className="flex items-start gap-3 rounded-2xl bg-background/80 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={applySzj}
                      onChange={(e) => setApplySzj(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">Kifizetői SZJA (SZJ)</p>
                      <p className="text-xs text-muted-foreground">
                        A bérleti díj számlán megjelenik az SZJA levonás összege és az utalandó nettó összeg.
                      </p>
                    </div>
                  </label>
                  {applySzj && monthlyRent && (() => {
                    const rent = Number(monthlyRent);
                    const costAllowance = Math.round(rent * 0.10);
                    const taxBase = rent - costAllowance;
                    const szjAmount = Math.round(taxBase * 0.15);
                    const netAmount = rent - szjAmount;
                    return rent > 0 ? (
                      <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm tabular-nums">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Kifizetői SZJA kalkulátor</p>
                        <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">Szja tv. 17. § (3) — 10% költséghányad alkalmazásával</p>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between"><span className="text-muted-foreground">Bruttó bérleti díj</span><span className="font-medium">{rent.toLocaleString("hu-HU")} Ft</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">10% költséghányad</span><span className="text-muted-foreground">−{costAllowance.toLocaleString("hu-HU")} Ft</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Adóalap (bérleti díj 90%-a)</span><span className="font-medium">{taxBase.toLocaleString("hu-HU")} Ft</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Levont SZJA (15%)</span><span className="font-medium text-destructive">−{szjAmount.toLocaleString("hu-HU")} Ft</span></div>
                          <div className="border-t border-amber-200 dark:border-amber-800 pt-1 mt-1 flex justify-between font-bold">
                            <span>Utalandó nettó összeg</span>
                            <span className="text-emerald-700 dark:text-emerald-400">{netAmount.toLocaleString("hu-HU")} Ft</span>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-500">SZOCHO nem terheli az ingatlan bérbeadásból származó jövedelmet.</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              </fieldset>

              {/* ━━━ 3. SZÁMLÁZÁS ━━━ */}
              <fieldset className="rounded-2xl border border-border/60 p-5 space-y-4">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Számlázás</legend>

              <div>
                <label className="flex items-center gap-3 rounded-2xl bg-background/80 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={billingSameAsTenant}
                    onChange={(e) => setBillingSameAsTenant(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">A számlázási adatok megegyeznek a bérlő adataival</p>
                    <p className="text-xs text-muted-foreground">
                      Ha a számla más névre szól (pl. cég nevére), kapcsold ki.
                    </p>
                  </div>
                </label>

                {!billingSameAsTenant && (
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    <Field label="Számla címzett neve" required>
                      <input
                        type="text"
                        value={billingName}
                        onChange={(e) => setBillingName(e.target.value)}
                        placeholder="pl. Példa Kft."
                        className={inputClassName()}
                      />
                    </Field>

                    <Field label="Számla címzett email">
                      <input
                        type="email"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        placeholder="szamla@pelda.hu"
                        className={inputClassName()}
                      />
                    </Field>

                    <Field label="Számlázási cím">
                      <input
                        type="text"
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        placeholder="Ha eltér a bérlő címétől"
                        className={inputClassName()}
                      />
                    </Field>

                    <Field label="Címzett típusa">
                      <select
                        value={billingBuyerType}
                        onChange={(e) => setBillingBuyerType(e.target.value as "individual" | "company")}
                        className={inputClassName()}
                      >
                        <option value="individual">Magánszemély</option>
                        <option value="company">Cég</option>
                      </select>
                    </Field>

                    {billingBuyerType === "company" && (
                      <Field label="Adószám" required>
                        <TaxNumberInput
                          value={billingTaxNumber}
                          onChange={setBillingTaxNumber}
                          onCompanyFound={(data) => {
                            setBillingName(data.name);
                            if (data.address) setBillingAddress(data.address);
                          }}
                          className={inputClassName()}
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>

              </fieldset>

              {/* ━━━ 4. HOZZÁFÉRÉS ━━━ */}
              <fieldset className="rounded-2xl border border-border/60 p-5 space-y-4">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hozzáférés & egyéb</legend>

              {tenantEmail && (
                <label className="flex items-center gap-3 rounded-2xl bg-background/80 px-4 py-3">
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

              <label className="flex items-start gap-3 rounded-2xl bg-background/80 px-4 py-3">
                <input
                  type="checkbox"
                  checked={inflationTracking}
                  onChange={(e) => setInflationTracking(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">Inflációkövető bérleti díj</p>
                  <p className="text-xs text-muted-foreground">
                    Minden év elején az infláció mértékével automatikusan emelkedik a bérleti díj.
                  </p>
                </div>
              </label>

              </fieldset>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Nyitó mérőállások
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Kezdő mérőállások
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Rögzítsd a mérőórák aktuális állását a beköltözés pillanatában.
                </p>
              </div>

              {property.meterInfo.length === 0 ? (
                <div className="rounded-[24px] bg-background/80 p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nincs mérőóra az ingatlanhoz. Hozzáadhatsz a mérők menüben.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {property.meterInfo.map((meter) => {
                    const meta = utilityMeta[meter.utilityType] ?? {
                      label: meter.utilityType,
                      icon: Zap,
                    };
                    const Icon = meta.icon;
                    return (
                      <div
                        key={meter.id}
                        className="rounded-[24px] ring-1 ring-border/60 bg-background/80 p-5 space-y-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{meta.label}</p>
                            {meter.serialNumber && (
                              <p className="text-xs text-muted-foreground truncate">
                                {meter.serialNumber}
                              </p>
                            )}
                          </div>
                        </div>
                        {meter.location && (
                          <p className="text-xs text-muted-foreground">
                            Helyszín: {meter.location}
                          </p>
                        )}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={initialReadings[meter.utilityType] ?? ""}
                          onChange={(e) =>
                            setInitialReadings((prev) => ({
                              ...prev,
                              [meter.utilityType]: e.target.value,
                            }))
                          }
                          placeholder="Kezdő állás"
                          className={inputClassName()}
                        />
                        <p className="text-xs text-muted-foreground">
                          Opcionális. Ha üres, később rögzítheted.
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Állapotfelvétel + dokumentumok
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Állapotfelvétel és szerződés
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Rögzítsd az ingatlan állapotát és töltsd fel a szükséges dokumentumokat.
                </p>
              </div>

              {/* Condition assessment */}
              <div className="rounded-[24px] ring-1 ring-border/60 bg-background/80 p-5 space-y-4">
                <p className="text-sm font-semibold">Az ingatlan állapota</p>
                <div className="flex flex-wrap gap-2">
                  {conditionOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setConditionRating((prev) =>
                          prev === opt.value ? "" : opt.value,
                        )
                      }
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        conditionRating === opt.value
                          ? "bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(99,102,241,0.25)]"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <Field label="Megjegyzés">
                  <textarea
                    value={conditionNotes}
                    onChange={(e) => setConditionNotes(e.target.value)}
                    placeholder="Az ingatlan állapotának leírása..."
                    rows={3}
                    className="w-full rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                </Field>

                <div>
                  <p className="mb-2 text-sm font-medium">Fotók</p>
                  <PhotoGallery
                    photos={conditionPhotos.map((url) => ({ url }))}
                    onUpload={(urls) => setConditionPhotos((prev) => [...prev, ...urls])}
                    onRemove={(url) => setConditionPhotos((prev) => prev.filter((u) => u !== url))}
                    editable
                    showCaptions
                    folder="move-in"
                  />
                </div>
              </div>

              {/* Contract upload */}
              <div className="rounded-[24px] ring-1 ring-border/60 bg-background/80 p-5 space-y-4">
                <p className="text-sm font-semibold">Bérleti szerződés</p>
                {contractUrls.length > 0 && (
                  <div className="space-y-2">
                    {contractUrls.map((url, idx) => (
                      <div
                        key={url}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm">
                            Dokumentum {idx + 1}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setContractUrls((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <input
                    ref={contractInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => handleContractUpload(e.target.files)}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => contractInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    Szerződés feltöltése
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Záró ellenőrzés
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Kulcsátadás és összegzés
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add meg a kulcsátadás részleteit és ellenőrizd az összesítőt.
                </p>
              </div>

              {/* Key handover */}
              <div className="rounded-[24px] ring-1 ring-border/60 bg-background/80 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold">Kulcsátadás</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Átadott kulcsok száma">
                    <input
                      type="number"
                      min="0"
                      value={keyCount}
                      onChange={(e) => setKeyCount(e.target.value)}
                      placeholder="0"
                      className={inputClassName()}
                    />
                  </Field>
                  <Field label="Kulcs megjegyzés">
                    <input
                      type="text"
                      value={keyNotes}
                      onChange={(e) => setKeyNotes(e.target.value)}
                      placeholder="pl. 2 bejárati, 1 postaláda"
                      className={inputClassName()}
                    />
                  </Field>
                </div>
              </div>

              {/* Summary */}
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

                  {/* Meter readings summary */}
                  {Object.entries(initialReadings).some(([, v]) => v && Number(v) > 0) && (
                    <>
                      <div className="my-2 h-px bg-border/60" />
                      <p className="font-medium text-muted-foreground">Mérőállások:</p>
                      {Object.entries(initialReadings)
                        .filter(([, v]) => v && Number(v) > 0)
                        .map(([type, value]) => (
                          <p key={type} className="pl-3">
                            {utilityMeta[type]?.label ?? type}: {value}
                          </p>
                        ))}
                    </>
                  )}

                  {/* Condition summary */}
                  {conditionRating && (
                    <>
                      <div className="my-2 h-px bg-border/60" />
                      <p>
                        <span className="font-medium text-muted-foreground">Állapot:</span>{" "}
                        {conditionOptions.find((o) => o.value === conditionRating)?.label ?? conditionRating}
                      </p>
                    </>
                  )}

                  {/* Documents summary */}
                  {(conditionPhotos.length > 0 || contractUrls.length > 0) && (
                    <>
                      <div className="my-2 h-px bg-border/60" />
                      <p>
                        <span className="font-medium text-muted-foreground">Dokumentumok:</span>{" "}
                        {conditionPhotos.length + contractUrls.length} fájl
                      </p>
                    </>
                  )}

                  {/* Keys summary */}
                  {keyCount && Number(keyCount) > 0 && (
                    <>
                      <div className="my-2 h-px bg-border/60" />
                      <p>
                        <span className="font-medium text-muted-foreground">Kulcsok:</span>{" "}
                        {keyCount} db
                        {keyNotes ? ` (${keyNotes})` : ""}
                      </p>
                    </>
                  )}
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

            <div className="flex items-center gap-3">
              {step < steps.length - 1 && (
                <>
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={moveIn.isPending || !tenantName}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-medium transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {moveIn.isPending ? "Mentés..." : "Mentés, folytatom később"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    disabled={step === 0 && !tenantName}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Tovább
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </>
              )}
              {step === steps.length - 1 && (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={moveIn.isPending || !tenantName}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {moveIn.isPending ? "Indítás..." : "Beköltözés indítása"}
                </button>
              )}
            </div>

            {moveInError && (
              <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {moveInError}
              </p>
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
              {property.address ?? "Nincs cím megadva"}
            </p>
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Havi bérleti díj</span>
                <span className="font-semibold">
                  {property.monthlyRent
                    ? `${property.monthlyRent.toLocaleString("hu-HU")} ${property.rentCurrency === "EUR" ? "€" : "Ft"}`
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
