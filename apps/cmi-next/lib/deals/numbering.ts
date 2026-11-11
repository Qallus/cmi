// Pipeline numbers on deal titles. A deal's title starts with its pipeline
// number the way staff write it ("26_058_Smith Residence"), and the number is
// also kept on its own in deals.job_number. Pure (no I/O).

/** A pipeline number: two-digit year, underscore, three digits (26_058). */
export const PIPELINE_NUMBER = /^\d{2}_\d{3}$/;

// A leading number plus whatever separator follows it ("26_058_", "26_058 - ").
const LEADING_NUMBER = /^\s*\d{2}_\d{3}[\s_\-–—]*/;

export function isPipelineNumber(value: string): boolean {
  return PIPELINE_NUMBER.test(value.trim());
}

/** The title without its leading pipeline number: "26_058_Smith Residence" → "Smith Residence". */
export function nameFromTitle(title: string | null | undefined): string {
  return (title ?? "").replace(LEADING_NUMBER, "").trim();
}

/** Number and name back into a title, in the staff format: "26_058_Smith Residence". */
export function titleFor(number: string, name: string): string {
  return `${number.trim()}_${nameFromTitle(name)}`;
}
