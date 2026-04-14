"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { PhoneInput } from "@/components/shared/phone-input";

interface TenantEditActionsProps {
  tenancyId: number;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
}

export function TenantEditActions({
  tenancyId,
  initialName,
  initialEmail,
  initialPhone,
}: TenantEditActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);

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

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Név"
        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
      />
      <PhoneInput
        value={phone}
        onChange={setPhone}
        placeholder="+36 30 123 4567"
        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({
              tenancyId,
              tenantName: name || undefined,
              tenantEmail: email || undefined,
              tenantPhone: phone || undefined,
            })
          }
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {update.isPending ? "..." : "Mentés"}
        </button>
        <button
          type="button"
          onClick={() => {
            setName(initialName);
            setEmail(initialEmail);
            setPhone(initialPhone);
            setEditing(false);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-secondary/50"
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
