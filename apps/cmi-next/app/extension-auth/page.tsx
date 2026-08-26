import { cookies } from "next/headers";
import { getSessionStaff } from "@/lib/auth/server-session";
import { ExtensionAuthHandoff } from "@/components/extension/auth-handoff";

export const metadata = { title: "Connect Extension — CMI" };
export const dynamic = "force-dynamic";

// Token handoff surface. The extension opens this page in a tab; we read the
// authenticated Supabase access token from the session cookie (HttpOnly, so this
// must happen server-side) and hand it to the client component, which posts it
// to the extension via chrome.runtime.sendMessage (externally_connectable).
export default async function ExtensionAuthPage() {
  const store = await cookies();
  const token = store.get("cmi-session")?.value ?? null;
  const staff = token ? await getSessionStaff() : null;
  // Read the runtime (non-public) var first — NEXT_PUBLIC_* is inlined at build
  // time, and this app only passes NEXT_PUBLIC_APP_URL as a build arg, so the
  // public copy can be empty in production. CMI_EXTENSION_ID is always available
  // server-side at runtime.
  const extensionId =
    process.env.CMI_EXTENSION_ID ?? process.env.NEXT_PUBLIC_CMI_EXTENSION_ID ?? "";

  return (
    <ExtensionAuthHandoff
      token={staff ? token : null}
      staffName={staff?.display_name ?? staff?.email ?? null}
      extensionId={extensionId}
    />
  );
}
