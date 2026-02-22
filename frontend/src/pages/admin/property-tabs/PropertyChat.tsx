import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { MessageCircle, Send } from "lucide-react";
import {
  getAdminChat, sendAdminChat, markAdminChatRead,
  type ChatMessageItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

interface Props {
  propertyId: number;
}

/** Resolve a date-string to a display label: today / yesterday / formatted date. */
function dateBucket(isoDate: string, todayLabel: string, yesterdayLabel: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const toDay = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  const dayStr = toDay(d);
  const todayStr = toDay(now);

  if (dayStr === todayStr) return todayLabel;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayStr === toDay(yesterday)) return yesterdayLabel;

  return d.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const POLL_INTERVAL = 10_000;

const PropertyChat = ({ propertyId }: Props) => {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevCountRef = useRef(0);

  // ---------- Data loading ----------

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await getAdminChat(propertyId);
        setMessages(data.messages);
      } catch {
        // silently ignore polling errors
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [propertyId],
  );

  // Initial load + mark read
  useEffect(() => {
    load();
    markAdminChatRead(propertyId).catch(() => {});
  }, [propertyId, load]);

  // Auto-refresh polling
  useEffect(() => {
    const id = setInterval(() => {
      load(true);
      markAdminChatRead(propertyId).catch(() => {});
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [propertyId, load]);

  // ---------- Auto-scroll ----------

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    if (messages.length !== prevCountRef.current) {
      scrollToBottom();
      prevCountRef.current = messages.length;
    }
  }, [messages.length, scrollToBottom]);

  // ---------- Sending ----------

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await sendAdminChat(propertyId, trimmed);
      setDraft("");
      await load(true);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch {
      // allow retry
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = (value: string) => {
    setDraft(value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
    }
  };

  // ---------- Grouping ----------

  const grouped: { label: string; items: ChatMessageItem[] }[] = [];
  let currentLabel = "";

  for (const msg of messages) {
    const label = msg.created_at
      ? dateBucket(msg.created_at, t("chat.today"), t("chat.yesterday"))
      : "—";
    if (label !== currentLabel) {
      grouped.push({ label, items: [] });
      currentLabel = label;
    }
    grouped[grouped.length - 1].items.push(msg);
  }

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="glass-card flex flex-col" style={{ height: 480 }}>
      {/* Message area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
        style={{ maxHeight: 400 }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">{t("chat.noMessages")}</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 border-t border-border/40" />
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                  {group.label}
                </span>
                <div className="flex-1 border-t border-border/40" />
              </div>

              {/* Messages in this group */}
              <div className="space-y-2">
                {group.items.map((msg) => {
                  const isAdmin = msg.sender_type === "admin";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isAdmin
                            ? "gradient-primary-bg text-primary-foreground rounded-br-md"
                            : "bg-muted text-foreground rounded-bl-md"
                        }`}
                      >
                        <p className="text-[11px] font-semibold opacity-70 mb-0.5">
                          {isAdmin ? t("chat.admin") : t("chat.tenant")}
                        </p>
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {msg.message}
                        </p>
                        <p
                          className={`text-[10px] mt-1 ${
                            isAdmin ? "text-primary-foreground/60" : "text-muted-foreground"
                          } text-right`}
                        >
                          {msg.created_at ? formatTime(msg.created_at) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/40 px-4 py-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          rows={1}
          disabled={sending}
          className="flex-1 resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50"
          style={{ maxHeight: 96 }}
        />
        <Button
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          size="icon"
          className="gradient-primary-bg border-0 h-9 w-9 rounded-xl flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default PropertyChat;
