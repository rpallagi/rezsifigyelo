"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, Building2, ChevronDown } from "lucide-react";

type Property = {
  id: number;
  name: string;
  address: string | null;
};

export function NewReadingDropdown({
  properties,
}: {
  properties: Property[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (properties.length === 0) {
    return (
      <Link
        href="/properties"
        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        <PlusCircle className="h-4 w-4" />
        + Új leolvasás
      </Link>
    );
  }

  if (properties.length === 1) {
    return (
      <Link
        href={`/properties/${properties[0]!.id}/readings/new`}
        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        <PlusCircle className="h-4 w-4" />
        + Új leolvasás
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
      >
        <PlusCircle className="h-4 w-4" />
        + Új leolvasás
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-[20px] border border-border/60 bg-card p-2 shadow-xl ring-1 ring-border/60">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Válassz ingatlant
          </p>
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}/readings/new`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition hover:bg-secondary"
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate font-medium">{property.name}</p>
                {property.address && (
                  <p className="truncate text-xs text-muted-foreground">
                    {property.address}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
