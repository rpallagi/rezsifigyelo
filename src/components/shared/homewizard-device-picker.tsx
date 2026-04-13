"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { Loader2, CheckCircle } from "lucide-react";

interface HomeWizardDevicePickerProps {
  onSelectDevice: (device: {
    deviceId: string;
    name: string;
    type: string;
    locationName: string;
  }) => void;
}

export function HomeWizardDevicePicker({
  onSelectDevice,
}: HomeWizardDevicePickerProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: savedSettings } = api.homewizard.getSettings.useQuery();

  const connect = api.homewizard.connect.useMutation({
    onError: (err) => setError(err.message),
  });

  // Also try listing from saved credentials
  const { data: savedLocations } = api.homewizard.listDevices.useQuery(
    undefined,
    { enabled: !!savedSettings?.hasCredentials },
  );

  const locations = connect.data ?? savedLocations;

  const handleConnect = () => {
    setError("");
    connect.mutate({ email, password });
  };

  const handleSelect = (
    deviceId: string,
    name: string,
    type: string,
    locationName: string,
  ) => {
    setSelected(deviceId);
    onSelectDevice({ deviceId, name, type, locationName });
  };

  // If we already have saved credentials and devices, show them directly
  if (locations && locations.length > 0) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">
          Válaszd ki az eszközt:
        </p>
        {locations.map((loc) =>
          loc.devices
            .filter((d) => d.type === "p1dongle" || d.type === "energymeter" || d.type === "watermeter")
            .map((dev) => (
              <button
                key={dev.device_id}
                type="button"
                onClick={() =>
                  handleSelect(dev.device_id, dev.name || dev.type, dev.type, loc.name)
                }
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  selected === dev.device_id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                    : "border-border hover:bg-secondary/50"
                }`}
              >
                <div>
                  <p className="font-medium">{dev.name || dev.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {loc.name} — {dev.device_id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                    {dev.type}
                  </span>
                  {selected === dev.device_id && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                </div>
              </button>
            )),
        )}
        {!savedSettings?.hasCredentials && (
          <button
            type="button"
            onClick={() => connect.reset()}
            className="text-xs text-muted-foreground hover:underline"
          >
            Másik fiók
          </button>
        )}
      </div>
    );
  }

  // Connection form
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-sm font-medium">HomeWizard Energy fiok</p>
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Jelszo"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <button
        type="button"
        onClick={handleConnect}
        disabled={connect.isPending || !email || !password}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {connect.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          "Csatlakozás"
        )}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
