import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { getMessages } from "@/lib/i18n/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { api } from "@/trpc/server";

export default async function MessagesPage() {
  const locale = await getCurrentLocale();
  const m = getMessages(locale);
  const properties = await api.property.list();

  return (
    <div>
      <h1 className="text-2xl font-bold">{m.messagesPage.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {m.messagesPage.description}
      </p>

      {properties.length === 0 ? (
        <p className="mt-8 text-muted-foreground">{m.messagesPage.empty}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => {
            const activeTenancy = property.tenancies.find(
              (t) => t.active,
            );
            const tenantName =
              activeTenancy?.tenant?.firstName ??
              (activeTenancy as { tenantName?: string | null } | undefined)
                ?.tenantName ??
              activeTenancy?.tenant?.email ??
              (activeTenancy as { tenantEmail?: string | null } | undefined)
                ?.tenantEmail ??
              null;

            return (
              <Link
                key={property.id}
                href={`/properties/${property.id}/chat`}
                className="group rounded-[24px] ring-1 ring-border/60 bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold tracking-tight">
                      {property.name}
                    </h3>
                    {property.address && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {property.address}
                      </p>
                    )}
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {tenantName ?? m.messagesPage.noTenant}
                  </p>
                  <span className="text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
                    {m.messagesPage.openChat} →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
