import { BusinessCardsClient } from "./business-cards-client";

export const metadata = { title: "Business Cards — CMI Dashboard" };

// Data is loaded client-side from /api/business-cards so it can be filtered by
// the signed-in staff member's role (own cards vs. manage-all).
export default function BusinessCardsPage() {
  return <BusinessCardsClient />;
}
