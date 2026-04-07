"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function PropertyChatPage() {
  const params = useParams();
  const propertyId = Number(params.id);
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = api.chat.list.useQuery(
    { propertyId },
    { refetchInterval: 5000 },
  );

  const { data: me } = api.user.me.useQuery();
  const utils = api.useUtils();

  const sendMessage = api.chat.send.useMutation({
    onSuccess: () => {
      setMessage("");
      void utils.chat.list.invalidate({ propertyId });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessage.mutate({ propertyId, message: message.trim() });
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <h1 className="mb-4 text-2xl font-bold">Chat</h1>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-auto rounded-lg border border-border p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Betöltés...</p>
        ) : !messages || messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Még nincs üzenet. Írj az elsőt!
          </p>
        ) : (
          messages
            .slice()
            .reverse()
            .map((msg) => {
              const isMe = msg.senderId === me?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {!isMe && (
                      <p className="mb-1 text-xs font-medium opacity-70">
                        {msg.sender.firstName ?? msg.sender.email}
                      </p>
                    )}
                    <p>{msg.message}</p>
                    <p className="mt-1 text-xs opacity-50">
                      {new Date(msg.createdAt).toLocaleString("hu-HU")}
                    </p>
                  </div>
                </div>
              );
            })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Üzenet..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!message.trim() || sendMessage.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Küldés
        </button>
      </form>
    </div>
  );
}
