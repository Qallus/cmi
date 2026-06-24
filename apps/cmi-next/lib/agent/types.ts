// Types for Bolt — the CMI dashboard AI agent and its tool/skill system.

export type StaffContext = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
};

export type FieldType = "string" | "text" | "number" | "boolean" | "date" | "enum" | "json" | "string[]";

export type AgentField = {
  name: string;
  type: FieldType;
  desc: string;
  required?: boolean;
  enumValues?: string[];
  readonly?: boolean;
};

export type AgentEntity = {
  key: string;            // stable identifier the agent uses, e.g. "contact"
  label: string;          // human label, e.g. "Contact"
  plural: string;         // e.g. "contacts"
  table: string;          // Supabase table
  description: string;    // one-line purpose
  idColumn: string;       // default "id"
  customIdPrefix?: string; // e.g. documents use "DOC-"
  slugFrom?: string;      // field to derive slug from (e.g. "title")
  hasUpdatedAt?: boolean; // set updated_at on writes
  searchColumns?: string[]; // text columns for keyword search
  orderBy?: { column: string; ascending: boolean };
  writeRoles: string[];   // roles allowed to create/update
  deleteRoles?: string[]; // roles allowed to delete (defaults to writeRoles)
  fields: AgentField[];
};

// The result of a tool call the loop feeds back to the model.
export type ToolResult = Record<string, unknown>;

// A staged action that must be confirmed by the staff member before it runs.
export type PendingAction = {
  id: string;
  kind: "delete" | "send";
  summary: string;
  // For delete:
  entity?: string;
  recordId?: string;
  // For send:
  channel?: "email" | "sms";
  to?: string;
  subject?: string;
  body?: string;
  contactId?: string | null;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls?: any[];
};

export type ToolActivity = {
  tool: string;
  summary: string;
  ok: boolean;
};
