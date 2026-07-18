// Project Canvas is exposed on TWO surfaces (client portal + staff dashboard),
// so its API routes accept EITHER a staff session (cmi-session) or a client
// session (cmi-client-session) and resolve a unified actor. Authorization on the
// resolved actor happens in the data layer.
import { requireAdmin } from "@/lib/auth/require-admin";
import { requireClient } from "@/lib/client-portal/auth";
import { isFeatureEnabled } from "@/lib/flags";
import { FEATURE_PROJECT_CANVAS } from "./types";

export type CanvasActor =
  | { kind: "staff"; staffId: string; role: string }
  | { kind: "client"; contactId: string };

export async function resolveCanvasActor(request: Request): Promise<CanvasActor | null> {
  try {
    const { staff } = await requireAdmin(request);
    return { kind: "staff", staffId: staff.id, role: staff.role_slug };
  } catch { /* not a staff session */ }
  try {
    const { contact } = await requireClient(request);
    return { kind: "client", contactId: contact.id };
  } catch { /* not a client session */ }
  return null;
}

export function canvasEnabled(): Promise<boolean> {
  return isFeatureEnabled(FEATURE_PROJECT_CANVAS);
}
