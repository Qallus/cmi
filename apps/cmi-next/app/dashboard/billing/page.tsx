import { CreditCard } from "lucide-react";

export const metadata = { title: "Billing — CMI Dashboard" };

export default function BillingPage() {
  return (
    <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card">
        <CreditCard className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h1 className="font-display text-xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          Billing management is coming soon. This section will include invoicing, payment tracking, and financial reporting.
        </p>
      </div>
    </div>
  );
}
