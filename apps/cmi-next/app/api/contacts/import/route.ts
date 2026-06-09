import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ContactDraft } from "@/lib/contacts/types";

export async function POST(req: Request) {
  try {
    const { contacts, duplicateAction = "skip" } = await req.json() as {
      contacts: ContactDraft[];
      duplicateAction: "skip" | "overwrite";
    };

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Get existing emails to detect duplicates
    const { data: existing } = await sb
      .from("contacts")
      .select("email")
      .in("email", contacts.map((c) => c.email).filter(Boolean));

    const existingEmails = new Set((existing ?? []).map((r: { email: string }) => r.email.toLowerCase()));

    const toInsert: ContactDraft[] = [];
    const toUpdate: ContactDraft[] = [];
    let skipped = 0;

    for (const c of contacts) {
      if (!c.email) continue;
      if (existingEmails.has(c.email.toLowerCase())) {
        if (duplicateAction === "overwrite") toUpdate.push(c);
        else skipped++;
      } else {
        toInsert.push(c);
      }
    }

    const errors: string[] = [];
    let imported = 0;

    if (toInsert.length > 0) {
      const { error } = await sb.from("contacts").insert(
        toInsert.map((c) => ({ ...c, updated_at: new Date().toISOString() }))
      );
      if (error) errors.push(`Insert error: ${error.message}`);
      else imported += toInsert.length;
    }

    for (const c of toUpdate) {
      const { error } = await sb
        .from("contacts")
        .update({ ...c, updated_at: new Date().toISOString() })
        .eq("email", c.email);
      if (error) errors.push(`Update error for ${c.email}: ${error.message}`);
      else imported++;
    }

    return NextResponse.json({ imported, skipped, errors });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
