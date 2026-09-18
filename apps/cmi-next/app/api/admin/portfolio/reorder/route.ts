import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { reorderPortfolio } from "@/lib/portfolio/data";

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const order = body?.order;
    if (!Array.isArray(order) || !order.length || !order.every((id: unknown) => typeof id === "string" && id)) {
      return NextResponse.json({ message: "order must be a non-empty array of portfolio ids." }, { status: 400 });
    }

    const moved = body?.moved && typeof body.moved.id === "string"
      ? { id: body.moved.id as string, category: body.moved.category ? String(body.moved.category) : null }
      : undefined;

    await reorderPortfolio(order as string[], moved);

    // Public archive + homepage featured strip cache for 60s; refresh them now.
    revalidatePath("/portfolio");
    revalidatePath("/");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Portfolio reorder failed." }, { status: 400 });
  }
}
