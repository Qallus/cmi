// One home per project: find projects that show in two areas today.
//   node --env-file=.env.local scripts/handoff-cleanup.mjs           → list only (no changes)
//   node --env-file=.env.local scripts/handoff-cleanup.mjs --apply   → link the matched Jobs
// --apply only links a Job to the Pre-Con record it matches by number
// (jobs.related_opportunity_id), which takes that record off the Pre-Con board.
// Nothing is deleted. Duplicate contacts are listed for a person to decide.
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)."); process.exit(1); }
const apply = process.argv.includes("--apply");
const H = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const get = async (p) => { const r = await fetch(`${url}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json(); };
const patch = async (p, body) => { const r = await fetch(`${url}/rest/v1/${p}`, { method: "PATCH", headers: H, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); };

const opps = await get("pipeline_opportunities?select=id,job_number,opportunity_name,stage&archived_at=is.null");
const jobs = await get("jobs?select=id,job_number,job_name,lead_number,status,related_opportunity_id&archived_at=is.null&is_template=eq.false");
const linked = new Set(jobs.filter((j) => j.related_opportunity_id).map((j) => j.related_opportunity_id));

// The Pre-Con number a Job carries: lead_number, else the YY_### after its own in
// the job number (26_012_26_027_…), else the YY_### its name starts with (26_027_…).
const numberIn = (j) => j.lead_number
  || (/^\d{2}_\d{3}_(\d{2}_\d{3})(?:_|$)/.exec(j.job_number ?? "")?.[1])
  || (/^(\d{2}_\d{3})(?:_|$)/.exec(j.job_name ?? "")?.[1])
  || null;

console.log(apply ? "APPLYING\n" : "DRY RUN (nothing changes; add --apply to link)\n");

console.log("1. Pre-Con records already linked to a live Job (they leave the Pre-Con board on their own):");
for (const o of opps.filter((o) => linked.has(o.id))) {
  const j = jobs.find((x) => x.related_opportunity_id === o.id);
  console.log(`   ${o.job_number} ${o.opportunity_name}  →  Job ${j.job_number}`);
}

console.log("\n2. Pre-Con records with a matching Job that isn't linked (fix: link them):");
const toLink = [];
for (const o of opps.filter((o) => !linked.has(o.id) && o.job_number)) {
  const matches = jobs.filter((j) => !j.related_opportunity_id && numberIn(j) === o.job_number);
  if (matches.length === 1) toLink.push({ o, j: matches[0] });
  else if (matches.length > 1) console.log(`   ? ${o.job_number} ${o.opportunity_name}: ${matches.length} Jobs match, left alone`);
}
if (!toLink.length) console.log("   none");
for (const { o, j } of toLink) {
  console.log(`   ${o.job_number} ${o.opportunity_name}  →  Job ${j.job_number}`);
  if (apply) { await patch(`jobs?id=eq.${j.id}`, { related_opportunity_id: o.id, ...(j.lead_number ? {} : { lead_number: o.job_number }) }); console.log("     linked"); }
}

console.log("\n3. Possible duplicate contacts (same email or same full name). Listed only:");
const contacts = await get("contacts?select=id,first_name,last_name,email,phone,created_at&order=created_at");
const groups = new Map();
const add = (k, c) => { if (!k) return; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); };
for (const c of contacts) {
  add(c.email ? `email:${c.email.trim().toLowerCase()}` : null, c);
  const n = `${(c.first_name ?? "").trim().toLowerCase()} ${(c.last_name ?? "").trim().toLowerCase()}`.trim(); add(n.includes(" ") ? `name:${n}` : null, c);
}
const seen = new Set(); let count = 0;
for (const [k, cs] of groups) {
  const ids = [...new Set(cs.map((c) => c.id))];
  if (ids.length < 2) continue;
  const sig = ids.sort().join(","); if (seen.has(sig)) continue; seen.add(sig); count++;
  console.log(`   ${k.split(":")[0]} "${k.slice(k.indexOf(":") + 1)}": ${cs.map((c) => `${(c.first_name ?? "")} ${(c.last_name ?? "")}`.trim() || c.email || c.id).join(" | ")} (${ids.length})`);
}
if (!count) console.log("   none");

// The same phone on people with different names usually means a wrong number on
// one of them (an import), not a duplicate: listed so the numbers can be checked.
console.log("\n4. The same phone on different people (check the numbers; not duplicates):");
const byPhone = new Map();
for (const c of contacts) { const d = (c.phone ?? "").replace(/\D/g, "").slice(-10); if (d.length >= 7) { if (!byPhone.has(d)) byPhone.set(d, []); byPhone.get(d).push(c); } }
let odd = 0;
for (const [d, cs] of byPhone) {
  const names = new Set(cs.map((c) => `${(c.first_name ?? "").trim()} ${(c.last_name ?? "").trim()}`.trim().toLowerCase() || c.email));
  if (cs.length > 1 && names.size > 1) { odd++; console.log(`   ${d}: ${cs.map((c) => `${(c.first_name ?? "")} ${(c.last_name ?? "")}`.trim() || c.email).join(" | ")}`); }
}
if (!odd) console.log("   none");
