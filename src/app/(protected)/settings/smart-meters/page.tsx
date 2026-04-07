"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

const utilityLabels: Record<string, string> = {
  villany: "Villany", viz: "Víz", gaz: "Gáz", csatorna: "Csatorna",
  internet: "Internet", kozos_koltseg: "Közös költség", egyeb: "Egyéb",
};

export default function SmartMeterSettingsPage() {
  const { data: properties } = api.property.list.useQuery();
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const { data: devices } = api.smartMeter.list.useQuery(
    { propertyId: selectedProperty! },
    { enabled: !!selectedProperty },
  );
  const utils = api.useUtils();

  // New device form
  const [deviceId, setDeviceId] = useState("");
  const [utilityType, setUtilityType] = useState("villany");
  const [source, setSource] = useState<"ttn" | "mqtt" | "home_assistant">("mqtt");
  const [name, setName] = useState("");
  const [valueField, setValueField] = useState("meter_value");
  const [multiplier, setMultiplier] = useState("1");
  const [offset, setOffset] = useState("0");
  const [minInterval, setMinInterval] = useState("60");

  const createDevice = api.smartMeter.create.useMutation({
    onSuccess: () => {
      setDeviceId(""); setName("");
      if (selectedProperty) void utils.smartMeter.list.invalidate({ propertyId: selectedProperty });
    },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty || !deviceId) return;
    createDevice.mutate({
      propertyId: selectedProperty,
      utilityType: utilityType as "villany",
      deviceId,
      source,
      name: name || undefined,
      valueField,
      multiplier: Number(multiplier),
      offset: Number(offset),
      minIntervalMinutes: Number(minInterval),
    });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Okos mérő eszközök</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        TTN / MQTT / HA szenzor eszközök kezelése ingatlanonként.
      </p>

      {/* Property selector */}
      <div className="mt-6">
        <label className="block text-sm font-medium">Ingatlan</label>
        <select
          value={selectedProperty ?? ""}
          onChange={(e) => setSelectedProperty(Number(e.target.value) || null)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Válassz ingatlant...</option>
          {properties?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Existing devices */}
      {selectedProperty && devices && (
        <div className="mt-6">
          <h3 className="font-semibold">Eszközök ({devices.length})</h3>
          {devices.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nincs eszköz.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{d.name ?? d.deviceId}</p>
                    <p className="text-xs text-muted-foreground">
                      {utilityLabels[d.utilityType]} · {d.source} · {d.deviceId}
                    </p>
                    {d.lastSeenAt && (
                      <p className="text-xs text-muted-foreground">
                        Utolsó: {new Date(d.lastSeenAt).toLocaleString("hu-HU")}
                        {d.lastRawValue != null && ` — ${d.lastRawValue}`}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${d.isActive ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-600"}`}>
                    {d.isActive ? "Aktív" : "Inaktív"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add new device */}
      {selectedProperty && (
        <form onSubmit={handleAdd} className="mt-8 space-y-4 rounded-lg border border-border p-6">
          <h3 className="font-semibold">Új eszköz</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">Device ID *</label>
              <input type="text" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Név</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-muted-foreground">Közmű</label>
              <select value={utilityType} onChange={(e) => setUtilityType(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {Object.entries(utilityLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Forrás</label>
              <select value={source} onChange={(e) => setSource(e.target.value as "mqtt")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="mqtt">MQTT</option>
                <option value="ttn">TTN (LoRaWAN)</option>
                <option value="home_assistant">Home Assistant</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Value field</label>
              <input type="text" value={valueField} onChange={(e) => setValueField(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-muted-foreground">Szorzó</label>
              <input type="number" step="any" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Offset</label>
              <input type="number" step="any" value={offset} onChange={(e) => setOffset(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Min. intervallum (perc)</label>
              <input type="number" value={minInterval} onChange={(e) => setMinInterval(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <button type="submit" disabled={!deviceId || createDevice.isPending} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {createDevice.isPending ? "Mentés..." : "Hozzáadás"}
          </button>
        </form>
      )}
    </div>
  );
}
