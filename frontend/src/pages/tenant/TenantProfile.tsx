import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTenantProfile, tenantLogout, type TenantProperty } from "@/lib/api";
import { formatHuf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LogOut, Building2, User, Mail, Phone, MapPin, CreditCard, Tag } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const TenantProfile = () => {
  const [profile, setProfile] = useState<TenantProperty | null>(null);
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    getTenantProfile().then(setProfile).catch(() => navigate("/tenant/login"));
  }, []);

  const handleLogout = async () => {
    await tenantLogout().catch(() => {});
    navigate("/tenant/login");
  };

  if (!profile) return null;

  const initials = (profile.contact_name || profile.name)
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const infoItems = [
    { icon: User, label: t('profile.contact'), value: profile.contact_name },
    { icon: Mail, label: t('profile.email'), value: profile.contact_email },
    { icon: Phone, label: t('profile.phone'), value: profile.contact_phone },
    { icon: MapPin, label: t('profile.address'), value: profile.address },
    { icon: CreditCard, label: t('profile.rent'), value: profile.monthly_rent ? `${formatHuf(profile.monthly_rent)}/ho` : null },
    { icon: Tag, label: t('profile.type'), value: profile.property_type === 'uzlet' ? t('common.uzlet') : t('common.lakas') },
  ].filter(item => item.value);

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-2 mb-6 animate-in">
        <h1 className="font-display text-2xl font-bold">{t('profile.title')}</h1>
      </div>

      {/* Profile header card */}
      <div className="glass-card p-6 mb-5 animate-in-delay-1">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-16 h-16 rounded-2xl gradient-tenant-bg flex items-center justify-center flex-shrink-0">
            <span className="font-display font-bold text-primary-foreground text-xl">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-xl">{profile.name}</p>
            {profile.address && <p className="text-sm text-muted-foreground mt-0.5">{profile.address}</p>}
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="glass-card overflow-hidden mb-5 animate-in-delay-2">
        {infoItems.map((item, i) => (
          <div
            key={item.label}
            className={`flex items-center gap-4 px-5 py-4 ${
              i < infoItems.length - 1 ? "border-b border-border/50" : ""
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <item.icon className="h-4 w-4 text-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-medium text-sm truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Property card */}
      <div className="glass-card p-5 mb-5 animate-in-delay-2">
        <div className="flex items-center gap-3 mb-3">
          <Building2 className="h-5 w-5 text-primary" />
          <p className="font-display font-semibold">{t('profile.propertyInfo')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-accent/50 rounded-xl p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{t('profile.type')}</p>
            <p className="font-semibold text-sm">{profile.property_type === 'uzlet' ? t('common.uzlet') : t('common.lakas')}</p>
          </div>
          {profile.monthly_rent && (
            <div className="bg-accent/50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{t('profile.rent')}</p>
              <p className="font-semibold text-sm format-hu">{formatHuf(profile.monthly_rent)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="animate-in-delay-3">
        <Button variant="outline" className="w-full h-12" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> {t('common.logout')}
        </Button>
      </div>
    </div>
  );
};

export default TenantProfile;
