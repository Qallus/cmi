import { useEffect, useState } from "react";
import type { Destination, Job, SelectionGroup } from "../../types";
import { api } from "../api";

const btn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
  background: active ? "var(--accent)" : "var(--card)",
  color: active ? "var(--accent-fg)" : "var(--fg)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
});

// Destination = Library or a specific Job, plus an optional Selection group.
export function DestinationPicker({
  destination,
  onChange,
}: {
  destination: Destination;
  onChange: (d: Destination) => void;
}) {
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [groups, setGroups] = useState<SelectionGroup[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [loadingJobs, setLoadingJobs] = useState(false);

  const selectedJob = destination.kind === "job" ? destination.job : null;
  const selectedJobId = selectedJob?.id;

  // Search jobs when in Job mode.
  useEffect(() => {
    if (destination.kind !== "job" || selectedJobId) return;
    let cancelled = false;
    setLoadingJobs(true);
    api
      .jobs(q)
      .then((d) => {
        if (!cancelled) setJobs((d.jobs as Job[]) ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingJobs(false));
    return () => {
      cancelled = true;
    };
  }, [q, destination.kind, selectedJobId]);

  // Load groups for the current scope (library = no job).
  useEffect(() => {
    api
      .groups(selectedJobId)
      .then((d) => setGroups((d.groups as SelectionGroup[]) ?? []))
      .catch(() => setGroups([]));
  }, [selectedJobId]);

  async function createGroup() {
    const name = newGroup.trim();
    if (!name) return;
    try {
      const d = await api.createGroup({ name, job_id: selectedJobId ?? null });
      const g = d.group as SelectionGroup;
      setGroups((prev) => [...prev, g]);
      setNewGroup("");
      onChange({ ...destination, group: g } as Destination);
    } catch {
      /* surfaced by Save if it matters */
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={btn(destination.kind === "library")} onClick={() => onChange({ kind: "library", group: null })}>
          Selection Library
        </button>
        <button type="button" style={btn(destination.kind === "job")} onClick={() => onChange({ kind: "job", job: null, group: null })}>
          Job
        </button>
      </div>

      {destination.kind === "job" &&
        (selectedJob ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              background: "var(--card)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedJob.job_name || "Job"} {selectedJob.job_number ? `· ${selectedJob.job_number}` : ""}
              </div>
              {selectedJob.full_address && (
                <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selectedJob.full_address}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onChange({ kind: "job", job: null, group: null })}
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12 }}
            >
              Change
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            <input className="cmi-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs by name or number…" />
            <div style={{ maxHeight: 160, overflowY: "auto", display: "grid", gap: 4 }}>
              {loadingJobs && <div style={{ fontSize: 12, color: "var(--muted)", padding: 4 }}>Searching…</div>}
              {!loadingJobs && jobs.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", padding: 4 }}>No jobs found.</div>}
              {jobs.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => onChange({ kind: "job", job: j, group: null })}
                  style={{ textAlign: "left", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", background: "var(--card)", color: "var(--fg)", cursor: "pointer" }}
                >
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                    {j.job_name || "Job"} {j.job_number ? `· ${j.job_number}` : ""}
                  </div>
                  {j.full_address && <div style={{ fontSize: 11, color: "var(--muted)" }}>{j.full_address}</div>}
                </button>
              ))}
            </div>
          </div>
        ))}

      <div>
        <span className="cmi-label">Selection group (optional)</span>
        <select
          className="cmi-input"
          value={destination.group?.id ?? ""}
          onChange={(e) => {
            const g = groups.find((x) => x.id === e.target.value) ?? null;
            onChange({ ...destination, group: g } as Destination);
          }}
        >
          <option value="">— None —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input className="cmi-input" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="New group name" />
          <button
            type="button"
            onClick={createGroup}
            style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0 12px", background: "var(--card)", color: "var(--fg)", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
