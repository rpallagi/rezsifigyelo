import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, PlusCircle, History, User, MessageCircle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { tenantSession, getTenantChatUnread } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import AiChat from "@/components/AiChat";

const POLL_INTERVAL = 30_000; // 30s

const TenantLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const { t } = useI18n();

  const navItems = [
    { to: "/tenant", icon: LayoutDashboard, label: t('nav.home') },
    { to: "/tenant/reading", icon: PlusCircle, label: t('nav.record') },
    { to: "/tenant/history", icon: History, label: t('nav.history') },
    { to: "/tenant/chat", icon: MessageCircle, label: t('chat.title') },
    { to: "/tenant/profile", icon: User, label: t('nav.profile') },
  ];

  useEffect(() => {
    tenantSession()
      .then((data) => {
        if (!data.logged_in) {
          navigate("/tenant/login");
        } else if (data.needs_property_select) {
          sessionStorage.setItem("pending_properties", JSON.stringify(data.properties));
          navigate("/tenant/select-property");
        } else {
          setChecked(true);
        }
      })
      .catch(() => navigate("/tenant/login"));
  }, []);

  // Poll unread chat count
  const fetchUnread = useCallback(() => {
    getTenantChatUnread()
      .then((data) => setChatUnread(data.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!checked) return;
    fetchUnread();
    const iv = setInterval(fetchUnread, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [checked, fetchUnread]);

  // When user navigates to chat, reset badge immediately
  useEffect(() => {
    if (location.pathname === "/tenant/chat") {
      setChatUnread(0);
    }
  }, [location.pathname]);

  if (!checked) return null;

  const UnreadBadge = ({ className = "" }: { className?: string }) =>
    chatUnread > 0 ? (
      <span
        className={`flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none ${className}`}
      >
        {chatUnread > 99 ? "99+" : chatUnread}
      </span>
    ) : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky top status bar */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-2 max-w-lg mx-auto">
          <span className="font-display font-semibold text-sm">{t('common.appName')}</span>
          <button
            onClick={() => navigate('/tenant/chat')}
            className="relative p-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <UnreadBadge className="absolute -top-0.5 -right-0.5" />
          </button>
        </div>
      </div>

      <Outlet />

      {/* Floating AI Chat for tenants */}
      <AiChat
        topic="tenant-help"
        title={t('ai.tenantTitle')}
        placeholder={t('ai.tenantPlaceholder')}
        mode="floating"
        bottomNav
      />

      <nav className="bottom-nav">
        <div className="flex items-center justify-around py-2 px-2 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className="relative">
                  <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                  {item.to === "/tenant/chat" && (
                    <UnreadBadge className="absolute -top-1.5 -right-2.5" />
                  )}
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default TenantLayout;
