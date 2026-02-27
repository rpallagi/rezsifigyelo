import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, LogOut, CheckCircle2, Mail, Send, AlertCircle, Server, Network, Loader2, ScanLine, Eye, EyeOff, ChevronDown } from "lucide-react";
import {
  changeAdminPassword, adminLogout, getEmailSettings, saveEmailSettings, testEmail,
  getHomeAssistantSettings, saveHomeAssistantSettings, testHomeAssistantConnection, getTailscaleDevices,
  getOcrSettings, saveOcrSettings,
  type TailscaleDeviceItem, type OcrSettings,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

const normalizeHaBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");
const normalizeHaToken = (value: string) => value.trim().replace(/^Bearer\s+/i, "");

const validateHaFields = (baseUrl: string, token: string, t: (key: string) => string): string | null => {
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return t('settings.haInvalidUrl');
      }
    } catch {
      return t('settings.haInvalidUrl');
    }
  }

  if (token) {
    if (/react router future flag warning/i.test(token)) {
      return t('settings.haInvalidTokenConsole');
    }
    if (/\s/.test(token)) {
      return t('settings.haInvalidTokenWhitespace');
    }
    if (token.length < 20) {
      return t('settings.haInvalidTokenShort');
    }
  }

  return null;
};

const AdminSettings = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  // Email settings state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [haBaseUrl, setHaBaseUrl] = useState("");
  const [haToken, setHaToken] = useState("");
  const [tailscaleApiToken, setTailscaleApiToken] = useState("");
  const [tailscaleTailnet, setTailscaleTailnet] = useState("");
  const [haSaving, setHaSaving] = useState(false);
  const [haSaveSuccess, setHaSaveSuccess] = useState(false);
  const [haTesting, setHaTesting] = useState(false);
  const [haTestResult, setHaTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tailscaleLoading, setTailscaleLoading] = useState(false);
  const [tailscaleDevices, setTailscaleDevices] = useState<TailscaleDeviceItem[]>([]);
  const [tailscaleResult, setTailscaleResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // OCR settings state
  const [ocrProvider, setOcrProvider] = useState<OcrSettings['provider']>('openai');
  const [ocrAnthropicKey, setOcrAnthropicKey] = useState('');
  const [ocrOpenaiKey, setOcrOpenaiKey] = useState('');
  const [ocrAnthropicConfigured, setOcrAnthropicConfigured] = useState(false);
  const [ocrOpenaiConfigured, setOcrOpenaiConfigured] = useState(false);
  const [ocrAnthropicMasked, setOcrAnthropicMasked] = useState('');
  const [ocrOpenaiMasked, setOcrOpenaiMasked] = useState('');
  const [ocrShowAnthropicKey, setOcrShowAnthropicKey] = useState(false);
  const [ocrShowOpenaiKey, setOcrShowOpenaiKey] = useState(false);
  const [ocrShowHowto, setOcrShowHowto] = useState(false);
  const [ocrSaving, setOcrSaving] = useState(false);
  const [ocrSaveResult, setOcrSaveResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Load settings on mount
  useEffect(() => {
    getEmailSettings().then((data) => {
      setEmailEnabled(data.enabled);
      setAdminEmail(data.admin_email);
      setSmtpConfigured(data.smtp_configured);
    }).catch(() => {});
    getHomeAssistantSettings().then((data) => {
      setHaBaseUrl(data.ha_base_url || "");
      setHaToken(data.ha_token || "");
      setTailscaleApiToken(data.tailscale_api_token || "");
      setTailscaleTailnet(data.tailscale_tailnet || "");
    }).catch(() => {});
    getOcrSettings().then((data) => {
      setOcrProvider(data.provider || 'openai');
      setOcrAnthropicConfigured(data.anthropic_configured);
      setOcrOpenaiConfigured(data.openai_configured);
      setOcrAnthropicMasked(data.anthropic_key_masked || '');
      setOcrOpenaiMasked(data.openai_key_masked || '');
    }).catch(() => {});
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError(t('settings.passwordMismatch'));
      return;
    }

    if (newPassword.length < 4) {
      setError(t('settings.passwordTooShort'));
      return;
    }

    setSaving(true);
    try {
      await changeAdminPassword(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setError(e.message || t('settings.passwordError'));
    } finally {
      setSaving(false);
    }
  };

  const handleEmailSave = async () => {
    setEmailSaving(true);
    setEmailSuccess(false);
    try {
      await saveEmailSettings({ enabled: emailEnabled, admin_email: adminEmail });
      setEmailSuccess(true);
      setTimeout(() => setEmailSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      await testEmail();
      setTestResult({ ok: true, msg: t('settings.testEmailSent') });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || t('settings.testEmailError') });
    } finally {
      setTestSending(false);
    }
  };

  const handleHaSave = async () => {
    setHaSaving(true);
    setHaSaveSuccess(false);
    try {
      await persistHaSettings();
      setHaSaveSuccess(true);
      setTimeout(() => setHaSaveSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setHaSaving(false);
    }
  };

  const persistHaSettings = async () => {
    const cleanedBaseUrl = normalizeHaBaseUrl(haBaseUrl);
    const cleanedToken = normalizeHaToken(haToken);
    const validationError = validateHaFields(cleanedBaseUrl, cleanedToken, t);
    if (validationError) {
      throw new Error(validationError);
    }

    if (cleanedBaseUrl !== haBaseUrl) setHaBaseUrl(cleanedBaseUrl);
    if (cleanedToken !== haToken) setHaToken(cleanedToken);

    const payload = {
      ha_base_url: cleanedBaseUrl,
      ha_token: cleanedToken,
      tailscale_api_token: tailscaleApiToken.trim(),
      tailscale_tailnet: tailscaleTailnet.trim(),
    };
    await saveHomeAssistantSettings(payload);
    return payload;
  };

  const handleHaTest = async () => {
    setHaTesting(true);
    setHaTestResult(null);
    try {
      await persistHaSettings();
      const res = await testHomeAssistantConnection();
      setHaTestResult({
        ok: true,
        msg: t('settings.haTestOk')
          .replace('{sensors}', String(res.sensor_count))
          .replace('{entities}', String(res.total_entities)),
      });
    } catch (e: any) {
      setHaTestResult({ ok: false, msg: e.message || t('settings.haTestError') });
    } finally {
      setHaTesting(false);
    }
  };

  const handleTailscaleDiscover = async () => {
    setTailscaleLoading(true);
    setTailscaleResult(null);
    try {
      await persistHaSettings();
      const res = await getTailscaleDevices();
      setTailscaleDevices(res.devices || []);
      setTailscaleResult({
        ok: true,
        msg: t('settings.haTailscaleFound').replace('{count}', String(res.count || 0)),
      });
    } catch (e: any) {
      setTailscaleDevices([]);
      setTailscaleResult({ ok: false, msg: e.message || t('settings.haTailscaleError') });
    } finally {
      setTailscaleLoading(false);
    }
  };

  const handleOcrSave = async () => {
    setOcrSaving(true);
    setOcrSaveResult(null);
    try {
      await saveOcrSettings({
        provider: ocrProvider,
        anthropic_key: ocrAnthropicKey || undefined,
        openai_key: ocrOpenaiKey || undefined,
      });
      setOcrSaveResult({ ok: true, msg: t('settings.ocrSaved') });
      // Refresh status
      const updated = await getOcrSettings();
      setOcrAnthropicConfigured(updated.anthropic_configured);
      setOcrOpenaiConfigured(updated.openai_configured);
      setOcrAnthropicMasked(updated.anthropic_key_masked || '');
      setOcrOpenaiMasked(updated.openai_key_masked || '');
      setOcrAnthropicKey('');
      setOcrOpenaiKey('');
      setTimeout(() => setOcrSaveResult(null), 4000);
    } catch (e: any) {
      setOcrSaveResult({ ok: false, msg: e.message || t('settings.ocrSaveError') });
    } finally {
      setOcrSaving(false);
    }
  };

  const handleLogout = async () => {
    setLogoutConfirm(false);
    try {
      await adminLogout();
    } catch {
      // ignore
    }
    navigate("/admin/login");
  };

  const formatLastSeen = (value?: string) => {
    if (!value) return "";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('settings.desc')}</p>
      </div>

      {/* Email settings card */}
      <div className="glass-card p-5 max-w-lg animate-in-delay-1">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Mail className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold">{t('settings.emailTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('settings.emailDesc')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {emailEnabled ? t('settings.emailEnabled') : t('settings.emailDisabled')}
            </span>
            <button
              onClick={() => setEmailEnabled(!emailEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Admin email */}
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('settings.adminEmail')}</label>
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder={t('settings.adminEmailPlaceholder')}
            />
          </div>

          {/* SMTP status */}
          <div className="flex items-center gap-2 text-sm">
            {smtpConfigured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-green-600">{t('settings.smtpConfigured')}</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-amber-600">{t('settings.smtpNotConfigured')}</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.smtpHint')}</p>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{testResult.msg}</span>
            </div>
          )}

          {emailSuccess && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('common.success')}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleEmailSave}
              disabled={emailSaving}
              className="flex-1 gradient-primary-bg border-0"
            >
              {emailSaving ? t('common.saving') : t('common.save')}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestEmail}
              disabled={testSending || !smtpConfigured || !adminEmail}
            >
              <Send className="h-4 w-4 mr-2" />
              {testSending ? t('settings.testEmailSending') : t('settings.testEmail')}
            </Button>
          </div>
        </div>
      </div>

      {/* Home Assistant setup moved to property scope */}
      <div className="glass-card p-5 max-w-2xl animate-in-delay-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Server className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold">{t('settings.haTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('settings.haDesc')}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('meters.haSetupScopeHint')}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {t('settings.haMovedToProperty')}
        </p>
      </div>

      {/* OCR Provider settings card */}
      <div className="glass-card p-5 max-w-lg animate-in-delay-1">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <ScanLine className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold">{t('settings.ocrTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('settings.ocrDesc')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Provider selector */}
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('settings.ocrProvider')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['claude', 'openai', 'tesseract'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setOcrProvider(p)}
                  className={`text-xs py-2 px-2 rounded-lg border transition-colors text-center ${
                    ocrProvider === p
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {p === 'claude' ? 'Claude (Anthropic)' : p === 'openai' ? 'GPT-4o mini' : 'Tesseract'}
                </button>
              ))}
            </div>
          </div>

          {/* Anthropic API key */}
          {ocrProvider === 'claude' && (
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('settings.ocrAnthropicKey')}</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 relative">
                  <Input
                    type="text"
                    value={ocrShowAnthropicKey ? ocrAnthropicKey : (ocrAnthropicKey ? '•'.repeat(Math.min(ocrAnthropicKey.length, 20)) : '')}
                    onChange={(e) => setOcrAnthropicKey(e.target.value)}
                    onFocus={() => setOcrShowAnthropicKey(true)}
                    placeholder={ocrAnthropicConfigured ? `${ocrAnthropicMasked} (hagyd üresen a megtartáshoz)` : t('settings.ocrAnthropicKeyPlaceholder')}
                    autoComplete="off"
                    className="font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setOcrShowAnthropicKey(!ocrShowAnthropicKey)}
                    className="absolute right-2 text-muted-foreground hover:text-foreground"
                  >
                    {ocrShowAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {ocrAnthropicConfigured ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><span className="text-xs text-green-600">{t('settings.ocrKeyConfigured')}</span></>
                ) : (
                  <><AlertCircle className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs text-amber-600">{t('settings.ocrKeyNotConfigured')}</span></>
                )}
              </div>
            </div>
          )}

          {/* OpenAI API key */}
          {ocrProvider === 'openai' && (
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('settings.ocrOpenaiKey')}</label>
              <div className="relative">
                <Input
                  type="text"
                  value={ocrShowOpenaiKey ? ocrOpenaiKey : (ocrOpenaiKey ? '•'.repeat(Math.min(ocrOpenaiKey.length, 20)) : '')}
                  onChange={(e) => setOcrOpenaiKey(e.target.value)}
                  onFocus={() => setOcrShowOpenaiKey(true)}
                  placeholder={ocrOpenaiConfigured ? `${ocrOpenaiMasked} (hagyd üresen a megtartáshoz)` : t('settings.ocrOpenaiKeyPlaceholder')}
                  autoComplete="off"
                  className="font-mono text-xs pr-8"
                />
                <button
                  type="button"
                  onClick={() => setOcrShowOpenaiKey(!ocrShowOpenaiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {ocrShowOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {ocrOpenaiConfigured ? (
                  <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><span className="text-xs text-green-600">{t('settings.ocrKeyConfigured')}</span></>
                ) : (
                  <><AlertCircle className="h-3.5 w-3.5 text-amber-500" /><span className="text-xs text-amber-600">{t('settings.ocrKeyNotConfigured')}</span></>
                )}
              </div>
            </div>
          )}

          {/* Tesseract info */}
          {ocrProvider === 'tesseract' && (
            <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground">
              {t('settings.ocrHowtoTesseract')}
            </div>
          )}

          {/* How-to guide */}
          {ocrProvider !== 'tesseract' && (
            <div>
              <button
                onClick={() => setOcrShowHowto(!ocrShowHowto)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ocrShowHowto ? 'rotate-180' : ''}`} />
                {t('settings.ocrHowto')}
              </button>
              {ocrShowHowto && (
                <div className="mt-2 bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
                  <p>
                    {ocrProvider === 'claude'
                      ? t('settings.ocrHowtoClaude')
                      : t('settings.ocrHowtoOpenai')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Save result */}
          {ocrSaveResult && (
            <div className={`flex items-center gap-2 text-sm ${ocrSaveResult.ok ? 'text-green-600' : 'text-destructive'}`}>
              {ocrSaveResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{ocrSaveResult.msg}</span>
            </div>
          )}

          <Button
            onClick={handleOcrSave}
            disabled={ocrSaving}
            className="w-full gradient-primary-bg border-0"
          >
            {ocrSaving ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* Password change card */}
      <div className="glass-card p-5 max-w-lg animate-in-delay-1">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Lock className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold">{t('settings.passwordChange')}</h2>
            <p className="text-xs text-muted-foreground">{t('settings.passwordChangeDesc')}</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <input type="text" name="username" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} readOnly />
          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('settings.currentPassword')}</label>
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('settings.currentPassword')}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('settings.newPassword')}</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('settings.newPassword')}
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">{t('settings.confirmPassword')}</label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('settings.confirmPassword')}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t('settings.passwordSuccess')}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full gradient-primary-bg border-0"
          >
            {saving ? t('common.saving') : t('settings.changePassword')}
          </Button>
        </form>
      </div>

      {/* Logout card */}
      <div className="glass-card p-5 max-w-lg animate-in-delay-2">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <LogOut className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold">{t('settings.logoutTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('settings.logoutDesc')}</p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setLogoutConfirm(true)}
          className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t('common.logout')}
        </Button>
      </div>

      {/* Logout confirmation */}
      <AlertDialog open={logoutConfirm} onOpenChange={setLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t('settings.logoutTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.logoutConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              {t('common.logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSettings;
