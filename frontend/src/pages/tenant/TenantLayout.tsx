import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, PlusCircle, History, User, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { tenantSession } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const TenantLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
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

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />

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
                <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
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
