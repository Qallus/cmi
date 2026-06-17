import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata = { title: "Terms of Service — Constructed Matter" };

export default function TermsPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-20 lg:px-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: June 2026</p>

        <div className="prose prose-neutral mt-10 max-w-none dark:prose-invert">
          <p>
            By accessing the Constructed Matter, Inc. website ("Site"), you agree to the following terms.
            If you do not agree, please do not use the Site.
          </p>

          <h2>Use of the Site</h2>
          <p>
            This Site is provided for informational purposes about Constructed Matter, Inc. services.
            You agree not to misuse the Site, attempt unauthorized access, or use it for any unlawful purpose.
          </p>

          <h2>Intellectual Property</h2>
          <p>
            All content on this Site — including text, images, logos, and project photography — is the
            property of Constructed Matter, Inc. or licensed to us and may not be reproduced without
            written permission.
          </p>

          <h2>No Professional Advice</h2>
          <p>
            Content on this Site is for general informational purposes only and does not constitute
            architectural, engineering, legal, or financial advice. For project-specific guidance,
            contact us directly.
          </p>

          <h2>Third-Party Links</h2>
          <p>
            The Site may contain links to external websites. We are not responsible for the content
            or practices of those sites.
          </p>

          <h2>Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Constructed Matter, Inc. is not liable for any
            damages arising from your use of this Site or reliance on its content.
          </p>

          <h2>Changes to These Terms</h2>
          <p>
            We may update these terms at any time. Continued use of the Site after changes constitutes
            acceptance of the updated terms.
          </p>

          <h2>Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of Arizona, without regard to conflict
            of law principles.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms? Contact us at{" "}
            <a href="mailto:hello@constructedmatter.com">hello@constructedmatter.com</a>.
          </p>
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
