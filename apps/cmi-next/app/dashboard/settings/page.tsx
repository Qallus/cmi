import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Settings — CMI Dashboard" };

function EnvRow({ label, envKey, masked }: { label: string; envKey: string; masked?: boolean }) {
  const value = process.env[envKey];
  const isSet = Boolean(value);
  const display = isSet ? (masked ? "••••••••••••" : value) : "Not configured";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <code className="text-xs text-muted-foreground">{envKey}</code>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{display}</span>
        <Badge tone={isSet ? "success" : "danger"}>{isSet ? "Set" : "Missing"}</Badge>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Configuration</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Environment variables are managed in Coolify. Restart the service after changes.</p>
      </div>

      <div className="grid gap-4 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Supabase</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border pt-0">
            <EnvRow label="Supabase URL" envKey="SUPABASE_URL" />
            <EnvRow label="Service Role Key" envKey="SUPABASE_SERVICE_ROLE_KEY" masked />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Hermes Agent</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border pt-0">
            <EnvRow label="Gateway URL" envKey="HERMES_AGENT_URL" />
            <EnvRow label="API Key" envKey="HERMES_AGENT_API_KEY" masked />
            <EnvRow label="Model" envKey="HERMES_AGENT_MODEL" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Email (SMTP)</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border pt-0">
            <EnvRow label="SMTP Host" envKey="SMTP_HOST" />
            <EnvRow label="SMTP Port" envKey="SMTP_PORT" />
            <EnvRow label="SMTP User" envKey="SMTP_USER" />
            <EnvRow label="SMTP Password" envKey="SMTP_PASSWORD" masked />
            <EnvRow label="From Address" envKey="EMAIL_FROM" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Twilio (SMS & Voice)</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border pt-0">
            <EnvRow label="Account SID" envKey="TWILIO_ACCOUNT_SID" />
            <EnvRow label="Auth Token" envKey="TWILIO_AUTH_TOKEN" masked />
            <EnvRow label="Phone Number" envKey="TWILIO_PHONE_NUMBER" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resend</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border pt-0">
            <EnvRow label="API Key" envKey="RESEND_API_KEY" masked />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>App</CardTitle></CardHeader>
          <CardContent className="divide-y divide-border pt-0">
            <EnvRow label="App URL" envKey="NEXT_PUBLIC_APP_URL" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
