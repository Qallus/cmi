"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PROJECTION_STATUS_META, type ProjectionDetail, type ProjectionRow } from "@/lib/projections/types";
import { ProjectionActions } from "../projection-actions";
import { ProjectionDetailBody } from "../projection-detail-body";
import { LinkChips } from "../projection-quick-view";

// The complete projection on its own page: header, Quick Features, and the
// full editor (forecast, team, billing, months, history).
export function ProjectionFullView({ initialRow, isSuperAdmin }: { initialRow: ProjectionRow; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [row, setRow] = React.useState(initialRow);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const changed = React.useCallback(async () => {
    setRefreshKey((k) => k + 1);
    const res = await fetch(`/api/projections/${initialRow.id}`);
    if (res.ok) setRow(((await res.json()) as ProjectionDetail).row);
  }, [initialRow.id]);

  const status = PROJECTION_STATUS_META[row.status];
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col">
      <div className="border-b border-border bg-card px-4 py-4 md:px-6">
        <Link href="/dashboard/projections" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Projections</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Projection</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{row.name}</h1>
              <Badge tone={status.tone}>{status.label}</Badge>
              {!row.include && <Badge>Excluded from totals</Badge>}
            </div>
            <LinkChips row={row} />
          </div>
        </div>
        <div className="mt-3">
          <ProjectionActions row={row} variant="bar" isSuperAdmin={isSuperAdmin}
            onChanged={() => void changed()} onRemoved={() => router.push("/dashboard/projections")}
            onOpen={(id) => router.push(`/dashboard/projections/${id}`)}
            onEdit={() => document.getElementById("projection-editor")?.scrollIntoView({ behavior: "smooth" })} />
        </div>
      </div>
      <div id="projection-editor" className="mx-auto flex w-full max-w-6xl flex-1 flex-col md:px-2">
        <ProjectionDetailBody id={row.id} onChanged={() => void changed()} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
