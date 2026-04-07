"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function MarketingPage() {
  const params = useParams();
  const propertyId = Number(params.id);

  const { data: property } = api.property.get.useQuery({ id: propertyId });

  // Marketing content from property detail - we'll use a simple form for now
  const [listingTitle, setListingTitle] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [saved, setSaved] = useState(false);

  // TODO: Add marketing content mutation when router is extended

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Marketing — {property?.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Hirdetési szöveg és fotók kezelése (ingatlan.com, stb.)
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">Hirdetés címe</label>
          <input
            type="text"
            value={listingTitle}
            onChange={(e) => setListingTitle(e.target.value)}
            placeholder="pl. Felújított 2 szobás lakás a belvárosban"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Hirdetés szövege</label>
          <textarea
            value={listingDescription}
            onChange={(e) => setListingDescription(e.target.value)}
            rows={8}
            placeholder="Részletes leírás..."
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Hirdetés URL</label>
          <input
            type="url"
            value={listingUrl}
            onChange={(e) => setListingUrl(e.target.value)}
            placeholder="https://ingatlan.com/..."
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          onClick={() => setSaved(true)}
          className="rounded-md bg-primary px-6 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Mentés
        </button>

        {saved && (
          <p className="text-sm text-green-600">Mentve!</p>
        )}
      </div>
    </div>
  );
}
