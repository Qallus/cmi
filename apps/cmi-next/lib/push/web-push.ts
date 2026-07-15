import webpush from "web-push";
import { getSupabaseAdmin } from "@/lib/supabase/server";

let configured: boolean | null = null;

// Configure web-push from env on first use. Returns false if VAPID keys are
// missing (push is then a no-op — the app works fine without it).
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@constructedmatter.com";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function savePushSubscription(staffId: string, sub: PushSubscriptionInput, userAgent?: string | null) {
  const supabase = getSupabaseAdmin();
  await supabase.from("push_subscriptions").upsert(
    {
      staff_user_id: staffId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent ?? null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
}

export async function removePushSubscription(endpoint: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

type StoredSub = { endpoint: string; p256dh: string; auth: string };

async function deliver(subs: StoredSub[], payload: PushPayload) {
  if (!ensureConfigured() || !subs.length) return;
  const supabase = getSupabaseAdmin();
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      } catch (error) {
        // 404/410 mean the subscription is gone — prune it so we stop retrying.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }),
  );
}

// Push to every stored subscription (all subscribers are staff). Best-effort;
// never throws to the caller so it can't break the triggering request.
export async function sendPushToAllSubscribers(payload: PushPayload) {
  try {
    if (!ensureConfigured()) return;
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
    await deliver((data ?? []) as StoredSub[], payload);
  } catch {
    /* swallow — push is non-critical */
  }
}

// Push to specific staff users.
export async function sendPushToStaff(staffIds: string[], payload: PushPayload) {
  try {
    if (!ensureConfigured() || !staffIds.length) return;
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").in("staff_user_id", staffIds);
    await deliver((data ?? []) as StoredSub[], payload);
  } catch {
    /* swallow — push is non-critical */
  }
}
