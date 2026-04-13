"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function ClickableRow({
  readingId,
  children,
  className,
}: {
  readingId: number;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        // Don't navigate if clicking a link inside the row
        if ((e.target as HTMLElement).closest("a")) return;
        router.push(`/readings/${readingId}`);
      }}
      className={`cursor-pointer border-b border-border/50 transition hover:bg-secondary/40 ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}

export function ClickableCard({
  readingId,
  children,
  className,
}: {
  readingId: number;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/readings/${readingId}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(`/readings/${readingId}`);
      }}
      className={`cursor-pointer transition hover:bg-secondary/40 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
