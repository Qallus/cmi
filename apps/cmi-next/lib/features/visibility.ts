// Same visibility rule as the sidebar: no roles means everyone; a flag must be
// on. Pure (unit-tested).
export type FeatureRule = { roles?: string[]; flag?: string };

export function featureVisible(f: FeatureRule, role: string | null | undefined, flags: Record<string, boolean>): boolean {
  if (f.roles && !f.roles.includes(role ?? "")) return false;
  if (f.flag && flags[f.flag] !== true) return false;
  return true;
}
