import { DmInbox } from "@/components/direct-messages/dm-inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Direct Messages — CMI Dashboard" };

export default function DirectMessagesPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Communications</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Direct Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">Private conversations with your team. Search, filter by date, flag importance, and pick up where you left off.</p>
      </div>
      <DmInbox />
    </div>
  );
}
