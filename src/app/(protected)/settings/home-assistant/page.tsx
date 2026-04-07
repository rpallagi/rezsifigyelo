"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

export default function HomeAssistantSettingsPage() {
  const { data: settings } = api.homeAssistant.getSettings.useQuery();
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [testResult, setTestResult] = useState("");

  const saveSettings = api.homeAssistant.saveSettings.useMutation({
    onSuccess: () => setTestResult("Mentve!"),
  });

  const testConnection = api.homeAssistant.testConnection.useMutation({
    onSuccess: (data) => setTestResult(`Kapcsolódva: ${data.message}`),
    onError: (err) => setTestResult(`Hiba: ${err.message}`),
  });

  const { data: entities } = api.homeAssistant.listEntities.useQuery(
    undefined,
    { enabled: !!settings?.hasToken },
  );

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Home Assistant Integráció</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Csatlakoztasd a Home Assistant-edet okos mérők automatikus
        leolvasásához.
      </p>

      {/* Connection settings */}
      <div className="mt-6 space-y-4 rounded-lg border border-border p-6">
        <h3 className="font-semibold">Kapcsolat</h3>
        <div>
          <label className="block text-sm font-medium">HA URL</label>
          <input
            type="url"
            value={baseUrl || settings?.baseUrl || ""}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://192.168.1.100:8123"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">
            Long-Lived Access Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={settings?.hasToken ? "••••••••" : "Illeszd be a tokent"}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            HA → Profil → Long-Lived Access Tokens → Create Token
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              saveSettings.mutate({
                baseUrl: baseUrl || settings?.baseUrl || "",
                token: token,
              })
            }
            disabled={saveSettings.isPending}
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

      {/* Entity list */}
      {entities && entities.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold">
            Elérhető szenzorok ({entities.length})
          </h3>
          <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2 font-medium">Entitás</th>
                  <th className="p-2 font-medium">Érték</th>
                  <th className="p-2 font-medium">Típus</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e) => (
                  <tr key={e.entityId} className="border-b">
                    <td className="p-2">
                      <p className="font-medium">{e.friendlyName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {e.entityId}
                      </p>
                    </td>
                    <td className="p-2">
                      {e.state} {e.unitOfMeasurement}
                    </td>
                    <td className="p-2 capitalize">{e.guessedUtility}</td>
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
