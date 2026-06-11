"use client";

import * as React from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Loader2,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "user" | "assistant" | "system";
type Message = { role: Role; content: string; id: string };

type TaskContext = {
  id: string;
  label: string;
  description: string;
  system: string;
  starters: string[];
};

const TASK_CONTEXTS: TaskContext[] = [
  {
    id: "general",
    label: "General Assistant",
    description: "Ask anything about the CMI project or codebase.",
    system:
      "You are Hermes, a senior full-stack developer assistant embedded in the Constructed Matter, Inc. staff dashboard. The project is a Next.js 16 + Supabase app at apps/cmi-next, alongside a legacy HTML/JS dashboard at staff-dashboard.html. Answer questions precisely, suggest code improvements, and help debug issues.",
    starters: [
      "What does the project-manager-client.tsx Gantt view do?",
      "How are Supabase API routes structured in this app?",
      "Summarize the current dashboard navigation sections.",
      "What integrations does this project use?",
    ],
  },
  {
    id: "project-manager",
    label: "Project Manager",
    description: "Help with Gantt, schedule items, templates, and tasks.",
    system:
      "You are Hermes, focused on the Project Manager / Gantt feature of the CMI Next.js dashboard. The main file is apps/cmi-next/app/dashboard/project-manager/project-manager-client.tsx. Schedule items are stored in Supabase as project_schedule_items. Templates come from project_templates and project_template_tasks. Help debug, improve, and extend the Gantt feature.",
    starters: [
      "How does the FAB dock trigger on bar click?",
      "Explain the drag-to-reschedule suppress pattern.",
      "How do project templates get applied to the schedule?",
      "What Supabase tables power the Gantt timeline?",
    ],
  },
  {
    id: "supabase",
    label: "Supabase & Data",
    description: "Schema, RLS policies, API routes, and migrations.",
    system:
      "You are Hermes, focused on the Supabase data layer for the CMI project. Key tables: project_schedule_items, project_schedule_dependencies, project_templates, portfolio_items, appointments, selections, users. API routes live in apps/cmi-next/app/api/. RLS and schema migrations are in supabase/. Help with queries, RLS policies, and migration design.",
    starters: [
      "What RLS policies should protect project_schedule_items?",
      "How do I add a new field to project_schedule_items safely?",
      "Write a migration to add a notes column to project_schedule_items.",
      "Explain the relationship between schedule items and dependencies.",
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio & WordPress",
    description: "Portfolio CRUD, WordPress CPT sync, and media.",
    system:
      "You are Hermes, focused on the Portfolio section of the CMI dashboard. Portfolio items are stored in Supabase (portfolio_items) and sync to WordPress as a custom post type. The dashboard page is apps/cmi-next/app/dashboard/portfolio/. Help with CRUD, WordPress API sync, media uploads, and public portfolio pages.",
    starters: [
      "How does a portfolio item sync to WordPress?",
      "What fields does a portfolio_items row have?",
      "How do I add a video_url field to portfolio items?",
      "What's the public portfolio page URL structure?",
    ],
  },
  {
    id: "debug",
    label: "Debug & Review",
    description: "Paste an error or code snippet for review.",
    system:
      "You are Hermes, acting as a code reviewer and debugger for the CMI Next.js dashboard. The stack is Next.js 16, React 19, TypeScript (strict), Tailwind CSS, and Supabase JS. When reviewing code or errors, be precise: identify the root cause, suggest the minimal fix, and flag any security or type issues.",
    starters: [
      "Here's a TypeScript error I'm seeing:",
      "Review this API route for security issues:",
      "Why is this Supabase query returning null?",
      "Check this component for performance issues:",
    ],
  },
];

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text);
}

function formatTranscript(messages: Message[]) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
    .join("\n\n---\n\n");
}

export function AgentClient({ configured }: { configured: boolean }) {
  const [taskId, setTaskId] = React.useState("general");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const task = TASK_CONTEXTS.find((t) => t.id === taskId) ?? TASK_CONTEXTS[0];

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function resetConversation(newTaskId?: string) {
    setMessages([]);
    setError(null);
    setInput("");
    if (newTaskId) setTaskId(newTaskId);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setError(null);

    const userMsg: Message = { role: "user", content: trimmed, id: crypto.randomUUID() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    const apiMessages = [
      { role: "system" as Role, content: task.system },
      ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const json = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: string;
      };
      if (!res.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const content = json.choices?.[0]?.message?.content ?? "(no response)";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content, id: crypto.randomUUID() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  const handleCopy = () => {
    copyToClipboard(formatTranscript(messages));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col p-4 md:p-6">
      <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Bolt AI Agent
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
            Agent Chat
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions, debug code, and get help with the CMI codebase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-52"
            value={taskId}
            onChange={(e) => resetConversation(e.target.value)}
          >
            {TASK_CONTEXTS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          {messages.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : (
                  <ClipboardCopy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy transcript"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => resetConversation()}>
                Clear
              </Button>
            </>
          )}
        </div>
      </header>

      {!configured && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <strong>Hermes not connected.</strong> Add{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">HERMES_AGENT_URL</code> and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">HERMES_AGENT_API_KEY</code> to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> and restart the
          dev server.
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-3">
        <div className="overflow-y-auto rounded-lg border border-border bg-card">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
                <Sparkles className="h-6 w-6 text-accent" />
              </div>
              <div>
                <div className="font-semibold">{task.label}</div>
                <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
              </div>
              <div className="grid w-full max-w-lg gap-2 md:grid-cols-2">
                {task.starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left text-xs text-muted-foreground transition hover:border-accent hover:bg-accent/5 hover:text-foreground"
                    onClick={() => void send(starter)}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-0 divide-y divide-border">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 px-4 py-4",
                    msg.role === "assistant" && "bg-muted/30"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      msg.role === "user"
                        ? "bg-accent text-accent-foreground"
                        : "border border-border bg-card text-muted-foreground"
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {msg.role === "user" ? "You" : "Hermes"}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 bg-muted/30 px-4 py-4">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Thinking…
                  </div>
                </div>
              )}
              {error && (
                <div className="px-4 py-3 text-sm text-destructive">{error}</div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            className="flex-1 resize-none"
            rows={3}
            placeholder={`Ask ${task.label}… (Enter to send, Shift+Enter for new line)`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <Button
            variant="accent"
            className="h-auto self-stretch px-4"
            disabled={loading || !input.trim()}
            onClick={() => void send(input)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
