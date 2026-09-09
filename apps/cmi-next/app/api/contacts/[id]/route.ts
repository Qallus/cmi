import { NextRequest, NextResponse } from "next/server";
import { updateContact, deleteContact } from "@/lib/contacts/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin().from("contacts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load contact." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const contact = await updateContact(id, body);
    return NextResponse.json(contact);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to update contact." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteContact(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to delete contact." }, { status: 500 });
  }
}
