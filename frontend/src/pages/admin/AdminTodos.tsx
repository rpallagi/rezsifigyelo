import { useEffect, useState } from "react";
import { ListTodo, Plus, Trash2, ArrowRightCircle, Calendar, Building2, Pencil } from "lucide-react";
import {
  getAdminTodos, addTodo, editTodo, toggleTodo, deleteTodo, getAdminProperties,
  type TodoItem, type AdminProperty,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

const priorityIcon: Record<string, string> = {
  low: "\uD83D\uDFE2",
  medium: "\uD83D\uDFE1",
  high: "\uD83D\uDD34",
};

const AdminTodos = () => {
  const { t } = useI18n();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTodo, setEditingTodo] = useState<number | null>(null);

  const priorityLabel: Record<string, string> = {
    low: t('todos.low'),
    medium: t('todos.medium'),
    high: t('todos.high'),
  };

  const statusSections = [
    { key: "pending", label: t('todos.pending'), color: "text-amber-500" },
    { key: "in_progress", label: t('todos.inProgress'), color: "text-blue-500" },
    { key: "done", label: t('todos.done'), color: "text-green-500" },
  ] as const;

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    property_id: "",
    due_date: "",
  });

  useEffect(() => {
    getAdminProperties().then((data) => setProperties(data.properties));
    loadTodos();
  }, []);

  const loadTodos = () => {
    setLoading(true);
    getAdminTodos()
      .then((data) => setTodos(data.todos))
      .finally(() => setLoading(false));
  };

  const openNew = () => {
    setForm({
      title: "",
      description: "",
      priority: "medium",
      property_id: "",
      due_date: "",
    });
    setEditingTodo(null);
    setDialogOpen(true);
  };

  const openEdit = (todo: TodoItem) => {
    setForm({
      title: todo.title,
      description: todo.description || "",
      priority: todo.priority,
      property_id: todo.property_id ? String(todo.property_id) : "",
      due_date: todo.due_date || "",
    });
    setEditingTodo(todo.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        property_id: form.property_id ? Number(form.property_id) : null,
        due_date: form.due_date || null,
      };
      if (editingTodo) {
        await editTodo(editingTodo, payload);
      } else {
        await addTodo(payload);
      }
      setDialogOpen(false);
      setEditingTodo(null);
      loadTodos();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleTodo(id);
      loadTodos();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTodo(id);
      loadTodos();
    } catch (e: any) {
      alert(e.message || t('common.error'));
    }
  };

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const todosByStatus = (status: string) => todos.filter((t) => t.status === status);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-in">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('todos.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{todos.filter((t) => t.status !== "done").length} {t('todos.openTasks')}</p>
        </div>
        <Button onClick={openNew} className="gradient-primary-bg border-0">
          <Plus className="h-4 w-4 mr-2" /> {t('todos.new')}
        </Button>
      </div>

      {/* Status sections */}
      <div className="space-y-8 animate-in-delay-1">
        {statusSections.map((section) => {
          const items = todosByStatus(section.key);
          return (
            <div key={section.key}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className={`font-display font-bold text-sm ${section.color}`}>
                  {section.label}
                </h2>
                <Badge variant="outline" className="text-xs">{items.length}</Badge>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-1">{t('todos.noTasks')}</p>
              ) : (
                <div className="space-y-2">
                  {items.map((todo) => (
                    <div
                      key={todo.id}
                      className={`glass-card-hover p-4 flex items-start gap-3 ${
                        todo.status === "done" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                        <span className="text-lg leading-none">
                          {priorityIcon[todo.priority] || priorityIcon.medium}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${todo.status === "done" ? "line-through" : ""}`}>
                          {todo.title}
                        </p>
                        {todo.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{todo.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {priorityLabel[todo.priority] || todo.priority}
                          </Badge>
                          {todo.property_name && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" /> {todo.property_name}
                            </span>
                          )}
                          {todo.due_date && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" /> {formatDate(todo.due_date)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(todo)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggle(todo.id)}
                        >
                          <ArrowRightCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(todo.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{editingTodo ? t('todos.editTitle') : t('todos.newTitle')}</DialogTitle>
            <DialogDescription>{t('todos.newDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('todos.taskTitle')} *</label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={t('todos.taskTitlePlaceholder')}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('todos.description')}</label>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder={t('common.details')}
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('todos.priority')}</label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{priorityIcon.low} {t('todos.low')}</SelectItem>
                  <SelectItem value="medium">{priorityIcon.medium} {t('todos.medium')}</SelectItem>
                  <SelectItem value="high">{priorityIcon.high} {t('todos.high')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('todos.property')}</label>
              <Select value={form.property_id} onValueChange={(v) => set("property_id", v)}>
                <SelectTrigger><SelectValue placeholder={t('todos.selectProperty')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('common.notSpecified')}</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1">{t('todos.dueDate')}</label>
              <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title}
              className="gradient-primary-bg border-0"
            >
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTodos;
