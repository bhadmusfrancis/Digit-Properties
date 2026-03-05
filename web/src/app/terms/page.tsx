import type { Metadata } from 'next';
import Link from 'next/link';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Digit Properties';

export const metadata: Metadata = {
  title: `Terms of Service | ${APP_NAME}`,
  description: `Terms of Service for ${APP_NAME} – Nigerian real estate platform.`,
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="border-b border-gray-200 pb-8">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-2 text-gray-600">Last updated: {new Date().toLocaleDateString('en-NG', { dateStyle: 'long' })}</p>
        <p className="mt-4 text-gray-600">
          Welcome to {APP_NAME}. By accessing or using our website, mobile applications, or services (collectively, the &quot;Platform&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). Please read them carefully.
        </p>
      </header>

      <div className="prose prose-slate mt-10 max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold">
        <section id="acceptance" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">1. Acceptance of Terms</h2>
          <p>
            By creating an account, signing in (including via third-party providers such as Google, Facebook, or Apple), or otherwise using the Platform, you confirm that you have read, understood, and agree to these Terms and our{' '}
            <Link href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>. If you do not agree, you must not use the Platform. We may update these Terms from time to time; continued use after changes constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section id="eligibility" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">2. Eligibility</h2>
          <p>
            You must be at least 18 years old and have the legal capacity to enter into binding contracts to use the Platform. By using the Platform, you represent that you meet these requirements. The Platform is intended for use in Nigeria; use from other jurisdictions is at your own risk.
          </p>
        </section>

        <section id="account" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">3. Account Registration and Security</h2>
          <p>
            You may register using email and password or through a supported social login provider. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. You must provide accurate and complete information and notify us promptly of any unauthorized use. We may suspend or terminate accounts that violate these Terms or for other legitimate reasons.
          </p>
        </section>

        <section id="use" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">4. Use of the Platform</h2>
          <p>
            The Platform allows users to browse, list, and inquire about properties (sale and rent), and to access verification and communication features subject to your verification status. You agree to use the Platform only for lawful purposes and in accordance with these Terms. You must not:
          </p>
          <ul className="list-disc pl-6">
            <li>Post false, misleading, or fraudulent content, including fake listings or impersonation;</li>
            <li>Harass, abuse, or harm other users or our staff;</li>
            <li>Scrape, automate access, or attempt to circumvent technical or access controls without permission;</li>
            <li>Use the Platform for any illegal or unauthorized purpose;</li>
            <li>Violate any applicable laws or regulations in Nigeria or your jurisdiction.</li>
          </ul>
        </section>

        <section id="listings" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">5. Listings and Content</h2>
          <p>
            If you list properties, you are responsible for the accuracy, legality, and ownership of your listings. You grant us a non-exclusive, royalty-free licence to use, display, and distribute your content in connection with the Platform. We do not guarantee the accuracy of user-generated content and are not responsible for transactions between users. Listing limits and features may depend on your account type and subscription.
          </p>
        </section>

        <section id="verification" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">6. Verification and Identity</h2>
          <p>
            We may offer identity and liveness verification, phone verification, and role upgrades (e.g. Verified Individual, Registered Agent, Registered Developer). Verification is subject to our verification policies and approval. You agree to provide accurate documents and information and to comply with our verification requirements. We may use third-party services and store verification-related data as described in our Privacy Policy.
          </p>
        </section>

        <section id="payments" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">7. Payments and Fees</h2>
          <p>
            Where you make payments (e.g. for listing boosts, subscriptions, or ads), you agree to pay all applicable fees and taxes. Payment terms, refunds, and pricing are as displayed at the time of purchase or in separate agreements. We may use third-party payment processors; your payment data may be processed according to their policies and ours.
          </p>
        </section>

        <section id="ip" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">8. Intellectual Property</h2>
          <p>
            The Platform, including its design, text, graphics, logos, and software (excluding your content), is owned by or licensed to us and is protected by copyright and other intellectual property laws. You may not copy, modify, or create derivative works without our prior written consent.
          </p>
        </section>

        <section id="disclaimers" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">9. Disclaimers</h2>
          <p>
            The Platform is provided &quot;as is&quot; and &quot;as available.&quot; We do not warrant that the Platform will be uninterrupted, error-free, or free of harmful components. We are not liable for the conduct of users or the quality, safety, or legality of listings. Property transactions are between users; we are not a party to such transactions unless otherwise stated.
          </p>
        </section>

        <section id="limitation" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">10. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, {APP_NAME} and its affiliates, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill, arising from your use of or inability to use the Platform. Our total liability for any claim shall not exceed the amount you paid us in the twelve (12) months preceding the claim, or one hundred thousand Naira (NGN 100,000), whichever is less.
          </p>
        </section>

        <section id="indemnity" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">11. Indemnity</h2>
          <p>
            You agree to indemnify and hold harmless {APP_NAME}, its affiliates, and their respective officers, directors, employees, and agents from and against any claims, damages, losses, and expenses (including reasonable legal fees) arising from your use of the Platform, your content, your breach of these Terms, or your violation of any law or third-party rights.
          </p>
        </section>

        <section id="termination" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">12. Termination</h2>
          <p>
            We may suspend or terminate your account and access to the Platform at any time, with or without notice, for breach of these Terms or for any other reason. You may close your account at any time through your account settings or by contacting us. Provisions that by their nature should survive (including disclaimers, limitation of liability, and indemnity) will survive termination.
          </p>
        </section>

        <section id="governing" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">13. Governing Law and Disputes</h2>
          <p>
            These Terms are governed by the laws of the Federal Republic of Nigeria. Any dispute arising out of or in connection with these Terms or the Platform shall first be attempted to be resolved by good-faith negotiation. If unresolved, disputes may be submitted to the courts of Nigeria.
          </p>
        </section>

        <section id="contact" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">14. Contact</h2>
          <p>
            For questions about these Terms, please contact us via our <Link href="/contact" className="text-primary-600 hover:underline">Contact</Link> page or the contact details published on the Platform.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-gray-200 pt-8">
        <Link href="/" className="text-primary-600 hover:underline">← Back to home</Link>
      </div>
    </div>
  );
}
