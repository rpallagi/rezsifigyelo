import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useI18n } from "@/lib/i18n";

const AdminLogin = () => {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminLogin(username, password);
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || t('adminLogin.errorLogin'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="fixed top-4 right-4 flex items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
      <div className="animate-in text-center mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-admin-bg flex items-center justify-center mx-auto mb-5">
          <Zap className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">{t('common.appName')}</h1>
        <p className="text-muted-foreground">{t('adminLogin.title')}</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 animate-in-delay-1">
        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t('adminLogin.username')}</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus />
        </div>
        <div>
          <label className="text-sm text-muted-foreground block mb-1">{t('adminLogin.password')}</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" className="w-full gradient-primary-bg border-0" disabled={loading}>
          {loading ? t('adminLogin.loggingIn') : t('adminLogin.loginBtn')}
        </Button>
      </form>

      <p className="text-muted-foreground text-xs mt-8 animate-in-delay-2">
        <Link to="/tenant/login" className="text-primary hover:underline">&larr; {t('adminLogin.tenantLogin')}</Link>
      </p>
    </div>
  );
};

export default AdminLogin;
