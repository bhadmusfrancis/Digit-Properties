import type { Metadata } from 'next';
import Link from 'next/link';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Digit Properties';

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description: `Privacy Policy for ${APP_NAME} – how we collect, use, and protect your data.`,
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="border-b border-gray-200 pb-8">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-gray-600">Last updated: {new Date().toLocaleDateString('en-NG', { dateStyle: 'long' })}</p>
        <p className="mt-4 text-gray-600">
          {APP_NAME} (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, mobile applications, and services (the &quot;Platform&quot;). By using the Platform, you consent to the practices described below.
        </p>
      </header>

      <div className="prose prose-slate mt-10 max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold">
        <section id="information-we-collect" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">1. Information We Collect</h2>
          <p>We may collect the following categories of information:</p>
          <ul className="list-disc pl-6">
            <li><strong>Account and profile data:</strong> name, email address, phone number, profile photo, date of birth, address, and company position (where applicable) when you register or update your profile.</li>
            <li><strong>Identity and verification data:</strong> images of identity documents, liveness (face) verification images, and related data you provide for verification purposes.</li>
            <li><strong>Listing and activity data:</strong> property listings you create, search and filter preferences, favorites, views, likes, and communication related to listings.</li>
            <li><strong>Payment data:</strong> billing information and transaction history; payment card details are processed by third-party payment providers and we do not store full card numbers.</li>
            <li><strong>Technical and usage data:</strong> IP address, device type, browser type, log data, and how you interact with the Platform.</li>
            <li><strong>Cookies and similar technologies:</strong> we use cookies and similar technologies for session management, preferences, and analytics as described in this policy.</li>
          </ul>
        </section>

        <section id="how-we-use" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc pl-6">
            <li>Provide, operate, and improve the Platform;</li>
            <li>Create and manage your account and authenticate you (including via social login);</li>
            <li>Process verification (identity, liveness, phone) and role upgrades;</li>
            <li>Display and promote listings, and connect users (e.g. contact details to verified users);</li>
            <li>Process payments and send transactional communications;</li>
            <li>Send service-related and marketing communications (where you have agreed);</li>
            <li>Detect and prevent fraud, abuse, and security incidents;</li>
            <li>Comply with legal obligations and enforce our Terms of Service;</li>
            <li>Analyse usage to improve our services and user experience.</li>
          </ul>
        </section>

        <section id="legal-basis" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">3. Legal Basis for Processing</h2>
          <p>
            We process your data where necessary for the performance of our contract with you (e.g. providing the Platform), for our legitimate interests (e.g. security, analytics, improving services), to comply with legal obligations, or with your consent where required (e.g. marketing, certain cookies). You may withdraw consent where applicable without affecting the lawfulness of processing based on consent before its withdrawal.
          </p>
        </section>

        <section id="sharing" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">4. Sharing and Disclosure</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc pl-6">
            <li><strong>Other users:</strong> as needed for the Platform (e.g. your name and contact details to verified users who inquire about your listings);</li>
            <li><strong>Service providers:</strong> hosting, email, SMS/WhatsApp (e.g. Twilio), payment processors (e.g. Paystack, Flutterwave), cloud storage (e.g. Cloudinary), and analytics providers, under contractual obligations to protect your data;</li>
            <li><strong>Verification and security:</strong> third-party verification or identity services where used;</li>
            <li><strong>Legal and safety:</strong> law enforcement, regulators, or others when required by law or to protect our rights and safety;</li>
            <li><strong>Business transfers:</strong> in connection with a merger, sale, or acquisition, subject to the same privacy commitments.</li>
          </ul>
          <p className="mt-4">We do not sell your personal information to third parties for their marketing purposes.</p>
        </section>

        <section id="retention" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">5. Data Retention</h2>
          <p>
            We retain your information for as long as your account is active or as needed to provide you services, and thereafter as necessary to comply with legal obligations, resolve disputes, and enforce our agreements. Verification-related data may be retained in accordance with our verification and compliance requirements. You may request deletion of your account and associated data subject to applicable law.
          </p>
        </section>

        <section id="security" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">6. Security</h2>
          <p>
            We implement appropriate technical and organisational measures to protect your data against unauthorised access, alteration, disclosure, or destruction. These include encryption in transit and at rest where applicable, access controls, and secure development practices. No method of transmission or storage is completely secure; you provide information at your own risk.
          </p>
        </section>

        <section id="rights" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">7. Your Rights</h2>
          <p>Depending on applicable law (including Nigerian Data Protection Regulation where relevant), you may have the right to:</p>
          <ul className="list-disc pl-6">
            <li>Access and receive a copy of your personal data;</li>
            <li>Correct or update inaccurate data;</li>
            <li>Request deletion of your data;</li>
            <li>Object to or restrict certain processing;</li>
            <li>Data portability where applicable;</li>
            <li>Withdraw consent where processing is consent-based;</li>
            <li>Lodge a complaint with a supervisory authority.</li>
          </ul>
          <p className="mt-4">
            To exercise these rights, contact us via our <Link href="/contact" className="text-primary-600 hover:underline">Contact</Link> page. We will respond in accordance with applicable law.
          </p>
        </section>

        <section id="cookies" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">8. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies for essential operations (e.g. session management), preferences, and to understand how the Platform is used. You can control cookies through your browser settings; disabling certain cookies may affect functionality. We may use analytics services that collect data about your use of the Platform; you may be able to opt out via your device or browser settings or the service provider&apos;s tools.
          </p>
        </section>

        <section id="children" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">9. Children</h2>
          <p>
            The Platform is not intended for users under 18. We do not knowingly collect personal data from children. If you believe we have collected data from a child, please contact us and we will take steps to delete it.
          </p>
        </section>

        <section id="international" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">10. International Transfers</h2>
          <p>
            Your data may be processed in Nigeria and in countries where our service providers operate. We ensure appropriate safeguards (e.g. contracts, adequacy decisions where applicable) are in place for such transfers as required by law.
          </p>
        </section>

        <section id="changes" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will post the updated policy on this page and update the &quot;Last updated&quot; date. For material changes, we may notify you by email or through the Platform. Continued use after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section id="contact" className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900">12. Contact Us</h2>
          <p>
            For questions about this Privacy Policy or our data practices, please contact us via our <Link href="/contact" className="text-primary-600 hover:underline">Contact</Link> page or the contact details published on the Platform.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-gray-200 pt-8">
        <Link href="/" className="text-primary-600 hover:underline">← Back to home</Link>
      </div>
    </div>
  );
}
