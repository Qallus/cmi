// Compatibility alias for the ported Workspace module (MJG used this path/name).
// CMI's canonical server client lives in ./server as getSupabaseAdmin().
export { getSupabaseAdmin as createSupabaseAdminClient } from "./server";
