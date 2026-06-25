import { ConsentPageView } from "@/components/consent/consent-page";

export const metadata = {
  title: "SMS Opt-Out — Constructed Matter, Inc.",
  description: "Stop receiving text messages from Constructed Matter, Inc.",
};

export default function SmsOptOutPage() {
  return <ConsentPageView channel="sms" mode="opt_out" />;
}
