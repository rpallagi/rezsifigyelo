"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/trpc/react";
import { CurrencyInput } from "@/components/shared/currency-input";
import { TaxNumberInput } from "@/components/shared/tax-number-input";
import { PhoneInput } from "@/components/shared/phone-input";

export default function TenantEditPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = Number(params.id);

  const { data: property, isLoading } = api.property.get.useQuery({ id: propertyId });

  const activeTenancy = property?.tenancies?.find(
    (t: { active: boolean }) => t.active,
  );

  const [tenantType, setTenantType] = useState<"individual" | "company">("individual");
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantMotherName, setTenantMotherName] = useState("");
  const [tenantBirthPlace, setTenantBirthPlace] = useState("");
  const [tenantBirthDate, setTenantBirthDate] = useState("");
  const [tenantTaxNumber, setTenantTaxNumber] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositCurrency, setDepositCurrency] = useState<"HUF" | "EUR">("HUF");
  const [leaseMonths, setLeaseMonths] = useState("");

  const [billingSameAsTenant, setBillingSameAsTenant] = useState(true);
  const [billingName, setBillingName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [billingTaxNumber, setBillingTaxNumber] = useState("");
  const [billingBuyerType, setBillingBuyerType] = useState<"individual" | "company">("individual");

  useEffect(() => {
    if (activeTenancy) {
      setTenantType((activeTenancy.tenantType as "individual" | "company") ?? "individual");
      setTenantName(activeTenancy.tenantName ?? "");
      setTenantEmail(activeTenancy.tenantEmail ?? "");
      setTenantPhone(activeTenancy.tenantPhone ?? "");
      setTenantAddress(activeTenancy.tenantAddress ?? "");
      setTenantMotherName(activeTenancy.tenantMotherName ?? "");
      setTenantBirthPlace(activeTenancy.tenantBirthPlace ?? "");
      setTenantBirthDate(activeTenancy.tenantBirthDate ?? "");
      setTenantTaxNumber(activeTenancy.tenantTaxNumber ?? "");
      setDepositAmount(activeTenancy.depositAmount?.toString() ?? "");
      setDepositCurrency((activeTenancy.depositCurrency as "HUF" | "EUR") ?? "HUF");
      setLeaseMonths(activeTenancy.leaseMonths?.toString() ?? "");

      const hasBillingOverride = !!(activeTenancy.billingName?.trim());
      setBillingSameAsTenant(!hasBillingOverride);
      setBillingName(activeTenancy.billingName ?? "");
      setBillingEmail(activeTenancy.billingEmail ?? "");
      setBillingAddress(activeTenancy.billingAddress ?? "");
      setBillingTaxNumber(activeTenancy.billingTaxNumber ?? "");
      setBillingBuyerType((activeTenancy.billingBuyerType as "individual" | "company") ?? "individual");
    }
  }, [activeTenancy]);

  const utils = api.useUtils();
  const updateTenant = api.tenancy.updateTenant.useMutation({
    onSuccess: async () => {
      await utils.property.get.invalidate({ id: propertyId });
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
      depositCurrency,
      leaseMonths: leaseMonths ? Number(leaseMonths) : undefined,
      billingName: !billingSameAsTenant ? (billingName || undefined) : "",
      billingEmail: !billingSameAsTenant ? (billingEmail || undefined) : "",
      billingAddress: !billingSameAsTenant ? (billingAddress || undefined) : "",
      billingTaxNumber: !billingSameAsTenant ? (billingTaxNumber || undefined) : "",
      billingBuyerType: !billingSameAsTenant ? billingBuyerType : undefined,
    });
  };

  if (isLoading) return <p className="text-muted-foreground">Betöltés...</p>;
  if (!property) return <p className="text-destructive">Ingatlan nem található.</p>;
  if (!activeTenancy) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="text-muted-foreground">Nincs aktív bérlő ennél az ingatlannál.</p>
        <Link
          href={`/properties/${propertyId}`}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Vissza
        </Link>
      </div>
    );
  }

  const inputCls = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/properties/${propertyId}`}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Vissza az ingatlanhoz
      </Link>

      <h1 className="text-2xl font-bold">Bérlő adatai</h1>
      <p className="mt-1 text-sm text-muted-foreground">{property.name}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Type selector */}
        <div className="flex gap-2">
          {([
            { value: "individual", label: "Magánszemély" },
            { value: "company", label: "Cég" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTenantType(opt.value)}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                tenantType === opt.value
                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20"
                  : "border-border hover:bg-secondary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Personal data */}
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">
            {tenantType === "company" ? "Cégadatok" : "Személyes adatok"}
          </legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">
                {tenantType === "company" ? "Cégnév" : "Teljes név"} *
              </label>
              <input
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Email</label>
              <input
                type="email"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Telefonszám</label>
              <PhoneInput
                value={tenantPhone}
                onChange={setTenantPhone}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                {tenantType === "company" ? "Székhely" : "Állandó lakcím"}
              </label>
              <input
                type="text"
                value={tenantAddress}
                onChange={(e) => setTenantAddress(e.target.value)}
                className={inputCls}
              />
            </div>

            {tenantType === "individual" ? (
              <>
                <div>
                  <label className="block text-xs text-muted-foreground">Anyja neve</label>
                  <input
                    type="text"
                    value={tenantMotherName}
                    onChange={(e) => setTenantMotherName(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Születési hely</label>
                  <input
                    type="text"
                    value={tenantBirthPlace}
                    onChange={(e) => setTenantBirthPlace(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Születési dátum</label>
                  <input
                    type="date"
                    value={tenantBirthDate}
                    onChange={(e) => setTenantBirthDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs text-muted-foreground">Adószám *</label>
                <TaxNumberInput
                  value={tenantTaxNumber}
                  onChange={setTenantTaxNumber}
                  onCompanyFound={(data) => {
                    setTenantName(data.name);
                    if (data.address) setTenantAddress(data.address);
                  }}
                  className={inputCls}
                />
              </div>
            )}
          </div>
        </fieldset>

        {/* Lease info */}
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Bérleti viszony</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">Kaució</label>
              <div className="mt-1 flex gap-2">
                <CurrencyInput
                  value={depositAmount}
                  onChange={setDepositAmount}
                  placeholder="0"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex gap-1 rounded-md border border-border p-0.5">
                  {(["HUF", "EUR"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDepositCurrency(c)}
                      className={`rounded px-2.5 py-1.5 text-xs font-medium transition ${
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
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Szerződés (hónap)</label>
              <input
                type="number"
                min="0"
                value={leaseMonths}
                onChange={(e) => setLeaseMonths(e.target.value)}
                placeholder="12"
                className={inputCls}
              />
            </div>
          </div>
        </fieldset>

        {/* Billing override */}
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Számlázási adatok</legend>
          <label className="flex items-center gap-3 rounded-xl bg-background/80 px-4 py-3">
            <input
              type="checkbox"
              checked={billingSameAsTenant}
              onChange={(e) => setBillingSameAsTenant(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <div>
              <p className="text-sm font-medium">A számlázási adatok megegyeznek a bérlő adataival</p>
              <p className="text-xs text-muted-foreground">
                Ha a számla más névre szól, kapcsold ki.
              </p>
            </div>
          </label>

          {!billingSameAsTenant && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs text-muted-foreground">Számla címzett neve *</label>
                <input
                  type="text"
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder="pl. Példa Kft."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">Számla címzett email</label>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">Számlázási cím</label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Ha eltér a bérlő címétől"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">Címzett típusa</label>
                <select
                  value={billingBuyerType}
                  onChange={(e) => setBillingBuyerType(e.target.value as "individual" | "company")}
                  className={inputCls}
                >
                  <option value="individual">Magánszemély</option>
                  <option value="company">Cég</option>
                </select>
              </div>
              {billingBuyerType === "company" && (
                <div>
                  <label className="block text-xs text-muted-foreground">Adószám *</label>
                  <TaxNumberInput
                    value={billingTaxNumber}
                    onChange={setBillingTaxNumber}
                    onCompanyFound={(data) => {
                      setBillingName(data.name);
                      if (data.address) setBillingAddress(data.address);
                    }}
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          )}
        </fieldset>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!tenantName || updateTenant.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateTenant.isPending ? "Mentés..." : "Mentés"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>

        {updateTenant.error && (
          <p className="text-sm text-destructive">
            Hiba: {updateTenant.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
