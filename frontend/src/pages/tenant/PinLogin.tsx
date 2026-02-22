import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Delete, Zap } from "lucide-react";
import { getProperties, tenantLogin, type PropertyItem } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

const PinLogin = () => {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const maxLength = 6;

  useEffect(() => {
    getProperties()
      .then((data) => setProperties(data.properties))
      .catch(() => setError(t('pinLogin.loadError')));
  }, []);

  const handleDigit = (digit: string) => {
    if (pin.length < maxLength) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const handleSubmit = async () => {
    if (!selectedProperty) {
      setError(t('pinLogin.selectError'));
      return;
    }
    if (pin.length < 4) {
      setError(t('pinLogin.pinTooShort'));
      return;
    }

    setLoading(true);
    try {
      await tenantLogin(parseInt(selectedProperty), pin);
      navigate("/tenant");
    } catch (e: any) {
      setError(e.message || t('pinLogin.pinError'));
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when PIN is complete (4-6 digits)
  useEffect(() => {
    if (pin.length >= 4 && selectedProperty) {
      handleSubmit();
    }
  }, [pin]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="animate-in text-center mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-tenant-bg flex items-center justify-center mx-auto mb-5">
          <Zap className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">{t('common.appName')}</h1>
        <p className="text-muted-foreground">{t('pinLogin.desc')}</p>
      </div>

      {/* Property selector */}
      <div className="w-full max-w-xs mb-6 animate-in-delay-1">
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="h-12 text-base">
            <SelectValue placeholder={t('pinLogin.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 mb-8 animate-in-delay-1">
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all duration-200 ${
              i < pin.length ? "bg-primary scale-110" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-destructive text-sm mb-4 animate-in">{error}</p>
      )}

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-4 animate-in-delay-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
          if (key === "") return <div key="empty" />;
          if (key === "del") {
            return (
              <button key="del" onClick={handleDelete} className="pin-button bg-transparent">
                <Delete className="h-6 w-6" />
              </button>
            );
          }
          return (
            <button
              key={key}
              onClick={() => handleDigit(key)}
              className="pin-button"
              disabled={loading}
            >
              {key}
            </button>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs mt-8">
        <a href="/admin/login" className="text-primary hover:underline">{t('tenantLogin.landlordLogin')} →</a>
      </p>
    </div>
  );
};

export default PinLogin;
