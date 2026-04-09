"use client";

import { useState } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import { api } from "@/trpc/react";

const PROFILE_COLORS = [
  { value: "blue", label: "Kék", bg: "bg-blue-500" },
  { value: "emerald", label: "Zöld", bg: "bg-emerald-500" },
  { value: "purple", label: "Lila", bg: "bg-purple-500" },
  { value: "amber", label: "Sárga", bg: "bg-amber-500" },
  { value: "rose", label: "Piros", bg: "bg-rose-500" },
  { value: "sky", label: "Égkék", bg: "bg-sky-500" },
  { value: "orange", label: "Narancs", bg: "bg-orange-500" },
  { value: "slate", label: "Szürke", bg: "bg-slate-500" },
] as const;

type ProfileFormState = {
  displayName: string;
  profileType: "individual" | "company" | "co_ownership";
  billingName: string;
  billingEmail: string;
  billingAddress: string;
  taxNumber: string;
  color: string;
  agentKey: string;
  eInvoice: boolean;
  defaultDueDays: string;
  defaultVatCode: "TAM" | "AAM" | "27";
  isDefault: boolean;
};

const emptyForm: ProfileFormState = {
  displayName: "",
  profileType: "individual",
  billingName: "",
  billingEmail: "",
  billingAddress: "",
  taxNumber: "",
  color: "blue",
  agentKey: "",
  eInvoice: true,
  defaultDueDays: "5",
  defaultVatCode: "TAM",
  isDefault: false,
};

export default function LandlordProfilesPage() {
  const { messages } = useLocale();
  const utils = api.useUtils();
  const { data: profiles } = api.landlordProfile.list.useQuery();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProfileFormState>(emptyForm);

  const createProfile = api.landlordProfile.create.useMutation({
    onSuccess: async () => {
      setForm(emptyForm);
      await utils.landlordProfile.list.invalidate();
    },
  });
  const updateProfile = api.landlordProfile.update.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      setForm(emptyForm);
      await Promise.all([
        utils.landlordProfile.list.invalidate(),
        utils.property.list.invalidate(),
      ]);
    },
  });
  const removeProfile = api.landlordProfile.remove.useMutation({
    onSuccess: async () => {
      await utils.landlordProfile.list.invalidate();
    },
  });

  const submit = () => {
    const payload = {
      displayName: form.displayName,
      profileType: form.profileType,
      billingName: form.billingName,
      billingEmail: form.billingEmail || undefined,
      billingAddress: form.billingAddress || undefined,
      taxNumber: form.taxNumber || undefined,
      color: (form.color || undefined) as "blue" | "emerald" | "purple" | "amber" | "rose" | "sky" | "orange" | "slate" | undefined,
      agentKey: form.agentKey || undefined,
      eInvoice: form.eInvoice,
      defaultDueDays: Number(form.defaultDueDays || 5),
      defaultVatCode: form.defaultVatCode,
      isDefault: form.isDefault,
    };

    if (editingId) {
      updateProfile.mutate({ id: editingId, ...payload });
      return;
    }

    createProfile.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{messages.settingsPage.landlordProfiles}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {messages.settingsPage.landlordProfilesDescription}
        </p>
      </div>

      <section className="rounded-2xl border border-border p-4 sm:p-6">
        <h2 className="text-lg font-semibold">
          {editingId
            ? messages.settingsPage.editLandlordProfile
            : messages.settingsPage.newLandlordProfile}
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileDisplayName}
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileType}
            </label>
            <select
              value={form.profileType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  profileType: e.target.value as ProfileFormState["profileType"],
                }))
              }
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            >
              <option value="individual">{messages.settingsPage.profileTypeIndividual}</option>
              <option value="company">{messages.settingsPage.profileTypeCompany}</option>
              <option value="co_ownership">{messages.settingsPage.profileTypeCoOwnership}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Szín</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROFILE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color: c.value }))}
                  title={c.label}
                  className={`h-8 w-8 rounded-full ${c.bg} transition ring-offset-2 ring-offset-background ${
                    form.color === c.value ? "ring-2 ring-primary" : "ring-0 hover:ring-2 hover:ring-border"
                  }`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileBillingName}
            </label>
            <input
              type="text"
              value={form.billingName}
              onChange={(e) => setForm((prev) => ({ ...prev, billingName: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileBillingEmail}
            </label>
            <input
              type="email"
              value={form.billingEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, billingEmail: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileBillingAddress}
            </label>
            <input
              type="text"
              value={form.billingAddress}
              onChange={(e) => setForm((prev) => ({ ...prev, billingAddress: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileTaxNumber}
            </label>
            <input
              type="text"
              value={form.taxNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, taxNumber: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileVatCode}
            </label>
            <select
              value={form.defaultVatCode}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  defaultVatCode: e.target.value as "TAM" | "AAM" | "27",
                }))
              }
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            >
              <option value="TAM">TAM</option>
              <option value="AAM">AAM</option>
              <option value="27">27% ÁFA</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileAgentKey}
            </label>
            <input
              type="password"
              value={form.agentKey}
              onChange={(e) => setForm((prev) => ({ ...prev, agentKey: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              {messages.settingsPage.profileDueDays}
            </label>
            <input
              type="number"
              min="0"
              max="31"
              value={form.defaultDueDays}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, defaultDueDays: e.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.eInvoice}
              onChange={(e) => setForm((prev) => ({ ...prev, eInvoice: e.target.checked }))}
            />
            <span>{messages.settingsPage.profileEInvoice}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
            />
            <span>{messages.settingsPage.profileDefault}</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={
              !form.displayName ||
              !form.billingName ||
              createProfile.isPending ||
              updateProfile.isPending
            }
            className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {editingId
              ? messages.settingsPage.saveLandlordProfile
              : messages.settingsPage.createLandlordProfile}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-xl border border-border px-5 py-3 text-sm hover:bg-secondary"
            >
              {messages.common.cancel}
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border p-4 sm:p-6">
        <h2 className="text-lg font-semibold">{messages.settingsPage.savedLandlordProfiles}</h2>
        <div className="mt-4 space-y-3">
          {profiles?.map((profile) => (
            <div key={profile.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${PROFILE_COLORS.find((c) => c.value === profile.color)?.bg ?? "bg-slate-500"}`} />
                    <p className="font-medium">{profile.displayName}</p>
                    {profile.isDefault && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {messages.settingsPage.profileDefaultBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {profile.billingName}
                    {profile.taxNumber ? ` · ${profile.taxNumber}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {profile.billingAddress ?? messages.common.noAddress}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {messages.settingsPage.profilePropertyCount}: {profile.propertyCount}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(profile.id);
                      setForm({
                        displayName: profile.displayName,
                        profileType: profile.profileType,
                        billingName: profile.billingName,
                        billingEmail: profile.billingEmail ?? "",
                        billingAddress: profile.billingAddress ?? "",
                        taxNumber: profile.taxNumber ?? "",
                        color: profile.color ?? "blue",
                        agentKey: profile.agentKey ?? "",
                        eInvoice: profile.eInvoice,
                        defaultDueDays: String(profile.defaultDueDays),
                        defaultVatCode:
                          (profile.defaultVatCode as "TAM" | "AAM" | "27") ?? "TAM",
                        isDefault: profile.isDefault,
                      });
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
                  >
                    {messages.settingsPage.editLandlordProfile}
                  </button>
                  {!profile.isDefault && (
                    <button
                      type="button"
                      onClick={() => removeProfile.mutate({ id: profile.id })}
                      className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/5"
                    >
                      {messages.settingsPage.deleteLandlordProfile}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
