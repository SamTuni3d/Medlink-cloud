import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Privacy Policy — MedLink' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/register"
          className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <h1 className="mb-2 text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mb-10 text-sm text-gray-400">Last updated: October 2026</p>

        <div className="prose prose-gray max-w-none text-sm leading-relaxed text-gray-700 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-gray-900 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1">

          <p>
            MedLink Technologies (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the MedLink Cloud pharmacy
            management platform. This Privacy Policy explains what data we collect, how we use it,
            and your rights in relation to it.
          </p>

          <h2>1. Data We Collect</h2>
          <p>
            We collect two categories of data: data you provide directly and data generated
            automatically by your use of the Service.
          </p>
          <p><strong>Data you provide:</strong></p>
          <ul>
            <li>Account information: your name, email address, phone number, and pharmacy details.</li>
            <li>Business data: medications, inventory, suppliers, sales records, and procurement orders.</li>
            <li>Patient data: names, dates of birth, phone numbers, and prescription records that you enter as part of dispensing.</li>
            <li>Payment information: processed by Paystack. We do not store card numbers or mobile money credentials on our servers.</li>
          </ul>
          <p><strong>Data generated automatically:</strong></p>
          <ul>
            <li>Audit logs of actions performed within your account (who did what, when).</li>
            <li>Device identifiers used to support offline sync.</li>
            <li>Error and diagnostic data to help us identify and fix problems.</li>
          </ul>

          <h2>2. How We Use Your Data</h2>
          <ul>
            <li>To provide, maintain, and improve the Service.</li>
            <li>To process subscription payments.</li>
            <li>To send operational notifications (low-stock alerts, expiry warnings, prescription-ready alerts).</li>
            <li>To respond to support requests.</li>
            <li>To comply with legal obligations.</li>
          </ul>
          <p>
            We do not use your business data or patient data for advertising, profiling, or
            sale to third parties.
          </p>

          <h2>3. Patient Data</h2>
          <p>
            Patient data entered into MedLink is owned by your pharmacy. You are the data
            controller under Ghana&apos;s Data Protection Act 2012; we are a data processor acting
            on your instructions. We process patient data solely to provide the Service to you
            and will not access it for any other purpose except as required by law.
          </p>

          <h2>4. Data Storage and Security</h2>
          <p>
            Your data is stored on Supabase infrastructure hosted in the EU (Frankfurt). We apply
            industry-standard security measures including:
          </p>
          <ul>
            <li>Encryption in transit (TLS 1.2+) and at rest.</li>
            <li>Row-level security ensuring each pharmacy can only access its own data.</li>
            <li>Role-based access controls within your account.</li>
            <li>Append-only audit logs for all sensitive operations.</li>
          </ul>

          <h2>5. Data Sharing</h2>
          <p>We share data only with the following sub-processors, under appropriate data protection agreements:</p>
          <ul>
            <li><strong>Supabase</strong> — database and authentication infrastructure.</li>
            <li><strong>Vercel</strong> — application hosting and delivery.</li>
            <li><strong>Paystack</strong> — payment processing.</li>
            <li><strong>Resend</strong> — transactional email delivery.</li>
            <li><strong>Arkesel</strong> — SMS notification delivery.</li>
            <li><strong>Sentry</strong> — error monitoring and diagnostics.</li>
          </ul>
          <p>We do not share data with any other third parties without your consent.</p>

          <h2>6. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. If you cancel your
            subscription, we retain your data for 30 days to allow export. After that period,
            data is permanently deleted, except where retention is required by law (e.g., financial
            records may be retained for 7 years under Ghanaian tax law).
          </p>

          <h2>7. Your Rights</h2>
          <p>Under Ghana&apos;s Data Protection Act 2012, you have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Correct inaccurate data.</li>
            <li>Request deletion of your data (subject to legal retention requirements).</li>
            <li>Export your data in a machine-readable format from your account settings.</li>
          </ul>

          <h2>8. Cookies</h2>
          <p>
            We use session cookies to maintain your login state. These are essential for the
            Service to function and cannot be disabled. We do not use advertising or tracking
            cookies.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material
            changes by email at least 14 days before they take effect.
          </p>

          <h2>10. Contact</h2>
          <p>
            For privacy-related queries or to exercise your rights, contact our Data Protection
            Officer at{' '}
            <a href="mailto:privacy@medlinkcloud.com" className="font-medium text-teal-700 underline">
              privacy@medlinkcloud.com
            </a>.
          </p>
        </div>
      </div>
    </div>
  )
}
