"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import { api } from "@/trpc/react";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]!;
}

function today() {
  return new Date().toISOString().split("T")[0]!;
}

function StatusChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-foreground";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function ContextCard({
  label,
  value,
  detail,
  badge,
}: {
  label: string;
  value: string;
  detail?: string;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        {badge}
      </div>
      <p className="mt-4 text-lg font-semibold tracking-tight">{value}</p>
      {detail && <p className="mt-2 text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function BillingClient() {
  const { messages, intlLocale } = useLocale();
  const { data: properties } = api.property.list.useQuery();
  const { data: landlordProfiles } = api.landlordProfile.list.useQuery();
  const { data: invoices } = api.invoice.list.useQuery();
  const defaultProfile = landlordProfiles?.find((profile) => profile.isDefault) ?? null;

  const [agentKeyOverride, setAgentKeyOverride] = useState<string | null>(null);
  const [defaultDueDaysOverride, setDefaultDueDaysOverride] = useState<string | null>(null);
  const [eInvoiceOverride, setEInvoiceOverride] = useState<boolean | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<number | undefined>();
  const [propertyId, setPropertyId] = useState<number | undefined>();
  const [periodFrom, setPeriodFrom] = useState(startOfMonth());
  const [periodTo, setPeriodTo] = useState(today());
  const [includeRent, setIncludeRent] = useState(true);
  const [includeCommonFees, setIncludeCommonFees] = useState(true);
  const [includeReadings, setIncludeReadings] = useState(true);
  const [sendToProvider, setSendToProvider] = useState(true);
  const [note, setNote] = useState("");
  const selectedProperty =
    properties?.find((property) => property.id === propertyId) ?? null;
  const effectiveSelectedProfileId =
    selectedProperty?.landlordProfile?.id ?? selectedProfileId ?? defaultProfile?.id;

  const { data: invoiceSettings } = api.invoice.getSettings.useQuery(
    effectiveSelectedProfileId ? { profileId: effectiveSelectedProfileId } : undefined,
  );

  const agentKey = agentKeyOverride ?? invoiceSettings?.agentKey ?? "";
  const defaultDueDays =
    defaultDueDaysOverride ?? String(invoiceSettings?.defaultDueDays ?? 5);
  const eInvoice = eInvoiceOverride ?? invoiceSettings?.eInvoice ?? true;

  const saveSettings = api.invoice.saveSettings.useMutation();
  const utils = api.useUtils();

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
    },
    onError: async () => {
      await Promise.all([
        utils.invoice.list.invalidate(),
        utils.invoice.preview.invalidate(),
      ]);
    },
  });

  const selectedPropertyName =
    selectedProperty?.name ?? null;
  const selectedProfile =
    landlordProfiles?.find((profile) => profile.id === effectiveSelectedProfileId) ?? null;

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

  const providerConfigured = invoiceSettings?.configured ?? false;
  const buyerPreviewName =
    preview.data?.buyer.name ??
    selectedProperty?.billingName ??
    selectedProperty?.contactName ??
    messages.common.none;
  const readinessTone = preview.data
    ? preview.data.canSendToProvider
      ? "success"
      : "warning"
    : providerConfigured
      ? "success"
      : "neutral";

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] bg-gradient-to-br from-background via-card to-secondary/40 p-5 shadow-sm ring-1 ring-border/60 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              {messages.billingPage.createInvoice}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {messages.billingPage.providerDescription}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {messages.billingPage.providerInfo}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[560px] xl:grid-cols-3">
            <ContextCard
              label={messages.billingPage.selectedScope}
              value={selectedPropertyName ?? messages.common.none}
              detail={selectedProperty?.address ?? messages.billingPage.chooseProperty}
            />
            <ContextCard
              label={messages.billingPage.activeSellerProfile}
              value={selectedProfile?.displayName ?? messages.common.none}
              detail={selectedProfile?.billingName ?? messages.billingPage.chooseLandlordProfile}
              badge={
                selectedProfile ? (
                  <StatusChip tone="success">{messages.billingPage.sellerSectionTitle}</StatusChip>
                ) : undefined
              }
            />
            <ContextCard
              label={messages.billingPage.readinessTitle}
              value={
                preview.data
                  ? preview.data.canSendToProvider
                    ? messages.billingPage.readyToSend
                    : messages.billingPage.notReadyToSend
                  : providerConfigured
                    ? messages.billingPage.providerReady
                    : messages.billingPage.previewPlaceholder
              }
              detail={buyerPreviewName}
              badge={<StatusChip tone={readinessTone}>{messages.billingPage.providerTitle}</StatusChip>}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-6">
        <h2 className="text-lg font-semibold">{messages.billingPage.providerTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.billingPage.providerDescription}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {messages.billingPage.providerInfo}
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <div>
            <label className="block text-sm font-medium">
              {messages.billingPage.landlordProfileLabel}
            </label>
            <select
              value={effectiveSelectedProfileId ?? ""}
              onChange={(e) =>
                {
                  setSelectedProfileId(e.target.value ? Number(e.target.value) : undefined);
                  setAgentKeyOverride(null);
                  setDefaultDueDaysOverride(null);
                  setEInvoiceOverride(null);
                }
              }
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{messages.billingPage.chooseLandlordProfile}</option>
              {landlordProfiles?.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Link
              href="/settings/landlord-profiles"
              className="rounded-xl border border-border px-4 py-3 text-sm hover:bg-secondary"
            >
              {messages.billingPage.manageLandlordProfiles}
            </Link>
          </div>
        </div>

        {selectedProfile && (
          <div className="mt-4 rounded-[24px] bg-background/80 p-4 text-sm ring-1 ring-border/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{selectedProfile.displayName}</p>
                <p className="mt-1 text-muted-foreground">
                  {selectedProfile.billingName}
                  {selectedProfile.taxNumber ? ` · ${selectedProfile.taxNumber}` : ""}
                </p>
              </div>
              <StatusChip tone={providerConfigured ? "success" : "warning"}>
                {providerConfigured
                  ? messages.billingPage.providerReady
                  : messages.billingPage.saveProvider}
              </StatusChip>
            </div>
            <p className="mt-2 text-muted-foreground">
              {selectedProfile.billingName}
            </p>
            <p className="mt-1 text-muted-foreground">{selectedProfile.billingAddress ?? messages.common.noAddress}</p>
            <p className="mt-1 text-muted-foreground">
              {selectedProfile.billingEmail ?? messages.common.none}
            </p>
          </div>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
          <div>
            <label className="block text-sm font-medium">
              {messages.billingPage.agentKey}
            </label>
            <input
              type="password"
              value={agentKey}
              onChange={(e) => setAgentKeyOverride(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.billingPage.defaultDueDays}
            </label>
            <input
              type="number"
              min="0"
              max="90"
              value={defaultDueDays}
              onChange={(e) => setDefaultDueDaysOverride(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={eInvoice}
            onChange={(e) => setEInvoiceOverride(e.target.checked)}
          />
          <span>{messages.billingPage.eInvoice}</span>
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              effectiveSelectedProfileId &&
              saveSettings.mutate({
                profileId: effectiveSelectedProfileId,
                agentKey,
                defaultDueDays: Number(defaultDueDays || 8),
                eInvoice,
              })
            }
            disabled={!effectiveSelectedProfileId || !agentKey || saveSettings.isPending}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveSettings.isPending
              ? messages.common.save
              : messages.billingPage.saveProvider}
          </button>
          {invoiceSettings?.configured && (
            <span className="rounded-full bg-green-100 px-3 py-2 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
              {messages.billingPage.providerReady}
            </span>
          )}
        </div>

        <div className="mt-5 rounded-[24px] bg-background/80 p-4 ring-1 ring-border/50">
          <h3 className="text-sm font-medium">{messages.billingPage.providerChecklistTitle}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>{messages.billingPage.providerChecklistAgent}</li>
            <li>{messages.billingPage.providerChecklistBuyer}</li>
            <li>{messages.billingPage.providerChecklistAddress}</li>
          </ul>
        </div>
      </section>

      <section className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-6">
        <h2 className="text-lg font-semibold">{messages.billingPage.createInvoice}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              {messages.common.property}
            </label>
            <select
              value={propertyId ?? ""}
              onChange={(e) => {
                const nextPropertyId = e.target.value ? Number(e.target.value) : undefined;
                const nextProperty =
                  properties?.find((property) => property.id === nextPropertyId) ?? null;
                setPropertyId(nextPropertyId);
                if (nextProperty?.landlordProfile?.id) {
                  setSelectedProfileId(nextProperty.landlordProfile.id);
                }
                setAgentKeyOverride(null);
                setDefaultDueDaysOverride(null);
                setEInvoiceOverride(null);
              }}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">{messages.billingPage.chooseProperty}</option>
              {properties?.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.billingPage.selectedScope}
            </label>
            <div className="mt-1 rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm">
              {selectedPropertyName ?? messages.common.none}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.billingPage.activeSellerProfile}
            </label>
            <div className="mt-1 rounded-xl border border-border bg-secondary/40 px-3 py-3 text-sm">
              {selectedProperty?.landlordProfile?.displayName ?? messages.common.none}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <ContextCard
            label={messages.billingPage.selectedScope}
            value={selectedPropertyName ?? messages.common.none}
            detail={selectedProperty?.address ?? messages.billingPage.chooseProperty}
          />
          <ContextCard
            label={messages.billingPage.activeSellerProfile}
            value={selectedProperty?.landlordProfile?.displayName ?? messages.common.none}
            detail={
              selectedProperty?.landlordProfile?.billingName ?? messages.billingPage.chooseLandlordProfile
            }
            badge={
              selectedProperty?.landlordProfile ? (
                <StatusChip tone="success">{messages.billingPage.sellerSectionTitle}</StatusChip>
              ) : undefined
            }
          />
          <ContextCard
            label={messages.billingPage.buyerSectionTitle}
            value={buyerPreviewName}
            detail={preview.data?.buyer.email ?? selectedProperty?.billingEmail ?? messages.common.none}
            badge={
              preview.data ? (
                <StatusChip tone={preview.data.buyer.buyerType === "company" ? "warning" : "neutral"}>
                  {preview.data.buyer.buyerType === "company"
                    ? messages.billingPage.buyerTypeCompany
                    : messages.billingPage.buyerTypeIndividual}
                </StatusChip>
              ) : undefined
            }
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">{messages.billingPage.periodFrom}</label>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">{messages.billingPage.periodTo}</label>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="rounded-[20px] bg-background/80 p-3 text-sm ring-1 ring-border/50">
            <input
              type="checkbox"
              checked={includeRent}
              onChange={(e) => setIncludeRent(e.target.checked)}
              className="mr-2"
            />
            {messages.billingPage.includeRent}
          </label>
          <label className="rounded-[20px] bg-background/80 p-3 text-sm ring-1 ring-border/50">
            <input
              type="checkbox"
              checked={includeCommonFees}
              onChange={(e) => setIncludeCommonFees(e.target.checked)}
              className="mr-2"
            />
            {messages.billingPage.includeCommonFees}
          </label>
          <label className="rounded-[20px] bg-background/80 p-3 text-sm ring-1 ring-border/50">
            <input
              type="checkbox"
              checked={includeReadings}
              onChange={(e) => setIncludeReadings(e.target.checked)}
              className="mr-2"
            />
            {messages.billingPage.includeReadings}
          </label>
          <label className="rounded-[20px] bg-background/80 p-3 text-sm ring-1 ring-border/50">
            <input
              type="checkbox"
              checked={sendToProvider}
              onChange={(e) => setSendToProvider(e.target.checked)}
              className="mr-2"
            />
            {messages.billingPage.sendToProvider}
          </label>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium">{messages.common.notes}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="mt-6 rounded-[24px] bg-background/70 p-4 ring-1 ring-border/50">
          <h3 className="font-medium">{messages.billingPage.preview}</h3>

          {preview.error ? (
            <p className="mt-3 text-sm text-destructive">{preview.error.message}</p>
          ) : !preview.data ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {messages.billingPage.previewPlaceholder}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[20px] bg-card p-4 ring-1 ring-border/50">
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
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.dueDayLabel}:
                    </span>{" "}
                    {preview.data.billingDefaults.billingDueDay}
                  </p>
                </div>

                <div className="rounded-[20px] bg-card p-4 ring-1 ring-border/50">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {messages.billingPage.sellerSectionTitle}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.sellerProfileNameLabel}:
                    </span>{" "}
                    {preview.data.sellerProfile.displayName}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.sellerNameLabel}:
                    </span>{" "}
                    {preview.data.sellerProfile.billingName}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.sellerTaxNumberLabel}:
                    </span>{" "}
                    {preview.data.sellerProfile.taxNumber ?? messages.common.none}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.sellerAddressLabel}:
                    </span>{" "}
                    {preview.data.sellerProfile.billingAddress ?? messages.common.noAddress}
                  </p>
                </div>

                <div className="rounded-[20px] bg-card p-4 ring-1 ring-border/50">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {messages.billingPage.buyerSectionTitle}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.buyerNameLabel}:
                    </span>{" "}
                    {preview.data.buyer.name}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.buyerSourceLabel}:
                    </span>{" "}
                    {buyerSourceLabel}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.buyerEmailLabel}:
                    </span>{" "}
                    {preview.data.buyer.email ?? messages.common.none}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.buyerTypeLabel}:
                    </span>{" "}
                    {preview.data.buyer.buyerType === "company"
                      ? messages.billingPage.buyerTypeCompany
                      : messages.billingPage.buyerTypeIndividual}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.buyerTaxNumberLabel}:
                    </span>{" "}
                    {preview.data.buyer.taxNumber ?? messages.common.none}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.buyerAddressLabel}:
                    </span>{" "}
                    {preview.data.buyer.address ?? messages.common.noAddress}
                  </p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">
                      {messages.billingPage.vatCodeLabel}:
                    </span>{" "}
                    {preview.data.billingDefaults.vatCode}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-[20px] bg-card p-4 ring-1 ring-border/50">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {messages.billingPage.invoiceList}
                  </p>
                  <div className="mt-4 space-y-3">
                    {preview.data.items.map((item, index) => (
                      <div
                        key={`${item.description}-${index}`}
                        className="flex flex-col gap-1 rounded-[18px] bg-background/80 p-3 ring-1 ring-border/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">
                          {item.grossAmountHuf.toLocaleString(intlLocale)} {messages.common.currencyCode}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[20px] bg-card p-4 ring-1 ring-border/50">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {messages.billingPage.invoiceTotal}
                  </p>
                  <p className="mt-4 text-3xl font-semibold tracking-tight">
                    {preview.data.grossTotalHuf.toLocaleString(intlLocale)} {messages.common.currencyCode}
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        {messages.billingPage.issueDateLabel}:
                      </span>{" "}
                      {new Date(preview.data.issueDate).toLocaleDateString(intlLocale)}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        {messages.billingPage.dueDateLabel}:
                      </span>{" "}
                      {new Date(preview.data.dueDate).toLocaleDateString(intlLocale)}
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
        </div>

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
          {createInvoice.data && (
            <p className="mt-3 text-sm text-muted-foreground">
              {createInvoice.data.synced
                ? messages.billingPage.createdAndSynced
                : messages.billingPage.createdDraft}
            </p>
          )}
          {createInvoice.error && (
            <p className="mt-3 text-sm text-destructive">
              {createInvoice.error.message}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[28px] bg-card/90 p-4 shadow-sm ring-1 ring-border/60 sm:p-6">
        <h2 className="text-lg font-semibold">{messages.billingPage.invoiceList}</h2>

        {invoices?.length ? (
          <div className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-[22px] bg-background/80 p-4 ring-1 ring-border/50"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {invoice.invoiceNumber ?? `#${invoice.id}`} - {invoice.property.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {invoice.buyerName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(invoice.issueDate).toLocaleDateString(intlLocale)} -{" "}
                      <span className="capitalize">{invoice.status}</span>
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">
                      {invoice.grossTotalHuf.toLocaleString(intlLocale)} {messages.common.currencyCode}
                    </p>
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block text-sm text-primary hover:underline"
                      >
                        {messages.billingPage.viewPdf}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {messages.billingPage.noInvoices}
          </p>
        )}
      </section>
    </div>
  );
}
