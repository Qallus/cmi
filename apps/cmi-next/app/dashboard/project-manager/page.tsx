import { AlertTriangle } from "lucide-react";
import { loadProjectManagerData } from "@/lib/project-manager/data";
import { getDemoProjectManagerData } from "@/lib/project-manager/demo-data";
import { ProjectManagerClient } from "./project-manager-client";

export const dynamic = "force-dynamic";

export default async function ProjectManagerPage() {
  try {
    const data = await loadProjectManagerData("default");
    return <ProjectManagerClient initialData={data} />;
  } catch (error) {
    return (
      <>
        <div className="px-4 pt-4 md:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div>
              <div className="font-semibold">Demo mode</div>
              <div className="text-muted-foreground">
                Supabase server credentials are not configured, so this screen is using sample Project Manager data. Add
                <code className="mx-1 rounded bg-muted px-1">apps/cmi-next/.env.local</code>
                when you want live data.
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {error instanceof Error ? error.message : "Unknown configuration error"}
              </div>
            </div>
          </div>
        </div>
        <ProjectManagerClient initialData={getDemoProjectManagerData()} demoMode />
      </>
    );
  }
}
