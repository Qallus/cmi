import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = { title: "Privacy Policy — Constructed Matter" };

export default function PrivacyPage() {
  return (
    <div>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-5 py-20 lg:px-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">
          <p>
            Constructed Matter, Inc. ("we," "us," or "our") respects your privacy. This Privacy Policy
            explains how we collect, use, and protect information when you visit our website or contact us.
          </p>

          <h2>Information We Collect</h2>
          <p>We may collect the following types of information:</p>
          <ul>
            <li><strong>Contact information</strong> — name, email address, phone number, and message content when you submit a contact or quote form.</li>
            <li><strong>Booking information</strong> — appointment type, preferred date, and contact details when you schedule a consultation.</li>
            <li><strong>Usage data</strong> — anonymous analytics such as page views and session duration collected via privacy-respecting analytics tools.</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <ul>
            <li>To respond to your inquiries and service requests.</li>
            <li>To schedule and manage appointments.</li>
            <li>To send project updates and communications you have requested.</li>
            <li>To improve our website and services.</li>
          </ul>

          <h2>Data Sharing</h2>
          <p>
            We do not sell your personal information. We may share data with trusted service providers
            (email delivery, CRM, scheduling) solely to operate our business. These providers are
            contractually required to protect your data.
          </p>

          <h2>Data Retention</h2>
          <p>
            We retain contact and inquiry information for as long as needed to fulfill the purpose of
            the communication and comply with applicable legal obligations.
          </p>

          <h2>Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal information by
            contacting us at{" "}
            <a href="mailto:hello@constructedmatter.com">hello@constructedmatter.com</a>.
          </p>

          <h2>Cookies</h2>
          <p>
            Our website may use essential cookies to operate correctly. We do not use third-party
            advertising cookies.
          </p>

          <h2>Contact</h2>
          <p>
            For privacy-related questions, contact us at{" "}
            <a href="mailto:hello@constructedmatter.com">hello@constructedmatter.com</a> or by mail at:
          </p>
          <address className="not-italic">
            Constructed Matter, Inc.<br />
            7314 E Osborn Dr Suite A<br />
            Scottsdale, AZ 85251
          </address>
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <Link href="/" className="text-sm font-medium text-accent hover:underline">
            ← Back to Home
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
