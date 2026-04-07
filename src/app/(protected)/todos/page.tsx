"use client";

import { useState } from "react";
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

export default function TodosPage() {
  const utils = api.useUtils();
  const { data: todos, isLoading } = api.todo.list.useQuery();

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
