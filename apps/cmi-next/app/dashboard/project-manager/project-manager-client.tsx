"use client";

import * as React from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Columns3,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderKanban,
  GripHorizontal,
  Link2,
  List,
  Loader2,
  Milestone,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Table2,
  Trash2,
  UserPlus,
  Video,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { addDays, cn, dateOnly, daysBetween, initials } from "@/lib/utils";
import type { DependencyType, ProjectManagerData, ProjectScheduleDependency, ProjectScheduleItem, SchedulePriority, ScheduleStatus } from "@/lib/project-manager/types";

type ItemDraft = {
  id?: string;
  title: string;
  project_title: string;
  phase: string;
  assignee: string;
  participants: string;
  start_date: string;
  end_date: string;
  status: ScheduleStatus;
  priority: SchedulePriority;
  progress: number;
  duration_minutes: number;
  notify: boolean;
  client_visible: boolean;
  visible_on_gantt: boolean;
  client: string;
  dependencies: string;
  description: string;
  forms: string;
  punch: string;
  internal_notes: string;
  is_blocked: boolean;
  blocker_reason: string;
};

type AssetModalState = {
  item: ProjectScheduleItem;
  type: "photo" | "video" | "selection" | "code";
};

type ProjectFilters = {
  project: string;
  type: string;
  status: string;
  priority: string;
  phase: string;
  assignee: string;
  quick: "today" | "day" | "week" | "month" | "dependencies" | "client_visible" | null;
};

const emptyFilters: ProjectFilters = {
  project: "",
  type: "",
  status: "",
  priority: "",
  phase: "",
  assignee: "",
  quick: null
};

const boardId = "default";
const dayWidth = 46;
const staffParticipantOptions = [
  "Angel Gutierrez - Staff",
  "Ben Peck - Staff",
  "Brandon Fadden - Super Admin",
  "Jeremy Waters - Super Admin",
  "Joe Ballard - Super Admin",
  "Yovana Hernandez - Staff"
];

const statusTone: Record<string, "default" | "accent" | "success" | "warning" | "danger" | "info"> = {
  scheduled: "info",
  in_progress: "accent",
  waiting: "warning",
  delayed: "warning",
  blocked: "danger",
  needs_approval: "warning",
  complete: "success",
  canceled: "default",
  pending: "default"
};

function emptyDraft(): ItemDraft {
  const today = dateOnly(new Date());
  return {
    title: "",
    project_title: "Project Manager",
    phase: "Project Tasks",
    assignee: "",
    participants: "",
    start_date: today,
    end_date: addDays(today, 2),
    status: "scheduled",
    priority: "normal",
    progress: 0,
    duration_minutes: 4320,
    notify: true,
    client_visible: false,
    visible_on_gantt: true,
    client: "",
    dependencies: "",
    description: "",
    forms: "",
    punch: "",
    internal_notes: "",
    is_blocked: false,
    blocker_reason: ""
  };
}

export function ProjectManagerClient({ initialData, demoMode = false }: { initialData: ProjectManagerData; demoMode?: boolean }) {
  const [items, setItems] = React.useState(initialData.items);
  const [dependencies, setDependencies] = React.useState(initialData.dependencies);
  const [templates] = React.useState(initialData.templates);
  const [templateTasks] = React.useState(initialData.templateTasks);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<ItemDraft | null>(null);
  const [assetModal, setAssetModal] = React.useState<AssetModalState | null>(null);
  const [templateId, setTemplateId] = React.useState(templates[0]?.id || "");
  const [templateTitle, setTemplateTitle] = React.useState("Client Project Board 001");
  const [templateStart, setTemplateStart] = React.useState(dateOnly(new Date()));
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [activeView, setActiveView] = React.useState<"list" | "kanban" | "table" | "calendar" | "gantt">("gantt");
  const [filters, setFilters] = React.useState<ProjectFilters>(emptyFilters);

  const filterOptions = React.useMemo(() => {
    const projects = new Set<string>();
    const types = new Set<string>();
    const statuses = new Set<string>();
    const priorities = new Set<string>();
    const phases = new Set<string>();
    const assignees = new Set<string>();
    items.forEach(item => {
      projects.add(item.schedule_group_key || item.project_title || "Ungrouped Project");
      types.add(item.type);
      statuses.add(item.status);
      if (item.priority) priorities.add(item.priority);
      if (item.phase) phases.add(item.phase);
      if (item.assignee) assignees.add(item.assignee);
    });
    const sort = (values: Set<string>) => Array.from(values).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return {
      projects: sort(projects),
      types: sort(types),
      statuses: sort(statuses),
      priorities: sort(priorities),
      phases: sort(phases),
      assignees: sort(assignees)
    };
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const today = dateOnly(new Date());
    const weekEnd = addDays(today, 7);
    const monthEnd = addDays(today, 30);
    const linkedIds = new Set<string>();
    dependencies.forEach(dep => {
      linkedIds.add(dep.source_item_id);
      linkedIds.add(dep.target_item_id);
    });

    return items.filter(item => {
      const projectKey = item.schedule_group_key || item.project_title || "Ungrouped Project";
      if (filters.project && projectKey !== filters.project) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.priority && item.priority !== filters.priority) return false;
      if (filters.phase && item.phase !== filters.phase) return false;
      if (filters.assignee && item.assignee !== filters.assignee) return false;
      if (filters.quick === "dependencies" && !linkedIds.has(item.id)) return false;
      if (filters.quick === "client_visible" && !item.client_visible) return false;
      if ((filters.quick === "today" || filters.quick === "day") && !(item.start_date <= today && item.end_date >= today)) return false;
      if (filters.quick === "week" && !(item.start_date <= weekEnd && item.end_date >= today)) return false;
      if (filters.quick === "month" && !(item.start_date <= monthEnd && item.end_date >= today)) return false;
      return true;
    });
  }, [dependencies, filters, items]);

  const visibleItems = React.useMemo(() => filteredItems.filter(item => item.visible_on_gantt !== false), [filteredItems]);
  const selectedTemplate = React.useMemo(() => templates.find(template => template.id === templateId) || templates[0], [templateId, templates]);
  const selectedTemplateTasks = React.useMemo(() => templateTasks.filter(task => task.template_id === templateId), [templateId, templateTasks]);
  const groups = React.useMemo(() => {
    const map = new Map<string, ProjectScheduleItem[]>();
    filteredItems.forEach(item => {
      const key = item.schedule_group_key || item.project_title || "Ungrouped Project";
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(item);
    });
    return Array.from(map.entries()).map(([name, rows]) => ({ name, rows }));
  }, [filteredItems]);

  const participantOptions = React.useMemo(() => {
    const values = new Set(staffParticipantOptions);
    items.forEach(item => {
      if (item.assignee) values.add(item.assignee.includes(" - ") ? item.assignee : `${item.assignee} - Staff`);
      String(item.participants || "")
        .split(",")
        .map(part => part.trim())
        .filter(Boolean)
        .forEach(part => values.add(part.includes(" - ") ? part : `${part} - Staff`));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const timeline = React.useMemo(() => {
    const rows = visibleItems.length ? visibleItems : filteredItems;
    const starts = rows.map(item => new Date(`${item.start_date}T00:00:00`).getTime()).filter(Boolean);
    const ends = rows.map(item => new Date(`${item.end_date}T00:00:00`).getTime()).filter(Boolean);
    const start = starts.length ? dateOnly(new Date(Math.min(...starts))) : dateOnly(new Date());
    const end = ends.length ? dateOnly(new Date(Math.max(...ends))) : addDays(start, 30);
    const days = Math.max(14, daysBetween(start, end) + 3);
    return { start, days };
  }, [filteredItems, visibleItems]);

  const metrics = React.useMemo(() => {
    const complete = filteredItems.filter(item => item.status === "complete").length;
    const inProgress = filteredItems.filter(item => item.status === "in_progress").length;
    const delayed = filteredItems.filter(item => item.status === "delayed").length;
    const blocked = filteredItems.filter(item => item.status === "blocked" || item.is_blocked).length;
    const overdue = filteredItems.filter(item => item.status !== "complete" && item.end_date < dateOnly(new Date())).length;
    const progress = filteredItems.length ? Math.round(filteredItems.reduce((sum, item) => sum + (Number(item.progress) || 0), 0) / filteredItems.length) : 0;
    return { complete, inProgress, delayed, blocked, overdue, progress, active: filteredItems.length - complete, clientVisible: filteredItems.filter(item => item.client_visible).length };
  }, [filteredItems]);

  async function refresh() {
    if (demoMode) {
      setNotice("Demo mode uses local sample data. Add Supabase credentials for live refresh.");
      return;
    }
    const [itemRes, depRes] = await Promise.all([
      fetch(`/api/project-manager/schedule?board_id=${boardId}`),
      fetch(`/api/project-manager/dependencies?board_id=${boardId}`)
    ]);
    const itemJson = await itemRes.json();
    const depJson = await depRes.json();
    if (!itemRes.ok) throw new Error(itemJson.message || "Could not refresh schedule.");
    if (!depRes.ok) throw new Error(depJson.message || "Could not refresh dependencies.");
    setItems(itemJson.items || []);
    setDependencies(depJson.dependencies || []);
  }

  async function applyTemplate() {
    if (demoMode) {
      const template = selectedTemplate;
      const tasks = selectedTemplateTasks;
      if (!template || !tasks.length) {
        setNotice("This template does not have schedule tasks yet.");
        return;
      }
      setSaving(true);
      setNotice(null);
      try {
        const projectTitle = templateTitle.trim() || template.name;
        const projectId = crypto.randomUUID();
        const itemIdByTaskKey = new Map<string, string>();
        const createdItems = tasks.map((templateTask, index) => {
          const itemId = crypto.randomUUID();
          itemIdByTaskKey.set(templateTask.task_key, itemId);
          const durationDays = Math.max(1, Math.ceil((templateTask.duration_minutes || 1440) / 1440));
          const itemStart = addDays(templateStart, templateTask.offset_days || 0);
          const itemEnd = addDays(itemStart, durationDays - 1);
          const roles = templateTask.suggested_roles || [];

          return {
            id: itemId,
            board_id: boardId,
            project_id: projectId,
            client_project_id: null,
            type: index === 0 ? "project" : templateTask.priority === "high" && templateTask.client_visible ? "milestone" : "task",
            project_title: projectTitle,
            title: templateTask.task_name,
            phase: templateTask.phase_name,
            assignee: roles[0] || "Project Manager",
            client: "Client",
            participants: roles.join(", ") || null,
            dependencies: templateTask.dependency_keys.join(", ") || null,
            start_date: itemStart,
            end_date: itemEnd,
            status: "scheduled",
            priority: templateTask.priority,
            progress: 0,
            notify: templateTask.client_visible,
            description: templateTask.description,
            forms: null,
            punch: null,
            client_visible: templateTask.client_visible,
            internal_notes: null,
            is_blocked: false,
            blocker_reason: null,
            sort_order: templateTask.sort_order,
            visible_on_gantt: true,
            schedule_group_key: projectTitle,
            template_slug: template.slug,
            template_name: template.name,
            duration_minutes: templateTask.duration_minutes,
            metadata: { template_task_key: templateTask.task_key, template_id: template.id }
          } satisfies ProjectScheduleItem;
        });

        const createdDependencies = tasks.flatMap(templateTask => {
          const targetId = itemIdByTaskKey.get(templateTask.task_key);
          if (!targetId) return [];
          return templateTask.dependency_keys.flatMap(sourceKey => {
            const sourceId = itemIdByTaskKey.get(sourceKey);
            if (!sourceId) return [];
            return [{
              id: crypto.randomUUID(),
              board_id: boardId,
              project_id: projectId,
              client_project_id: null,
              source_item_id: sourceId,
              target_item_id: targetId,
              dependency_type: "finish_to_start",
              lag_days: 0,
              auto_shift: true,
              notes: `${sourceKey} before ${templateTask.task_key}`
            } satisfies ProjectScheduleDependency];
          });
        });

        setItems(current => [...current, ...createdItems]);
        setDependencies(current => [...current, ...createdDependencies]);
        setCollapsed(current => {
          const next = new Set(current);
          next.delete(projectTitle);
          return next;
        });
        setActiveView("gantt");
        setNotice(`Created ${createdItems.length} scheduled items and ${createdDependencies.length} dependencies from ${template.name}.`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Template apply failed.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/project-manager/apply-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: boardId,
          template_id: templateId,
          project_title: templateTitle,
          start_date: templateStart
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Template apply failed.");
      await refresh();
      setNotice(`Created ${json.items?.length || 0} scheduled items from template.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Template apply failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveItem(draft: ItemDraft) {
    if (demoMode) {
      const item = draftToDemoItem(draft);
      setItems(current => draft.id ? current.map(row => row.id === draft.id ? item : row) : [...current, item]);
      setSelected(null);
      setNotice("Demo schedule item saved locally.");
      return;
    }
    setSaving(true);
    try {
      const method = draft.id ? "PATCH" : "POST";
      const url = draft.id ? `/api/project-manager/schedule/${draft.id}` : "/api/project-manager/schedule";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, board_id: boardId, schedule_group_key: draft.project_title })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Save failed.");
      await refresh();
      setSelected(null);
      setNotice("Schedule item saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function patchItem(item: ProjectScheduleItem, patch: Partial<ProjectScheduleItem>) {
    const next = { ...item, ...patch };
    setItems(current => current.map(row => (row.id === item.id ? next : row)));
    if (demoMode) return true;
    const res = await fetch(`/api/project-manager/schedule/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (!res.ok) {
      await refresh();
      const json = await res.json();
      setNotice(json.message || "Update failed.");
      return false;
    }
    return true;
  }

  async function deleteItem(item: ProjectScheduleItem) {
    setItems(current => current.filter(row => row.id !== item.id));
    if (demoMode) return;
    const res = await fetch(`/api/project-manager/schedule/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      await refresh();
      const json = await res.json();
      setNotice(json.message || "Delete failed.");
    }
  }

  async function createDependency(input: {
    source_item_id: string;
    target_item_id: string;
    dependency_type: DependencyType;
    lag_days: number;
    auto_shift: boolean;
    notes?: string;
  }) {
    if (input.source_item_id === input.target_item_id) {
      setNotice("A task cannot depend on itself.");
      return false;
    }
    const exists = dependencies.some(dep => dep.source_item_id === input.source_item_id && dep.target_item_id === input.target_item_id && dep.dependency_type === input.dependency_type);
    if (exists) {
      setNotice("That dependency already exists.");
      return false;
    }
    if (demoMode) {
      setDependencies(current => [...current, { id: crypto.randomUUID(), board_id: boardId, project_id: null, client_project_id: null, ...input, notes: input.notes || null }]);
      return true;
    }
    const res = await fetch("/api/project-manager/dependencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board_id: boardId, ...input })
    });
    const json = await res.json();
    if (!res.ok) {
      setNotice(json.message || "Dependency create failed.");
      return false;
    }
    setDependencies(current => [...current, json.dependency]);
    return true;
  }

  async function deleteDependency(dependency: ProjectScheduleDependency) {
    setDependencies(current => current.filter(row => row.id !== dependency.id));
    if (demoMode) return true;
    const res = await fetch(`/api/project-manager/dependencies/${dependency.id}`, { method: "DELETE" });
    if (!res.ok) {
      await refresh();
      const json = await res.json();
      setNotice(json.message || "Dependency delete failed.");
      return false;
    }
    return true;
  }

  async function addConnectedTask(parent: ProjectScheduleItem) {
    const duration = Math.max(parent.duration_minutes || 1440, 1440);
    const start = addDays(parent.end_date, 1);
    const end = addDays(start, Math.max(1, Math.ceil(duration / 1440)) - 1);
    const childDraft: ItemDraft = {
      ...emptyDraft(),
      title: `New task after ${parent.title}`,
      project_title: parent.project_title || parent.schedule_group_key || "Project Manager",
      phase: parent.phase || "Project Tasks",
      assignee: parent.assignee || "",
      participants: parent.participants || "",
      client: parent.client || "",
      start_date: start,
      end_date: end,
      duration_minutes: duration,
      client_visible: Boolean(parent.client_visible),
      visible_on_gantt: true,
      dependencies: `Connected to ${parent.title}`
    };

    if (demoMode) {
      const child = draftToDemoItem(childDraft);
      setItems(current => [...current, child]);
      await createDependency({
        source_item_id: parent.id,
        target_item_id: child.id,
        dependency_type: "finish_to_start",
        lag_days: 0,
        auto_shift: true,
        notes: "Added from Gantt action dock"
      });
      setNotice(`Added connected task under ${parent.title}.`);
      return;
    }

    const res = await fetch("/api/project-manager/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...childDraft, board_id: boardId, schedule_group_key: childDraft.project_title })
    });
    const json = await res.json();
    if (!res.ok) {
      setNotice(json.message || "Connected task create failed.");
      return;
    }
    setItems(current => [...current, json.item]);
    await createDependency({
      source_item_id: parent.id,
      target_item_id: json.item.id,
      dependency_type: "finish_to_start",
      lag_days: 0,
      auto_shift: true,
      notes: "Added from Gantt action dock"
    });
    setNotice(`Added connected task under ${parent.title}.`);
  }

  async function saveAsset(type: AssetModalState["type"], item: ProjectScheduleItem, payload: Record<string, unknown>) {
    setSaving(true);
    setNotice(null);
    const body = {
      ...payload,
      resource: type === "selection" ? "selection" : type === "code" ? "code_reference" : "media",
      media_type: type === "photo" || type === "video" ? type : undefined,
      project_id: item.project_id,
      project_schedule_item_id: item.id,
      metadata: {
        project_title: item.project_title || item.schedule_group_key,
        schedule_item_title: item.title,
        phase: item.phase,
        ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {})
      }
    };

    if (demoMode) {
      bumpAssociationCount(item.id, type);
      setAssetModal(null);
      setSaving(false);
      setNotice(`${assetLabel(type)} saved locally in demo mode. Add Supabase credentials for live writes.`);
      return;
    }

    try {
      const res = await fetch("/api/project-manager/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `${assetLabel(type)} save failed.`);
      bumpAssociationCount(item.id, type);
      setAssetModal(null);
      setNotice(`${assetLabel(type)} added to ${item.title}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${assetLabel(type)} save failed.`);
    } finally {
      setSaving(false);
    }
  }

  function bumpAssociationCount(itemId: string, type: AssetModalState["type"]) {
    const key = type === "selection" ? "selections" : type === "code" ? "codes" : "media";
    const mediaKey = type === "photo" ? "photos" : type === "video" ? "videos" : null;
    setItems(current => current.map(row => {
      if (row.id !== itemId) return row;
      const currentCounts = row.association_counts || { selections: 0, media: 0, photos: 0, videos: 0, codes: 0, billing: 0, participants: String(row.participants || "").split(",").filter(Boolean).length };
      return {
        ...row,
        association_counts: {
          ...currentCounts,
          [key]: currentCounts[key] + 1,
          ...(mediaKey ? { [mediaKey]: currentCounts[mediaKey] + 1 } : {})
        }
      };
    }));
  }

  function exportProjectCsv(item: ProjectScheduleItem) {
    const groupKey = item.schedule_group_key || item.project_title || item.title;
    const rows = items.filter(row => (row.schedule_group_key || row.project_title || row.title) === groupKey);
    const csvRows = [
      ["Constructed Matter, Inc.", "Project Export"],
      ["Project", groupKey],
      [],
      ["Title", "Type", "Phase", "Assignee", "Status", "Priority", "Start", "End", "Progress", "Client Visible"],
      ...rows.map(row => [row.title, row.type, row.phase || "", row.assignee || "", row.status, row.priority || "", row.start_date, row.end_date, String(row.progress || 0), row.client_visible ? "Yes" : "No"])
    ];
    const csv = csvRows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${groupKey.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-schedule.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printProjectPdf(item: ProjectScheduleItem) {
    const groupKey = item.schedule_group_key || item.project_title || item.title;
    const rows = items.filter(row => (row.schedule_group_key || row.project_title || row.title) === groupKey);
    const html = `
      <html>
        <head>
          <title>${groupKey} Schedule</title>
          <style>
            body { font-family: Arial, sans-serif; color: #171513; margin: 40px; }
            header { border-bottom: 1px solid #d8d1c8; padding-bottom: 18px; margin-bottom: 24px; }
            .brand { letter-spacing: 0.28em; font-weight: 700; font-size: 12px; text-transform: uppercase; }
            h1 { font-size: 26px; margin: 14px 0 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th { text-align: left; color: #a87328; text-transform: uppercase; font-size: 10px; letter-spacing: .12em; }
            th, td { border-bottom: 1px solid #e8e1d8; padding: 10px 8px; }
          </style>
        </head>
        <body>
          <header>
            <div class="brand">Constructed Matter, Inc.</div>
            <h1>${groupKey}</h1>
            <div>Project schedule export</div>
          </header>
          <table>
            <thead><tr><th>Item</th><th>Phase</th><th>Status</th><th>Start</th><th>End</th><th>Assignee</th></tr></thead>
            <tbody>
              ${rows.map(row => `<tr><td>${row.title}</td><td>${row.phase || ""}</td><td>${row.status}</td><td>${row.start_date}</td><td>${row.end_date}</td><td>${row.assignee || ""}</td></tr>`).join("")}
            </tbody>
          </table>
        </body>
      </html>`;
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const viewTabs = [
    { id: "list", label: "List", icon: List },
    { id: "kanban", label: "Kanban", icon: Columns3 },
    { id: "table", label: "Table", icon: Table2 },
    { id: "calendar", label: "Calendar", icon: CalendarRange },
    { id: "gantt", label: "Gantt", icon: BarChart3 }
  ] as const;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Fluent Boards</div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Projects</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {filterOptions.projects.slice(0, 6).map(project => (
            <button
              key={project}
              type="button"
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition hover:border-accent hover:text-accent",
                filters.project === project ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground"
              )}
              onClick={() => setFilters(current => ({ ...current, project: current.project === project ? "" : project }))}
            >
              {project} <span className="text-[10px]">({items.filter(item => (item.schedule_group_key || item.project_title || "Ungrouped Project") === project).length})</span>
            </button>
          ))}
          <Button variant="accent" onClick={() => setSelected(emptyDraft())}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </header>

      <div className="inline-flex rounded-md border border-border bg-muted p-1">
        <button className="inline-flex h-8 items-center gap-2 rounded px-3 text-xs font-medium text-muted-foreground" type="button">
          <FolderKanban className="h-3.5 w-3.5" />
          My Tasks
        </button>
        {viewTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={cn("inline-flex h-8 items-center gap-2 rounded px-3 text-xs font-medium transition", activeView === tab.id ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setActiveView(tab.id)}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</div>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[1.2fr_repeat(5,minmax(120px,1fr))]">
        <Card className="xl:col-span-1">
          <CardHeader>
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Project Management Overview</div>
            <CardTitle>{groups[0]?.name || "No active project"}</CardTitle>
            <CardDescription>Track phases, tasks, milestones, blocked work, client-visible schedule items, and upcoming deadlines.</CardDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(emptyDraft())}>Add Project</Button>
              <Button size="sm" variant="outline" onClick={() => setSelected(emptyDraft())}>Add Task</Button>
              <Button size="sm" variant="outline">Review Blockers</Button>
            </div>
          </CardHeader>
        </Card>
        <MetricCard label="Schedule Health" value={metrics.blocked || metrics.delayed ? "At Risk" : "Healthy"} sub={`${metrics.overdue} overdue, ${metrics.blocked} blocked`} tone={metrics.blocked ? "danger" : "success"} />
        <MetricCard label="Active Items" value={String(metrics.active)} sub={`${groups.length} project groups`} />
        <MetricCard label="Progress" value={`${metrics.progress}%`} sub={`${metrics.complete} complete, ${metrics.inProgress} active`} />
        <MetricCard label="Milestones" value={String(filteredItems.filter(item => item.type === "milestone").length)} sub={`${dependencies.length} dependency links`} />
        <MetricCard label="Client Visible" value={String(metrics.clientVisible)} sub="Shared timeline items" />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Build your schedule</CardTitle>
            <CardDescription>Apply a construction template, then refine tasks, dependencies, participants, and dates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_160px_auto]">
              <Select value={templateId} onChange={event => setTemplateId(event.target.value)}>
                {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
              </Select>
              <Input value={templateTitle} onChange={event => setTemplateTitle(event.target.value)} placeholder="Project name" />
              <Input type="date" value={templateStart} onChange={event => setTemplateStart(event.target.value)} />
              <Button variant="accent" disabled={saving || !templateId || !templateTitle} onClick={applyTemplate}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Real-time progress tracking</CardTitle>
            <CardDescription>Track in-progress, completed, delayed, blocked, and pending confirmation tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${metrics.progress}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{metrics.progress}% average progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Project health: {metrics.blocked || metrics.delayed ? "Needs Review" : "Healthy"}</CardTitle>
            <CardDescription>{metrics.overdue} overdue, {metrics.blocked} blocked, and {metrics.clientVisible} client-visible items.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline">Publish schedule</Button>
            <Button size="sm" variant="outline">
              <Link2 className="h-3.5 w-3.5" />
              Show risk chain
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <CardTitle>{groups[0]?.name || "Gantt Timeline"}</CardTitle>
              <CardDescription>Project schedule, tasks, dependencies, participants, and timeline controls.</CardDescription>
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              <Select value={filters.type} onChange={event => setFilters(current => ({ ...current, type: event.target.value }))}>
                <option value="">All types</option>
                {filterOptions.types.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
              </Select>
              <Select value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))}>
                <option value="">All status</option>
                {filterOptions.statuses.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </Select>
              <Select value={filters.priority} onChange={event => setFilters(current => ({ ...current, priority: event.target.value }))}>
                <option value="">All priority</option>
                {filterOptions.priorities.map(priority => <option key={priority} value={priority}>{priority.replaceAll("_", " ")}</option>)}
              </Select>
              <Select value={filters.phase} onChange={event => setFilters(current => ({ ...current, phase: event.target.value }))}>
                <option value="">All phases</option>
                {filterOptions.phases.map(phase => <option key={phase} value={phase}>{phase}</option>)}
              </Select>
              <Select value={filters.assignee} onChange={event => setFilters(current => ({ ...current, assignee: event.target.value }))}>
                <option value="">All assignees</option>
                {filterOptions.assignees.map(assignee => <option key={assignee} value={assignee}>{assignee}</option>)}
              </Select>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setFilters(emptyFilters)}>Clear filters</Button>
            <Button size="sm" variant={filters.quick === "today" ? "accent" : "outline"} onClick={() => setFilters(current => ({ ...current, quick: current.quick === "today" ? null : "today" }))}>Today</Button>
            <Button size="sm" variant="outline" onClick={() => setFilters(current => ({ ...current, quick: null }))}>Fit project</Button>
            <Button size="sm" variant={filters.quick === "month" ? "accent" : "outline"} onClick={() => setFilters(current => ({ ...current, quick: current.quick === "month" ? null : "month" }))}>Month</Button>
            <Button size="sm" variant={filters.quick === "week" ? "accent" : "outline"} onClick={() => setFilters(current => ({ ...current, quick: current.quick === "week" ? null : "week" }))}>Week</Button>
            <Button size="sm" variant={filters.quick === "day" ? "accent" : "outline"} onClick={() => setFilters(current => ({ ...current, quick: current.quick === "day" ? null : "day" }))}>Day</Button>
            <Button size="sm" variant={filters.quick === "dependencies" ? "accent" : "outline"} onClick={() => setFilters(current => ({ ...current, quick: current.quick === "dependencies" ? null : "dependencies" }))}>Dependencies</Button>
            <Button size="sm" variant={filters.quick === "client_visible" ? "accent" : "outline"} onClick={() => setFilters(current => ({ ...current, quick: current.quick === "client_visible" ? null : "client_visible" }))}>Client View</Button>
            <Badge>{filteredItems.length} shown</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {activeView === "gantt" ? (
            <GanttView
              items={visibleItems}
              dependencies={dependencies}
              timeline={timeline}
              onEdit={item => setSelected(itemToDraft(item))}
              onMove={(item, patch) => patchItem(item, patch)}
              onPatch={patchItem}
              onDelete={deleteItem}
              onAddTask={addConnectedTask}
              onAddUser={item => {
                setSelected(itemToDraft(item));
                setNotice("Add staff, client, vendor, or subcontractor from the Participants field.");
              }}
              onAddPhoto={item => setAssetModal({ item, type: "photo" })}
              onAddVideo={item => setAssetModal({ item, type: "video" })}
              onAddSelection={item => setAssetModal({ item, type: "selection" })}
              onAddCodeReference={item => setAssetModal({ item, type: "code" })}
              onExportCsv={exportProjectCsv}
              onPrintPdf={printProjectPdf}
            />
          ) : activeView === "kanban" ? (
            <KanbanPreview items={filteredItems} onEdit={item => setSelected(itemToDraft(item))} onStatusChange={(item, status) => patchItem(item, { status, progress: status === "complete" ? 100 : item.progress })} />
          ) : activeView === "list" ? (
            <ListView items={filteredItems} onEdit={item => setSelected(itemToDraft(item))} />
          ) : activeView === "table" ? (
            <TableView items={filteredItems} onEdit={item => setSelected(itemToDraft(item))} />
          ) : (
            <CalendarView items={filteredItems} onEdit={item => setSelected(itemToDraft(item))} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Items</CardTitle>
          <CardDescription>Expandable project groups synced with the Gantt timeline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {groups.length ? groups.map(group => (
            <div key={group.name} className="overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                className="flex w-full items-center justify-between bg-muted px-4 py-3 text-left"
                onClick={() => setCollapsed(current => {
                  const next = new Set(current);
                  if (next.has(group.name)) next.delete(group.name);
                  else next.add(group.name);
                  return next;
                })}
              >
                <span className="flex items-center gap-2 font-medium">
                  {collapsed.has(group.name) ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {group.name}
                </span>
                <Badge>{group.rows.length} items</Badge>
              </button>
              {!collapsed.has(group.name) ? (
                <div className="divide-y divide-border">
                  {group.rows.map(item => (
                    <ScheduledRow
                      key={item.id}
                      item={item}
                      onEdit={() => setSelected(itemToDraft(item))}
                      onPatch={patch => patchItem(item, patch)}
                      onDelete={() => deleteItem(item)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No scheduled items yet. Apply a project template to seed the Gantt.
            </div>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <ItemEditor
          draft={selected}
          items={items}
          dependencies={dependencies}
          participantOptions={participantOptions}
          saving={saving}
          onClose={() => setSelected(null)}
          onChange={setSelected}
          onSave={saveItem}
          onCreateDependency={createDependency}
          onDeleteDependency={deleteDependency}
        />
      ) : null}
      {assetModal ? (
        <ProjectAssetModal
          state={assetModal}
          saving={saving}
          onClose={() => setAssetModal(null)}
          onSave={payload => saveAsset(assetModal.type, assetModal.item, payload)}
        />
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone = "default"
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
        <div className={cn("mt-3 text-2xl font-semibold", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</div>
        <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function getAssociationBadges(item: ProjectScheduleItem) {
  const counts = item.association_counts || {
    selections: 0,
    media: 0,
    photos: 0,
    videos: 0,
    codes: 0,
    billing: 0,
    participants: String(item.participants || "").split(",").map(value => value.trim()).filter(Boolean).length
  };
  const photoCount = counts.photos || counts.media || 0;
  return [
    { key: "selections", label: "Selections", count: counts.selections, icon: Package },
    { key: "participants", label: "People", count: counts.participants, icon: UserPlus },
    { key: "photos", label: "Photos", count: photoCount, icon: Camera },
    { key: "videos", label: "Videos", count: counts.videos, icon: Video },
    { key: "codes", label: "Codes", count: counts.codes, icon: BookOpen },
    { key: "billing", label: "Pricing / Estimates", count: counts.billing, icon: FileText }
  ].filter(badge => badge.count > 0);
}

function AssociationBadges({ item, compact = false }: { item: ProjectScheduleItem; compact?: boolean }) {
  const badges = getAssociationBadges(item);
  if (!badges.length) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1", compact ? "mt-0" : "mt-2")}>
      {badges.map(badge => {
        const Icon = badge.icon;
        return (
          <span
            key={badge.key}
            title={`${badge.count} ${badge.label.toLowerCase()} linked`}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 font-medium text-accent",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"
            )}
          >
            <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            <span>{badge.count}</span>
          </span>
        );
      })}
    </span>
  );
}

function KanbanPreview({
  items,
  onEdit,
  onStatusChange
}: {
  items: ProjectScheduleItem[];
  onEdit: (item: ProjectScheduleItem) => void;
  onStatusChange: (item: ProjectScheduleItem, status: ScheduleStatus) => Promise<boolean> | boolean;
}) {
  const columns: ScheduleStatus[] = ["pending", "scheduled", "in_progress", "waiting", "blocked", "needs_approval", "complete", "canceled"];
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  return (
    <div className="grid gap-3 overflow-x-auto md:grid-cols-4 xl:grid-cols-8">
      {columns.map(status => {
        const rows = items.filter(item => item.status === status).slice(0, 12);
        const isDragOverTarget = draggedId && items.find(item => item.id === draggedId)?.status !== status;
        return (
          <div
            key={status}
            className={cn("min-h-48 rounded-lg border border-border bg-muted p-3 transition", isDragOverTarget && "border-accent/60 bg-accent/5")}
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              const itemId = event.dataTransfer.getData("text/plain") || draggedId;
              const item = items.find(row => row.id === itemId);
              setDraggedId(null);
              if (item && item.status !== status) void onStatusChange(item, status);
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{status.replaceAll("_", " ")}</div>
              <Badge>{rows.length}</Badge>
            </div>
            <div className="space-y-2">
              {rows.length ? rows.map(item => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  draggable
                  className={cn(
                    "w-full cursor-grab rounded-md border border-border bg-card p-3 text-left shadow-xs transition hover:border-accent active:cursor-grabbing",
                    draggedId === item.id && "opacity-50 ring-2 ring-accent"
                  )}
                  onClick={() => onEdit(item)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") onEdit(item);
                  }}
                  onDragStart={event => {
                    setDraggedId(item.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                  }}
                  onDragEnd={() => setDraggedId(null)}
                >
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.phase || item.project_title || "Project Tasks"}</div>
                  <AssociationBadges item={item} compact />
                  <div className="mt-3 flex items-center justify-between">
                    <Badge tone={item.priority === "high" || item.priority === "urgent" ? "danger" : "success"}>{item.priority || "normal"}</Badge>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">{initials(item.assignee || item.title)}</span>
                  </div>
                </div>
              )) : (
                <div className="rounded-md border border-dashed border-border py-8 text-center text-xs text-muted-foreground">Drop cards here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListView({ items, onEdit }: { items: ProjectScheduleItem[]; onEdit: (item: ProjectScheduleItem) => void }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {items.length ? items.map(item => (
        <button key={item.id} type="button" className="grid w-full gap-3 px-4 py-3 text-left hover:bg-muted md:grid-cols-[1.3fr_1fr_140px_140px] md:items-center" onClick={() => onEdit(item)}>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{item.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.project_title || "Project"} / {item.phase || "Project Tasks"}</span>
            <AssociationBadges item={item} compact />
          </span>
          <span className="text-xs text-muted-foreground">{item.assignee || "Unassigned"}</span>
          <Badge tone={statusTone[item.status] || "default"}>{item.status.replaceAll("_", " ")}</Badge>
          <span className="text-xs text-muted-foreground">{item.start_date} - {item.end_date}</span>
        </button>
      )) : (
        <div className="p-8 text-center text-sm text-muted-foreground">No schedule items yet.</div>
      )}
    </div>
  );
}

function TableView({ items, onEdit }: { items: ProjectScheduleItem[]; onEdit: (item: ProjectScheduleItem) => void }) {
  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-border bg-muted text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Project</th>
            <th className="px-4 py-3 font-medium">Phase</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Start</th>
            <th className="px-4 py-3 font-medium">End</th>
            <th className="px-4 py-3 font-medium">Progress</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(item => (
            <tr key={item.id} className="cursor-pointer hover:bg-muted" onClick={() => onEdit(item)}>
              <td className="max-w-72 px-4 py-3 font-medium">
                <span className="block truncate">{item.title}</span>
                <AssociationBadges item={item} compact />
              </td>
              <td className="px-4 py-3 text-muted-foreground">{item.project_title || "Project"}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.phase || "Project Tasks"}</td>
              <td className="px-4 py-3"><Badge tone={statusTone[item.status] || "default"}>{item.status.replaceAll("_", " ")}</Badge></td>
              <td className="px-4 py-3"><Badge tone={item.priority === "high" || item.priority === "urgent" || item.priority === "critical" ? "danger" : "default"}>{item.priority || "normal"}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{item.start_date}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.end_date}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.progress || 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length ? <div className="p-8 text-center text-sm text-muted-foreground">No schedule items yet.</div> : null}
    </div>
  );
}

function CalendarView({ items, onEdit }: { items: ProjectScheduleItem[]; onEdit: (item: ProjectScheduleItem) => void }) {
  const today = dateOnly(new Date());
  const calendarStart = addDays(today, -3);
  const days = Array.from({ length: 14 }, (_, index) => addDays(calendarStart, index));
  return (
    <div className="grid gap-2 overflow-auto rounded-lg border border-border p-3 md:grid-cols-7">
      {days.map(day => {
        const dayItems = items.filter(item => item.start_date <= day && item.end_date >= day).slice(0, 4);
        return (
          <div key={day} className={cn("min-h-36 rounded-md border border-border bg-card p-3", day === today && "border-accent")}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold">{new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
              <Badge>{dayItems.length}</Badge>
            </div>
            <div className="space-y-2">
              {dayItems.map(item => (
                <button key={item.id} type="button" className="block w-full rounded border border-border bg-muted px-2 py-1.5 text-left text-xs hover:border-accent" onClick={() => onEdit(item)}>
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-muted-foreground">{item.project_title || item.phase || "Project"}</span>
                  <AssociationBadges item={item} compact />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const minutesPerDay = 1440;
const dragSnapMinutes = 15;

type TimelinePosition = {
  date: string;
  offsetMinutes: number;
};

type DragState = {
  item: ProjectScheduleItem;
  mode: "move" | "resize-start" | "resize-end";
  pointerStartX: number;
  pointerStartY: number;
  pointerX: number;
  pointerY: number;
  originalStartTotal: number;
  originalDurationMinutes: number;
  shiftMinutes: number;
  durationMinutes: number;
  start: TimelinePosition;
  end: TimelinePosition;
  moved: boolean;
};

function getTimelineOffsetMinutes(item: ProjectScheduleItem) {
  const value = item.metadata?.timeline_start_offset_minutes;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getDurationMinutes(item: ProjectScheduleItem) {
  return Math.max(
    dragSnapMinutes,
    Number(item.duration_minutes) || Math.max(1, daysBetween(item.start_date, item.end_date) + 1) * minutesPerDay
  );
}

function snapMinutes(value: number) {
  return Math.round(value / dragSnapMinutes) * dragSnapMinutes;
}

function normalizeTimelinePosition(timelineStart: string, totalMinutes: number): TimelinePosition {
  const safeMinutes = Math.max(0, totalMinutes);
  const dayIndex = Math.floor(safeMinutes / minutesPerDay);
  return {
    date: addDays(timelineStart, dayIndex),
    offsetMinutes: safeMinutes - dayIndex * minutesPerDay
  };
}

function timelinePositionToTotalMinutes(timelineStart: string, position: TimelinePosition) {
  return daysBetween(timelineStart, position.date) * minutesPerDay + position.offsetMinutes;
}

function endDateFromStart(timelineStart: string, startTotalMinutes: number, durationMinutes: number) {
  const endTotalMinutes = Math.max(startTotalMinutes + durationMinutes, startTotalMinutes + dragSnapMinutes);
  const endDayIndex = Math.max(0, Math.ceil(endTotalMinutes / minutesPerDay) - 1);
  return addDays(timelineStart, endDayIndex);
}

function formatShift(minutes: number) {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  if (!hours) return `${sign}${mins} min`;
  if (!mins) return `${sign}${hours} hr`;
  return `${sign}${hours} hr ${mins} min`;
}

function formatTimelineDateTime(position: TimelinePosition) {
  const date = new Date(`${position.date}T00:00:00`);
  date.setMinutes(position.offsetMinutes);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function assetLabel(type: AssetModalState["type"]) {
  if (type === "photo") return "Photo";
  if (type === "video") return "Video";
  if (type === "selection") return "Selection";
  return "Code Reference";
}

function timelineItemStartTotal(timelineStart: string, item: ProjectScheduleItem, preview?: DragState | null) {
  if (preview?.item.id === item.id) return timelinePositionToTotalMinutes(timelineStart, preview.start);
  return daysBetween(timelineStart, item.start_date) * minutesPerDay + getTimelineOffsetMinutes(item);
}

function timelineItemDurationMinutes(item: ProjectScheduleItem, preview?: DragState | null) {
  if (preview?.item.id === item.id) return preview.durationMinutes;
  return getDurationMinutes(item);
}

function GanttView({
  items,
  dependencies,
  timeline,
  onEdit,
  onMove,
  onPatch,
  onDelete,
  onAddTask,
  onAddUser,
  onAddPhoto,
  onAddVideo,
  onAddSelection,
  onAddCodeReference,
  onExportCsv,
  onPrintPdf
}: {
  items: ProjectScheduleItem[];
  dependencies: ProjectScheduleDependency[];
  timeline: { start: string; days: number };
  onEdit: (item: ProjectScheduleItem) => void;
  onMove: (item: ProjectScheduleItem, patch: Partial<ProjectScheduleItem>) => Promise<boolean> | boolean;
  onPatch: (item: ProjectScheduleItem, patch: Partial<ProjectScheduleItem>) => Promise<boolean> | boolean;
  onDelete: (item: ProjectScheduleItem) => void;
  onAddTask: (item: ProjectScheduleItem) => void;
  onAddUser: (item: ProjectScheduleItem) => void;
  onAddPhoto: (item: ProjectScheduleItem) => void;
  onAddVideo: (item: ProjectScheduleItem) => void;
  onAddSelection: (item: ProjectScheduleItem) => void;
  onAddCodeReference: (item: ProjectScheduleItem) => void;
  onExportCsv: (item: ProjectScheduleItem) => void;
  onPrintPdf: (item: ProjectScheduleItem) => void;
}) {
  const rows = items.slice(0, 80);
  const labelWidth = 300;
  const frameRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const recentlyDraggedRef = React.useRef<string | null>(null);
  const [availableTrackWidth, setAvailableTrackWidth] = React.useState(0);
  const [drag, setDrag] = React.useState<DragState | null>(null);
  const [savingItemId, setSavingItemId] = React.useState<string | null>(null);
  const [dragError, setDragError] = React.useState<string | null>(null);
  const [dependencyNotice, setDependencyNotice] = React.useState<string | null>(null);
  const [actionDock, setActionDock] = React.useState<{ item: ProjectScheduleItem; x: number; y: number } | null>(null);
  const [associationPeek, setAssociationPeek] = React.useState<{ item: ProjectScheduleItem; x: number; y: number } | null>(null);

  React.useEffect(() => {
    const node = frameRef.current;
    if (!node) return;

    const updateWidth = () => {
      setAvailableTrackWidth(Math.max(0, Math.floor(node.clientWidth - labelWidth)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const width = Math.max(timeline.days * dayWidth, availableTrackWidth);
  const effectiveDayWidth = width / Math.max(timeline.days, 1);
  const minutesPerPixel = minutesPerDay / effectiveDayWidth;

  React.useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  React.useEffect(() => {
    if (!drag) return;
    const activeDrag = drag;
    const move = (event: PointerEvent) => {
      const shiftMinutes = snapMinutes((event.clientX - activeDrag.pointerStartX) * minutesPerPixel);
      const originalStartTotal = activeDrag.originalStartTotal;
      const originalEndTotal = originalStartTotal + activeDrag.originalDurationMinutes;
      const moved = Math.abs(event.clientX - activeDrag.pointerStartX) > 4 || Math.abs(event.clientY - activeDrag.pointerStartY) > 4;
      let nextStartTotal = originalStartTotal;
      let nextEndTotal = originalEndTotal;

      if (activeDrag.mode === "move") {
        nextStartTotal = Math.max(0, originalStartTotal + shiftMinutes);
        nextEndTotal = nextStartTotal + activeDrag.originalDurationMinutes;
      } else if (activeDrag.mode === "resize-start") {
        nextStartTotal = Math.min(Math.max(0, originalStartTotal + shiftMinutes), originalEndTotal - dragSnapMinutes);
        nextEndTotal = originalEndTotal;
      } else {
        nextStartTotal = originalStartTotal;
        nextEndTotal = Math.max(originalStartTotal + dragSnapMinutes, originalEndTotal + shiftMinutes);
      }

      setDrag(current => current ? {
        ...current,
        pointerX: event.clientX,
        pointerY: event.clientY,
        shiftMinutes,
        durationMinutes: Math.max(dragSnapMinutes, nextEndTotal - nextStartTotal),
        start: normalizeTimelinePosition(timeline.start, nextStartTotal),
        end: normalizeTimelinePosition(timeline.start, nextEndTotal),
        moved: current.moved || moved
      } : current);
    };

    const up = async () => {
      const finalDrag = dragRef.current || activeDrag;
      setDrag(null);
      recentlyDraggedRef.current = finalDrag.item.id;
      if (!finalDrag.moved) {
        setActionDock({ item: finalDrag.item, x: finalDrag.pointerX, y: finalDrag.pointerY });
        return;
      }
      if (!finalDrag.shiftMinutes && finalDrag.durationMinutes === finalDrag.originalDurationMinutes) return;

      const dependencyCount = dependencies.filter(dep => dep.source_item_id === finalDrag.item.id || dep.target_item_id === finalDrag.item.id).length;
      if (dependencyCount) {
        setDependencyNotice(`${finalDrag.item.title} updated. ${dependencyCount} dependency ${dependencyCount === 1 ? "connector was" : "connectors were"} redrawn; auto-shift rules are still manual in this prototype.`);
      } else {
        setDependencyNotice(null);
      }

      const startTotal = timelinePositionToTotalMinutes(timeline.start, finalDrag.start);
      const endTotal = timelinePositionToTotalMinutes(timeline.start, finalDrag.end);
      const durationMinutes = Math.max(dragSnapMinutes, endTotal - startTotal);
      const metadata = {
        ...(finalDrag.item.metadata || {}),
        timeline_start_offset_minutes: finalDrag.start.offsetMinutes,
        last_timeline_shift_minutes: finalDrag.mode === "move" ? finalDrag.shiftMinutes : 0,
        last_timeline_resize_minutes: finalDrag.mode === "move" ? 0 : finalDrag.shiftMinutes,
        last_timeline_interaction: finalDrag.mode
      };

      setSavingItemId(finalDrag.item.id);
      setDragError(null);
      const ok = await onMove(finalDrag.item, {
        start_date: finalDrag.start.date,
        end_date: endDateFromStart(timeline.start, startTotal, durationMinutes),
        duration_minutes: durationMinutes,
        metadata
      });
      setSavingItemId(null);
      if (!ok) setDragError("Schedule update failed. The task was refreshed from the server.");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dependencies, drag, minutesPerPixel, onEdit, onMove, timeline.start]);

  const startTimelineDrag = (event: React.PointerEvent, item: ProjectScheduleItem, mode: DragState["mode"]) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startTotal = daysBetween(timeline.start, item.start_date) * minutesPerDay + getTimelineOffsetMinutes(item);
    const duration = getDurationMinutes(item);
    setDragError(null);
    setActionDock(null);
    setAssociationPeek(null);
    setDrag({
      item,
      mode,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
      originalStartTotal: startTotal,
      originalDurationMinutes: duration,
      shiftMinutes: 0,
      durationMinutes: duration,
      start: normalizeTimelinePosition(timeline.start, startTotal),
      end: normalizeTimelinePosition(timeline.start, startTotal + duration),
      moved: false
    });
  };

  const showAssociationPeek = (event: React.PointerEvent<HTMLElement>, item: ProjectScheduleItem) => {
    if (dragRef.current || !getAssociationBadges(item).length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setAssociationPeek({
      item,
      x: rect.left + rect.width / 2,
      y: Math.max(12, rect.top - 8)
    });
  };

  return (
    <div ref={frameRef} className="cmi-gantt-scrollbar w-full overflow-auto rounded-lg border border-border">
      {dragError ? <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{dragError}</div> : null}
      {dependencyNotice ? <div className="border-b border-accent/30 bg-accent/10 px-4 py-2 text-xs text-muted-foreground">{dependencyNotice}</div> : null}
      {drag ? (
        <div
          className="pointer-events-none fixed z-[80] w-64 rounded-md border border-border bg-card p-3 text-xs text-card-foreground shadow-lg"
          style={{
            left: `min(calc(100vw - 280px), max(12px, ${drag.pointerX + 14}px))`,
            top: `min(calc(100vh - 128px), max(12px, ${drag.pointerY + 14}px))`
          }}
        >
          <div className="font-semibold">{drag.mode === "move" ? "Move task" : drag.mode === "resize-start" ? "Adjust start" : "Adjust end"}</div>
          <div className="mt-1"><span className="text-muted-foreground">Start:</span> {formatTimelineDateTime(drag.start)}</div>
          <div className="mt-1"><span className="text-muted-foreground">End:</span> {formatTimelineDateTime(drag.end)}</div>
          <div className="mt-2 font-semibold text-accent">{drag.mode === "move" ? "Moved" : "Adjusted"}: {formatShift(drag.shiftMinutes)}</div>
          <div className="mt-1 text-muted-foreground">Duration: {formatShift(drag.durationMinutes).replace("+", "")}</div>
        </div>
      ) : null}
      {associationPeek && !drag ? (
        <GanttAssociationPeek
          item={associationPeek.item}
          x={associationPeek.x}
          y={associationPeek.y}
        />
      ) : null}
      {actionDock ? (
        <GanttActionDock
          item={actionDock.item}
          x={actionDock.x}
          y={actionDock.y}
          onClose={() => setActionDock(null)}
          onAddTask={() => { onAddTask(actionDock.item); setActionDock(null); }}
          onAddUser={() => { onAddUser(actionDock.item); setActionDock(null); }}
          onAddPhoto={() => { onAddPhoto(actionDock.item); setActionDock(null); }}
          onAddVideo={() => { onAddVideo(actionDock.item); setActionDock(null); }}
          onAddSelection={() => { onAddSelection(actionDock.item); setActionDock(null); }}
          onAddCodeReference={() => { onAddCodeReference(actionDock.item); setActionDock(null); }}
          onEdit={() => { onEdit(actionDock.item); setActionDock(null); }}
          onHide={() => { onPatch(actionDock.item, { visible_on_gantt: false }); setActionDock(null); }}
          onComplete={() => { onPatch(actionDock.item, { status: "complete", progress: 100 }); setActionDock(null); }}
          onCancel={() => { onPatch(actionDock.item, { status: "canceled" }); setActionDock(null); }}
          onDelete={() => { onDelete(actionDock.item); setActionDock(null); }}
          onExportCsv={() => { onExportCsv(actionDock.item); setActionDock(null); }}
          onPrintPdf={() => { onPrintPdf(actionDock.item); setActionDock(null); }}
        />
      ) : null}
      <div className="grid select-none" style={{ gridTemplateColumns: `${labelWidth}px ${width}px`, minWidth: labelWidth + width }}>
        <div className="sticky left-0 z-20 border-b border-r border-border bg-card px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Schedule Item
        </div>
        <div className="grid border-b border-border bg-card" style={{ gridTemplateColumns: `repeat(${timeline.days}, ${effectiveDayWidth}px)` }}>
          {Array.from({ length: timeline.days }, (_, index) => {
            const date = addDays(timeline.start, index);
            return (
              <div key={date} className="border-r border-border px-1 py-2 text-center text-[11px] text-muted-foreground">
                <div>{new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })}</div>
                <strong className="text-foreground">{new Date(`${date}T00:00:00`).getDate()}</strong>
              </div>
            );
          })}
        </div>

        <div className="sticky left-0 z-10 border-r border-border bg-card">
          {rows.map(item => (
            <button
              key={item.id}
              type="button"
              className="flex h-14 w-full items-center gap-3 border-b border-border px-4 text-left hover:bg-muted"
              onClick={() => onEdit(item)}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {initials(item.assignee || item.title)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.phase || item.project_title}</span>
                <AssociationBadges item={item} compact />
              </span>
            </button>
          ))}
        </div>

        <div className="relative gantt-grid-bg" style={{ width, minHeight: rows.length * 56, ["--gantt-day-width" as string]: `${effectiveDayWidth}px` }}>
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
            {dependencies.map(dep => {
              const sourceIndex = rows.findIndex(item => item.id === dep.source_item_id);
              const targetIndex = rows.findIndex(item => item.id === dep.target_item_id);
              const source = rows[sourceIndex];
              const target = rows[targetIndex];
              if (!source || !target) return null;
              const sourceStartTotal = timelineItemStartTotal(timeline.start, source, drag);
              const sourceDuration = timelineItemDurationMinutes(source, drag);
              const targetStartTotal = timelineItemStartTotal(timeline.start, target, drag);
              const targetDuration = timelineItemDurationMinutes(target, drag);
              const sourceXStart = sourceStartTotal / minutesPerDay * effectiveDayWidth;
              const sourceXFinish = (sourceStartTotal + sourceDuration) / minutesPerDay * effectiveDayWidth;
              const targetXStart = targetStartTotal / minutesPerDay * effectiveDayWidth;
              const targetXFinish = (targetStartTotal + targetDuration) / minutesPerDay * effectiveDayWidth;
              const sourceSide = dep.dependency_type === "start_to_start" || dep.dependency_type === "start_to_finish" ? "start" : "finish";
              const targetSide = dep.dependency_type === "finish_to_finish" || dep.dependency_type === "start_to_finish" ? "finish" : "start";
              const x1 = sourceSide === "start" ? sourceXStart : sourceXFinish;
              const y1 = sourceIndex * 56 + 28;
              const x2 = targetSide === "finish" ? targetXFinish : targetXStart;
              const y2 = targetIndex * 56 + 28;
              const mid = Math.max(x1 + 18, x1 + (x2 - x1) / 2);
              return (
                <path
                  key={dep.id}
                  d={`M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.7"
                />
              );
            })}
          </svg>
          {rows.map((item, index) => {
            const offsetMinutes = getTimelineOffsetMinutes(item);
            const durationMinutes = getDurationMinutes(item);
            const baseLeft = Math.max(0, (daysBetween(timeline.start, item.start_date) * minutesPerDay + offsetMinutes) / minutesPerDay * effectiveDayWidth);
            const isDragging = drag?.item.id === item.id;
            const draggedStartTotal = isDragging ? timelinePositionToTotalMinutes(timeline.start, drag.start) : null;
            const draggedEndTotal = isDragging ? timelinePositionToTotalMinutes(timeline.start, drag.end) : null;
            const left = isDragging && draggedStartTotal !== null
              ? Math.max(0, draggedStartTotal / minutesPerDay * effectiveDayWidth)
              : baseLeft;
            const barDurationMinutes = isDragging && draggedStartTotal !== null && draggedEndTotal !== null
              ? Math.max(dragSnapMinutes, draggedEndTotal - draggedStartTotal)
              : durationMinutes;
            const blocked = item.status === "blocked" || item.is_blocked;
            return (
              <React.Fragment key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "group absolute z-20 flex h-9 cursor-grab touch-none items-center gap-2 rounded-md border px-7 text-left text-xs font-semibold shadow-md transition active:cursor-grabbing",
                    isDragging ? "scale-[1.01] ring-2 ring-ring" : "hover:scale-[1.01]",
                    blocked ? "border-destructive/60 bg-destructive/15" : item.status === "complete" ? "border-success/50 bg-success/15" : "border-accent/50 bg-accent/15"
                  )}
                  style={{ left, top: index * 56 + 10, width: Math.max(88, barDurationMinutes / minutesPerDay * effectiveDayWidth - 8) }}
                  onClick={event => {
                    event.stopPropagation();
                    if (recentlyDraggedRef.current === item.id) {
                      recentlyDraggedRef.current = null;
                      return;
                    }
                    setAssociationPeek(null);
                    setActionDock({ item, x: event.clientX, y: event.clientY });
                  }}
                  onPointerEnter={event => showAssociationPeek(event, item)}
                  onPointerMove={event => showAssociationPeek(event, item)}
                  onPointerLeave={() => setAssociationPeek(current => current?.item.id === item.id ? null : current)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") onEdit(item);
                  }}
                  onPointerDown={event => startTimelineDrag(event, item, "move")}
                  title="Drag the center to move. Drag either edge to resize duration."
                >
                  <span
                    className="absolute inset-y-0 left-0 z-20 flex w-5 cursor-ew-resize items-center justify-center rounded-l-md border-r border-current/20 bg-current/10 opacity-80 transition hover:bg-accent/35 group-hover:opacity-100"
                    title="Resize start"
                    onPointerDown={event => startTimelineDrag(event, item, "resize-start")}
                  >
                    <span className="h-4 w-0.5 rounded-full bg-current opacity-80" />
                  </span>
                  {savingItemId === item.id ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" /> : <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 transition group-hover:opacity-100" />}
                  <span className="truncate">{item.title}</span>
                  {savingItemId === item.id ? <span className="ml-auto text-[10px] text-muted-foreground">Saving</span> : null}
                  <span
                    className="absolute inset-y-0 right-0 z-20 flex w-5 cursor-ew-resize items-center justify-center rounded-r-md border-l border-current/20 bg-current/10 opacity-80 transition hover:bg-accent/35 group-hover:opacity-100"
                    title="Resize end"
                    onPointerDown={event => startTimelineDrag(event, item, "resize-end")}
                  >
                    <span className="h-4 w-0.5 rounded-full bg-current opacity-80" />
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GanttAssociationPeek({ item, x, y }: { item: ProjectScheduleItem; x: number; y: number }) {
  const badges = getAssociationBadges(item);
  if (!badges.length) return null;
  return (
    <div
      className="pointer-events-none fixed z-[75] flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full border border-border bg-card/95 px-2 py-1 text-xs text-card-foreground shadow-lg backdrop-blur"
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      {badges.map(badge => {
        const Icon = badge.icon;
        return (
          <span
            key={badge.key}
            className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1 font-semibold text-accent"
            title={`${badge.count} ${badge.label.toLowerCase()} linked`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{badge.count}</span>
          </span>
        );
      })}
    </div>
  );
}

function GanttActionDock({
  item,
  x,
  y,
  onClose,
  onAddTask,
  onAddUser,
  onAddPhoto,
  onAddVideo,
  onAddSelection,
  onAddCodeReference,
  onEdit,
  onHide,
  onComplete,
  onCancel,
  onDelete,
  onExportCsv,
  onPrintPdf
}: {
  item: ProjectScheduleItem;
  x: number;
  y: number;
  onClose: () => void;
  onAddTask: () => void;
  onAddUser: () => void;
  onAddPhoto: () => void;
  onAddVideo: () => void;
  onAddSelection: () => void;
  onAddCodeReference: () => void;
  onEdit: () => void;
  onHide: () => void;
  onComplete: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onExportCsv: () => void;
  onPrintPdf: () => void;
}) {
  React.useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-gantt-action-dock]")) onClose();
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);

  const actions = [
    { label: "Connect task", icon: Link2, action: onAddTask },
    { label: "Add user", icon: UserPlus, action: onAddUser },
    { label: "Photo", icon: Camera, action: onAddPhoto },
    { label: "Video", icon: Video, action: onAddVideo },
    { label: "Selection", icon: Package, action: onAddSelection },
    { label: "Code", icon: BookOpen, action: onAddCodeReference },
    { label: "Edit", icon: Pencil, action: onEdit },
    { label: "Hide", icon: EyeOff, action: onHide },
    { label: "Complete", icon: CheckCircle2, action: onComplete },
    { label: "Cancel", icon: XCircle, action: onCancel },
    { label: "CSV", icon: Download, action: onExportCsv },
    { label: "PDF", icon: FileText, action: onPrintPdf },
    { label: "Delete", icon: Trash2, action: onDelete, danger: true }
  ];

  return (
    <div
      data-gantt-action-dock
      className="fixed z-[90] w-[280px] rounded-lg border border-border bg-card p-3 text-card-foreground shadow-xl"
      style={{ left: `min(calc(100vw - 300px), max(12px, ${x + 12}px))`, top: `min(calc(100vh - 360px), max(12px, ${y + 12}px))` }}
    >
      <div className="mb-2 min-w-0">
        <div className="truncate text-sm font-semibold">{item.title}</div>
        <div className="truncate text-xs text-muted-foreground">{item.type} - {item.phase || item.project_title || "Project"}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {actions.map(action => (
          <button
            key={action.label}
            type="button"
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-2 text-center text-[11px] font-medium transition hover:border-accent hover:bg-accent hover:text-accent-foreground",
              action.danger && "text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
            )}
            onClick={action.action}
          >
            <action.icon className="h-4 w-4" />
            {action.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
        Drag the center to move. Use the left or right edge handles to resize duration.
      </div>
    </div>
  );
}

function ProjectAssetModal({
  state,
  saving,
  onClose,
  onSave
}: {
  state: AssetModalState;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const { type, item } = state;
  const [mediaDraft, setMediaDraft] = React.useState({
    title: "",
    file_url: "",
    caption: "",
    capture_source: "upload",
    client_visible: false,
    file_name: ""
  });
  const [selectionDraft, setSelectionDraft] = React.useState({
    name: "",
    vendor_name: "",
    category: "",
    manufacturer: "",
    sku: "",
    model_number: "",
    description: "",
    image_url: "",
    product_url: "",
    price: "",
    quantity: "1",
    unit: "each",
    status: "pending",
    delivery_date: "",
    lead_time_days: "",
    client_approval_status: "not_sent",
    client_visible: false,
    internal_notes: ""
  });
  const [codeDraft, setCodeDraft] = React.useState({
    title: "",
    jurisdiction_type: "city",
    jurisdiction_name: "",
    code_source: "",
    code_section: "",
    code_text: "",
    source_url: "",
    applies_to_phase: item.phase || "",
    required_inspection: "",
    compliance_status: "not_reviewed",
    notes: "",
    client_visible: false
  });

  const title = type === "code" ? "Add Code Reference" : `Add ${assetLabel(type)}`;
  const mediaAccept = type === "photo" ? "image/*" : "video/*";

  return (
    <div className="fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-sm">
      <div className="ml-auto flex h-full max-w-3xl flex-col rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Project Asset</div>
            <h2 className="mt-2 font-display text-2xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{item.project_title || item.schedule_group_key || "Project"} / {item.title}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-5">
          {type === "photo" || type === "video" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  {type === "photo" ? "Photo" : "Video"} title
                  <Input className="mt-1" value={mediaDraft.title} onChange={event => setMediaDraft({ ...mediaDraft, title: event.target.value })} placeholder="Site progress, slab inspection, selection preview..." />
                </label>
                <label className="block text-sm font-medium">
                  Capture source
                  <Select className="mt-1" value={mediaDraft.capture_source} onChange={event => setMediaDraft({ ...mediaDraft, capture_source: event.target.value })}>
                    <option value="upload">Upload</option>
                    <option value="front_camera">Front camera</option>
                    <option value="rear_camera">Rear camera</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </label>
              </div>
              <label className="block text-sm font-medium">
                File URL
                <Input className="mt-1" value={mediaDraft.file_url} onChange={event => setMediaDraft({ ...mediaDraft, file_url: event.target.value })} placeholder="https://..." />
              </label>
              <div className="rounded-lg border border-dashed border-border bg-muted p-4">
                <label className="block text-sm font-medium">
                  Upload or capture file
                  <Input
                    className="mt-2"
                    type="file"
                    accept={mediaAccept}
                    capture="environment"
                    onChange={event => setMediaDraft({ ...mediaDraft, file_name: event.target.files?.[0]?.name || "" })}
                  />
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  {mediaDraft.file_name ? `Selected: ${mediaDraft.file_name}. ` : ""}
                  Supabase Storage upload will attach this file to the saved media record in the next storage pass.
                </p>
              </div>
              <label className="block text-sm font-medium">
                Caption
                <Textarea className="mt-1" value={mediaDraft.caption} onChange={event => setMediaDraft({ ...mediaDraft, caption: event.target.value })} />
              </label>
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={mediaDraft.client_visible} onChange={event => setMediaDraft({ ...mediaDraft, client_visible: event.target.checked })} />
                Client visible
              </label>
            </>
          ) : null}

          {type === "selection" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  Selection name
                  <Input className="mt-1" value={selectionDraft.name} onChange={event => setSelectionDraft({ ...selectionDraft, name: event.target.value })} placeholder="Tile, vanity, appliance, fixture..." />
                </label>
                <label className="block text-sm font-medium">
                  Vendor
                  <Input className="mt-1" value={selectionDraft.vendor_name} onChange={event => setSelectionDraft({ ...selectionDraft, vendor_name: event.target.value })} placeholder="Vendor or supplier" />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-sm font-medium">
                  Category
                  <Input className="mt-1" value={selectionDraft.category} onChange={event => setSelectionDraft({ ...selectionDraft, category: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  Manufacturer
                  <Input className="mt-1" value={selectionDraft.manufacturer} onChange={event => setSelectionDraft({ ...selectionDraft, manufacturer: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  SKU
                  <Input className="mt-1" value={selectionDraft.sku} onChange={event => setSelectionDraft({ ...selectionDraft, sku: event.target.value })} />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  Model number
                  <Input className="mt-1" value={selectionDraft.model_number} onChange={event => setSelectionDraft({ ...selectionDraft, model_number: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  Product URL
                  <Input className="mt-1" value={selectionDraft.product_url} onChange={event => setSelectionDraft({ ...selectionDraft, product_url: event.target.value })} placeholder="https://..." />
                </label>
              </div>
              <label className="block text-sm font-medium">
                Image URL
                <Input className="mt-1" value={selectionDraft.image_url} onChange={event => setSelectionDraft({ ...selectionDraft, image_url: event.target.value })} placeholder="https://..." />
              </label>
              <div className="grid gap-3 md:grid-cols-4">
                <label className="block text-sm font-medium">
                  Price
                  <Input className="mt-1" type="number" min={0} step={0.01} value={selectionDraft.price} onChange={event => setSelectionDraft({ ...selectionDraft, price: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  Quantity
                  <Input className="mt-1" type="number" min={0} step={0.01} value={selectionDraft.quantity} onChange={event => setSelectionDraft({ ...selectionDraft, quantity: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  Unit
                  <Input className="mt-1" value={selectionDraft.unit} onChange={event => setSelectionDraft({ ...selectionDraft, unit: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  Lead days
                  <Input className="mt-1" type="number" min={0} value={selectionDraft.lead_time_days} onChange={event => setSelectionDraft({ ...selectionDraft, lead_time_days: event.target.value })} />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-sm font-medium">
                  Status
                  <Select className="mt-1" value={selectionDraft.status} onChange={event => setSelectionDraft({ ...selectionDraft, status: event.target.value })}>
                    {["pending", "available", "delivery", "out_of_stock", "discontinued", "approved", "rejected", "needs_review"].map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                  </Select>
                </label>
                <label className="block text-sm font-medium">
                  Delivery date
                  <Input className="mt-1" type="date" value={selectionDraft.delivery_date} onChange={event => setSelectionDraft({ ...selectionDraft, delivery_date: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  Client approval
                  <Select className="mt-1" value={selectionDraft.client_approval_status} onChange={event => setSelectionDraft({ ...selectionDraft, client_approval_status: event.target.value })}>
                    {["not_sent", "pending", "approved", "rejected", "revision_requested"].map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                  </Select>
                </label>
              </div>
              <label className="block text-sm font-medium">
                Description
                <Textarea className="mt-1" value={selectionDraft.description} onChange={event => setSelectionDraft({ ...selectionDraft, description: event.target.value })} />
              </label>
              <label className="block text-sm font-medium">
                Internal notes
                <Textarea className="mt-1" value={selectionDraft.internal_notes} onChange={event => setSelectionDraft({ ...selectionDraft, internal_notes: event.target.value })} />
              </label>
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={selectionDraft.client_visible} onChange={event => setSelectionDraft({ ...selectionDraft, client_visible: event.target.checked })} />
                Client visible
              </label>
            </>
          ) : null}

          {type === "code" ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  Reference title
                  <Input className="mt-1" value={codeDraft.title} onChange={event => setCodeDraft({ ...codeDraft, title: event.target.value })} placeholder="Setback, egress, electrical, inspection..." />
                </label>
                <label className="block text-sm font-medium">
                  Jurisdiction
                  <Select className="mt-1" value={codeDraft.jurisdiction_type} onChange={event => setCodeDraft({ ...codeDraft, jurisdiction_type: event.target.value })}>
                    {["city", "county", "state", "federal", "hoa", "other"].map(kind => <option key={kind} value={kind}>{kind}</option>)}
                  </Select>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-sm font-medium">
                  Jurisdiction name
                  <Input className="mt-1" value={codeDraft.jurisdiction_name} onChange={event => setCodeDraft({ ...codeDraft, jurisdiction_name: event.target.value })} placeholder="Scottsdale, Maricopa County, Arizona..." />
                </label>
                <label className="block text-sm font-medium">
                  Code source
                  <Input className="mt-1" value={codeDraft.code_source} onChange={event => setCodeDraft({ ...codeDraft, code_source: event.target.value })} placeholder="IRC, NEC, city ordinance..." />
                </label>
                <label className="block text-sm font-medium">
                  Code section
                  <Input className="mt-1" value={codeDraft.code_section} onChange={event => setCodeDraft({ ...codeDraft, code_section: event.target.value })} placeholder="R311.7, E3902..." />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-sm font-medium">
                  Applies to phase
                  <Input className="mt-1" value={codeDraft.applies_to_phase} onChange={event => setCodeDraft({ ...codeDraft, applies_to_phase: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  Required inspection
                  <Input className="mt-1" value={codeDraft.required_inspection} onChange={event => setCodeDraft({ ...codeDraft, required_inspection: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  Compliance status
                  <Select className="mt-1" value={codeDraft.compliance_status} onChange={event => setCodeDraft({ ...codeDraft, compliance_status: event.target.value })}>
                    {["not_reviewed", "applicable", "satisfied", "issue", "not_applicable"].map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                  </Select>
                </label>
              </div>
              <label className="block text-sm font-medium">
                Source URL
                <Input className="mt-1" value={codeDraft.source_url} onChange={event => setCodeDraft({ ...codeDraft, source_url: event.target.value })} placeholder="https://..." />
              </label>
              <label className="block text-sm font-medium">
                Code text
                <Textarea className="mt-1" value={codeDraft.code_text} onChange={event => setCodeDraft({ ...codeDraft, code_text: event.target.value })} />
              </label>
              <label className="block text-sm font-medium">
                Notes
                <Textarea className="mt-1" value={codeDraft.notes} onChange={event => setCodeDraft({ ...codeDraft, notes: event.target.value })} />
              </label>
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <input type="checkbox" checked={codeDraft.client_visible} onChange={event => setCodeDraft({ ...codeDraft, client_visible: event.target.checked })} />
                Client visible
              </label>
            </>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            disabled={saving}
            onClick={() => onSave(type === "selection" ? selectionDraft : type === "code" ? codeDraft : mediaDraft)}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save {assetLabel(type)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScheduledRow({
  item,
  onEdit,
  onPatch,
  onDelete
}: {
  item: ProjectScheduleItem;
  onEdit: () => void;
  onPatch: (patch: Partial<ProjectScheduleItem>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_140px_120px_220px] md:items-center">
      <button type="button" className="min-w-0 text-left" onClick={onEdit}>
        <div className="truncate text-sm font-medium">{item.title}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{item.phase || "Project Tasks"} · {item.assignee || "Unassigned"}</div>
      </button>
      <Badge tone={statusTone[item.status] || "default"}>{item.status.replaceAll("_", " ")}</Badge>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {item.start_date}
      </div>
      <div className="flex flex-wrap justify-start gap-1 md:justify-end">
        <Button size="sm" variant="ghost" onClick={() => onPatch({ visible_on_gantt: item.visible_on_gantt === false })}>
          {item.visible_on_gantt === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onPatch({ status: "complete", progress: 100 })}>
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onPatch({ status: "canceled" })}>
          <XCircle className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ItemEditor({
  draft,
  items,
  dependencies,
  participantOptions,
  saving,
  onClose,
  onChange,
  onSave,
  onCreateDependency,
  onDeleteDependency
}: {
  draft: ItemDraft;
  items: ProjectScheduleItem[];
  dependencies: ProjectScheduleDependency[];
  participantOptions: string[];
  saving: boolean;
  onClose: () => void;
  onChange: (draft: ItemDraft) => void;
  onSave: (draft: ItemDraft) => void;
  onCreateDependency: (input: { source_item_id: string; target_item_id: string; dependency_type: DependencyType; lag_days: number; auto_shift: boolean; notes?: string }) => Promise<boolean>;
  onDeleteDependency: (dependency: ProjectScheduleDependency) => Promise<boolean>;
}) {
  const update = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => onChange({ ...draft, [key]: value });
  const selectedParticipants = draft.participants
    ? draft.participants.split(",").map(part => part.trim()).filter(Boolean)
    : [];
  const dependencyRows = dependencies.filter(dep => dep.target_item_id === draft.id);
  const [dependencySource, setDependencySource] = React.useState("");
  const [dependencyType, setDependencyType] = React.useState<DependencyType>("finish_to_start");
  const [lagDays, setLagDays] = React.useState(0);
  const [autoShift, setAutoShift] = React.useState(true);
  const availableDependencyItems = items.filter(item => item.id !== draft.id);

  const toggleParticipant = (participant: string) => {
    const next = selectedParticipants.includes(participant)
      ? selectedParticipants.filter(item => item !== participant)
      : [...selectedParticipants, participant];
    update("participants", next.join(", "));
  };

  const addDependency = async () => {
    if (!draft.id || !dependencySource) return;
    const ok = await onCreateDependency({
      source_item_id: dependencySource,
      target_item_id: draft.id,
      dependency_type: dependencyType,
      lag_days: lagDays,
      auto_shift: autoShift,
      notes: draft.dependencies
    });
    if (ok) setDependencySource("");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-sm">
      <div className="ml-auto flex h-full max-w-4xl flex-col rounded-lg border border-border bg-card shadow-lg">
        <div className="border-b border-border p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Task Schedule Item</div>
          <h2 className="mt-2 font-display text-2xl font-semibold">{draft.id ? `Edit ${draft.title || "Schedule Item"}` : "New Schedule Item"}</h2>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-5">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => onChange({ ...draft, status: "complete", progress: 100 })}>Mark complete</Button>
            <Select className="w-44" value={draft.status} onChange={event => update("status", event.target.value as ScheduleStatus)}>
              {["pending", "scheduled", "in_progress", "waiting", "delayed", "blocked", "needs_approval", "complete", "canceled"].map(status => (
                <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
              ))}
            </Select>
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={draft.notify} onChange={event => update("notify", event.target.checked)} />
              Notify participants
            </label>
            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <input type="checkbox" checked={draft.client_visible} onChange={event => update("client_visible", event.target.checked)} />
              Client visible
            </label>
          </div>
          <label className="block text-sm font-medium">
            Title
            <Input className="mt-1" value={draft.title} onChange={event => update("title", event.target.value)} />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Project
              <Input className="mt-1" value={draft.project_title} onChange={event => update("project_title", event.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              Assignee / Vendor
              <Input className="mt-1" value={draft.assignee} onChange={event => update("assignee", event.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Phase
              <Input className="mt-1" value={draft.phase} onChange={event => update("phase", event.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              Client
              <Input className="mt-1" value={draft.client} onChange={event => update("client", event.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Dependency Notes
              <Input className="mt-1" value={draft.dependencies} onChange={event => update("dependencies", event.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              Priority
              <Select className="mt-1" value={draft.priority} onChange={event => update("priority", event.target.value as SchedulePriority)}>
                {["low", "normal", "high", "urgent", "critical", "blocking_closeout"].map(priority => (
                  <option key={priority} value={priority}>{priority.replaceAll("_", " ")}</option>
                ))}
              </Select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block text-sm font-medium">
              Start
              <Input className="mt-1" type="date" value={draft.start_date} onChange={event => update("start_date", event.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              End
              <Input className="mt-1" type="date" value={draft.end_date} onChange={event => update("end_date", event.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              Duration Days
              <Input
                className="mt-1"
                type="number"
                min={0.25}
                step={0.125}
                value={Math.round((draft.duration_minutes / 1440) * 100) / 100}
                onChange={event => update("duration_minutes", Math.max(15, Number(event.target.value || 1) * 1440))}
              />
            </label>
            <label className="block text-sm font-medium">
              Progress
              <Input className="mt-1" type="number" min={0} max={100} value={draft.progress} onChange={event => update("progress", Number(event.target.value))} />
            </label>
          </div>
          <div className="rounded-md border border-border bg-muted p-4 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Duration examples</div>
            <div className="mt-1">0.125 = 1 hour, 0.25 = 2 hours, 0.5 = half day. Drag either bar edge to adjust this live.</div>
          </div>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Participants</div>
            <Select value="" onChange={event => event.target.value && toggleParticipant(event.target.value)}>
              <option value="">Select staff, client, vendor, or subcontractor</option>
              {participantOptions.map(participant => <option key={participant} value={participant}>{participant}</option>)}
            </Select>
            <div className="flex flex-wrap gap-2">
              {selectedParticipants.map(participant => (
                <button key={participant} type="button" className="rounded-full border border-border bg-muted px-3 py-1 text-xs" onClick={() => toggleParticipant(participant)}>
                  {participant} x
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-muted p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Task Dependencies</div>
            <p className="mt-2 text-sm text-muted-foreground">Connect predecessor steps so the Gantt chart can show visual Buildertrend-style schedule links.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_120px_110px]">
              <Select value={dependencySource} onChange={event => setDependencySource(event.target.value)}>
                <option value="">Select schedule item</option>
                {availableDependencyItems.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </Select>
              <Select value={dependencyType} onChange={event => setDependencyType(event.target.value as DependencyType)}>
                <option value="finish_to_start">Finish to Start</option>
                <option value="start_to_start">Start to Start</option>
                <option value="finish_to_finish">Finish to Finish</option>
                <option value="start_to_finish">Start to Finish</option>
              </Select>
              <Input type="number" min={0} value={lagDays} onChange={event => setLagDays(Number(event.target.value || 0))} />
              <Button variant="outline" disabled={!draft.id || !dependencySource} onClick={addDependency}>Add Link</Button>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={autoShift} onChange={event => setAutoShift(event.target.checked)} />
              Auto-shift dependent work later
            </label>
            <div className="mt-4 space-y-2">
              {dependencyRows.map(dep => {
                const source = items.find(item => item.id === dep.source_item_id);
                return (
                  <div key={dep.id} className="flex items-center justify-between rounded-md bg-card px-3 py-3 text-sm">
                    <div>
                      <div className="font-medium">{source?.title || "Schedule item"}</div>
                      <div className="text-xs text-muted-foreground">{dep.dependency_type.replaceAll("_", " ")} - {dep.auto_shift ? "auto-shift" : "manual"}{dep.lag_days ? ` - ${dep.lag_days} lag days` : ""}</div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDeleteDependency(dep)}>Remove</Button>
                  </div>
                );
              })}
            </div>
          </section>

          <label className="block text-sm font-medium">
            Description
            <Textarea className="mt-1" value={draft.description} onChange={event => update("description", event.target.value)} />
          </label>
          <label className="inline-flex h-12 items-center gap-2 rounded-md border border-border px-3 text-sm">
            <input type="checkbox" checked={draft.is_blocked} onChange={event => update("is_blocked", event.target.checked)} />
            Mark as blocked
          </label>
          {draft.is_blocked ? (
            <label className="block text-sm font-medium">
              Blocker reason
              <Input className="mt-1" value={draft.blocker_reason} onChange={event => update("blocker_reason", event.target.value)} />
            </label>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium">
              Forms / Documents
              <Textarea className="mt-1" value={draft.forms} onChange={event => update("forms", event.target.value)} placeholder="Permit, inspection form, uploaded drawings..." />
            </label>
            <label className="block text-sm font-medium">
              Punch Lists / Confirmations
              <Textarea className="mt-1" value={draft.punch} onChange={event => update("punch", event.target.value)} placeholder="Subcontractor confirmation, site photos, punch list..." />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Internal Notes <span className="font-normal text-muted-foreground">not visible to client</span>
            <Textarea className="mt-1" value={draft.internal_notes} onChange={event => update("internal_notes", event.target.value)} placeholder="Internal schedule notes, cost-sensitive context, private delay notes..." />
          </label>
          <div className="rounded-lg border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Upload project photos or videos for this schedule item</div>
            <div className="mt-1">Media attachments will connect in the storage phase.</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="accent" disabled={saving} onClick={() => onSave(draft)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function itemToDraft(item: ProjectScheduleItem): ItemDraft {
  return {
    id: item.id,
    title: item.title,
    project_title: item.project_title || item.schedule_group_key || "Project Manager",
    phase: item.phase || "Project Tasks",
    assignee: item.assignee || "",
    participants: item.participants || "",
    start_date: item.start_date,
    end_date: item.end_date,
    status: item.status || "scheduled",
    priority: item.priority || "normal",
    progress: item.progress || 0,
    duration_minutes: item.duration_minutes || Math.max(1, daysBetween(item.start_date, item.end_date) + 1) * 1440,
    notify: Boolean(item.notify),
    client_visible: Boolean(item.client_visible),
    visible_on_gantt: item.visible_on_gantt !== false,
    client: item.client || "",
    dependencies: item.dependencies || "",
    description: item.description || "",
    forms: item.forms || "",
    punch: item.punch || "",
    internal_notes: item.internal_notes || "",
    is_blocked: Boolean(item.is_blocked),
    blocker_reason: item.blocker_reason || ""
  };
}

function draftToDemoItem(draft: ItemDraft): ProjectScheduleItem {
  return {
    id: draft.id || crypto.randomUUID(),
    board_id: boardId,
    project_id: null,
    client_project_id: null,
    type: draft.id ? "task" : "task",
    project_title: draft.project_title,
    title: draft.title || "Untitled schedule item",
    phase: draft.phase,
    assignee: draft.assignee || null,
    client: draft.client || null,
    participants: draft.participants || null,
    dependencies: draft.dependencies || null,
    start_date: draft.start_date,
    end_date: draft.end_date,
    status: draft.status,
    priority: draft.priority,
    progress: draft.progress,
    notify: draft.notify,
    description: draft.description || null,
    forms: draft.forms || null,
    punch: draft.punch || null,
    client_visible: draft.client_visible,
    internal_notes: draft.internal_notes || null,
    is_blocked: draft.is_blocked || draft.status === "blocked",
    blocker_reason: draft.blocker_reason || null,
    sort_order: 0,
    visible_on_gantt: draft.visible_on_gantt,
    schedule_group_key: draft.project_title,
    template_slug: null,
    template_name: null,
    duration_minutes: draft.duration_minutes,
    metadata: {}
  };
}
