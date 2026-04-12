"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Search, Clock, ArrowDownAZ } from "lucide-react";
import { api } from "@/trpc/react";

type SortMode = "recent" | "name" | "unread";

function timeAgo(date: Date | string) {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "most";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} perce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} órája`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} napja`;
  return d.toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const { data: items = [], isLoading } = api.chat.listOverview.useQuery();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? items.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.address ?? "").toLowerCase().includes(q) ||
            (p.tenantName ?? "").toLowerCase().includes(q) ||
            (p.lastMessage ?? "").toLowerCase().includes(q),
        )
      : [...items];

    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name, "hu"));
    } else if (sort === "unread") {
      list.sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread;
        // secondary: recent
        const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        return tb - ta;
      });
    } else {
      // recent
      list.sort((a, b) => {
        const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
        const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
        if (ta !== tb) return tb - ta;
        return a.name.localeCompare(b.name, "hu");
      });
    }
    return list;
  }, [items, search, sort]);

  const totalUnread = items.reduce((s, p) => s + p.unread, 0);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Üzenetek</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chat minden ingatlanhoz{totalUnread > 0 ? ` · ${totalUnread} olvasatlan` : ""}
          </p>
        </div>
      </div>

      {/* Search + sort */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés: ingatlan, cím, bérlő, üzenet..."
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {(
            [
              { key: "recent" as const, label: "Legutóbbi", icon: Clock },
              { key: "name" as const, label: "Név", icon: ArrowDownAZ },
              { key: "unread" as const, label: "Olvasatlan", icon: MessageCircle },
            ]
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                sort === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Betöltés...</p>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {search ? "Nincs találat." : "Még nincs ingatlan."}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/properties/${p.id}/chat`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:bg-secondary/40 hover:shadow-sm"
            >
              {/* Thumbnail */}
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {p.avatarUrl ? (
                  <img src={p.avatarUrl} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                {p.unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
                    {p.unread > 9 ? "9+" : p.unread}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`truncate text-sm ${p.unread > 0 ? "font-bold" : "font-semibold"}`}>
                    {p.name}
                  </h3>
                  {p.lastAt && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(p.lastAt)}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {p.tenantName ?? "Nincs aktív bérlő"}
                  {p.address && <span className="opacity-60"> · {p.address}</span>}
                </p>
                {p.lastMessage && (
                  <p className={`mt-0.5 truncate text-xs ${p.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {p.lastMessage}
                  </p>
                )}
                {!p.lastMessage && (
                  <p className="mt-0.5 text-xs italic text-muted-foreground/60">
                    Nincs még üzenet
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
