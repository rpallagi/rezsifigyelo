"use client";

import { useParams } from "next/navigation";

import { PropertyChatThread } from "@/components/chat/property-chat-thread";

export default function PropertyChatPage() {
  const params = useParams();
  const propertyId = Number(params.id);

  return (
    <PropertyChatThread
      propertyId={propertyId}
      title="Chat"
      emptyMessage="Még nincs üzenet. Írj az elsőt!"
    />
  );
}
