"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/trpc/react";

interface TaxNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onCompanyFound?: (data: { name: string; taxNumber: string; address: string }) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export function TaxNumberInput({
  value,
  onChange,
  onCompanyFound,
  className = "h-12 w-full rounded-2xl border border-border/60 bg-background/80 px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-4 focus:ring-primary/10",
  placeholder = "12345678-1-23",
  required,
}: TaxNumberInputProps) {
  const [lookupError, setLookupError] = useState("");
  const [lookupSuccess, setLookupSuccess] = useState("");

  const lookup = api.tenancy.lookupTaxNumber.useMutation({
    onSuccess: (data) => {
      setLookupError("");
      setLookupSuccess(`${data.name}`);
      onChange(data.taxNumber);
      onCompanyFound?.(data);
      setTimeout(() => setLookupSuccess(""), 5000);
    },
    onError: (err) => {
      setLookupError(err.message);
      setLookupSuccess("");
    },
  });

  const canLookup = value.replace(/\D/g, "").length >= 8;

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setLookupError("");
            setLookupSuccess("");
          }}
          placeholder={placeholder}
          required={required}
          className={className}
        />
        <button
          type="button"
          disabled={!canLookup || lookup.isPending}
          onClick={() => {
            setLookupError("");
            setLookupSuccess("");
            lookup.mutate({ taxNumber: value });
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-border/60 bg-background/80 px-3 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40"
          title="Adatok lekérdezése a NAV-tól"
        >
          {lookup.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          Lekérdezés
        </button>
      </div>
      {lookupSuccess && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {lookupSuccess}
        </p>
      )}
      {lookupError && (
        <p className="text-xs text-destructive">{lookupError}</p>
      )}
    </div>
  );
}
