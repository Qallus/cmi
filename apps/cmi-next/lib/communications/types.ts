export type MessageChannel = "email" | "sms" | "call";
export type MessageDirection = "outbound" | "inbound";
export type MessageStatus = "draft" | "queued" | "sent" | "delivered" | "failed" | "received";

export interface Message {
  id: string;
  direction: MessageDirection;
  channel: MessageChannel;
  contact_id: string | null;
  to_address: string | null;
  from_address: string | null;
  subject: string | null;
  body: string | null;
  status: MessageStatus;
  project_id: string | null;
  quote_id: string | null;
  provider: string | null;
  provider_id: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  sent_at: string;
  created_at: string;
  // joined
  contact?: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
  contact_id?: string;
  project_id?: string;
  quote_id?: string;
}

export interface SendSmsPayload {
  to: string;
  body: string;
  contact_id?: string;
  project_id?: string;
}
