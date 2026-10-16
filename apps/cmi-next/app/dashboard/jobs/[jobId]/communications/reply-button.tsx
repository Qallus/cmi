"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { ComposeDialog, type ComposeRecipient } from "@/components/communications/compose-dialog";

// Reply to one message in a job's history with the same composer the top bar uses.
export function ReplyButton({ jobId, channel, to, subject, recipients }: {
  jobId: string; channel: "email" | "sms"; to: string; subject: string | null; recipients: ComposeRecipient[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
        <Send className="h-3 w-3" /> Reply
      </button>
      {open && (
        <ComposeDialog
          init={{ channel, to, subject: subject ? `Re: ${subject.replace(/^Re:\s*/i, "")}` : "" }}
          recipients={recipients}
          jobId={jobId}
          onClose={() => setOpen(false)}
          onSent={() => router.refresh()}
        />
      )}
    </>
  );
}
