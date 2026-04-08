"use client";

import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

export function InvitationActions({ invitationId }: { invitationId: number }) {
  const router = useRouter();

  const revoke = api.tenancy.revokeInvitation.useMutation({
    onSuccess: () => router.refresh(),
  });
  const resend = api.tenancy.resendInvitation.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => resend.mutate({ invitationId })}
        disabled={resend.isPending}
        title="Meghívó újraküldése"
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:bg-secondary/50 disabled:opacity-50"
      >
        {resend.isPending ? "..." : "Újraküldés"}
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm("Biztosan visszavonod a meghívót?")) {
            revoke.mutate({ invitationId });
          }
        }}
        disabled={revoke.isPending}
        title="Meghívó visszavonása"
        className="rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
      >
        {revoke.isPending ? "..." : "Visszavonás"}
      </button>
    </div>
  );
}
