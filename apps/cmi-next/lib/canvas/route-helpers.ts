import { NextResponse } from "next/server";
import { canvasEnabled, resolveCanvasActor, type CanvasActor } from "./actor";
import { CanvasError } from "./data";

// Every canvas route: 404 when the flag is off, 401 when neither a staff nor a
// client session is present. Returns the unified actor otherwise.
export async function requireCanvasActor(request: Request): Promise<CanvasActor> {
  if (!(await canvasEnabled())) throw new CanvasError("Not found.", 404);
  const actor = await resolveCanvasActor(request);
  if (!actor) throw new CanvasError("Unauthorized.", 401);
  return actor;
}

export function canvasErrorResponse(err: unknown): NextResponse {
  if (err instanceof CanvasError) return NextResponse.json({ error: err.message }, { status: err.status });
  const msg = err instanceof Error ? err.message : "Request failed.";
  return NextResponse.json({ error: msg }, { status: 500 });
}
