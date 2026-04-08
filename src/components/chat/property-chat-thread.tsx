"use client";

import { useEffect, useRef, useState } from "react";

import { useLocale } from "@/components/providers/locale-provider";
import { api } from "@/trpc/react";

export function PropertyChatThread({
  propertyId,
  title,
  emptyMessage,
}: {
  propertyId: number;
  title: string;
  emptyMessage: string;
}) {
  const { intlLocale, messages } = useLocale();
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: thread, isLoading } = api.chat.list.useQuery(
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
  }, [thread]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessage.mutate({ propertyId, message: message.trim() });
  };

  return (
    <div className="flex min-h-[70vh] flex-col">
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>

      <div className="flex-1 space-y-3 overflow-auto rounded-lg border border-border bg-card p-3 sm:p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{messages.common.loading}</p>
        ) : !thread || thread.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          thread
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
                    className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm sm:max-w-[75%] ${
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
                    <p className="break-words">{msg.message}</p>
                    <p className="mt-1 text-xs opacity-60">
                      {new Date(msg.createdAt).toLocaleString(intlLocale)}
                    </p>
                  </div>
                </div>
              );
            })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={messages.chatPage.inputPlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!message.trim() || sendMessage.isPending}
          className="shrink-0 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {messages.chatPage.send}
        </button>
      </form>
    </div>
  );
}
