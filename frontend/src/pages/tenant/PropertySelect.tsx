import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronRight, Zap } from "lucide-react";
import { tenantSelectProperty, type PropertyItem } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const PropertySelect = () => {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    const stored = sessionStorage.getItem("pending_properties");
    if (stored) {
      setProperties(JSON.parse(stored));
    } else {
      navigate("/tenant/login");
    }
  }, []);

  const handleSelect = async (propertyId: number) => {
    setLoading(true);
    setError("");
    try {
      await tenantSelectProperty(propertyId);
      sessionStorage.removeItem("pending_properties");
      navigate("/tenant");
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="animate-in text-center mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-tenant-bg flex items-center justify-center mx-auto mb-5">
          <Zap className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">{t('propSelect.title')}</h1>
        <p className="text-muted-foreground">{t('propSelect.desc')}</p>
      </div>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      <div className="w-full max-w-sm space-y-3 animate-in-delay-1">
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id)}
            disabled={loading}
            className="glass-card-hover w-full p-5 flex items-center gap-4 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold">{p.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{p.property_type}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default PropertySelect;
