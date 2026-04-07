"use client";

import { useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { api } from "@/trpc/react";

export default function SmartMeterSettingsPage() {
  const { messages, utilityLabel, intlLocale } = useLocale();
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
      <h1 className="text-2xl font-bold">{messages.smartMetersPage.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {messages.smartMetersPage.description}
      </p>

      {/* Property selector */}
      <div className="mt-6">
        <label className="block text-sm font-medium">{messages.smartMetersPage.propertySelector}</label>
        <select
          value={selectedProperty ?? ""}
          onChange={(e) => setSelectedProperty(Number(e.target.value) || null)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">{messages.smartMetersPage.chooseProperty}</option>
          {properties?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Existing devices */}
      {selectedProperty && devices && (
        <div className="mt-6">
          <h3 className="font-semibold">{messages.smartMetersPage.devices} ({devices.length})</h3>
          {devices.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{messages.smartMetersPage.noDevices}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{d.name ?? d.deviceId}</p>
                    <p className="text-xs text-muted-foreground">
                      {utilityLabel(d.utilityType)} · {d.source} · {d.deviceId}
                    </p>
                    {d.lastSeenAt && (
                      <p className="text-xs text-muted-foreground">
                        {messages.smartMetersPage.lastSeen}: {new Date(d.lastSeenAt).toLocaleString(intlLocale)}
                        {d.lastRawValue != null && ` — ${d.lastRawValue}`}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${d.isActive ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-600"}`}>
                    {d.isActive ? messages.common.active : messages.common.inactive}
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
          <h3 className="font-semibold">{messages.smartMetersPage.newDevice}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">Device ID *</label>
              <input type="text" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">{messages.smartMetersPage.deviceName}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-muted-foreground">{messages.smartMetersPage.utility}</label>
              <select value={utilityType} onChange={(e) => setUtilityType(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {(["villany", "viz", "gaz", "csatorna", "internet", "kozos_koltseg", "egyeb"] as const).map((utility) => (
                  <option key={utility} value={utility}>{utilityLabel(utility)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">{messages.smartMetersPage.source}</label>
              <select value={source} onChange={(e) => setSource(e.target.value as "mqtt")} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="mqtt">{messages.smartMetersPage.mqtt}</option>
                <option value="ttn">{messages.smartMetersPage.ttn}</option>
                <option value="home_assistant">{messages.smartMetersPage.homeAssistant}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">{messages.smartMetersPage.valueField}</label>
              <input type="text" value={valueField} onChange={(e) => setValueField(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-muted-foreground">{messages.smartMetersPage.multiplier}</label>
              <input type="number" step="any" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">{messages.smartMetersPage.offset}</label>
              <input type="number" step="any" value={offset} onChange={(e) => setOffset(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">{messages.smartMetersPage.minInterval}</label>
              <input type="number" value={minInterval} onChange={(e) => setMinInterval(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <button type="submit" disabled={!deviceId || createDevice.isPending} className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {createDevice.isPending ? messages.tenantShell.saving : messages.smartMetersPage.add}
          </button>
        </form>
      )}
    </div>
  );
}
