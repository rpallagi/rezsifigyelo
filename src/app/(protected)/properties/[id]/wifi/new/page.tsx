"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { MultiPhotoUpload, type UploadedPhoto } from "@/components/shared/multi-photo-upload";

export default function NewWifiPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = Number(params.id);

  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");
  const [routerIp, setRouterIp] = useState("");
  const [routerUser, setRouterUser] = useState("");
  const [routerPassword, setRouterPassword] = useState("");
  const [tailscaleIp, setTailscaleIp] = useState("");
  const [tailscaleDns, setTailscaleDns] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

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
      routerIp: routerIp || undefined,
      routerUser: routerUser || undefined,
      routerPassword: routerPassword || undefined,
      tailscaleIp: tailscaleIp || undefined,
      tailscaleDns: tailscaleDns || undefined,
      photoUrls: photos.length > 0 ? photos.map((p) => p.url) : undefined,
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

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">ISP Router belépés</legend>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs text-muted-foreground">Router IP</label>
              <input
                type="text"
                value={routerIp}
                onChange={(e) => setRouterIp(e.target.value)}
                placeholder="192.168.1.1"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Felhasználónév</label>
              <input
                type="text"
                value={routerUser}
                onChange={(e) => setRouterUser(e.target.value)}
                placeholder="admin"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Jelszó</label>
              <input
                type="text"
                value={routerPassword}
                onChange={(e) => setRouterPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-2 text-sm font-medium">Tailscale / távoli elérés</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-muted-foreground">Tailscale IP</label>
              <input
                type="text"
                value={tailscaleIp}
                onChange={(e) => setTailscaleIp(e.target.value)}
                placeholder="100.x.x.x"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">MagicDNS név</label>
              <input
                type="text"
                value={tailscaleDns}
                onChange={(e) => setTailscaleDns(e.target.value)}
                placeholder="router-lakas.tailnet-xyz.ts.net"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </fieldset>

        <MultiPhotoUpload
          photos={photos}
          onChange={setPhotos}
          folder="wifi"
          label="Router fotók (opcionális)"
        />

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
