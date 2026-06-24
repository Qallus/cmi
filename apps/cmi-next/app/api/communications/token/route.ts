// Mints a Twilio Voice SDK access token for the browser softphone.
import { NextResponse } from "next/server";
import twilio from "twilio";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import {
  VOICE_CLIENT_IDENTITY,
  defaultCallerId,
  getOwnedNumbers,
  getSmsNumbers,
} from "@/lib/twilio";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !authToken) {
    return NextResponse.json(
      { error: "Twilio credentials not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)." },
      { status: 501 },
    );
  }
  if (!twimlAppSid) {
    return NextResponse.json(
      { error: "TWILIO_TWIML_APP_SID is required for the browser softphone." },
      { status: 501 },
    );
  }

  // Voice SDK tokens require an API Key/Secret. Fall back to account creds only
  // if an explicit key is not provided (works, but a Standard API key is preferred).
  const keySid = apiKeySid || accountSid;
  const keySecret = apiKeySecret || authToken;

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  const token = new AccessToken(accountSid, keySid, keySecret, {
    identity: VOICE_CLIENT_IDENTITY,
    ttl: 3600,
  });
  token.addGrant(voiceGrant);

  return NextResponse.json({
    token: token.toJwt(),
    identity: VOICE_CLIENT_IDENTITY,
    phoneNumbers: getOwnedNumbers(),
    defaultPhoneNumber: defaultCallerId() || null,
    smsPhoneNumbers: getSmsNumbers(),
  });
}
