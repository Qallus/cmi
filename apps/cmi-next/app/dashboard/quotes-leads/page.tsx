import { loadQuotes } from "@/lib/quotes/data";
import { QuotesClient } from "./quotes-client";

export const metadata = { title: "Quotes & Leads — CMI Dashboard" };

export default async function QuotesLeadsPage() {
  try {
    const quotes = await loadQuotes();
    return <QuotesClient initialQuotes={quotes} />;
  } catch {
    return <QuotesClient initialQuotes={[]} />;
  }
}
