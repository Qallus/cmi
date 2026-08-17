// Built-in Schedule Templates + Job Schedule Packages. Items use relative day
// offsets from the schedule's start date; dependencies reference item keys.
import type { ScheduleType, DependencyType } from "./types";

export type TemplateItem = {
  key: string;
  title: string;
  phaseKey?: string;
  kind?: "task" | "milestone";
  offset: number;      // calendar days from schedule start
  duration?: number;   // calendar days (tasks); milestones ignore this
  deps?: { on: string; type?: DependencyType }[];
};
export type ScheduleTemplate = {
  id: string;
  name: string;
  type: ScheduleType;
  description: string;
  phases: { key: string; name: string }[];
  items: TemplateItem[];
};

export const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: "construction",
    name: "Construction",
    type: "construction",
    description: "Foundation → framing → MEP → finishes → closeout.",
    phases: [
      { key: "site", name: "Sitework & Foundation" },
      { key: "frame", name: "Framing & Dry-In" },
      { key: "mep", name: "MEP Rough-In" },
      { key: "finish", name: "Finishes" },
      { key: "close", name: "Closeout" },
    ],
    items: [
      { key: "start", title: "Construction Start", kind: "milestone", phaseKey: "site", offset: 0 },
      { key: "excavate", title: "Excavation & grading", phaseKey: "site", offset: 0, duration: 5, deps: [{ on: "start" }] },
      { key: "foundation", title: "Foundation", phaseKey: "site", offset: 5, duration: 10, deps: [{ on: "excavate" }] },
      { key: "found_insp", title: "Foundation Inspection", kind: "milestone", phaseKey: "site", offset: 15, deps: [{ on: "foundation" }] },
      { key: "framing", title: "Framing", phaseKey: "frame", offset: 16, duration: 15, deps: [{ on: "found_insp" }] },
      { key: "dryin", title: "Dry-In", kind: "milestone", phaseKey: "frame", offset: 31, deps: [{ on: "framing" }] },
      { key: "rough_mep", title: "Rough electrical / plumbing / HVAC", phaseKey: "mep", offset: 32, duration: 12, deps: [{ on: "dryin" }] },
      { key: "rough_insp", title: "Rough Inspection Passed", kind: "milestone", phaseKey: "mep", offset: 44, deps: [{ on: "rough_mep" }] },
      { key: "insulation", title: "Insulation & drywall", phaseKey: "finish", offset: 45, duration: 12, deps: [{ on: "rough_insp" }] },
      { key: "finishes", title: "Interior finishes", phaseKey: "finish", offset: 57, duration: 20, deps: [{ on: "insulation" }] },
      { key: "final_insp", title: "Final Inspection", kind: "milestone", phaseKey: "close", offset: 78, deps: [{ on: "finishes" }] },
      { key: "punch", title: "Punch list", phaseKey: "close", offset: 79, duration: 7, deps: [{ on: "final_insp" }] },
      { key: "sub_complete", title: "Substantial Completion", kind: "milestone", phaseKey: "close", offset: 86, deps: [{ on: "punch" }] },
    ],
  },
  {
    id: "pre_construction",
    name: "Pre-Construction",
    type: "pre_construction",
    description: "Contract, budget, and mobilization.",
    phases: [{ key: "pc", name: "Pre-Construction" }],
    items: [
      { key: "contract", title: "Contract signed", kind: "milestone", phaseKey: "pc", offset: 0 },
      { key: "budget", title: "Finalize budget", phaseKey: "pc", offset: 0, duration: 7, deps: [{ on: "contract" }] },
      { key: "mobilize", title: "Mobilize crews & order long-lead items", phaseKey: "pc", offset: 7, duration: 10, deps: [{ on: "budget" }] },
    ],
  },
  {
    id: "design",
    name: "Design",
    type: "design",
    description: "Schematic → design development → construction docs.",
    phases: [{ key: "d", name: "Design" }],
    items: [
      { key: "kickoff", title: "Design kickoff", kind: "milestone", phaseKey: "d", offset: 0 },
      { key: "schematic", title: "Schematic design", phaseKey: "d", offset: 0, duration: 14, deps: [{ on: "kickoff" }] },
      { key: "dd", title: "Design development", phaseKey: "d", offset: 14, duration: 14, deps: [{ on: "schematic" }] },
      { key: "cd", title: "Construction documents", phaseKey: "d", offset: 28, duration: 21, deps: [{ on: "dd" }] },
    ],
  },
  {
    id: "permitting",
    name: "Permitting",
    type: "permit",
    description: "Submittal through issuance.",
    phases: [{ key: "p", name: "Permitting" }],
    items: [
      { key: "submit", title: "Submit for permit", phaseKey: "p", offset: 0, duration: 3 },
      { key: "review", title: "Municipal review", phaseKey: "p", offset: 3, duration: 30, deps: [{ on: "submit" }] },
      { key: "issued", title: "Permit Issued", kind: "milestone", phaseKey: "p", offset: 33, deps: [{ on: "review" }] },
    ],
  },
  {
    id: "procurement",
    name: "Procurement",
    type: "procurement",
    description: "Long-lead ordering and deliveries.",
    phases: [{ key: "pr", name: "Procurement" }],
    items: [
      { key: "windows", title: "Order windows & doors", phaseKey: "pr", offset: 0, duration: 3 },
      { key: "cabinets", title: "Order cabinets", phaseKey: "pr", offset: 0, duration: 3 },
      { key: "windows_del", title: "Windows delivered", kind: "milestone", phaseKey: "pr", offset: 45, deps: [{ on: "windows" }] },
      { key: "cabinets_del", title: "Cabinets delivered", kind: "milestone", phaseKey: "pr", offset: 60, deps: [{ on: "cabinets" }] },
    ],
  },
  {
    id: "selections",
    name: "Client Selections",
    type: "selections",
    description: "Client decisions that release procurement.",
    phases: [{ key: "sel", name: "Selections" }],
    items: [
      { key: "flooring", title: "Flooring selection due", phaseKey: "sel", offset: 0, duration: 1 },
      { key: "tile", title: "Tile selection due", phaseKey: "sel", offset: 7, duration: 1 },
      { key: "cabinets_sel", title: "Cabinet & countertop selection due", phaseKey: "sel", offset: 14, duration: 1 },
      { key: "fixtures", title: "Plumbing & lighting fixtures due", phaseKey: "sel", offset: 21, duration: 1 },
    ],
  },
  {
    id: "inspections",
    name: "Inspections",
    type: "inspection",
    description: "Key inspection milestones.",
    phases: [{ key: "i", name: "Inspections" }],
    items: [
      { key: "foundation", title: "Foundation inspection", kind: "milestone", phaseKey: "i", offset: 15 },
      { key: "rough", title: "Rough inspection", kind: "milestone", phaseKey: "i", offset: 44 },
      { key: "final", title: "Final inspection", kind: "milestone", phaseKey: "i", offset: 78 },
    ],
  },
  {
    id: "closeout",
    name: "Closeout",
    type: "closeout",
    description: "Punch, walkthrough, and handover.",
    phases: [{ key: "c", name: "Closeout" }],
    items: [
      { key: "punch", title: "Punch list", phaseKey: "c", offset: 0, duration: 7 },
      { key: "walk", title: "Client walkthrough", kind: "milestone", phaseKey: "c", offset: 7, deps: [{ on: "punch" }] },
      { key: "co", title: "Certificate of Occupancy", kind: "milestone", phaseKey: "c", offset: 9, deps: [{ on: "walk" }] },
      { key: "final", title: "Final Completion", kind: "milestone", phaseKey: "c", offset: 10, deps: [{ on: "co" }] },
    ],
  },
  {
    id: "warranty",
    name: "Warranty",
    type: "warranty",
    description: "Post-completion warranty checkpoints.",
    phases: [{ key: "w", name: "Warranty" }],
    items: [
      { key: "start", title: "Warranty activated", kind: "milestone", phaseKey: "w", offset: 0 },
      { key: "six", title: "6-month check-in", kind: "milestone", phaseKey: "w", offset: 180, deps: [{ on: "start" }] },
      { key: "oneyear", title: "1-year walk", kind: "milestone", phaseKey: "w", offset: 365, deps: [{ on: "start" }] },
    ],
  },
];

export function getTemplate(id: string): ScheduleTemplate | undefined {
  return SCHEDULE_TEMPLATES.find((t) => t.id === id);
}

export type SchedulePackage = { id: string; name: string; description: string; templateIds: string[] };
export const SCHEDULE_PACKAGES: SchedulePackage[] = [
  { id: "custom_home", name: "Custom Home", description: "Design, permitting, procurement, selections, construction, inspections, closeout.", templateIds: ["design", "permitting", "procurement", "selections", "construction", "inspections", "closeout"] },
  { id: "renovation", name: "Renovation", description: "Pre-con, selections, procurement, construction, closeout.", templateIds: ["pre_construction", "selections", "procurement", "construction", "closeout"] },
  { id: "adu", name: "ADU / Addition", description: "Design, permitting, construction, inspections, closeout.", templateIds: ["design", "permitting", "construction", "inspections", "closeout"] },
];
export function getPackage(id: string): SchedulePackage | undefined {
  return SCHEDULE_PACKAGES.find((p) => p.id === id);
}
