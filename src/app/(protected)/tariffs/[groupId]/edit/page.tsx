"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { api } from "@/trpc/react";

export default function EditTariffGroupPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = Number(params.groupId);

  const { data: group, isLoading } = api.tariff.getGroup.useQuery({ id: groupId });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? "");
    }
  }, [group]);

  const updateGroup = api.tariff.updateGroup.useMutation({
    onSuccess: () => {
      router.push("/tariffs");
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateGroup.mutate({
      id: groupId,
      name,
      description: description || undefined,
    });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Betöltés...</div>;
  }

  if (!group) {
    return <div className="text-sm text-muted-foreground">A tarifa csoport nem található.</div>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Tarifa csoport szerkesztése</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Itt tudod módosítani a csoport nevét és leírását.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium">
            Név <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Leírás</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={!name || updateGroup.isPending}
            className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {updateGroup.isPending ? "Mentés..." : "Mentés"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/tariffs")}
            className="rounded-md border border-border px-6 py-2 text-sm hover:bg-secondary"
          >
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}
