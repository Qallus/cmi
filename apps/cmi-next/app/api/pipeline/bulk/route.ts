// One quick action (stage, next action, archive, restore, delete) applied to
// every checked Pre-Con opportunity — see lib/records-io/actions.ts.
import { handleBulk } from "@/lib/records-io/actions";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleBulk("precon", request);
}
