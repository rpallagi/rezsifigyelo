import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, Lock, LogOut, CheckCircle2 } from "lucide-react";
import { changeAdminPassword, adminLogout } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

const AdminSettings = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Az új jelszavak nem egyeznek!");
      return;
    }

    if (newPassword.length < 4) {
      setError("Az új jelszónak legalább 4 karakter hosszúnak kell lennie!");
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
      setError(e.message || "Hiba történt a jelszó módosítása közben.");
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-2xl font-bold">Beállítások</h1>
        <p className="text-muted-foreground text-sm mt-1">Fiók és biztonsági beállítások</p>
      </div>

      {/* Password change card */}
      <div className="glass-card p-5 max-w-lg animate-in-delay-1">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Lock className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold">Jelszó módosítás</h2>
            <p className="text-xs text-muted-foreground">Változtasd meg az admin jelszavadat</p>
          </div>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">Jelenlegi jelszó</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Jelenlegi jelszó"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">Új jelszó</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Új jelszó"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">Új jelszó megerősítése</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Új jelszó ismét"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {success && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Jelszó sikeresen módosítva!</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full gradient-primary-bg border-0"
          >
            {saving ? "Mentés..." : "Jelszó módosítása"}
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
            <h2 className="font-display font-bold">Kijelentkezés</h2>
            <p className="text-xs text-muted-foreground">Kilépés az admin felületről</p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setLogoutConfirm(true)}
          className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Kijelentkezés
        </Button>
      </div>

      {/* Logout confirmation */}
      <AlertDialog open={logoutConfirm} onOpenChange={setLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Kijelentkezés</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan ki szeretnél jelentkezni az admin felületről?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>
              Kijelentkezés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSettings;
