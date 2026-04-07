"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { UserProfile } from "@clerk/nextjs";
import { api } from "@/trpc/react";
import Link from "next/link";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const utils = api.useUtils();
  const { data: user } = api.user.me.useQuery();

  // Email settings
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  // OCR settings
  const [ocrProvider, setOcrProvider] = useState("claude");

  // MQTT settings
  const [mqttEnabled, setMqttEnabled] = useState(false);
  const [mqttBroker, setMqttBroker] = useState("");
  const [mqttPort, setMqttPort] = useState("1883");
  const [mqttUser, setMqttUser] = useState("");
  const [mqttPassword, setMqttPassword] = useState("");
  const [mqttTopic, setMqttTopic] = useState("rezsi/#");

  const updateLocale = api.user.updateLocale.useMutation({
    onSuccess: () => void utils.user.me.invalidate(),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Beállítások</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alkalmazás, integráció és profil beállítások
        </p>
      </div>

      {/* Theme */}
      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Megjelenés</h2>
        <div className="mt-4 flex gap-2">
          {[
            { value: "light", label: "Világos" },
            { value: "dark", label: "Sötét" },
            { value: "system", label: "Rendszer" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`rounded-md border px-4 py-2 text-sm ${
                theme === t.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Language */}
      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Nyelv</h2>
        <div className="mt-4 flex gap-2">
          {[
            { value: "hu", label: "Magyar" },
            { value: "en", label: "English" },
          ].map((l) => (
            <button
              key={l.value}
              onClick={() =>
                updateLocale.mutate({ locale: l.value as "hu" | "en" })
              }
              className={`rounded-md border px-4 py-2 text-sm ${
                user?.locale === l.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Integrációk</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link
            href="/settings/home-assistant"
            className="rounded-lg border border-border p-4 hover:bg-secondary/50"
          >
            <h3 className="font-medium">Home Assistant</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Okos mérők, szenzorok
            </p>
          </Link>
          <Link
            href="/settings/smart-meters"
            className="rounded-lg border border-border p-4 hover:bg-secondary/50"
          >
            <h3 className="font-medium">Okos mérők (MQTT/TTN)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              LoRaWAN, MQTT webhook
            </p>
          </Link>
        </div>
      </section>

      {/* Email */}
      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">Email értesítések</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">
              {emailEnabled ? "Bekapcsolva" : "Kikapcsolva"}
            </span>
            <button
              onClick={() => setEmailEnabled(!emailEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground">
              Admin email
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            SMTP: Vercel env vars — SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
          </p>
        </div>
      </section>

      {/* OCR */}
      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">OCR (mérő leolvasás)</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground">Provider</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { value: "claude", label: "Claude Haiku" },
                { value: "openai", label: "GPT-4o mini" },
                { value: "gemini", label: "Gemini Flash" },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setOcrProvider(p.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    ocrProvider === p.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            API kulcs: Vercel env var — ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_AI_KEY
          </p>
        </div>
      </section>

      {/* MQTT */}
      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">MQTT</h2>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">{mqttEnabled ? "Bekapcsolva" : "Kikapcsolva"}</span>
            <button
              onClick={() => setMqttEnabled(!mqttEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                mqttEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  mqttEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {mqttEnabled && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-muted-foreground">Broker</label>
                  <input type="text" value={mqttBroker} onChange={(e) => setMqttBroker(e.target.value)} placeholder="mqtt.example.com" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground">Port</label>
                  <input type="number" value={mqttPort} onChange={(e) => setMqttPort(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-muted-foreground">User</label>
                  <input type="text" value={mqttUser} onChange={(e) => setMqttUser(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground">Jelszó</label>
                  <input type="password" value={mqttPassword} onChange={(e) => setMqttPassword(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground">Topic prefix</label>
                <input type="text" value={mqttTopic} onChange={(e) => setMqttTopic(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <p className="text-xs text-muted-foreground">
                Webhook URL: <code className="rounded bg-secondary px-1">/api/webhooks/smart-meter?source=mqtt</code>
              </p>
            </>
          )}
        </div>
      </section>

      {/* Smart Meter Webhook info */}
      <section className="rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold">TTN (LoRaWAN) Webhook</h2>
        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p>TTN Application → Integrations → Webhooks → Add:</p>
          <code className="block rounded bg-secondary p-2 text-xs">
            POST https://rezsifigyelo.vercel.app/api/webhooks/smart-meter?source=ttn
          </code>
          <p>Token: Vercel env var SMART_METER_WEBHOOK_TOKEN</p>
        </div>
      </section>

      {/* Clerk Profile */}
      <section className="rounded-lg border border-border p-6">
        <h2 className="mb-4 text-lg font-semibold">Profil</h2>
        <UserProfile />
      </section>
    </div>
  );
}
