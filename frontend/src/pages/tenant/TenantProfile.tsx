import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTenantProfile, tenantLogout, type TenantProperty } from "@/lib/api";
import { formatHuf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const TenantProfile = () => {
  const [profile, setProfile] = useState<TenantProperty | null>(null);
  const navigate = useNavigate();

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

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="pt-2 mb-6 animate-in">
        <h1 className="font-display text-2xl font-bold">Profil</h1>
      </div>

      <div className="glass-card p-6 animate-in-delay-1">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="font-display font-bold text-primary text-xl">{initials}</span>
          </div>
          <div>
            <p className="font-display font-bold text-lg">{profile.name}</p>
            {profile.address && <p className="text-sm text-muted-foreground">{profile.address}</p>}
          </div>
        </div>

        <div className="space-y-4 text-sm">
          {profile.contact_name && (
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Kapcsolattartó</span>
              <span className="font-medium">{profile.contact_name}</span>
            </div>
          )}
          {profile.contact_email && (
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{profile.contact_email}</span>
            </div>
          )}
          {profile.contact_phone && (
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Telefon</span>
              <span className="font-medium">{profile.contact_phone}</span>
            </div>
          )}
          {profile.monthly_rent && (
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Bérleti díj</span>
              <span className="font-medium">{formatHuf(profile.monthly_rent)}/hó</span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Típus</span>
            <span className="font-medium">{profile.property_type === 'uzlet' ? '🏪 Üzlet' : '🏠 Lakás'}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 animate-in-delay-2">
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Kijelentkezés
        </Button>
      </div>
    </div>
  );
};

export default TenantProfile;
