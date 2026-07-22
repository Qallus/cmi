// Public opt-in / opt-out endpoint for the SMS & email consent pages.
//
// Deliberately unauthenticated: carriers and CAN-SPAM both require that an
// opt-out cannot be gated behind a login, a fee, or extra information.
import { NextResponse } from "next/server";
import {
  applyConsent,
  linkConsentToContact,
  looksValid,
  CONSENT_DISCLOSURE_VERSION,
  type Channel,
  type ConsentAction,
  type ConsentCategory,
} from "@/lib/messaging/consent";

type Body = {
  channel?: Channel;
  action?: ConsentAction;
  address?: string;
  categories?: ConsentCategory[];
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  relationship?: string;
  /** Verbatim disclosure text rendered on the page at submit time. */
  disclosureText?: string;
  sourceUrl?: string;
};

const MAX_LEN = 200;
const clean = (v: unknown) => String(v ?? "").trim().slice(0, MAX_LEN) || null;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;

  const channel = body?.channel;
  const action = body?.action;
  const address = String(body?.address || "").trim();

  if (channel !== "sms" && channel !== "email") {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }
  if (action !== "opt_in" && action !== "opt_out") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  if (!looksValid(channel, address)) {
    return NextResponse.json(
      { error: channel === "email" ? "Enter a valid email address." : "Enter a valid phone number." },
      { status: 400 },
    );
  }

  const categories = (body?.categories ?? []).filter(
    (c): c is ConsentCategory => c === "service" || c === "marketing",
  );
  if (categories.length === 0) {
    return NextResponse.json(
      {
        error:
          action === "opt_in"
            ? "Select at least one message type to continue."
            : "Select what you would like to stop receiving.",
      },
      { status: 400 },
    );
  }

  const person = {
    firstName: clean(body?.firstName),
    lastName: clean(body?.lastName),
    // Whichever field the page collected the address in should also be the
    // identity value for that channel.
    email: clean(channel === "email" ? address : body?.email),
    phone: clean(channel === "sms" ? address : body?.phone),
    company: clean(body?.company),
    relationship: clean(body?.relationship),
  };

  // Best-effort CRM linkage — never block a consent change on it, especially an
  // opt-out, which must always succeed.
  let contactId: string | null = null;
  try {
    contactId = await linkConsentToContact(person);
  } catch {
    contactId = null;
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const result = await applyConsent({
    channel,
    action,
    address,
    categories,
    source: "public_page",
    contactId,
    person,
    optOutMethod: action === "opt_out" ? "public_page" : null,
    audit: {
      sourceUrl: clean(body?.sourceUrl),
      ip: forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      disclosureText: String(body?.disclosureText ?? "").trim().slice(0, 5000) || null,
      disclosureVersion: CONSENT_DISCLOSURE_VERSION,
    },
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, categories });
}
