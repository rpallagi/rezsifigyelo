"use client";

import Link from "next/link";

interface TenantEditActionsProps {
  propertyId: number;
  tenancyId: number;
}

export function TenantEditActions({ propertyId }: TenantEditActionsProps) {
  return (
    <Link
      href={`/properties/${propertyId}/move-in?edit=true`}
      className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary/50"
    >
      Szerkesztés
    </Link>
  );
}
