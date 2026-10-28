import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProjectCanvasVisibility } from "@/components/dashboard/project-canvas-visibility";
import { ExtensionAccessPanel } from "@/components/dashboard/extension-access-panel";
import { FabVisibility } from "@/components/dashboard/fab-visibility";
import { NavVisibilityPanel } from "@/components/dashboard/nav-visibility-panel";
import { ClaudeAccessPanel } from "@/components/dashboard/claude-access-panel";
import { getSessionStaff } from "@/lib/auth/server-session";
import { SettingsTabs } from "./settings-tabs";

export const metadata = { title: "Settings — CMI Dashboard" };

/** One environment variable: whether it's set, and its value unless secret. */
function EnvRow({ label, envKey, masked }: { label: string; envKey: string; masked?: boolean }) {
  const value = process.env[envKey];
  const isSet = Boolean(value);
  const display = isSet ? (masked ? "••••••••••••" : value) : "Not configured";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <code className="text-xs text-muted-foreground">{envKey}</code>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-xs text-muted-foreground">{display}</span>
        <Badge tone={isSet ? "success" : "danger"}>{isSet ? "Set" : "Missing"}</Badge>
      </div>
    </div>
  );
}

function CredentialCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle>{title}</CardTitle>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent className="divide-y divide-border pt-0">{children}</CardContent>
    </Card>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [staff, { tab }] = await Promise.all([getSessionStaff(), searchParams]);

  const general = (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="pt-0"><FabVisibility /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Feature Flags</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <Link href="/dashboard/settings/features" className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3 text-sm hover:bg-muted">
            <span>
              <span className="block font-medium">Turn features on or off</span>
              <span className="block text-xs text-muted-foreground">Projections, Take-Off, Project Canvas and other staged features.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Project Canvas Visibility</CardTitle></CardHeader>
        <CardContent className="pt-0"><ProjectCanvasVisibility /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Extension Access</CardTitle></CardHeader>
        <CardContent className="pt-0"><ExtensionAccessPanel /></CardContent>
      </Card>
    </div>
  );

  const claude = (
    <div className="max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>Claude &amp; AI Access</CardTitle>
          <p className="text-xs text-muted-foreground">
            Who can use Claude with CMI data, who has the company-wide view, and who may receive AI-generated email, SMS, DMs and notifications.
          </p>
        </CardHeader>
        <CardContent className="pt-0"><ClaudeAccessPanel /></CardContent>
      </Card>
    </div>
  );

  const sidebar = (
    <div className="max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Sidebar Navigation</CardTitle></CardHeader>
        <CardContent className="pt-0"><NavVisibilityPanel canEdit={staff?.role_slug === "super_admin"} /></CardContent>
      </Card>
    </div>
  );

  // Values come from the server's environment (Coolify). Secrets show as dots;
  // nothing here can change them, so a redeploy is needed after an edit.
  const credentials = (
    <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
      <CredentialCard title="Supabase">
        <EnvRow label="Supabase URL" envKey="SUPABASE_URL" />
        <EnvRow label="Anon (public) key" envKey="SUPABASE_ANON_KEY" masked />
        <EnvRow label="Service Role Key" envKey="SUPABASE_SERVICE_ROLE_KEY" masked />
      </CredentialCard>

      <CredentialCard title="Hermes Agent" note="The AI gateway behind Bolt and the morning briefing summary.">
        <EnvRow label="Gateway URL" envKey="HERMES_AGENT_URL" />
        <EnvRow label="API Key" envKey="HERMES_AGENT_API_KEY" masked />
        <EnvRow label="Model" envKey="HERMES_AGENT_MODEL" />
      </CredentialCard>

      <CredentialCard title="Email (SMTP)" note="Not used by the dashboard today; all email goes out through Resend.">
        <EnvRow label="SMTP Host" envKey="SMTP_HOST" />
        <EnvRow label="SMTP Port" envKey="SMTP_PORT" />
        <EnvRow label="SMTP User" envKey="SMTP_USER" />
        <EnvRow label="SMTP Password" envKey="SMTP_PASSWORD" masked />
        <EnvRow label="From Address" envKey="EMAIL_FROM" />
      </CredentialCard>

      <CredentialCard title="Resend" note="Sends every dashboard email: invites, notifications, briefings.">
        <EnvRow label="API Key" envKey="RESEND_API_KEY" masked />
        <EnvRow label="From Address" envKey="RESEND_FROM_EMAIL" />
        <EnvRow label="Reply-To" envKey="RESEND_REPLY_TO" />
      </CredentialCard>

      <CredentialCard title="OpenAI" note="Transcribes voice notes and meeting recordings.">
        <EnvRow label="API Key" envKey="OPENAI_API_KEY" masked />
      </CredentialCard>

      <CredentialCard title="Google Workspace" note="Read-only Gmail, Drive, Sheets and Calendar for the Claude connector (domain-wide delegation). Setup: docs/ai-os/google-dwd-setup.md.">
        <EnvRow label="Service account key (JSON)" envKey="GOOGLE_SERVICE_ACCOUNT_JSON" masked />
        <EnvRow label="Workspace domain" envKey="GOOGLE_WORKSPACE_DOMAIN" />
      </CredentialCard>

      <CredentialCard title="Cloudflare Turnstile" note="Spam protection on the Contact page and trade partner forms. Optional; without it, honeypot and timing checks still run.">
        <EnvRow label="Site key" envKey="TURNSTILE_SITE_KEY" />
        <EnvRow label="Secret key" envKey="TURNSTILE_SECRET_KEY" masked />
      </CredentialCard>

      <CredentialCard title="Claude (Anthropic API)" note="Reads uploaded certificates of insurance, W-9s and licenses for Trade Partners and checks them against our minimums. Optional; without it, documents are simply not read.">
        <EnvRow label="API key" envKey="ANTHROPIC_API_KEY" masked />
        <EnvRow label="Compliance reminder CC" envKey="TRADE_PARTNER_COMPLIANCE_CC" />
      </CredentialCard>

      <CredentialCard title="Twilio (SMS & Voice)">
        <EnvRow label="Account SID" envKey="TWILIO_ACCOUNT_SID" />
        <EnvRow label="Auth Token" envKey="TWILIO_AUTH_TOKEN" masked />
        <EnvRow label="Phone Number" envKey="TWILIO_PHONE_NUMBER" />
        <EnvRow label="Voice API Key SID" envKey="TWILIO_API_KEY_SID" />
        <EnvRow label="Voice API Key Secret" envKey="TWILIO_API_KEY_SECRET" masked />
        <EnvRow label="TwiML App SID" envKey="TWILIO_TWIML_APP_SID" />
      </CredentialCard>

      <CredentialCard title="App">
        <EnvRow label="App URL" envKey="NEXT_PUBLIC_APP_URL" />
      </CredentialCard>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Configuration</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Credentials are managed in Coolify. Redeploy after changing them.</p>
      </div>
      <SettingsTabs initialTab={tab} panels={{ general, claude, sidebar, credentials }} />
    </div>
  );
}
