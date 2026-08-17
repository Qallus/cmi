import type { EmailBlock } from "@/components/email-builder/types";
import type { PageSizeKey, Orientation } from "./page-sizes";

export interface PrintDoc {
  id: string;
  name: string;
  page_size: PageSizeKey;
  orientation: Orientation;
  width_in: number | null;
  height_in: number | null;
  blocks: EmailBlock[];
  html: string;
  status: "draft" | "active";
  created_at: string;
  updated_at: string;
}

export type PrintListItem = Pick<PrintDoc, "id" | "name" | "page_size" | "orientation" | "status" | "created_at" | "updated_at">;
