"use client";

import { useState, type ReactNode } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import { api } from "@/trpc/react";

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

/* ================================================================== */
/*  InvoiceListView                                                    */
/* ================================================================== */

function InvoiceListView({
  onNewInvoice,
  activeProfileId,
  onProfileChange,
}: {
  onNewInvoice: () => void;
  activeProfileId: number | null;
  onProfileChange: (id: number | null) => void;
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
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.billingPage.title}
        </h1>
        <button
          type="button"
          onClick={onNewInvoice}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + {messages.billingPage.createInvoice}
        </button>
      </div>

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
  const [note, setNote] = useState("");

  const selectedProperty =
    properties?.find((p) => p.id === propertyId) ?? null;
  const defaultProfile =
    landlordProfiles?.find((p) => p.isDefault) ?? null;
  const effectiveProfileId =
    selectedProperty?.landlordProfile?.id ??
    selectedProfileId ??
    defaultProfile?.id;
  const selectedProfile =
    landlordProfiles?.find((p) => p.id === effectiveProfileId) ?? null;

  const { data: invoiceSettings } = api.invoice.getSettings.useQuery(
    effectiveProfileId ? { profileId: effectiveProfileId } : undefined,
  );

  const providerConfigured = invoiceSettings?.configured ?? false;

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
                  onClick={() => { setPeriodFrom(m.from); setPeriodTo(m.to); }}
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

      {/* Preview section */}
      <section className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-6">
        <h2 className="text-lg font-semibold">
          {messages.billingPage.preview}
        </h2>

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
            {/* Three-column summary */}
            <div className="grid gap-3 md:grid-cols-3">
              {/* Readiness */}
              <div className="rounded-[20px] bg-background/80 p-4 ring-1 ring-border/50">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {messages.billingPage.readinessTitle}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">
                    {messages.billingPage.providerStatusLabel}:
                  </span>{" "}
                  {preview.data.canSendToProvider
                    ? messages.billingPage.readyToSend
                    : messages.billingPage.notReadyToSend}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-medium">
                    {messages.billingPage.activeTenantLabel}:
                  </span>{" "}
                  {preview.data.tenant?.name ?? messages.common.noTenant}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-medium">
                    {messages.billingPage.billingModeLabel}:
                  </span>{" "}
                  {preview.data.billingDefaults.billingMode === "advance"
                    ? messages.billingPage.billingModeAdvance
                    : messages.billingPage.billingModeArrears}
                </p>
              </div>

              {/* Seller */}
              <div className="rounded-[20px] bg-background/80 p-4 ring-1 ring-border/50">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {messages.billingPage.sellerSectionTitle}
                </p>
                <p className="mt-2 text-sm font-medium">
                  {preview.data.sellerProfile.displayName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.data.sellerProfile.billingName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.data.sellerProfile.billingAddress ??
                    messages.common.noAddress}
                </p>
              </div>

              {/* Buyer */}
              <div className="rounded-[20px] bg-background/80 p-4 ring-1 ring-border/50">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {messages.billingPage.buyerSectionTitle}
                </p>
                <p className="mt-2 text-sm font-medium">
                  {preview.data.buyer.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {buyerSourceLabel}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.data.buyer.email ?? messages.common.none}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.data.buyer.address ?? messages.common.noAddress}
                </p>
              </div>
            </div>

            {/* Line items + total */}
            <div className="grid gap-3 md:grid-cols-[1.4fr_0.9fr]">
              <div className="rounded-[20px] bg-background/80 p-4 ring-1 ring-border/50">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {messages.billingPage.invoiceList}
                </p>
                <div className="mt-3 space-y-2">
                  {preview.data.items.map((item, index) => (
                    <div
                      key={`${item.description}-${index}`}
                      className="flex flex-col gap-1 rounded-[18px] bg-card p-3 ring-1 ring-border/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.unit}
                        </p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums">
                        {item.grossAmountHuf.toLocaleString(intlLocale)}{" "}
                        {messages.common.currencyCode}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[20px] bg-background/80 p-4 ring-1 ring-border/50">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {messages.billingPage.invoiceTotal}
                </p>
                <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight">
                  {preview.data.grossTotalHuf.toLocaleString(intlLocale)}{" "}
                  {messages.common.currencyCode}
                </p>
                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">
                      {messages.billingPage.issueDateLabel}:
                    </span>{" "}
                    {new Date(preview.data.issueDate).toLocaleDateString(
                      intlLocale,
                    )}
                  </p>
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

        {/* Submit button */}
        <div className="mt-5">
          <button
            type="button"
            disabled={!preview.data || createInvoice.isPending}
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
/*  Main export                                                        */
/* ================================================================== */

export function BillingClient() {
  const [mode, setMode] = useState<"list" | "new">("list");
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);

  if (mode === "new") {
    return (
      <NewInvoiceForm
        onBack={() => setMode("list")}
        initialProfileId={activeProfileId}
      />
    );
  }

  return (
    <InvoiceListView
      onNewInvoice={() => setMode("new")}
      activeProfileId={activeProfileId}
      onProfileChange={setActiveProfileId}
    />
  );
}
