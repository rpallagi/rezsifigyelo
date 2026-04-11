"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, FileText, Check, CheckCheck, Loader2 } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const markRead = api.chat.markRead.useMutation();

  // Mark received messages as read when thread loads or updates
  useEffect(() => {
    if (thread && thread.length > 0 && me?.id) {
      markRead.mutate({ propertyId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, me?.id, propertyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessage.mutate({ propertyId, message: message.trim() });
  };

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "chat");

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        const data = (await res.json()) as { url: string };
        const attachmentType = file.type.startsWith("image/")
          ? ("image" as const)
          : ("document" as const);

        sendMessage.mutate({
          propertyId,
          message: message.trim() || file.name,
          attachmentUrl: data.url,
          attachmentType,
          attachmentName: file.name,
        });
        setMessage("");
      } catch {
        // Upload failed silently
      } finally {
        setUploading(false);
        // Reset file input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [propertyId, message, sendMessage],
  );

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

                    {msg.attachmentUrl && msg.attachmentType === "image" && (
                      <img
                        src={msg.attachmentUrl}
                        alt={msg.attachmentName ?? ""}
                        className="mt-2 max-w-[240px] rounded-xl cursor-pointer"
                        onClick={() => window.open(msg.attachmentUrl!, "_blank")}
                      />
                    )}

                    {msg.attachmentUrl && msg.attachmentType === "document" && (
                      <a
                        href={msg.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 flex items-center gap-2 rounded-lg bg-background/50 px-3 py-2 text-xs hover:bg-background/80"
                      >
                        <FileText className="h-4 w-4" />
                        {msg.attachmentName ?? "Dokumentum"}
                      </a>
                    )}

                    <p className="mt-1 flex items-center gap-1 text-xs opacity-60">
                      {new Date(msg.createdAt).toLocaleString(intlLocale)}
                      {isMe &&
                        (msg.isRead ? (
                          <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
                        ))}
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
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sendMessage.isPending}
          className="shrink-0 rounded-xl border border-input bg-background px-3 py-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          title="Melléklet"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </button>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            uploading
              ? "Melléklet feltöltés..."
              : messages.chatPage.inputPlaceholder
          }
          disabled={uploading}
          className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!message.trim() || sendMessage.isPending || uploading}
          className="shrink-0 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {messages.chatPage.send}
        </button>
      </form>
    </div>
  );
}
