import { useEffect, useState } from "react";
import { Rocket, GitBranch, GitCommit, RefreshCw, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { getSystemInfo, systemPull, systemRebuild, type SystemInfo } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";

const AdminSystem = () => {
  const { t } = useI18n();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [pullOutput, setPullOutput] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);

  const load = () => {
    setLoading(true);
    getSystemInfo()
      .then(setInfo)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handlePull = async () => {
    setPulling(true);
    setPullOutput(null);
    try {
      const result = await systemPull();
      setPullOutput(result.output || t('system.gitPullSuccess'));
      load();
    } catch (e: any) {
      setPullOutput(`${t('common.error')}: ${e.message}`);
    } finally {
      setPulling(false);
    }
  };

  const handleRebuild = async () => {
    setConfirmRebuild(false);
    setRebuilding(true);
    try {
      await systemRebuild();
      // The server will restart, so we may lose connection
      setPullOutput(t('system.rebuildStarted'));
    } catch (e: any) {
      setPullOutput(`${t('common.error')}: ${e.message}`);
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="space-y-6">
      <div className="animate-in">
        <h1 className="font-display text-2xl font-bold">{t('system.title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('system.desc')}</p>
      </div>

      {/* Version card */}
      <div className="glass-card p-5 animate-in-delay-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Rocket className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold">{t('system.versionInfo')}</h2>
            <p className="text-xs text-muted-foreground">{t('system.versionInfo')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t('system.version')}</p>
            <p className="font-display font-bold text-sm">{info.version}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t('system.branch')}</p>
            <p className="flex items-center gap-1.5 text-sm">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono font-medium">{info.branch}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t('system.commit')}</p>
            <p className="flex items-center gap-1.5 text-sm">
              <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
              <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{info.commit_hash}</code>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t('system.commitDate')}</p>
            <p className="text-sm">{formatDate(info.commit_date)}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-0.5">{t('system.commitMsg')}</p>
            <p className="text-sm">{info.commit_message}</p>
          </div>
        </div>
      </div>

      {/* Update status */}
      <div className="glass-card p-5 animate-in-delay-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {info.has_update ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center animate-pulse">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-amber-600">
                    {info.behind} {t('system.newCommits')}
                  </h2>
                  <p className="text-xs text-muted-foreground">{t('system.updateAvailable')}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-green-600">{t('system.upToDate')}</h2>
                  <p className="text-xs text-muted-foreground">{t('system.upToDateDesc')}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* New commits list */}
        {info.has_update && info.new_commits && info.new_commits.length > 0 && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('system.newCommits')}:</p>
            <div className="space-y-1">
              {info.new_commits.map((c, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground">{c}</p>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handlePull}
            disabled={pulling || rebuilding}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            {pulling ? t('system.gitPulling') : t('system.gitPull')}
          </Button>
          <Button
            onClick={() => setConfirmRebuild(true)}
            disabled={pulling || rebuilding}
            className="flex-1 gradient-primary-bg border-0"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${rebuilding ? "animate-spin" : ""}`} />
            {rebuilding ? t('system.rebuilding') : t('system.rebuild')}
          </Button>
        </div>
      </div>

      {/* Pull output */}
      {pullOutput && (
        <div className="glass-card p-5 animate-in">
          <h3 className="font-display font-bold text-sm mb-2">{t('system.output')}</h3>
          <pre className="text-xs font-mono bg-muted/50 p-3 rounded-lg whitespace-pre-wrap overflow-x-auto max-h-48">
            {pullOutput}
          </pre>
        </div>
      )}

      {/* Rebuild confirmation */}
      <AlertDialog open={confirmRebuild} onOpenChange={setConfirmRebuild}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t('system.rebuildConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('system.rebuildConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRebuild} className="gradient-primary-bg border-0">
              {t('common.yes')}, {t('system.rebuild').toLowerCase()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSystem;
