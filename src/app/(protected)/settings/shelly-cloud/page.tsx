"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export default function ShellyCloudSettingsPage() {
  const { data: settings } = api.shellyCloud.getSettings.useQuery();
  const [authKey, setAuthKey] = useState("");
  const [serverHost, setServerHost] = useState("");
  const [testResult, setTestResult] = useState("");

  const effectiveServerHost =
    serverHost.length > 0 ? serverHost : (settings?.serverHost ?? "");

  const saveSettings = api.shellyCloud.saveSettings.useMutation({
    onSuccess: () => setTestResult("Mentve!"),
  });

  const testConnection = api.shellyCloud.testConnection.useMutation({
    onSuccess: (data) =>
      setTestResult(`Kapcsolat OK — ${data.deviceCount} eszköz találva`),
    onError: (err) => setTestResult(`Hiba: ${err.message}`),
  });

  const { data: devices } = api.shellyCloud.listDevices.useQuery(undefined, {
    enabled: !!settings?.hasAuthKey,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Shelly Cloud</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Shelly energiamérők automatikus adatgyűjtése a Shelly Cloud API-n keresztül.
        Az adatok 5 percenként frissülnek.
      </p>

      <div className="mt-6 space-y-4 rounded-lg border border-border p-6">
        <h3 className="font-semibold">Kapcsolat beállítása</h3>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/30">
          <p className="font-semibold text-blue-900 dark:text-blue-200">Hol találod az adatokat?</p>
          <ol className="mt-1.5 space-y-1 text-blue-800 dark:text-blue-300">
            <li>1. Nyisd meg: <a href="https://control.shelly.cloud" target="_blank" rel="noopener noreferrer" className="font-medium underline">control.shelly.cloud</a></li>
            <li>2. Bal alul / jobb felül: <strong>User Settings</strong></li>
            <li>3. <strong>Access And Permissions</strong> → lent: <strong>Authorization cloud key</strong></li>
            <li>4. Ott látod a Server-t és a kulcsot — másold be őket ide</li>
          </ol>
        </div>

        <div>
          <label className="block text-sm font-medium">Szerver</label>
          <input
            type="text"
            value={effectiveServerHost}
            onChange={(e) => setServerHost(e.target.value)}
            placeholder="shelly-63-eu.shelly.cloud"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Csak a host rész (https:// nélkül)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Authorization Cloud Key</label>
          <input
            type="password"
            value={authKey}
            onChange={(e) => setAuthKey(e.target.value)}
            placeholder={settings?.hasAuthKey ? "••••••••" : "MTAx..."}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              saveSettings.mutate({
                authKey,
                serverHost: effectiveServerHost,
              })
            }
            disabled={saveSettings.isPending || !authKey}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Mentés
          </button>
          <button
            onClick={() => testConnection.mutate()}
            disabled={testConnection.isPending}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            Teszt
          </button>
        </div>

        {testResult && (
          <p className="text-sm text-muted-foreground">{testResult}</p>
        )}
      </div>

      {devices && devices.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold">Eszközök ({devices.length})</h3>
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2 font-medium">Név</th>
                  <th className="p-2 font-medium">Típus</th>
                  <th className="p-2 font-medium">ID</th>
                  <th className="p-2 font-medium">Státusz</th>
                  <th className="p-2 font-medium">Teljesítmény</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="p-2 font-medium">{d.name}</td>
                    <td className="p-2 text-muted-foreground">{d.code ?? d.type}</td>
                    <td className="p-2 font-mono text-xs text-muted-foreground">{d.id}</td>
                    <td className="p-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.online
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            d.online ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        {d.online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="p-2">
                      {d.emStatus?.total_act_power !== undefined
                        ? `${Math.round(d.emStatus.total_act_power)} W`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
