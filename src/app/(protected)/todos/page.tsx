"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/trpc/react";

const priorityColors = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const priorityLabels = { low: "Alacsony", medium: "Közepes", high: "Magas" };
const statusLabels = {
  pending: "Függőben",
  in_progress: "Folyamatban",
  done: "Kész",
};

const checklistLabels: Record<string, string> = {
  meter_readings: "Kezdő mérőállások rögzítése",
  contract_upload: "Szerződés feltöltése",
  handover_protocol: "Átadás-átvételi jegyzőkönyv",
  key_handover: "Kulcsátadás",
  final_readings: "Záró mérőállások rögzítése",
  condition_assessment: "Állapotfelvétel",
  deposit_settlement: "Kaució elszámolás",
  key_return: "Kulcsvisszavétel",
};

function checklistHref(step: string, propertyId: number) {
  switch (step) {
    case "meter_readings":
    case "final_readings":
      return `/properties/${propertyId}/readings/new`;
    case "contract_upload":
    case "handover_protocol":
    case "condition_assessment":
      return `/properties/${propertyId}/documents/new`;
    case "deposit_settlement":
      return `/properties/${propertyId}/move-out`;
    default:
      return `/properties/${propertyId}`;
  }
}

export default function TodosPage() {
  const utils = api.useUtils();
  const { data: todos, isLoading } = api.todo.list.useQuery();
  const { data: properties } = api.property.list.useQuery();

  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const createTodo = api.todo.create.useMutation({
    onSuccess: () => {
      setTitle("");
      void utils.todo.list.invalidate();
    },
  });

  const updateTodo = api.todo.update.useMutation({
    onSuccess: () => void utils.todo.list.invalidate(),
  });

  const deleteTodo = api.todo.delete.useMutation({
    onSuccess: () => void utils.todo.list.invalidate(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createTodo.mutate({ title, priority });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Feladatok</h1>

      {/* Checklist teendők ingatlanokból */}
      {properties && properties.some((p) => p.handoverChecklists.length > 0) && (
        <div className="mt-6 rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Ingatlan teendők
          </h2>
          <div className="mt-3 space-y-2">
            {properties
              .filter((p) => p.handoverChecklists.length > 0)
              .flatMap((p) =>
                p.handoverChecklists.map((c) => (
                  <Link
                    key={c.id}
                    href={checklistHref(c.step, p.id)}
                    className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-background p-3 transition hover:bg-secondary/50 dark:border-amber-800/40"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {checklistLabels[c.step] ?? c.step}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.name} · {c.checklistType === "move_in" ? "Beköltözés" : "Kiköltözés"}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                      Függő
                    </span>
                  </Link>
                )),
              )}
          </div>
        </div>
      )}

      {/* Quick add */}
      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Új feladat..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={priority}
          onChange={(e) =>
            setPriority(e.target.value as "low" | "medium" | "high")
          }
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="low">Alacsony</option>
          <option value="medium">Közepes</option>
          <option value="high">Magas</option>
        </select>
        <button
          type="submit"
          disabled={!title.trim() || createTodo.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Hozzáadás
        </button>
      </form>

      {/* List */}
      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Betöltés...</p>
      ) : !todos || todos.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Nincs feladat.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-center gap-3 rounded-lg border border-border p-3 ${
                todo.status === "done" ? "opacity-50" : ""
              }`}
            >
              <button
                onClick={() =>
                  updateTodo.mutate({
                    id: todo.id,
                    status: todo.status === "done" ? "pending" : "done",
                  })
                }
                className={`h-5 w-5 shrink-0 rounded border ${
                  todo.status === "done"
                    ? "border-primary bg-primary"
                    : "border-border"
                }`}
              >
                {todo.status === "done" && (
                  <span className="text-xs text-primary-foreground">✓</span>
                )}
              </button>

              <div className="flex-1">
                <p
                  className={`text-sm ${
                    todo.status === "done" ? "line-through" : ""
                  }`}
                >
                  {todo.title}
                </p>
                {todo.property && (
                  <p className="text-xs text-muted-foreground">
                    {todo.property.name}
                  </p>
                )}
              </div>

              <span
                className={`rounded-full px-2 py-0.5 text-xs ${priorityColors[todo.priority]}`}
              >
                {priorityLabels[todo.priority]}
              </span>

              <span className="text-xs text-muted-foreground">
                {statusLabels[todo.status]}
              </span>

              <button
                onClick={() => deleteTodo.mutate({ id: todo.id })}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
