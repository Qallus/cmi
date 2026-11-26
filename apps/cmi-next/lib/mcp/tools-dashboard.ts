// Claude connector: the Overview dashboard. Draft a What's New entry (admins;
// it stays a draft until someone publishes it in Settings → Dashboard) and add
// a card to your own Overview. Only while the dashboard_v2 flag is on.
import { isFeatureEnabled, loadFlags } from "@/lib/flags";
import { canManageWhatsNew, cardAllowed, DASHBOARD_FLAG } from "@/lib/dashboard/access";
import { CARDS } from "@/lib/dashboard/cards";
import { CARD_TYPES, copy, isCardType, newId, normalize, STANDARD, type CardType } from "@/lib/dashboard/layout";
import { saveDashboardLayout } from "@/lib/dashboard/data";
import { createNews } from "@/lib/dashboard/whats-new";
import { NEWS_ICON_NAMES } from "@/lib/dashboard/news-icons";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { McpCaller } from "./auth";
import type { Json, McpTool } from "./tools";

const obj = (properties: Json = {}, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const on = () => isFeatureEnabled(DASHBOARD_FLAG);

export function dashboardTools(): McpTool[] {
  return [
    {
      name: "cmi_whats_new_draft",
      title: "Draft a What's New entry",
      description: "Draft a card for the Overview's What's New row (a new feature or change worth trying). Saved as a draft; an admin publishes it in Settings → Dashboard. Keep the body to one or two plain sentences.",
      risk: "write",
      available: async (c: McpCaller) => canManageWhatsNew(c.ctx.role) && (await on()),
      inputSchema: () => obj({
        title: str("Short title, e.g. \"Event invitations\""),
        body: str("One or two sentences: what it is and where to find it"),
        href: str("Optional link inside CMI, e.g. /dashboard/events"),
        icon: { type: "string", enum: NEWS_ICON_NAMES },
        tag: str("Optional tag, e.g. New"),
      }, ["title", "body"]),
      run: async (a, c) => {
        const entry = await createNews(a, c.ctx.id, false);
        return { result: { entry, next_step: "Publish it in Settings → Dashboard → What's New." }, entity: "whats_new", recordId: entry.id, after: entry };
      },
    },
    {
      name: "cmi_dashboard_cards",
      title: "List Overview cards",
      description: "The cards you can add to your Overview dashboard (stats, tasks, calendar, charts, tools), with what each shows.",
      risk: "read",
      available: () => on(),
      inputSchema: () => obj(),
      run: async (_a, c) => {
        const flags = await loadFlags();
        return { result: { cards: CARD_TYPES.filter((t) => cardAllowed(t, c.ctx.role, flags)).map((t) => ({ type: t, title: CARDS[t].title, what: CARDS[t].what, category: CARDS[t].category })) } };
      },
    },
    {
      name: "cmi_dashboard_add_card",
      title: "Add a card to my Overview",
      description: "Add a card to your own Overview dashboard (get the type from cmi_dashboard_cards). Optional section title: an existing section, or a new one with that name. Changes only your layout.",
      risk: "write",
      available: () => on(),
      inputSchema: () => obj({ type: str("Card type, e.g. chart_pipeline"), section: str("Section title (optional)") }, ["type"]),
      run: async (a, c) => {
        const flags = await loadFlags();
        const allow = (t: CardType) => cardAllowed(t, c.ctx.role, flags);
        if (!isCardType(a.type) || !allow(a.type)) throw new Error(`"${String(a.type)}" isn't a card you can add. See cmi_dashboard_cards.`);
        const { data } = await getSupabaseAdmin().from("dashboard_layouts").select("layout").eq("staff_user_id", c.ctx.id).maybeSingle();
        const layout = normalize(data?.layout, allow) ?? normalize(copy(STANDARD), allow)!;
        const want = typeof a.section === "string" ? a.section.trim().slice(0, 60) : "";
        let section = want ? layout.sections.find((s) => s.title.toLowerCase() === want.toLowerCase()) : layout.sections.at(-1);
        if (!section) { section = { id: newId("s"), title: want || "My cards", style: "grid", cards: [] }; layout.sections.push(section); }
        section.hidden = false;
        section.cards.push({ id: newId(a.type), type: a.type, size: CARDS[a.type].size });
        await saveDashboardLayout(c.ctx.id, layout);
        return { result: { added: CARDS[a.type].title, section: section.title, next_step: "Open the Overview to see it; Customize to move it." } };
      },
    },
  ];
}
