"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

interface ShellyCloudDevicePickerProps {
  deviceId: string;
  onSelectDevice: (id: string, name: string | undefined, authKey: string, serverHost: string) => void;
}

export function ShellyCloudDevicePicker({ deviceId, onSelectDevice }: ShellyCloudDevicePickerProps) {
  const [serverHost, setServerHost] = useState("shelly-63-eu.shelly.cloud");
  const [authKey, setAuthKey] = useState("");
  const [devices, setDevices] = useState<Array<{ id: string; name: string; type: string; online: boolean }> | null>(null);

  const connect = api.shellyCloud.connectShelly.useMutation({
    onSuccess: (result) => {
      setDevices(result);
      // Auto-select if only 1 device
      if (result.length === 1) {
        const d = result[0]!;
        onSelectDevice(d.id, d.name, authKey, serverHost);
      }
    },
  });

  // Step 1: Connect form
  if (!devices) {
    return (
      <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <div>
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            🔑 Shelly Cloud hozzáférés
          </p>
          <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
            Hol találod?{" "}
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
          onClick={() => connect.mutate({ authKey, serverHost })}
          disabled={connect.isPending || !authKey.trim() || !serverHost.trim()}
          className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {connect.isPending ? "Kapcsolódás..." : "Kapcsolódás →"}
        </button>

        {connect.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/30 dark:text-red-300">
            {connect.error.message}
          </p>
        )}
      </div>
    );
  }

  // Step 2: Device selection (or single-device confirmation)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {devices.length === 1 ? "Eszköz:" : `${devices.length} eszköz található:`}
        </p>
        <button
          type="button"
          onClick={() => {
            setDevices(null);
            onSelectDevice("", undefined, "", "");
          }}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Más fiók
        </button>
      </div>

      <div className="space-y-1.5">
        {devices.map((d) => {
          const isSelected = deviceId === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDevice(d.id, d.name, authKey, serverHost)}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary"
                  : "border-border hover:bg-secondary/50"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{d.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {d.id} · {d.type}
                </p>
              </div>
              <span
                className={`inline-flex h-2 w-2 shrink-0 rounded-full ${
                  d.online ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
