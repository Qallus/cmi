import { ConsentPageView } from "@/components/consent/consent-page";

export const metadata = {
  title: "Email Opt-Out — Constructed Matter, Inc.",
  description: "Unsubscribe from emails from Constructed Matter, Inc.",
};

export default function EmailOptOutPage() {
  return <ConsentPageView channel="email" mode="opt_out" />;
}
