import { Wrench, Download, Building2, Receipt, Hammer, ShieldCheck, ImageIcon, FileText } from "lucide-react";

import { PropertyCoverImage } from "@/components/properties/property-cover-image";
import { formatCurrency, formatNumber, getMessages, type Locale } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { api } from "@/trpc/server";
import { MaintenanceEntryActions } from "./maintenance-entry-actions";
import { MaintenanceDemoActions } from "./maintenance-demo-actions";
import { NewEntryDropdown } from "./new-entry-dropdown";

type MaintenanceCategory = "javitas" | "karbantartas" | "felujitas" | "csere";
type MaintenanceStatus = "pending" | "in_progress" | "done";

type DisplayLog = {
  id: string | number;
  description: string;
  category: MaintenanceCategory;
  costHuf: number;
  priority: string;
  status: MaintenanceStatus;
  performedBy: string | null;
  performedDate: string | null;
  propertyId: number | null;
  propertyName: string;
  propertyAddress: string | null;
  propertyType: string;
  propertyAvatarUrl: string | null;
  photoUrls: string[];
  documentUrls: string[];
  mock?: boolean;
};

function categoryMeta(category: MaintenanceCategory, locale: Locale) {
  const hu = locale === "hu";

  switch (category) {
    case "javitas":
      return {
        label: hu ? "Javitas" : "Repair",
        badge:
          "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary-foreground",
        iconWrap:
          "bg-primary/5 group-hover:bg-primary/10 text-primary dark:bg-primary/10 dark:group-hover:bg-primary/20",
        icon: Wrench,
      };
    case "karbantartas":
      return {
        label: hu ? "Karbantartas" : "Maintenance",
        badge:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        iconWrap:
          "bg-emerald-50 group-hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:group-hover:bg-emerald-950/30",
        icon: ShieldCheck,
      };
    case "felujitas":
      return {
        label: hu ? "Felujitas" : "Renovation",
        badge:
          "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
        iconWrap:
          "bg-amber-50 group-hover:bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:group-hover:bg-amber-950/30",
        icon: Hammer,
      };
    case "csere":
      return {
        label: hu ? "Csere" : "Replacement",
        badge:
          "bg-sky-100 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
        iconWrap:
          "bg-sky-50 group-hover:bg-sky-100 text-sky-700 dark:bg-sky-950/20 dark:group-hover:bg-sky-950/30",
        icon: Receipt,
      };
  }
}

function priorityBadge(priority: string, locale: Locale) {
  switch (priority) {
    case "low":
      return {
        label: locale === "hu" ? "Alacsony" : "Low",
        className:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
    case "urgent":
      return {
        label: locale === "hu" ? "Surgos" : "Urgent",
        className:
          "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300",
      };
    default:
      return {
        label: locale === "hu" ? "Normal" : "Normal",
        className:
          "bg-secondary text-muted-foreground",
      };
  }
}

function statusBadge(status: MaintenanceStatus, locale: Locale) {
  switch (status) {
    case "pending":
      return {
        label: locale === "hu" ? "Fuggoben" : "Pending",
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
      };
    case "in_progress":
      return {
        label: locale === "hu" ? "Folyamatban" : "In progress",
        className:
          "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
      };
    case "done":
      return {
        label: locale === "hu" ? "Kesz" : "Done",
        className:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
      };
  }
}

function normalizeCategory(raw: string | null | undefined): MaintenanceCategory {
  const value = raw?.toLowerCase() ?? "";

  if (
    value.includes("karbant") ||
    value.includes("tiszt") ||
    value.includes("szerv")
  ) {
    return "karbantartas";
  }
  if (value.includes("feluj") || value.includes("fest") || value.includes("butor")) {
    return "felujitas";
  }
  if (value.includes("csere") || value.includes("villany")) {
    return "csere";
  }

  return "javitas";
}

function normalizeStatus(raw: string | null | undefined, performedDate: string | null): MaintenanceStatus {
  if (raw === "in_progress") return "in_progress";
  if (raw === "done" || performedDate) return "done";
  return "pending";
}

function propertyTypeLabel(propertyType: string, locale: Locale) {
  switch (propertyType) {
    case "uzlet":
      return locale === "hu" ? "Uzlet" : "Commercial";
    case "telek":
      return locale === "hu" ? "Telek" : "Plot";
    case "egyeb":
      return locale === "hu" ? "Egyeb" : "Other";
    default:
      return locale === "hu" ? "Lakas" : "Apartment";
  }
}

function propertyPlaceholder(propertyType: string) {
  switch (propertyType) {
    case "uzlet":
      return "linear-gradient(135deg, rgba(0,108,73,0.92), rgba(108,248,187,0.68)), radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 40%)";
    case "telek":
      return "linear-gradient(135deg, rgba(131,81,0,0.9), rgba(255,185,95,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 40%)";
    case "egyeb":
      return "linear-gradient(135deg, rgba(25,28,30,0.9), rgba(118,117,134,0.72)), radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 42%)";
    default:
      return "linear-gradient(135deg, rgba(70,72,212,0.92), rgba(96,99,238,0.75)), radial-gradient(circle at top right, rgba(255,255,255,0.28), transparent 42%)";
  }
}

function buildMockLogs(locale: Locale): DisplayLog[] {
  const iso = (daysAgo: number | null) =>
    daysAgo == null
      ? null
      : new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);

  return [
    {
      id: "mock-1",
      description:
        locale === "hu"
          ? "Csotores elharitasa - Furdoszoba"
          : "Pipe burst repair - Bathroom",
      category: "javitas",
      costHuf: 45000,
      priority: "urgent",
      status: "done",
      performedBy: "Viz-Gaz Kft.",
      performedDate: iso(4),
      propertyId: null,
      propertyName: locale === "hu" ? "Budapest, Akacfa u. 12." : "Budapest, Akacfa str. 12.",
      propertyAddress: locale === "hu" ? "Budapest, Akacfa u. 12." : "Budapest, Akacfa str. 12.",
      propertyType: "lakas",
      propertyAvatarUrl: null,
      photoUrls: ["example1.jpg", "example2.jpg"],
      documentUrls: [],
      mock: true,
    },
    {
      id: "mock-2",
      description:
        locale === "hu"
          ? "Klimaberendezes eves tisztitasa"
          : "Annual HVAC servicing",
      category: "karbantartas",
      costHuf: 18000,
      priority: "normal",
      status: "in_progress",
      performedBy: "Klima-Master",
      performedDate: null,
      propertyId: null,
      propertyName: locale === "hu" ? "Szentendre, Duna korzo 4." : "Szentendre, Duna promenade 4.",
      propertyAddress: locale === "hu" ? "Szentendre, Duna korzo 4." : "Szentendre, Duna promenade 4.",
      propertyType: "uzlet",
      propertyAvatarUrl: null,
      photoUrls: [],
      documentUrls: ["receipt.pdf"],
      mock: true,
    },
    {
      id: "mock-3",
      description:
        locale === "hu"
          ? "Konyhabutor csere es festes"
          : "Kitchen furniture replacement and painting",
      category: "felujitas",
      costHuf: 850000,
      priority: "normal",
      status: "done",
      performedBy: "HomeDesign Studio",
      performedDate: iso(16),
      propertyId: null,
      propertyName: locale === "hu" ? "Budapest, Vaci ut 88." : "Budapest, Vaci ut 88.",
      propertyAddress: locale === "hu" ? "Budapest, Vaci ut 88." : "Budapest, Vaci ut 88.",
      propertyType: "lakas",
      propertyAvatarUrl: null,
      photoUrls: ["kitchen1.jpg"],
      documentUrls: ["invoice.pdf"],
      mock: true,
    },
    {
      id: "mock-4",
      description:
        locale === "hu"
          ? "Kismegszakito tabla korszerusitese"
          : "Breaker panel modernization",
      category: "csere",
      costHuf: 62000,
      priority: "low",
      status: "pending",
      performedBy: "Watt-Vill Kft.",
      performedDate: null,
      propertyId: null,
      propertyName: locale === "hu" ? "Budapest, Akacfa u. 12." : "Budapest, Akacfa str. 12.",
      propertyAddress: locale === "hu" ? "Budapest, Akacfa u. 12." : "Budapest, Akacfa str. 12.",
      propertyType: "lakas",
      propertyAvatarUrl: null,
      photoUrls: [],
      documentUrls: [],
      mock: true,
    },
  ];
}

export default async function MaintenancePage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const [properties, logs] = await Promise.all([
    api.property.list(),
    api.maintenance.list({}),
  ]);

  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const normalizedLogs: DisplayLog[] = logs
    .filter((log) => (log.propertyId ? propertyById.has(log.propertyId) : true))
    .map((log) => {
      const property = log.propertyId ? propertyById.get(log.propertyId) : null;

      return {
        id: log.id,
        description: log.description,
        category: normalizeCategory(log.category),
        costHuf: Math.round(log.costHuf ?? 0),
        priority: (log as Record<string, unknown>).priority as string ?? "normal",
        status: normalizeStatus(
          (log as Record<string, unknown>).status as string | null,
          log.performedDate ?? null,
        ),
        performedBy: log.performedBy ?? null,
        performedDate: log.performedDate ?? null,
        propertyId: property?.id ?? null,
        propertyName:
          property?.name ?? (locale === "hu" ? "Portfolio elem" : "Portfolio item"),
        propertyAddress: property?.address ?? null,
        propertyType: property?.propertyType ?? "lakas",
        propertyAvatarUrl: property?.avatarUrl ?? null,
        photoUrls: ((log as Record<string, unknown>).photoUrls as string[] | null) ?? [],
        documentUrls: ((log as Record<string, unknown>).documentUrls as string[] | null) ?? [],
      };
    });

  const displayLogs =
    normalizedLogs.length >= 4
      ? normalizedLogs
      : [...normalizedLogs, ...buildMockLogs(locale).slice(0, 4 - normalizedLogs.length)];

  const activeLogs = normalizedLogs.length > 0 ? normalizedLogs : buildMockLogs(locale);
  const now = new Date();
  const monthlyCost = activeLogs
    .filter((log) => {
      if (!log.performedDate) return false;
      const date = new Date(log.performedDate);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    })
    .reduce((sum, log) => sum + log.costHuf, 0);
  const pendingCount = activeLogs.filter((log) => log.status === "pending").length;
  const inProgressCount = activeLogs.filter((log) => log.status === "in_progress").length;
  const doneCount = activeLogs.filter((log) => log.status === "done").length;

  const categories: MaintenanceCategory[] = [
    "javitas",
    "karbantartas",
    "felujitas",
    "csere",
  ];
  const categoryFilters = categories.map((category) => ({
    category,
    count: activeLogs.filter((log) => log.category === category).length,
  }));

  const statusFilters: { status: MaintenanceStatus | "all"; label: string; count: number }[] = [
    { status: "all", label: locale === "hu" ? "Osszes" : "All", count: activeLogs.length },
    { status: "pending", label: locale === "hu" ? "Fuggoben" : "Pending", count: pendingCount },
    { status: "in_progress", label: locale === "hu" ? "Folyamatban" : "In progress", count: inProgressCount },
    { status: "done", label: locale === "hu" ? "Kesz" : "Done", count: doneCount },
  ];

  const copy =
    locale === "hu"
      ? {
          title: "Karbantartasi Naplo",
          subtitle: "Ingatlan-portfolio szerviz es javitasi elozmenyei",
          export: "Exportalas",
          newEntry: "Uj bejegyzes",
          total: "Osszes kartya",
          monthlyCost: "Havi koltseg",
          inProgress: "Folyamatban levo",
          closed: "Lezart",
          property: "Ingatlan",
          cost: "Koltseg",
          vendor: "Vegezte",
          date: "Datum",
          photos: "foto",
          docs: "dok.",
          demoNote:
            normalizedLogs.length === 0
              ? "Meg nincs eles karbantartasi bejegyzes, ezert demo elemekkel toltottuk fel a nezetet."
              : null,
        }
      : {
          title: "Maintenance Log",
          subtitle: "Service history and repair activity across the property portfolio",
          export: "Export",
          newEntry: "New entry",
          total: "Total entries",
          monthlyCost: "Monthly cost",
          inProgress: "In progress",
          closed: "Closed",
          property: "Property",
          cost: "Cost",
          vendor: "Performed by",
          date: "Date",
          photos: "photo(s)",
          docs: "doc(s)",
          demoNote:
            normalizedLogs.length === 0
              ? "There are no live maintenance entries yet, so the layout is filled with demo content."
              : null,
        };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</p>
          {copy.demoNote && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                {copy.demoNote}
              </p>
              {properties.length > 0 && (
                <MaintenanceDemoActions propertyIds={properties.map((property) => property.id)} />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            <Download className="h-4 w-4" />
            {copy.export}
          </button>
          <NewEntryDropdown
            properties={properties.map((p) => ({
              id: p.id,
              name: p.name,
              address: p.address ?? null,
            }))}
            label={copy.newEntry}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              +{formatNumber(Math.max(displayLogs.length - normalizedLogs.length, 0), locale)}
            </span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{copy.total}</p>
          <p className="mt-1 text-3xl font-semibold">{formatNumber(activeLogs.length, locale)}</p>
        </div>

        <div className="rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-sm">
          <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 inline-flex">
            <Receipt className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{copy.monthlyCost}</p>
          <p className="mt-1 text-3xl font-semibold">{formatCurrency(monthlyCost, locale)}</p>
        </div>

        <div className="rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-sm">
          <div className="rounded-2xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 inline-flex">
            <Wrench className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{copy.inProgress}</p>
          <p className="mt-1 text-3xl font-semibold">{formatNumber(pendingCount + inProgressCount, locale)}</p>
        </div>

        <div className="rounded-[28px] border border-border/60 bg-card/90 p-6 shadow-sm">
          <div className="rounded-2xl bg-secondary/10 p-2 text-secondary inline-flex">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{copy.closed}</p>
          <p className="mt-1 text-3xl font-semibold">{formatNumber(doneCount, locale)}</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((filter, i) => (
          <span
            key={filter.status}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              i === 0
                ? "bg-primary text-primary-foreground"
                : "border border-border/70 bg-card text-foreground"
            }`}
          >
            {filter.label} {filter.count > 0 ? `\u00B7 ${formatNumber(filter.count, locale)}` : ""}
          </span>
        ))}
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {categoryFilters.map((filter) => {
          const meta = categoryMeta(filter.category, locale);
          return (
            <span
              key={filter.category}
              className="rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground"
            >
              {meta.label} {`\u00B7 ${formatNumber(filter.count, locale)}`}
            </span>
          );
        })}
      </div>

      <div className="space-y-4">
        {displayLogs.map((log) => {
          const meta = categoryMeta(log.category, locale);
          const Icon = meta.icon;
          const propertyLabel =
            log.propertyAddress ?? log.propertyName;
          const pBadge = priorityBadge(log.priority, locale);
          const sBadge = statusBadge(log.status, locale);

          return (
            <div
              key={log.id}
              className="group flex flex-col gap-5 rounded-[30px] border border-border/60 bg-card/90 p-5 shadow-sm transition hover:shadow-md md:flex-row md:items-center"
            >
              <div className="relative h-28 overflow-hidden rounded-[24px] md:w-52 shrink-0">
                <PropertyCoverImage
                  imageUrl={log.propertyAvatarUrl}
                  title={log.propertyName}
                  className="absolute inset-0 h-full w-full object-cover"
                  placeholderClassName="absolute inset-0 h-full w-full"
                  placeholderBackground={propertyPlaceholder(log.propertyType)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                <div className="absolute left-3 top-3">
                  <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-900">
                    {propertyTypeLabel(log.propertyType, locale)}
                  </span>
                </div>
                <div className="absolute inset-x-3 bottom-3">
                  <p className="line-clamp-2 text-sm font-semibold text-white">
                    {log.propertyName}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors ${meta.iconWrap}`}
                >
                  <Icon className="h-7 w-7" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${pBadge.className}`}>
                      {pBadge.label}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${sBadge.className}`}>
                      {sBadge.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {typeof log.id === "number" ? `#LOG-${log.id}` : "#DEMO"}
                    </span>
                    {log.mock && (
                      <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Demo
                      </span>
                    )}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">
                    {log.description}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-4 w-4" />
                      {propertyLabel}
                    </span>
                    {log.photoUrls.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {log.photoUrls.length} {copy.photos}
                      </span>
                    )}
                    {log.documentUrls.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {log.documentUrls.length} {copy.docs}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4 md:min-w-[320px] md:border-t-0 md:border-l md:pl-6 md:pt-0">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {copy.cost}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatCurrency(log.costHuf, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {copy.vendor}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {log.performedBy ?? "\u2014"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {copy.date}
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {log.performedDate
                      ? new Date(log.performedDate).toLocaleDateString(
                          locale === "hu" ? "hu-HU" : "en-US",
                        )
                      : "\u2014"}
                  </p>
                </div>
                {typeof log.id === "number" && (
                  <div className="col-span-2 flex justify-end md:col-span-1 md:items-end">
                    <MaintenanceEntryActions
                      id={log.id}
                      canComplete={log.status !== "done"}
                      canMarkInProgress={log.status === "pending"}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
