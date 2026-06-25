import { ConsentPageView } from "@/components/consent/consent-page";

export const metadata = {
  title: "SMS Opt-In — Constructed Matter, Inc.",
  description: "Opt in to receive text messages from Constructed Matter, Inc.",
};

export default function SmsOptInPage() {
  return <ConsentPageView channel="sms" mode="opt_in" />;
}
