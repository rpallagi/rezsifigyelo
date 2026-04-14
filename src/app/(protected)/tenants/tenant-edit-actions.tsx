"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { PhoneInput } from "@/components/shared/phone-input";
import { ChevronDown, Loader2 } from "lucide-react";

interface TenantEditActionsProps {
  tenancyId: number;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialAddress?: string;
  initialMotherName?: string;
  initialBirthPlace?: string;
  initialBirthDate?: string;
  initialTenantType?: string;
  initialTaxNumber?: string;
  initialBillingName?: string;
  initialBillingEmail?: string;
  initialBillingAddress?: string;
  initialBillingTaxNumber?: string;
  initialBillingBuyerType?: string;
  initialDepositAmount?: number;
  initialDepositCurrency?: string;
  initialLeaseMonths?: number;
}

export function TenantEditActions({
  tenancyId,
  initialName,
  initialEmail,
  initialPhone,
  initialAddress = "",
  initialMotherName = "",
  initialBirthPlace = "",
  initialBirthDate = "",
  initialTenantType = "individual",
  initialTaxNumber = "",
  initialBillingName = "",
  initialBillingEmail = "",
  initialBillingAddress = "",
  initialBillingTaxNumber = "",
  initialBillingBuyerType = "individual",
  initialDepositAmount,
  initialDepositCurrency = "HUF",
  initialLeaseMonths,
}: TenantEditActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [motherName, setMotherName] = useState(initialMotherName);
  const [birthPlace, setBirthPlace] = useState(initialBirthPlace);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [tenantType, setTenantType] = useState(initialTenantType);
  const [taxNumber, setTaxNumber] = useState(initialTaxNumber);
  const [billingName, setBillingName] = useState(initialBillingName);
  const [billingEmail, setBillingEmail] = useState(initialBillingEmail);
  const [billingAddress, setBillingAddress] = useState(initialBillingAddress);
  const [billingTaxNumber, setBillingTaxNumber] = useState(initialBillingTaxNumber);
  const [billingBuyerType, setBillingBuyerType] = useState(initialBillingBuyerType);
  const [depositAmount, setDepositAmount] = useState(initialDepositAmount?.toString() ?? "");
  const [depositCurrency, setDepositCurrency] = useState(initialDepositCurrency);
  const [leaseMonths, setLeaseMonths] = useState(initialLeaseMonths?.toString() ?? "");
  const [showBilling, setShowBilling] = useState(!!initialBillingName);

  const update = api.tenancy.updateTenant.useMutation({
    onSuccess: () => {
      setEditing(false);
      router.refresh();
    },
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary/50"
      >
        Szerkesztés
      </button>
    );
  }

  const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  const handleSave = () => {
    update.mutate({
      tenancyId,
      tenantName: name || undefined,
      tenantEmail: email || undefined,
      tenantPhone: phone || undefined,
      tenantAddress: address || undefined,
      tenantMotherName: motherName || undefined,
      tenantBirthPlace: birthPlace || undefined,
      tenantBirthDate: birthDate || undefined,
      tenantType: tenantType as "individual" | "company",
      tenantTaxNumber: taxNumber || undefined,
      billingName: billingName || undefined,
      billingEmail: billingEmail || undefined,
      billingAddress: billingAddress || undefined,
      billingTaxNumber: billingTaxNumber || undefined,
      billingBuyerType: billingBuyerType as "individual" | "company",
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
      depositCurrency: depositCurrency as "HUF" | "EUR",
      leaseMonths: leaseMonths ? Number(leaseMonths) : undefined,
    });
  };

  return (
    <div className="col-span-full rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
      <h3 className="text-base font-semibold">Bérlő szerkesztése</h3>

      {/* Basic info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Név</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Típus</label>
          <select value={tenantType} onChange={(e) => setTenantType(e.target.value)} className={inputClass}>
            <option value="individual">Magánszemély</option>
            <option value="company">Cég</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Telefon</label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Cím</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Lakcím" className={inputClass} />
        </div>
      </div>

      {/* Personal details (individuals) */}
      {tenantType === "individual" && (
        <fieldset className="rounded-lg border border-border p-4 space-y-3">
          <legend className="px-2 text-xs font-medium text-muted-foreground">Személyes adatok</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Anyja neve</label>
              <input type="text" value={motherName} onChange={(e) => setMotherName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Születési hely</label>
              <input type="text" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Születési dátum</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} />
            </div>
          </div>
        </fieldset>
      )}

      {/* Tax number */}
      <div>
        <label className={labelClass}>Adószám</label>
        <input type="text" value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="12345678-1-23" className={inputClass} />
      </div>

      {/* Lease + deposit */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Bérleti időszak (hónap)</label>
          <input type="number" value={leaseMonths} onChange={(e) => setLeaseMonths(e.target.value)} placeholder="12" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Kaució</label>
          <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Kaució pénznem</label>
          <div className="flex gap-1 mt-1">
            {(["HUF", "EUR"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDepositCurrency(c)}
                className={`rounded px-3 py-2 text-xs font-medium transition ${
                  depositCurrency === c ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"
                }`}
              >
                {c === "HUF" ? "Ft" : "€"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Billing override */}
      <div>
        <button
          type="button"
          onClick={() => setShowBilling(!showBilling)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-3 w-3 transition ${showBilling ? "rotate-180" : ""}`} />
          Számlázási adatok felülírása
        </button>
        {showBilling && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Számlázási név</label>
              <input type="text" value={billingName} onChange={(e) => setBillingName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Számlázási email</label>
              <input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Számlázási cím</label>
              <input type="text" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Számlázási adószám</label>
              <input type="text" value={billingTaxNumber} onChange={(e) => setBillingTaxNumber(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Vevő típus</label>
              <select value={billingBuyerType} onChange={(e) => setBillingBuyerType(e.target.value)} className={inputClass}>
                <option value="individual">Magánszemély</option>
                <option value="company">Cég</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          type="button"
          disabled={update.isPending}
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Mentés
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-secondary/50"
        >
          Mégse
        </button>
        {update.isError && (
          <span className="text-xs text-destructive">Hiba történt</span>
        )}
      </div>
    </div>
  );
}
