import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard, Building2, CreditCard, Wrench, ListTodo,
  BarChart3, Settings, TrendingUp, ChevronLeft, Zap, FileText, Rocket,
  MessageCircle,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { adminSession, getTaxReminders, getCommonFeeReminders, getAdminChatUnread } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import AiChat from "@/components/AiChat";

const AdminLayout = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  const mainNav = [
    { title: t('adminDash.title'), url: "/admin", icon: LayoutDashboard },
    { title: t('props.title'), url: "/admin/properties", icon: Building2 },
    { title: t('adminReadings.title'), url: "/admin/readings", icon: FileText },
    { title: t('payments.title'), url: "/admin/payments", icon: CreditCard },
    { title: t('maint.title'), url: "/admin/maintenance", icon: Wrench },
    { title: t('todos.title'), url: "/admin/todos", icon: ListTodo },
  ];

  const analyticsNav = [
    { title: t('tariffs.title'), url: "/admin/tariffs", icon: BarChart3 },
    { title: t('roi.title'), url: "/admin/roi", icon: TrendingUp },
    { title: t('system.title'), url: "/admin/system", icon: Rocket },
    { title: t('settings.title'), url: "/admin/settings", icon: Settings },
  ];

  useEffect(() => {
    adminSession()
      .then((data) => {
        if (!data.logged_in) navigate("/admin/login");
        else {
          setChecked(true);
          // Show reminders on login
          getTaxReminders().then(({ reminders }) => {
            reminders.forEach((r) => {
              toast.warning(
                `${r.property_name}: ${t('tax.title')} – ${r.amount?.toLocaleString('hu-HU')} Ft`,
                { description: `${t('tax.paymentMemo')}: ${r.payment_memo || '—'}`, duration: 10000 }
              );
            });
          }).catch(() => {});
          getCommonFeeReminders().then(({ reminders }) => {
            reminders.forEach((r) => {
              toast.warning(
                `${r.property_name}: ${t('fees.title')} – ${r.amount?.toLocaleString('hu-HU')} Ft`,
                { description: `${t('fees.paymentMemo')}: ${r.payment_memo || '—'}`, duration: 10000 }
              );
            });
          }).catch(() => {});
        }
      })
      .catch(() => navigate("/admin/login"));
  }, []);

  // Poll unread chat count
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const fetchUnread = useCallback(() => {
    getAdminChatUnread()
      .then((data) => {
        const map = (data.unread || {}) as Record<string, number>;
        setUnreadMap(map);
        setTotalUnread(Object.values(map).reduce((a, b) => a + b, 0));
      })
      .catch(() => {});
  }, []);

  const handleChatClick = () => {
    const active = Object.entries(unreadMap).filter(([_, c]) => c > 0);
    if (active.length === 1) {
      navigate(`/admin/properties/${active[0][0]}?tab=chat`);
    } else {
      navigate('/admin/properties');
    }
  };

  useEffect(() => {
    if (!checked) return;
    fetchUnread();
    const iv = setInterval(fetchUnread, 30_000);
    return () => clearInterval(iv);
  }, [checked, fetchUnread]);

  if (!checked) return null;

  const NavItem = ({ item }: { item: { title: string; url: string; icon: React.ComponentType<any> } }) => {
    const isActive = location.pathname === item.url;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link
            to={item.url}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border">
          <SidebarContent className="pt-4">
            <div className="px-4 mb-6">
              <Link to="/" className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-sidebar-primary" />
                <span className="font-display font-bold text-lg">{t('common.appName')}</span>
              </Link>
            </div>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50 px-4 mb-1">
                {t('admin.management')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map((item) => <NavItem key={item.url} item={item} />)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/50 px-4 mb-1 mt-4">
                {t('admin.analytics')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {analyticsNav.map((item) => <NavItem key={item.url} item={item} />)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <div className="mt-auto p-4">
              <Link to="/" className="flex items-center gap-2 text-sm text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" /> {t('admin.backHome')}
              </Link>
            </div>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger />
            <span className="text-sm font-medium text-muted-foreground">{t('admin.label')}</span>
            <button
              onClick={handleChatClick}
              className="ml-auto relative p-2 rounded-lg hover:bg-accent transition-colors"
              title={t('chat.title')}
            >
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </button>
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>

        {/* Floating AI Chat for admins */}
        <AiChat
          topic="admin-help"
          title={t('ai.adminTitle')}
          placeholder={t('ai.adminPlaceholder')}
          mode="floating"
        />
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
