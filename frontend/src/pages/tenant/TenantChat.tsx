import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import {
  getTenantChat,
  sendTenantChat,
  getTenantChatUnread,
  type ChatMessageItem,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Return a locale-friendly date key (YYYY-MM-DD) for grouping. */
const dateKey = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Pretty-print a time from an ISO string. */
const formatTime = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });
};

/** Group messages by date, preserving order. */
const groupByDate = (messages: ChatMessageItem[]) => {
  const groups: { date: string; messages: ChatMessageItem[] }[] = [];
  let currentKey = "";

  for (const msg of messages) {
    const key = dateKey(msg.created_at);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ date: key, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const TenantChat = () => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevCountRef = useRef(0);
  const navigate = useNavigate();
  const { t } = useI18n();

  /* ---- data fetching ---- */

  const fetchMessages = useCallback(async () => {
    try {
      const res = await getTenantChat();
      setMessages(res.messages);
    } catch {
      // silently ignore refresh failures; first load handled below
    }
  }, []);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await getTenantChatUnread();
      setUnread(res.count);
    } catch {
      // ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    Promise.all([getTenantChat(), getTenantChatUnread()])
      .then(([chatRes, unreadRes]) => {
        setMessages(chatRes.messages);
        setUnread(unreadRes.count);
        prevCountRef.current = chatRes.messages.length;
      })
      .catch(() => navigate("/tenant/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  // Auto-refresh every 10 s
  useEffect(() => {
    const id = setInterval(() => {
      fetchMessages();
      fetchUnread();
    }, 10_000);
    return () => clearInterval(id);
  }, [fetchMessages, fetchUnread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length !== prevCountRef.current) {
      prevCountRef.current = messages.length;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  }, [messages]);

  // Also scroll on first paint after loading
  useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loading]);

  /* ---- send ---- */

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await sendTenantChat(trimmed);
      setText("");
      await fetchMessages();
      // auto-resize textarea back
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch {
      toast.error(t("chat.sendError") || "Hiba az \u00fczenet k\u00fcld\u00e9sekor");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ---- auto-resize textarea ---- */

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  /* ---- date label ---- */

  const dateSeparatorLabel = (key: string): string => {
    const today = dateKey(new Date().toISOString());
    const yesterday = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return dateKey(d.toISOString());
    })();

    if (key === today) return t("chat.today");
    if (key === yesterday) return t("chat.yesterday");

    // Format as locale date
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("hu-HU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  /* ---- render ---- */

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4 pt-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-3/4 rounded-2xl" />
        <Skeleton className="h-12 w-2/3 rounded-2xl ml-auto" />
        <Skeleton className="h-12 w-3/4 rounded-2xl" />
        <Skeleton className="h-12 w-2/3 rounded-2xl ml-auto" />
        <Skeleton className="h-14 w-full rounded-2xl mt-auto" />
      </div>
    );
  }

  const grouped = groupByDate(messages);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-lg mx-auto">
      {/* ---- Header ---- */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={() => navigate("/tenant")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-lg font-bold truncate">
            {t("chat.title")}
          </h1>
        </div>
        {unread > 0 && (
          <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {unread}
          </span>
        )}
      </div>

      {/* ---- Messages ---- */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <MessageCircle className="h-12 w-12 opacity-30" />
            <p className="text-sm">{t("chat.noMessages")}</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border/60" />
                <span className="text-[11px] text-muted-foreground font-medium px-2">
                  {dateSeparatorLabel(group.date)}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>

              {/* Messages in this day */}
              <div className="space-y-2">
                {group.messages.map((msg) => {
                  const isAdmin = msg.sender_type === "admin";

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
                    >
                      <div className="max-w-[80%] space-y-0.5">
                        {/* Sender label */}
                        <p
                          className={`text-[10px] font-medium px-1 ${
                            isAdmin
                              ? "text-muted-foreground"
                              : "text-muted-foreground text-right"
                          }`}
                        >
                          {isAdmin ? t("chat.admin") : t("chat.tenant")}
                        </p>

                        {/* Bubble */}
                        <div
                          className={
                            isAdmin
                              ? "bg-muted rounded-2xl rounded-tl-sm p-3"
                              : "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm p-3"
                          }
                        >
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {msg.message}
                          </p>
                        </div>

                        {/* Timestamp */}
                        <p
                          className={`text-[10px] px-1 ${
                            isAdmin
                              ? "text-muted-foreground"
                              : "text-muted-foreground text-right"
                          }`}
                        >
                          {formatTime(msg.created_at)}
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

      {/* ---- Input area ---- */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={t("chat.placeholder")}
            rows={1}
            disabled={sending}
            className="flex-1 resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 max-h-[120px] leading-relaxed"
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-full flex-shrink-0"
            onClick={handleSend}
            disabled={!text.trim() || sending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TenantChat;
