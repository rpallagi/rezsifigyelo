import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Zap, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tenantLogin, tenantRegister } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

const TenantLogin = () => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await tenantLogin(email, password);
      if (result.needs_property_select) {
        // Store properties and redirect to property select
        sessionStorage.setItem("pending_properties", JSON.stringify(result.properties));
        navigate("/tenant/select-property");
      } else {
        navigate("/tenant");
      }
    } catch (err: any) {
      setError(err.message || "Hibas e-mail cim vagy jelszo!");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const result = await tenantRegister(email, password, name);
      setSuccess(result.message || "Sikeres regisztracio!");
      setMode("login");
    } catch (err: any) {
      setError(err.message || "Hiba tortent a regisztracio soran!");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: string) => {
    // TODO: Implement OAuth flows
    setError(`${provider} bejelentkezes hamarosan elerheto!`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Theme toggle */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="animate-in text-center mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-tenant-bg flex items-center justify-center mx-auto mb-5">
          <Zap className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-2xl font-bold mb-2">Rezsi Kovetes</h1>
        <p className="text-muted-foreground">
          {mode === "login" ? "Berlo bejelentkezes" : "Uj fiok letrehozasa"}
        </p>
      </div>

      {/* Social Login Buttons */}
      <div className="w-full max-w-sm space-y-3 animate-in-delay-1 mb-6">
        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium gap-3"
          onClick={() => handleSocialLogin("Google")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Folytatas Google-lel
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium gap-3"
          onClick={() => handleSocialLogin("Facebook")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#1877F2">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Folytatas Facebook-kal
        </Button>

        <Button
          variant="outline"
          className="w-full h-12 text-sm font-medium gap-3"
          onClick={() => handleSocialLogin("Apple")}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Folytatas Apple-lel
        </Button>
      </div>

      {/* Divider */}
      <div className="w-full max-w-sm flex items-center gap-3 mb-6 animate-in-delay-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">vagy e-mail cimmel</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Login/Register Form */}
      <form
        onSubmit={mode === "login" ? handleLogin : handleRegister}
        className="w-full max-w-sm space-y-4 animate-in-delay-2"
      >
        {mode === "register" && (
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Neved"
              className="pl-10 h-12"
            />
          </div>
        )}

        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail cim"
            className="pl-10 h-12"
            autoFocus
            required
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Jelszo"
            className="pl-10 pr-10 h-12"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && <p className="text-success text-sm">{success}</p>}

        <Button
          type="submit"
          className="w-full h-12 gradient-primary-bg border-0 text-sm font-semibold"
          disabled={loading}
        >
          {loading
            ? (mode === "login" ? "Bejelentkezes..." : "Regisztracio...")
            : (mode === "login" ? "Bejelentkezes" : "Regisztracio")
          }
        </Button>
      </form>

      {/* Toggle login/register */}
      <p className="text-muted-foreground text-sm mt-6 animate-in-delay-3">
        {mode === "login" ? (
          <>
            Meg nincs fiokod?{" "}
            <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }} className="text-primary hover:underline font-medium">
              Regisztracio
            </button>
          </>
        ) : (
          <>
            Mar van fiokod?{" "}
            <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} className="text-primary hover:underline font-medium">
              Bejelentkezes
            </button>
          </>
        )}
      </p>

      <p className="text-muted-foreground text-xs mt-4 animate-in-delay-3">
        <Link to="/admin/login" className="text-primary hover:underline">Berbeado belepes</Link>
      </p>
    </div>
  );
};

export default TenantLogin;
