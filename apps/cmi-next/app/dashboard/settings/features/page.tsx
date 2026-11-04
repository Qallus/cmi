import { redirect } from "next/navigation";

// Feature flags moved into Settings as a tab; keep old links working.
export default function FeatureFlagsPage() {
  redirect("/dashboard/settings?tab=features");
}
