// Pins (one home per project, Step 2): show a project on another board too.
// Pure rules, so the boards and the tests agree.
import type { Area } from "./home.ts";

export type PinRecordType = "deal" | "precon" | "job";
export const RECORD_AREA: Record<PinRecordType, Area> = { deal: "pipeline", precon: "precon", job: "jobs" };

export type PinRow = { id: string; record_type: PinRecordType; record_id: string; show_in: Area; expires_at?: string | null };

/**
 * A pin shows only while its record is the project's home (a deal not yet won,
 * a Pre-Con record without a live Job, a live Job) and the board it's pinned to
 * isn't that home. Expired pins (reserved option) don't show.
 */
export function pinIsShown(pin: PinRow, recordIsHome: boolean, now = new Date().toISOString()): boolean {
  if (!recordIsHome) return false;
  if (RECORD_AREA[pin.record_type] === pin.show_in) return false;
  if (pin.expires_at && pin.expires_at <= now) return false;
  return true;
}

/** The two boards a record can be pinned to (not its own). */
export function otherAreas(recordType: PinRecordType): Area[] {
  return (["pipeline", "precon", "jobs"] as Area[]).filter((a) => a !== RECORD_AREA[recordType]);
}
