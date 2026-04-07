"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function NewWifiPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");

  const createWifi = api.wifi.create.useMutation({
    onSuccess: () => {
      router.push(`/properties/${propertyId}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWifi.mutate({
      propertyId,
      ssid,
      password: password || undefined,
      location: location || undefined,
    });
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">WiFi hozzáadás</h1>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">
            SSID (hálózatnév) <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Jelszó</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Helyszín</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="pl. Nappali router, Emelet repeater"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!ssid || createWifi.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createWifi.isPending ? "Mentés..." : "Hozzáadás"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/properties/${propertyId}`)}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}
