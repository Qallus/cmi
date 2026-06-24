import { loadMessages } from "@/lib/communications/data";
import { loadContactSubmissions } from "@/lib/contact-submissions/data";
import { CommunicationsClient } from "./communications-client";
import type { Message } from "@/lib/communications/types";
import type { ContactSubmission } from "@/lib/contact-submissions/types";

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

function getDemoSubmissions(): ContactSubmission[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-sub-1",
      first_name: "Sarah", last_name: "Mitchell",
      email: "sarah.mitchell@gmail.com", phone: "(480) 555-0142",
      how_heard: "Google Search",
      subject: "Custom Home Build — Paradise Valley",
      message: "Hi, we're looking to build a custom 4,500 sq ft home on a lot we own in Paradise Valley. We have architectural plans ready and are looking for a GC. Would love to schedule a consultation.",
      status: "new", contact_id: null,
      submitted_at: now, created_at: now,
    },
    {
      id: "demo-sub-2",
      first_name: "Tom", last_name: "Rivera",
      email: "tom.rivera@email.com", phone: "(602) 555-0198",
      how_heard: "Referral",
      subject: "ADU / Casita Build",
      message: "Referred by the Hendersons on Oak Drive. We're interested in building a 700 sq ft detached casita in our backyard in Scottsdale. Can we discuss options and pricing?",
      status: "read", contact_id: null,
      submitted_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}

export const dynamic = "force-dynamic";

export default async function CommunicationsPage() {
  let messages: Message[] = [];
  let submissions: ContactSubmission[] = [];

  try {
    messages = await loadMessages("all", 200);
  } catch {
    messages = getDemoMessages();
  }

  try {
    submissions = await loadContactSubmissions(500);
  } catch {
    submissions = getDemoSubmissions();
  }

  return <CommunicationsClient initialMessages={messages} initialSubmissions={submissions} />;
}
