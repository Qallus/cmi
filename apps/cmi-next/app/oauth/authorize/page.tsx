// OAuth consent for the CMI MCP server: "Claude wants to connect to CMI as you".
// Outside the middleware matcher, so it authenticates itself.
//
// Arriving from claude.ai is a cross-site navigation, so the SameSite=strict
// session cookie isn't sent on the first load. <SessionBounce> reloads the page
// once from our own origin (now same-site, cookie included); only if there's
// still no session do we send the person to /login.
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { getSessionStaff } from "@/lib/auth/server-session";
import { mcpAccessFor } from "@/lib/mcp/auth";
import { checkAuthorizeParams, redirectWith, type AuthorizeParams } from "@/lib/mcp/authorize";
import { SessionBounce } from "./session-bounce";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connect Claude — CMI" };

type Search = AuthorizeParams & { _b?: string };

function Message({ title, body }: { title: string; body: string }) {
  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </AuthLayout>
  );
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Search> }) {
  const { _b, ...params } = await searchParams;
  const check = await checkAuthorizeParams(params);
  if (!check.ok) {
    if (check.redirectable) redirect(redirectWith(check.redirectUri, { error: check.error, error_description: check.message, state: check.state }));
    return <Message title="Can't connect" body={check.message} />;
  }
  const { req } = check;

  const staff = await getSessionStaff();
  if (!staff) {
    if (_b !== "1") return <SessionBounce />;
    const back = `/oauth/authorize?${new URLSearchParams(params as Record<string, string>)}`;
    redirect(`/login?redirectTo=${encodeURIComponent(back)}`);
  }

  const access = await mcpAccessFor({ id: staff.id, role_slug: staff.role_slug });
  if (!access.allowed) return <Message title="Claude access isn't on for you" body={access.reason} />;

  const hidden = { ...params, client_id: req.clientId, redirect_uri: req.redirectUri };
  return (
    <AuthLayout>
      <div className="flex items-center gap-2 text-accent"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-medium uppercase tracking-[0.18em]">Connect an AI app</span></div>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Allow {req.clientName} to use CMI?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;re signed in as <span className="font-medium text-foreground">{staff.display_name || staff.email}</span>.
      </p>
      <ul className="mt-5 space-y-2 text-sm">
        {[
          "Read jobs, the pipeline, daily logs, meetings, files and other dashboard records you can already see",
          "Read your own tasks, meetings and the CMI knowledge base",
          access.companyWide ? "Company-wide view (you're on the ownership list)" : null,
          "It can't send messages, delete anything or see money unless your role already can",
        ].filter(Boolean).map((line) => (
          <li key={line} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{line}</li>
        ))}
      </ul>
      <form method="post" action="/api/oauth/authorize" className="mt-6 flex gap-2">
        {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={String(v)} /> : null))}
        <button type="submit" name="decision" value="allow" className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90">Allow</button>
        <button type="submit" name="decision" value="deny" className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">Cancel</button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">Every request Claude makes is logged. A Super Admin can switch off access at any time in Settings → Claude.</p>
    </AuthLayout>
  );
}
