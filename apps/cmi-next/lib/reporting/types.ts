// Shapes for the weekly workload meeting report.

export type ReportStatus = "draft" | "final";
export type RecordType = "job" | "deal" | "opportunity" | "projection";

export { DEFAULT_SECTIONS } from "./parse";
import { DEFAULT_SECTIONS } from "./parse";

export type SectionKey = (typeof DEFAULT_SECTIONS)[number]["key"];

export type ReportActionItem = {
  id: string;
  report_item_id: string;
  body: string;
  owner_staff_id: string | null;
  owner_label: string | null;
  due_date: string | null;
  completed_at: string | null;
  carried_from_id: string | null;
  sort_order: number;
};

export type ReportItem = {
  id: string;
  report_id: string;
  section_id: string;
  sort_order: number;
  record_type: RecordType | null;
  record_id: string | null;
  job_number: string | null;
  title: string;
  status_text: string | null;
  scope: string | null;
  design_partner: string | null;
  value_note: string | null;
  original_completion: string | null;
  current_completion: string | null;
  warranty_date: string | null;
  financial_note: string | null;
  latest_update: string | null;
  procurement_note: string | null;
  notes: string | null;
  action_items: ReportActionItem[];
};

export type ReportSection = {
  id: string;
  report_id: string;
  key: string;
  title: string;
  sort_order: number;
  items: ReportItem[];
};

export type MeetingReport = {
  id: string;
  title: string;
  meeting_date: string;
  status: ReportStatus;
  compare_since: string | null;
  previous_report_id: string | null;
  notes: string | null;
  finalized_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportDetail = MeetingReport & { sections: ReportSection[] };

export type ReportSummary = MeetingReport & {
  item_count: number;
  open_action_count: number;
};

/** One row of the "what changed since" report. */
export type ChangeRow = {
  id: string;
  table_name: string;
  record_id: string;
  record_label: string | null;
  op: "insert" | "update" | "delete";
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
};

/** Grouped for display: one record, everything that happened to it. */
export type ChangeGroup = {
  table_name: string;
  record_id: string;
  record_label: string;
  href: string | null;
  changes: ChangeRow[];
  notes_added: number;
};

/** An open action item anywhere in the reports, for the by-person view. */
export type OpenActionItem = ReportActionItem & {
  report_id: string;
  report_title: string;
  meeting_date: string;
  item_title: string;
  job_number: string | null;
  owner_name: string | null;
  overdue: boolean;
};
