import { loadMessages } from "@/lib/communications/data";
import { CommunicationsClient } from "./communications-client";
import type { Message } from "@/lib/communications/types";

export const metadata = { title: "Communications — CMI Dashboard" };

function getDemoMessages(): Message[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-1", direction: "outbound", channel: "email",
      contact_id: null, to_address: "client@example.com", from_address: "info@constructedmatter.com",
      subject: "Your Quote is Ready", body: "Hi! Your quote has been prepared and is attached.",
      status: "delivered", project_id: null, quote_id: null, provider: "resend", provider_id: "msg_demo1",
      error_message: null, duration_seconds: null, recording_url: null, sent_at: now, created_at: now,
    },
    {
      id: "demo-2", direction: "outbound", channel: "sms",
      contact_id: null, to_address: "+16025550100", from_address: "+18005551234",
      subject: null, body: "Hi! Your appointment is confirmed for Thursday at 10am.",
      status: "delivered", project_id: null, quote_id: null, provider: "twilio", provider_id: "SM_demo2",
      error_message: null, duration_seconds: null, recording_url: null, sent_at: now, created_at: now,
    },
    {
      id: "demo-3", direction: "inbound", channel: "sms",
      contact_id: null, to_address: "+18005551234", from_address: "+16025550200",
      subject: null, body: "Can we reschedule to Friday instead?",
      status: "received", project_id: null, quote_id: null, provider: "twilio", provider_id: "SM_demo3",
      error_message: null, duration_seconds: null, recording_url: null, sent_at: now, created_at: now,
    },
    {
      id: "demo-4", direction: "outbound", channel: "call",
      contact_id: null, to_address: "+16025550300", from_address: "+18005551234",
      subject: null, body: null, status: "delivered", project_id: null, quote_id: null,
      provider: "twilio", provider_id: "CA_demo4", error_message: null,
      duration_seconds: 183, recording_url: null, sent_at: now, created_at: now,
    },
  ];
}

export default async function CommunicationsPage() {
  let messages: Message[] = [];
  try {
    messages = await loadMessages("all", 200);
  } catch {
    messages = getDemoMessages();
  }
  return <CommunicationsClient initialMessages={messages} />;
}
