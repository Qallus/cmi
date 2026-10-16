// Public page for a client Executive Summary sent by text: the branded summary
// with "Save as PDF" and a link to the client's project portal.
//
// The link is the summary's random UUID. Only summaries written for the client
// and actually sent are served; internal (team) summaries never are.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { summaryDocumentHtml } from "@/lib/exec-summary/render";
import { projectInfo } from "@/lib/exec-summary/deliver";
import { publicAppUrl } from "@/lib/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const notFound = () => new Response("This summary isn't available.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return notFound();

  const { data: row } = await getSupabaseAdmin().from("executive_summaries")
    .select("id, job_id, opportunity_id, audience, status, headline, body_html, facts, content, sent_to, created_by_name, sent_at, created_at")
    .eq("id", id).maybeSingle();
  if (!row || row.audience !== "client" || row.status !== "sent") return notFound();

  const target = row.job_id ? "job" : "precon";
  const project = await projectInfo(target, (row.job_id ?? row.opportunity_id) as string);
  if (!project) return notFound();

  const content = (row.content ?? {}) as { opening?: string; completed?: string[]; coming_soon?: { item: string; when: string | null }[]; photos?: { url: string; caption: string | null }[] };
  const app = publicAppUrl();
  const portal = row.job_id ? `${app}/client/jobs/${row.job_id}/overview` : null;
  const when = new Date((row.sent_at ?? row.created_at) as string);
  // Each texted link carries that reader's key (?r=…) so the greeting is theirs.
  const reader = new URL(req.url).searchParams.get("r");
  const sentTo = (row.sent_to ?? []) as { reader?: string; firstName?: string | null; name?: string; kind?: string }[];
  const clients = sentTo.filter((s) => s.kind === "client");
  const first = (s: { firstName?: string | null; name?: string } | undefined) => s?.firstName || s?.name?.trim().split(/\s+/)[0] || null;
  // Older links have no key; when the summary went to a single client, greet them.
  const firstName = reader
    ? first(sentTo.find((s) => s.reader && s.reader === reader))
    : clients.length === 1 ? first(clients[0]) : null;

  const html = summaryDocumentHtml({
    audience: "client", kind: project.kind, projectName: project.name, projectNumber: project.number,
    headline: row.headline as string, opening: content.opening ?? "", firstName,
    facts: (row.facts ?? []) as { label: string; value: string }[],
    completed: content.completed ?? [], comingSoon: content.coming_soon ?? [], photos: content.photos ?? [],
    bodyHtml: row.body_html as string, preparedBy: (row.created_by_name as string | null) ?? null,
    dateLabel: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Phoenix" }).format(when),
    appUrl: app,
    cta: portal ? { label: "View your project portal", url: portal } : null,
  });

  // A small bar for phones: save as PDF (the browser's print dialog) and the portal.
  const bar = `
<style>
  .cmi-bar{position:sticky;top:0;z-index:10;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;padding:10px 12px;background:#111111;font-family:Helvetica,Arial,sans-serif}
  .cmi-bar a,.cmi-bar button{display:inline-block;padding:9px 16px;border-radius:6px;font-size:14px;font-weight:bold;text-decoration:none;cursor:pointer;border:0}
  .cmi-bar .pdf{background:#9e6f2e;color:#fff}
  .cmi-bar .portal{background:#ffffff;color:#111111}
  @media print{.cmi-bar{display:none}body{background:#fff!important}@page{size:letter;margin:0.5in}}
  /* Phones: the document is built from fixed-width email tables, so reflow it
     here (the emailed version is unchanged). */
  html,body{max-width:100%;overflow-x:hidden}
  img{max-width:100%}
  @media screen and (max-width:680px){
    body>table{padding:12px 8px!important}
    table[width="640"]{width:100%!important;border-radius:8px!important}
    table{max-width:100%!important}
    td[style*="32px"]{padding-left:18px!important;padding-right:18px!important}
    td[style*="padding:30px"]{padding-top:22px!important}
    td[width="50%"]{display:block!important;width:100%!important;box-sizing:border-box;margin-bottom:8px}
    table[style*="border-spacing"]{border-spacing:0!important}
    td[width="8"],td[width="10"]{display:none!important}
    td[width="50%"] img{max-width:100%!important;width:100%!important;height:auto!important;max-height:260px;object-fit:cover}
    h1{font-size:21px!important;line-height:1.3!important}
    p,li,td,div{overflow-wrap:anywhere}
    .cmi-bar a,.cmi-bar button{flex:1 1 140px;text-align:center;white-space:nowrap}
  }
</style>
<div class="cmi-bar">
  <button class="pdf" type="button" onclick="window.print()">Save as PDF</button>
  ${portal ? `<a class="portal" href="${portal}">Open Project Portal</a>` : ""}
</div>`;

  return new Response(html.replace(/<body([^>]*)>/, `<body$1>${bar}`), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
