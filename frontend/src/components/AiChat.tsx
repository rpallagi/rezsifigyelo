import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { MessageCircle, X, Send, Bot, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiChat } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface AiChatProps {
  topic: 'smart-meter' | 'tenant-help' | 'admin-help' | 'general';
  title?: string;
  placeholder?: string;
  mode?: 'inline' | 'floating';
  className?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const AiChat = ({ topic, title, placeholder, mode = 'inline', className }: AiChatProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatTitle = title || t('ai.title');
  const chatPlaceholder = placeholder || t('ai.placeholder');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setError(null);

    const userMsg: ChatMsg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg].slice(-10);
      const res = await aiChat(msg, topic, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (e: any) {
      setError(e.message || t('ai.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const chatContent = (
    <div className={cn("flex flex-col", mode === 'inline' ? "h-[400px]" : "h-[500px] max-h-[70vh]")}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-display font-semibold text-sm">{chatTitle}</p>
            <p className="text-[10px] text-muted-foreground">{t('ai.poweredBy')}</p>
          </div>
        </div>
        {mode === 'floating' && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t('ai.empty')}</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
              msg.role === 'user'
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-accent rounded-bl-md"
            )}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-accent rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 inline-block">
              {error}
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/50">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatPlaceholder}
            rows={1}
            className="flex-1 resize-none bg-accent rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px] max-h-[100px]"
            style={{ height: 'auto', overflow: 'hidden' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 100) + 'px';
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-10 w-10 rounded-xl gradient-primary-bg border-0 flex-shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );

  if (mode === 'inline') {
    return (
      <div className={cn("glass-card overflow-hidden", className)}>
        {chatContent}
      </div>
    );
  }

  // Floating mode
  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full gradient-primary-bg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center"
        >
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </button>
      )}

      {/* Chat overlay */}
      {open && (
        <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-[380px] z-50 glass-card overflow-hidden shadow-2xl rounded-2xl animate-in fade-in-0 zoom-in-95 duration-200">
          {chatContent}
        </div>
      )}
    </>
  );
};

export default AiChat;
