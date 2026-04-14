"use client";

import { useState, type ReactNode } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import { api } from "@/trpc/react";
import { CurrencyInput } from "@/components/shared/currency-input";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]!;
}

function today() {
  return new Date().toISOString().split("T")[0]!;
}

const PROFILE_DOT_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  purple: "bg-purple-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
  orange: "bg-orange-500",
  slate: "bg-slate-500",
};

function profileDotClass(color: string | null) {
  return PROFILE_DOT_COLORS[color ?? ""] ?? "bg-slate-500";
}

const PAYMENT_CATEGORIES = [
  { value: "berleti_dij", label: "Bérleti díj" },
  { value: "kozos_koltseg", label: "Közös költség" },
  { value: "kaucio", label: "Kaució" },
  { value: "villany", label: "Villany" },
  { value: "viz", label: "Víz" },
  { value: "gaz", label: "Gáz" },
  { value: "karbantartas", label: "Karbantartás" },
  { value: "egyeb", label: "Egyéb" },
] as const;

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  berleti_dij:
    "bg-primary/15 text-primary dark:bg-primary/20",
  kozos_koltseg:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  kaucio:
    "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
  villany:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  viz:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  gaz:
    "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200",
  karbantartas:
    "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  egyeb:
    "bg-secondary text-muted-foreground",
};

function categoryLabel(category: string | null) {
  return PAYMENT_CATEGORIES.find((c) => c.value === category)?.label ?? null;
}

const STATUS_STYLES: Record<string, string> = {
  draft:
    "bg-secondary text-muted-foreground",
  sent:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  overdue:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  paid:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Piszkozat";
    case "sent":
      return "Kiküldve";
    case "overdue":
      return "Lejárt";
    case "paid":
      return "Fizetve";
    default:
      return status;
  }
}

/* ------------------------------------------------------------------ */
/*  Shared UI atoms                                                    */
/* ------------------------------------------------------------------ */

function StatusBadge({
  children,
  status,
}: {
  children: ReactNode;
  status: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
    >
      {status === "paid" && (
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      )}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared tab header                                                  */
/* ------------------------------------------------------------------ */

function BillingTabHeader({
  activeTab,
  onTabChange,
  actionLabel,
  onAction,
}: {
  activeTab: "invoices" | "payments";
  onTabChange: (tab: "invoices" | "payments") => void;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Számlázás</h1>
        <div className="flex gap-1 rounded-xl bg-secondary p-1">
          <button
            type="button"
            onClick={() => onTabChange("invoices")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "invoices"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Számlák
          </button>
          <button
            type="button"
            onClick={() => onTabChange("payments")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "payments"
                ? "bg-background shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            Befizetések
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + {actionLabel}
      </button>
    </div>
  );
}

/* ================================================================== */
/*  InvoiceListView                                                    */
/* ================================================================== */

function InvoiceListView({
  onNewInvoice,
  activeProfileId,
  onProfileChange,
  activeTab,
  onTabChange,
}: {
  onNewInvoice: () => void;
  activeProfileId: number | null;
  onProfileChange: (id: number | null) => void;
  activeTab: "invoices" | "payments";
  onTabChange: (tab: "invoices" | "payments") => void;
}) {
  const { messages, intlLocale } = useLocale();
  const { data: invoices, isLoading } = api.invoice.list.useQuery();
  const { data: landlordProfiles } = api.landlordProfile.list.useQuery();
  const utils = api.useUtils();

  const filterProfileId = activeProfileId;

  const deleteInvoice = api.invoice.delete.useMutation({
    onSuccess: () => void utils.invoice.list.invalidate(),
  });
  const markPaid = api.invoice.markPaid.useMutation({
    onSuccess: () => void utils.invoice.list.invalidate(),
  });
  const markUnpaid = api.invoice.markUnpaid.useMutation({
    onSuccess: () => void utils.invoice.list.invalidate(),
  });

  const filteredInvoices = filterProfileId
    ? invoices?.filter((inv) => inv.sellerProfileId === filterProfileId)
    : invoices;

  return (
    <div className="space-y-5">
      {/* Header */}
      <BillingTabHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        actionLabel={messages.billingPage.createInvoice}
        onAction={onNewInvoice}
      />

      <p className="text-sm text-muted-foreground">
        {messages.billingPage.subtitle}
      </p>

      {/* Profile filter tabs */}
      {landlordProfiles && landlordProfiles.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onProfileChange(null)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filterProfileId === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            Összes
          </button>
          {landlordProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => onProfileChange(profile.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filterProfileId === profile.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${profileDotClass(profile.color)}`}
              />
              {profile.displayName}
            </button>
          ))}
          <a
            href="/settings/landlord-profiles"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Profilok kezelése →
          </a>
        </div>
      )}

      {/* Invoice cards */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Betöltés...
        </div>
      ) : !filteredInvoices?.length ? (
        <div className="rounded-[24px] bg-card/90 p-8 text-center ring-1 ring-border/60">
          <p className="text-sm text-muted-foreground">
            {messages.billingPage.noInvoices}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="rounded-[22px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Left side: invoice info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {invoice.sellerProfile?.color && (
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${profileDotClass(invoice.sellerProfile.color)}`}
                      />
                    )}
                    <p className="truncate font-medium">
                      {invoice.invoiceNumber ?? `#${invoice.id}`}
                    </p>
                    <StatusBadge status={invoice.status}>
                      {statusLabel(invoice.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {invoice.property.name}
                    {invoice.buyerName ? ` \u2014 ${invoice.buyerName}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(invoice.issueDate).toLocaleDateString(intlLocale)}
                    {invoice.status === "paid" && invoice.paidAt && (
                      <span>
                        {" \u00b7 "}
                        Fizetve:{" "}
                        {new Date(invoice.paidAt).toLocaleDateString(
                          intlLocale,
                        )}
                      </span>
                    )}
                  </p>
                </div>

                {/* Right side: amount + actions */}
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <p className="text-lg font-semibold tabular-nums tracking-tight">
                    {invoice.grossTotalHuf.toLocaleString(intlLocale)}{" "}
                    {messages.common.currencyCode}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
                      >
                        {messages.billingPage.viewPdf}
                      </a>
                    )}

                    {invoice.status === "draft" && (
                      <button
                        type="button"
                        disabled={deleteInvoice.isPending}
                        onClick={() => deleteInvoice.mutate({ id: invoice.id })}
                        className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                      >
                        Törlés
                      </button>
                    )}

                    {(invoice.status === "sent" ||
                      invoice.status === "overdue") && (
                      <button
                        type="button"
                        disabled={markPaid.isPending}
                        onClick={() => markPaid.mutate({ id: invoice.id })}
                        className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30 disabled:opacity-50"
                      >
                        Fizetve jelölés
                      </button>
                    )}

                    {invoice.status === "paid" && (
                      <button
                        type="button"
                        disabled={markUnpaid.isPending}
                        onClick={() => markUnpaid.mutate({ id: invoice.id })}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
                      >
                        Visszavonás
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  NewInvoiceForm                                                     */
/* ================================================================== */

function NewInvoiceForm({
  onBack,
  initialProfileId,
}: {
  onBack: () => void;
  initialProfileId: number | null;
}) {
  const { messages, intlLocale } = useLocale();
  const { data: properties } = api.property.list.useQuery();
  const { data: landlordProfiles } = api.landlordProfile.list.useQuery();
  const utils = api.useUtils();

  const [propertyId, setPropertyId] = useState<number | undefined>();
  const [selectedProfileId, setSelectedProfileId] = useState<
    number | undefined
  >(initialProfileId ?? undefined);
  const [periodFrom, setPeriodFrom] = useState(startOfMonth());
  const [periodTo, setPeriodTo] = useState(today());
  const [includeRent, setIncludeRent] = useState(true);
  const [includeCommonFees, setIncludeCommonFees] = useState(true);
  const [includeReadings, setIncludeReadings] = useState(true);
  const [sendToProvider, setSendToProvider] = useState(true);
  const [note, setNote] = useState(() => {
    const d = new Date(startOfMonth());
    return `Bérleti díj és rezsi — ${d.toLocaleDateString("hu-HU", { year: "numeric", month: "long" })}`;
  });
  const [editedDescriptions, setEditedDescriptions] = useState<Record<number, string>>({});
  const [editedNotes, setEditedNotes] = useState<Record<number, string>>({});
  const [manualConfirmed, setManualConfirmed] = useState(false);

  const selectedProperty =
    properties?.find((p) => p.id === propertyId) ?? null;
  const defaultProfile =
    landlordProfiles?.find((p) => p.isDefault) ?? null;
  const effectiveProfileId =
    selectedProperty?.landlordProfile?.id ??
    selectedProfileId ??
    defaultProfile?.id;
  const { data: invoiceSettings } = api.invoice.getSettings.useQuery(
    effectiveProfileId ? { profileId: effectiveProfileId } : undefined,
  );

  const previewEnabled = propertyId != null;
  const preview = api.invoice.preview.useQuery(
    {
      propertyId: propertyId ?? 0,
      periodFrom,
      periodTo,
      includeRent,
      includeCommonFees,
      includeReadings,
      note: note || undefined,
      paymentMethod: "transfer",
    },
    { enabled: previewEnabled },
  );

  const createInvoice = api.invoice.create.useMutation({
    onSuccess: async () => {
      setNote("");
      await Promise.all([
        utils.invoice.list.invalidate(),
        utils.invoice.preview.invalidate(),
      ]);
      onBack();
    },
    onError: async () => {
      await Promise.all([
        utils.invoice.list.invalidate(),
        utils.invoice.preview.invalidate(),
      ]);
    },
  });

  const buyerSourceLabel = (() => {
    switch (preview.data?.buyer.source) {
      case "tenant":
        return messages.billingPage.buyerSourceTenant;
      case "tenant_email":
        return messages.billingPage.buyerSourceTenantEmail;
      case "billing_profile":
        return messages.billingPage.buyerSourceBillingProfile;
      case "property_contact":
        return messages.billingPage.buyerSourcePropertyContact;
      case "property_name":
        return messages.billingPage.buyerSourcePropertyName;
      default:
        return messages.common.none;
    }
  })();

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-secondary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.billingPage.createInvoice}
        </h1>
      </div>

      {/* Form section */}
      <section className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-6">
        {/* Property + profile selectors */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              {messages.common.property}
            </label>
            <select
              value={propertyId ?? ""}
              onChange={(e) => {
                const nextId = e.target.value
                  ? Number(e.target.value)
                  : undefined;
                const nextProp =
                  properties?.find((p) => p.id === nextId) ?? null;
                setPropertyId(nextId);
                if (nextProp?.landlordProfile?.id) {
                  setSelectedProfileId(nextProp.landlordProfile.id);
                }
              }}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{messages.billingPage.chooseProperty}</option>
              {(selectedProfileId
                ? properties?.filter((p) => p.landlordProfile?.id === selectedProfileId)
                : properties
              )?.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                  {property.landlordProfile ? ` (${property.landlordProfile.displayName})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.billingPage.landlordProfileLabel}
            </label>
            <select
              value={effectiveProfileId ?? ""}
              onChange={(e) =>
                setSelectedProfileId(
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">
                {messages.billingPage.chooseLandlordProfile}
              </option>
              {landlordProfiles?.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Auto-billing warning */}
        {propertyId && properties?.find((p) => p.id === propertyId)?.autoBilling && (
          <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm dark:border-amber-700/60 dark:bg-amber-950/20">
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              ⚠️ Automatikus számlázás aktív
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Ez az ingatlan automatikus számlázásra van kapcsolva (minden hó {properties?.find((p) => p.id === propertyId)?.autoBillingDay ?? 1}-én).
              Ha manuálisan állítasz ki számlát, a következő automata számlázás NEM fogja kihagyni az időszakot.
            </p>
          </div>
        )}

        {/* Period — month shortcuts + manual */}
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Időszak</label>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const now = new Date();
              const months: { label: string; from: string; to: string }[] = [];
              for (let i = 0; i < 6; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const year = d.getFullYear();
                const month = d.getMonth();
                const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
                const lastDay = new Date(year, month + 1, 0).getDate();
                const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                const label = d.toLocaleDateString(intlLocale, { year: "numeric", month: "short" });
                months.push({ label, from, to });
              }
              return months.map((m) => (
                <button
                  key={m.from}
                  type="button"
                  onClick={() => {
                    setPeriodFrom(m.from);
                    setPeriodTo(m.to);
                    const d = new Date(m.from);
                    setNote(`Bérleti díj és rezsi — ${d.toLocaleDateString("hu-HU", { year: "numeric", month: "long" })}`);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    periodFrom === m.from && periodTo === m.to
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {m.label}
                </button>
              ));
            })()}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">
                {messages.billingPage.periodFrom}
              </label>
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                {messages.billingPage.periodTo}
              </label>
              <input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex items-center gap-2 rounded-[20px] bg-background/80 p-3 text-sm ring-1 ring-border/50">
            <input
              type="checkbox"
              checked={includeRent}
              onChange={(e) => setIncludeRent(e.target.checked)}
            />
            {messages.billingPage.includeRent}
          </label>
          <label className="flex items-center gap-2 rounded-[20px] bg-background/80 p-3 text-sm ring-1 ring-border/50">
            <input
              type="checkbox"
              checked={includeCommonFees}
              onChange={(e) => setIncludeCommonFees(e.target.checked)}
            />
            {messages.billingPage.includeCommonFees}
          </label>
          <label className="flex items-center gap-2 rounded-[20px] bg-background/80 p-3 text-sm ring-1 ring-border/50">
            <input
              type="checkbox"
              checked={includeReadings}
              onChange={(e) => setIncludeReadings(e.target.checked)}
            />
            {messages.billingPage.includeReadings}
          </label>
          <label className="flex items-center gap-2 rounded-[20px] bg-background/80 p-3 text-sm ring-1 ring-border/50">
            <input
              type="checkbox"
              checked={sendToProvider}
              onChange={(e) => setSendToProvider(e.target.checked)}
            />
            {messages.billingPage.sendToProvider}
          </label>
        </div>

        {/* Note */}
        <div className="mt-4">
          <label className="block text-sm font-medium">
            {messages.common.notes}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </section>

      {/* Preview section — redesigned */}
      <section className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-6">
        <h2 className="text-lg font-semibold">Élőnézet</h2>

        {preview.error ? (
          <p className="mt-3 text-sm text-destructive">
            {preview.error.message}
          </p>
        ) : !preview.data ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {messages.billingPage.previewPlaceholder}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Compact seller/buyer header */}
            <div className="rounded-xl bg-secondary/30 px-4 py-3 text-xs space-y-1">
              <p>
                <span className="font-semibold">Kiállító:</span>{" "}
                {preview.data.sellerProfile.displayName} · {preview.data.sellerProfile.billingAddress ?? ""}
                {preview.data.canSendToProvider
                  ? <span className="ml-2 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-semibold">Küldhető</span>
                  : <span className="ml-2 rounded bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 text-[10px] font-semibold">Nem küldhető</span>
                }
              </p>
              <p>
                <span className="font-semibold">Vevő:</span>{" "}
                {preview.data.buyer.name}
                {preview.data.buyer.taxNumber && <span> · {preview.data.buyer.taxNumber}</span>}
                {preview.data.buyer.address && <span className="text-muted-foreground"> · {preview.data.buyer.address}</span>}
              </p>
            </div>

            {/* Line items — prominently editable */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tételek</p>
              {preview.data.items.map((item, index) => {
                const sourceLabel = item.sourceType === "rent" ? "Bérleti díj" : item.sourceType === "common_fee" ? "Közös költség" : "Rezsi";
                return (
                  <div key={`${item.sourceType}-${index}`} className="rounded-2xl border border-border bg-background p-4 space-y-3">
                    {/* Header: type badge + amount */}
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{sourceLabel}</span>
                      <span className="text-lg font-bold tabular-nums">
                        {item.grossAmountHuf.toLocaleString(intlLocale)} {messages.common.currencyCode}
                      </span>
                    </div>

                    {/* Description — big editable textarea */}
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Megnevezés</label>
                      <textarea
                        value={editedDescriptions[index] ?? item.description}
                        onChange={(e) => setEditedDescriptions((prev) => ({ ...prev, [index]: e.target.value }))}
                        rows={Math.max(4, (editedDescriptions[index] ?? item.description).split("\n").length + 1)}
                        className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Item note — optional */}
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Tétel megjegyzés (opcionális)</label>
                      <input
                        type="text"
                        value={editedNotes[index] ?? ""}
                        onChange={(e) => setEditedNotes((prev) => ({ ...prev, [index]: e.target.value }))}
                        placeholder="pl. részletezés, hivatkozás..."
                        className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>

                    {/* Meta: quantity, unit, VAT */}
                    <p className="text-[11px] text-muted-foreground">{item.quantity} {item.unit} · ÁFA: {item.vatRate}</p>

                    {/* SZJ calculator for rent */}
                    {item.sourceType === "rent" && preview.data.property.applySzj && (() => {
                      const rent = item.unitPriceHuf;
                      const costRate = preview.data.property.szjCostRate ?? 10;
                      const szjRate = preview.data.property.szjRate ?? 15;
                      const szjBase = rent * (1 - costRate / 100);
                      const szjAmount = Math.round(szjBase * szjRate / 100);
                      const netAmount = rent - szjAmount;
                      return (
                        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Kifizetői SZJA kalkulátor</p>
                          <div className="mt-2 space-y-1 text-sm tabular-nums">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Bruttó bérleti díj</span>
                              <span className="font-medium">{rent.toLocaleString("hu-HU")} Ft</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">SZJA levonás ({szjRate}%)</span>
                              <span className="font-medium text-destructive">−{szjAmount.toLocaleString("hu-HU")} Ft</span>
                            </div>
                            <div className="border-t border-amber-200 dark:border-amber-800 pt-1 flex justify-between font-bold">
                              <span>Utalandó összeg</span>
                              <span className="text-emerald-700 dark:text-emerald-400">{netAmount.toLocaleString("hu-HU")} Ft</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            {/* Totals + dates */}
            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Számla végösszeg</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
                    {preview.data.grossTotalHuf.toLocaleString(intlLocale)} {messages.common.currencyCode}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground space-y-0.5">
                  <p>Kiállítás: <span className="font-medium text-foreground">{new Date(preview.data.issueDate).toLocaleDateString(intlLocale)}</span></p>
                  <p>
                    <span className="font-medium text-foreground">
                      {messages.billingPage.dueDateLabel}:
                    </span>{" "}
                    {new Date(preview.data.dueDate).toLocaleDateString(
                      intlLocale,
                    )}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      {messages.billingPage.vatCodeLabel}:
                    </span>{" "}
                    {preview.data.billingDefaults.vatCode}
                  </p>
                </div>
              </div>
            </div>

            {/* Blockers */}
            {preview.data.blockers.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">
                  {messages.billingPage.blockersTitle}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-destructive">
                  {preview.data.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {preview.data.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="text-sm font-medium">
                  {messages.billingPage.warningsTitle}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {preview.data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Auto-billing confirmation checkbox */}
        {propertyId && properties?.find((p) => p.id === propertyId)?.autoBilling && (
          <div className="mt-4">
            <label className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-700/60 dark:bg-amber-950/10">
              <input
                type="checkbox"
                checked={manualConfirmed}
                onChange={(e) => setManualConfirmed(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <span className="text-xs text-amber-800 dark:text-amber-300">
                Tudomásul veszem, ez egy manuális/extra számla az automatikus számlázás mellett.
              </span>
            </label>
          </div>
        )}

        {/* Submit button */}
        <div className="mt-5">
          <button
            type="button"
            disabled={!preview.data || createInvoice.isPending || (properties?.find((p) => p.id === propertyId)?.autoBilling && !manualConfirmed)}
            onClick={() =>
              propertyId &&
              createInvoice.mutate({
                propertyId,
                periodFrom,
                periodTo,
                includeRent,
                includeCommonFees,
                includeReadings,
                note: note || undefined,
                paymentMethod: "transfer",
                sendToProvider,
              })
            }
            className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
          >
            {createInvoice.isPending
              ? messages.billingPage.creating
              : messages.billingPage.createInvoiceAction}
          </button>

          {sendToProvider && preview.data && !preview.data.canSendToProvider && (
            <p className="mt-3 text-sm text-destructive">
              {messages.billingPage.sendBlockedHint}
            </p>
          )}

          {createInvoice.error && (
            <p className="mt-3 text-sm text-destructive">
              {createInvoice.error.message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ================================================================== */
/*  PaymentsListView                                                   */
/* ================================================================== */

const PAYMENT_METHOD_STYLES: Record<string, string> = {
  transfer:
    "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
  cash:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  card:
    "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
};

function paymentMethodLabel(method: string | null) {
  switch (method) {
    case "transfer":
      return "Átutalás";
    case "cash":
      return "Készpénz";
    case "card":
      return "Kártya";
    default:
      return method ?? "—";
  }
}

function PaymentsListView({
  onNewPayment,
  activeProfileId,
  onProfileChange,
  activeTab,
  onTabChange,
}: {
  onNewPayment: () => void;
  activeProfileId: number | null;
  onProfileChange: (id: number | null) => void;
  activeTab: "invoices" | "payments";
  onTabChange: (tab: "invoices" | "payments") => void;
}) {
  const { intlLocale } = useLocale();
  const { data: allPayments, isLoading } = api.payment.listAll.useQuery();
  const { data: landlordProfiles } = api.landlordProfile.list.useQuery();
  const { data: propertiesList } = api.property.list.useQuery();
  const utils = api.useUtils();

  const deletePayment = api.payment.delete.useMutation({
    onSuccess: () => void utils.payment.listAll.invalidate(),
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Build property→profile mapping
  const propertyProfileMap = new Map<number, number>();
  propertiesList?.forEach((p) => {
    if (p.landlordProfile?.id) {
      propertyProfileMap.set(p.id, p.landlordProfile.id);
    }
  });

  const filteredPayments = activeProfileId
    ? allPayments?.filter(
        (pay) => propertyProfileMap.get(pay.propertyId) === activeProfileId,
      )
    : allPayments;

  return (
    <div className="space-y-5">
      <BillingTabHeader
        activeTab={activeTab}
        onTabChange={onTabChange}
        actionLabel="Kézi befizetés"
        onAction={onNewPayment}
      />

      <p className="text-sm text-muted-foreground">
        Bérlői befizetések nyilvántartása.
      </p>

      {/* Profile filter tabs */}
      {landlordProfiles && landlordProfiles.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onProfileChange(null)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeProfileId === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-secondary/80"
            }`}
          >
            Összes
          </button>
          {landlordProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => onProfileChange(profile.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeProfileId === profile.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${profileDotClass(profile.color)}`}
              />
              {profile.displayName}
            </button>
          ))}
          <a
            href="/settings/landlord-profiles"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Profilok kezelése →
          </a>
        </div>
      )}

      {/* Payment cards */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Betöltés...
        </div>
      ) : !filteredPayments?.length ? (
        <div className="rounded-[24px] bg-card/90 p-8 text-center ring-1 ring-border/60">
          <p className="text-sm text-muted-foreground">
            Még nincs rögzített befizetés.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayments.map((payment) => (
            <div
              key={payment.id}
              className="rounded-[22px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Left side */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">
                      {payment.propertyName}
                    </p>
                    {payment.paymentMethod && (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          PAYMENT_METHOD_STYLES[payment.paymentMethod] ??
                          "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {paymentMethodLabel(payment.paymentMethod)}
                      </span>
                    )}
                    {payment.category && categoryLabel(payment.category) && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          CATEGORY_BADGE_STYLES[payment.category] ??
                          "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {categoryLabel(payment.category)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {new Date(payment.paymentDate).toLocaleDateString(
                      intlLocale,
                    )}
                  </p>
                  {payment.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {payment.notes}
                    </p>
                  )}
                </div>

                {/* Right side */}
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <p className="text-lg font-semibold tabular-nums tracking-tight">
                    {payment.amountHuf.toLocaleString(intlLocale)} Ft
                  </p>
                  <div className="flex items-center gap-2">
                    {confirmDeleteId === payment.id ? (
                      <>
                        <button
                          type="button"
                          disabled={deletePayment.isPending}
                          onClick={() => {
                            deletePayment.mutate({ id: payment.id });
                            setConfirmDeleteId(null);
                          }}
                          className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
                        >
                          Megerősítés
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
                        >
                          Mégsem
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(payment.id)}
                        className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5"
                      >
                        Törlés
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  NewPaymentForm                                                     */
/* ================================================================== */

function NewPaymentForm({
  onBack,
  initialProfileId,
}: {
  onBack: () => void;
  initialProfileId: number | null;
}) {
  const { data: properties } = api.property.list.useQuery();
  const utils = api.useUtils();

  const [propertyId, setPropertyId] = useState<number | undefined>();
  const [category, setCategory] = useState<string>("berleti_dij");
  const [amountHuf, setAmountHuf] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("transfer");
  const [paymentDate, setPaymentDate] = useState(today());
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [notes, setNotes] = useState("");

  const filteredProperties = initialProfileId
    ? properties?.filter((p) => p.landlordProfile?.id === initialProfileId)
    : properties;

  const createPayment = api.payment.create.useMutation({
    onSuccess: async () => {
      await utils.payment.listAll.invalidate();
      onBack();
    },
  });

  const canSubmit =
    propertyId != null && amountHuf !== "" && Number(amountHuf) > 0;

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-secondary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
        <h1 className="text-2xl font-bold tracking-tight">
          Kézi befizetés rögzítése
        </h1>
      </div>

      {/* Form */}
      <section className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-6">
        {/* Property selector */}
        <div>
          <label className="block text-sm font-medium">Ingatlan</label>
          <select
            value={propertyId ?? ""}
            onChange={(e) =>
              setPropertyId(
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Válassz ingatlant...</option>
            {filteredProperties?.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
                {property.landlordProfile
                  ? ` (${property.landlordProfile.displayName})`
                  : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Kategória</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PAYMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === cat.value
                    ? CATEGORY_BADGE_STYLES[cat.value]
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Összeg (Ft)</label>
          <CurrencyInput
            value={amountHuf}
            onChange={setAmountHuf}
            placeholder="0"
            min="0"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Payment method */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Fizetés módja</label>
          <div className="mt-2 flex gap-2">
            {(
              [
                { value: "transfer", label: "Átutalás" },
                { value: "cash", label: "Készpénz" },
                { value: "card", label: "Kártya" },
              ] as const
            ).map((method) => (
              <button
                key={method.value}
                type="button"
                onClick={() => setPaymentMethod(method.value)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  paymentMethod === method.value
                    ? PAYMENT_METHOD_STYLES[method.value]
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Dátum</label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Period */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Időszak (tól)</label>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Időszak (ig)</label>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <label className="block text-sm font-medium">Megjegyzés</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Submit */}
        <div className="mt-5">
          <button
            type="button"
            disabled={!canSubmit || createPayment.isPending}
            onClick={() =>
              propertyId &&
              createPayment.mutate({
                propertyId,
                amountHuf: Number(amountHuf),
                paymentDate,
                paymentMethod,
                category,
                periodFrom: periodFrom || undefined,
                periodTo: periodTo || undefined,
                notes: notes || undefined,
              })
            }
            className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
          >
            {createPayment.isPending ? "Rögzítés..." : "Rögzítés"}
          </button>

          {createPayment.error && (
            <p className="mt-3 text-sm text-destructive">
              {createPayment.error.message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/* ================================================================== */
/*  Main export                                                        */
/* ================================================================== */

export function BillingClient() {
  const [mode, setMode] = useState<
    "invoices" | "payments" | "new-invoice" | "new-payment"
  >("invoices");
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const activeTab: "invoices" | "payments" =
    mode === "payments" || mode === "new-payment" ? "payments" : "invoices";

  if (mode === "new-invoice") {
    return (
      <NewInvoiceForm
        onBack={() => setMode("invoices")}
        initialProfileId={activeProfileId}
      />
    );
  }

  if (mode === "new-payment") {
    return (
      <NewPaymentForm
        onBack={() => setMode("payments")}
        initialProfileId={activeProfileId}
      />
    );
  }

  if (mode === "payments") {
    return (
      <PaymentsListView
        onNewPayment={() => setMode("new-payment")}
        activeProfileId={activeProfileId}
        onProfileChange={setActiveProfileId}
        activeTab={activeTab}
        onTabChange={(tab) => setMode(tab)}
      />
    );
  }

  return (
    <InvoiceListView
      onNewInvoice={() => setMode("new-invoice")}
      activeProfileId={activeProfileId}
      onProfileChange={setActiveProfileId}
      activeTab={activeTab}
      onTabChange={(tab: "invoices" | "payments") => setMode(tab)}
    />
  );
}
