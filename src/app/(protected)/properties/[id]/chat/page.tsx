"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useLocale } from "@/components/providers/locale-provider";
import { PropertyChatThread } from "@/components/chat/property-chat-thread";
import { api } from "@/trpc/react";

export default function PropertyChatPage() {
  const params = useParams();
  const propertyId = Number(params.id);
  const { messages } = useLocale();

  const { data: property, isLoading } = api.property.get.useQuery({
    id: propertyId,
  });

  const activeTenancy = property?.tenancies.find(
    (t: { active: boolean }) => t.active,
  );

  const tenantLabel = activeTenancy
    ? (activeTenancy as { tenant?: { firstName?: string | null; email?: string | null } }).tenant?.firstName ??
      (activeTenancy as { tenantName?: string | null }).tenantName ??
      (activeTenancy as { tenant?: { email?: string | null } }).tenant?.email ??
      (activeTenancy as { tenantEmail?: string | null }).tenantEmail ??
      null
    : null;

  const chatTitle = property ? `Chat — ${property.name}` : "Chat";

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href={`/properties/${propertyId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition hover:bg-secondary/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Vissza
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {messages.common.loading}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {tenantLabel && (
            <p className="-mt-1 mb-2 text-sm text-muted-foreground">
              {tenantLabel}
            </p>
          )}

          <div className="flex-1 overflow-hidden">
            <PropertyChatThread
              propertyId={propertyId}
              title={chatTitle}
              emptyMessage="Még nincs üzenet. Írj az elsőt!"
            />
          </div>
        </div>
      )}
    </div>
  );
}
