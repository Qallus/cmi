import { PunchListsClient } from "./punch-lists-client";

export const metadata = { title: "Punch Lists — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Every punch list across Jobs, Pre-Con and the Pipeline. The lists load
// client-side so check-offs stay instant on a phone.
export default function PunchListsPage() {
  return <PunchListsClient />;
}
