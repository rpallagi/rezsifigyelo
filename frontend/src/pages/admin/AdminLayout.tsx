import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Building2, CreditCard, Wrench, ListTodo,
  BarChart3, Settings, TrendingUp, ChevronLeft, Zap, FileText, Rocket,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { adminSession } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const AdminLayout = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

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
        else setChecked(true);
      })
      .catch(() => navigate("/admin/login"));
  }, []);

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
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
