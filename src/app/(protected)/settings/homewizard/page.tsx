"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function HomeWizardSettingsPage() {
  const { data: settings } = api.homewizard.getSettings.useQuery();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"ok" | "error">("ok");

  const saveSettings = api.homewizard.saveSettings.useMutation({
    onSuccess: () => {
      setMessage("Mentve es csatlakozva!");
      setMessageType("ok");
    },
    onError: (err) => {
      setMessage(`Hiba: ${err.message}`);
      setMessageType("error");
    },
  });

  const testConnection = api.homewizard.testConnection.useMutation({
    onSuccess: (data) => {
      setMessage(
        `Kapcsolat OK — ${data.locationCount} helyszin, ${data.deviceCount} eszkoz`,
      );
      setMessageType("ok");
    },
    onError: (err) => {
      setMessage(`Hiba: ${err.message}`);
      setMessageType("error");
    },
  });

  const { data: locations } = api.homewizard.listDevices.useQuery(undefined, {
    enabled: !!settings?.hasCredentials,
  });

  const deviceCount =
    locations?.reduce((n, l) => n + l.devices.length, 0) ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-full p-2 transition hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">HomeWizard Energy</h1>
          <p className="text-sm text-muted-foreground">
            P1 mero, watermeter es energymeter adatok a HomeWizard cloud-bol.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-lg border border-border p-6">
        <h3 className="font-semibold">Fiok beallitasok</h3>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/30">
          <p className="font-semibold text-blue-900 dark:text-blue-200">
            Hogyan mukodik?
          </p>
          <ol className="mt-1.5 space-y-1 text-blue-800 dark:text-blue-300">
            <li>
              1. Hasznald ugyanazt az emailt es jelszot amit a{" "}
              <strong>HomeWizard Energy</strong> appban.
            </li>
            <li>
              2. A rendszer a HomeWizard cloud API-n keresztul kerdezi le az
              adatokat.
            </li>
            <li>
              3. Az ingyenes fiok 12 honapnyi adatot tarol — importalhato.
            </li>
          </ol>
        </div>

        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            value={email || settings?.email || ""}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pelda@email.com"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Jelszo</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={settings?.hasCredentials ? "••••••••" : "Jelszo"}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() =>
              saveSettings.mutate({
                email: email || settings?.email || "",
                password,
              })
            }
            disabled={
              saveSettings.isPending || (!email && !settings?.email) || !password
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saveSettings.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Mentes"
            )}
          </button>
          <button
            onClick={() => testConnection.mutate()}
            disabled={testConnection.isPending || !settings?.hasCredentials}
            className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
          >
            {testConnection.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Teszt"
            )}
          </button>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              messageType === "ok"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
            }`}
          >
            {messageType === "ok" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {message}
          </div>
        )}
      </div>

      {/* Device list */}
      {locations && locations.length > 0 && (
        <div className="mt-6 space-y-4 rounded-lg border border-border p-6">
          <h3 className="font-semibold">
            Eszközök ({deviceCount})
          </h3>
          {locations.map((loc) => (
            <div key={loc.id}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {loc.name}{" "}
                <span className="font-normal normal-case">{loc.location}</span>
              </p>
              <div className="mt-2 space-y-1.5">
                {loc.devices.map((dev) => (
                  <div
                    key={dev.device_id}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {dev.name || dev.type}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {dev.device_id}
                      </p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                      {dev.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
