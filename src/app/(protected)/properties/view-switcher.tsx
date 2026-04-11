"use client";

import { useRouter } from "next/navigation";
import { LayoutGrid, Grid3x3, List, Table } from "lucide-react";

const VIEWS = [
  { id: "grid", icon: LayoutGrid, label: "Nagy kártya" },
  { id: "compact", icon: Grid3x3, label: "Kis kártya" },
  { id: "list", icon: List, label: "Lista" },
  { id: "table", icon: Table, label: "Táblázat" },
] as const;

export function ViewSwitcher({ active }: { active: string }) {
  const router = useRouter();

  function switchView(view: string) {
    document.cookie = `rezsi-property-view=${view}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.push(`/properties?view=${view}`);
  }

  return (
    <div className="flex gap-1 rounded-xl bg-secondary p-1">
      {VIEWS.map((v) => {
        const Icon = v.icon;
        const isActive = active === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => switchView(v.id)}
            title={v.label}
            className={`rounded-lg p-2 transition ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
