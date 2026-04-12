"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

interface ShellyCloudDevicePickerProps {
  deviceId: string;
  onSelectDevice: (id: string, name?: string) => void;
}

export function ShellyCloudDevicePicker({ deviceId, onSelectDevice }: ShellyCloudDevicePickerProps) {
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = api.shellyCloud.getSettings.useQuery();
  const { data: devices, isLoading: devicesLoading, error: devicesError, refetch: refetchDevices } =
    api.shellyCloud.listDevices.useQuery(undefined, {
      enabled: !!settings?.hasAuthKey,
    });

  const [serverHost, setServerHost] = useState("shelly-63-eu.shelly.cloud");
  const [authKey, setAuthKey] = useState("");
  const [saveError, setSaveError] = useState("");

  const saveSettings = api.shellyCloud.saveSettings.useMutation({
    onSuccess: async () => {
      setSaveError("");
      await refetchSettings();
      await refetchDevices();
    },
    onError: (err) => setSaveError(err.message),
  });

  // Still loading — show skeleton
  if (settingsLoading) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        Shelly Cloud beállítások betöltése...
      </div>
    );
  }

  // No credentials yet → show inline form
  if (!settings?.hasAuthKey) {
    return (
      <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            🔑 Shelly Cloud hozzáférés
          </p>
          <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
            <a href="https://control.shelly.cloud" target="_blank" rel="noopener noreferrer" className="font-medium underline">
              control.shelly.cloud
            </a>
            {" "}→ User Settings → Access And Permissions → <strong>Authorization cloud key</strong>
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">Szerver</label>
          <input
            type="text"
            value={serverHost}
            onChange={(e) => setServerHost(e.target.value)}
            placeholder="shelly-63-eu.shelly.cloud"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">Authorization Cloud Key</label>
          <input
            type="password"
            value={authKey}
            onChange={(e) => setAuthKey(e.target.value)}
            placeholder="MTAx..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="button"
          onClick={() => saveSettings.mutate({ authKey, serverHost })}
          disabled={saveSettings.isPending || !authKey.trim() || !serverHost.trim()}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {saveSettings.isPending ? "Mentés..." : "Kapcsolódás"}
        </button>

        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
      </div>
    );
  }

  // Credentials saved → show device picker
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Eszköz kiválasztása</label>
        <a href="/settings/shelly-cloud" className="text-xs text-muted-foreground underline hover:text-foreground">
          Shelly Cloud beállítások
        </a>
      </div>

      {devicesLoading && (
        <p className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          Eszközök betöltése...
        </p>
      )}

      {devicesError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs dark:border-red-900 dark:bg-red-950/30">
          <p className="font-semibold text-red-800 dark:text-red-300">Hiba a Shelly Cloud kapcsolatkor</p>
          <p className="mt-1 text-red-700 dark:text-red-400">{devicesError.message}</p>
          <button
            type="button"
            onClick={() => void refetchDevices()}
            className="mt-2 rounded-md border border-red-300 px-2 py-1 font-medium text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-200"
          >
            Újrapróbálás
          </button>
        </div>
      )}

      {!devicesLoading && !devicesError && devices && devices.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Nincsenek elérhető eszközök. Ellenőrizd a Shelly Cloud fiókodat.
        </p>
      )}

      {!devicesLoading && devices && devices.length > 0 && (
        <div className="space-y-1.5">
          {devices.map((d) => {
            const isSelected = deviceId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDevice(d.id, d.name)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary"
                    : "border-border hover:bg-secondary/50"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{d.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {d.id} · {d.code ?? d.type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.emStatus?.total_act_power !== undefined && (
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {Math.round(d.emStatus.total_act_power)} W
                    </span>
                  )}
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${
                      d.online ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
