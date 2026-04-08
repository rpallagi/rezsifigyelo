"use client";

import { useState } from "react";

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

export function BillingClient() {
  const { messages, intlLocale } = useLocale();
  const { data: properties } = api.property.list.useQuery();
  const { data: invoiceSettings } = api.invoice.getSettings.useQuery();
  const { data: invoices } = api.invoice.list.useQuery();

  const [agentKeyOverride, setAgentKeyOverride] = useState<string | null>(null);
  const [defaultDueDaysOverride, setDefaultDueDaysOverride] = useState<string | null>(null);
  const [eInvoiceOverride, setEInvoiceOverride] = useState<boolean | null>(null);
  const [propertyId, setPropertyId] = useState<number | undefined>();
  const [periodFrom, setPeriodFrom] = useState(startOfMonth());
  const [periodTo, setPeriodTo] = useState(today());
  const [includeRent, setIncludeRent] = useState(true);
  const [includeCommonFees, setIncludeCommonFees] = useState(true);
  const [includeReadings, setIncludeReadings] = useState(true);
  const [sendToProvider, setSendToProvider] = useState(true);
  const [note, setNote] = useState("");

  const agentKey = agentKeyOverride ?? invoiceSettings?.agentKey ?? "";
  const defaultDueDays =
    defaultDueDaysOverride ?? String(invoiceSettings?.defaultDueDays ?? 8);
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
    properties?.find((property) => property.id === propertyId)?.name ?? null;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{messages.billingPage.providerTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.billingPage.providerDescription}
        </p>

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

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              saveSettings.mutate({
                agentKey,
                defaultDueDays: Number(defaultDueDays || 8),
                eInvoice,
              })
            }
            disabled={!agentKey || saveSettings.isPending}
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
      </section>

      <section className="rounded-2xl border border-border p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{messages.billingPage.createInvoice}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              {messages.common.property}
            </label>
            <select
              value={propertyId ?? ""}
              onChange={(e) => setPropertyId(e.target.value ? Number(e.target.value) : undefined)}
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
          <label className="rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={includeRent}
              onChange={(e) => setIncludeRent(e.target.checked)}
              className="mr-2"
            />
            {messages.billingPage.includeRent}
          </label>
          <label className="rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={includeCommonFees}
              onChange={(e) => setIncludeCommonFees(e.target.checked)}
              className="mr-2"
            />
            {messages.billingPage.includeCommonFees}
          </label>
          <label className="rounded-xl border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={includeReadings}
              onChange={(e) => setIncludeReadings(e.target.checked)}
              className="mr-2"
            />
            {messages.billingPage.includeReadings}
          </label>
          <label className="rounded-xl border border-border p-3 text-sm">
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

        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-medium">{messages.billingPage.preview}</h3>

          {preview.error ? (
            <p className="mt-3 text-sm text-destructive">{preview.error.message}</p>
          ) : !preview.data ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {messages.billingPage.previewPlaceholder}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {preview.data.items.map((item, index) => (
                <div
                  key={`${item.description}-${index}`}
                  className="flex flex-col gap-1 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
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

              <div className="rounded-xl bg-secondary/50 p-4 text-sm">
                <p>
                  {messages.billingPage.invoiceTotal}:{" "}
                  <span className="font-semibold">
                    {preview.data.grossTotalHuf.toLocaleString(intlLocale)} {messages.common.currencyCode}
                  </span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  {messages.billingPage.issueDateLabel}:{" "}
                  {new Date(preview.data.issueDate).toLocaleDateString(intlLocale)}
                  {" · "}
                  {messages.billingPage.dueDateLabel}:{" "}
                  {new Date(preview.data.dueDate).toLocaleDateString(intlLocale)}
                </p>
              </div>
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

      <section className="rounded-2xl border border-border p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{messages.billingPage.invoiceList}</h2>

        {invoices?.length ? (
          <div className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-border p-4"
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
