import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { FeatureFlag } from "@/lib/flags";
import { FeatureFlagsPanel } from "./feature-flags-panel";

export const metadata = { title: "Feature Flags — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  let flags: FeatureFlag[] = [];
  try {
    const { data } = await getSupabaseAdmin().from("feature_flags").select("*").order("key");
    flags = (data ?? []) as FeatureFlag[];
  } catch {
    flags = [];
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <Link href="/dashboard/settings" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Configuration</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Feature Flags</h1>
        <p className="mt-1 text-sm text-muted-foreground">Turn features on or off without a redeploy. Changes take effect within ~30 seconds.</p>
      </div>

      <div className="grid max-w-2xl gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Rollout</CardTitle>
            <CardDescription>Super Admin and Admin only. Flags gate a feature&apos;s nav entry, pages, and API routes.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <FeatureFlagsPanel initial={flags} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
