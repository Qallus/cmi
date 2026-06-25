import { ConsentPageView } from "@/components/consent/consent-page";

export const metadata = {
  title: "Email Opt-In — Constructed Matter, Inc.",
  description: "Opt in to receive emails from Constructed Matter, Inc.",
};

export default function EmailOptInPage() {
  return <ConsentPageView channel="email" mode="opt_in" />;
}
