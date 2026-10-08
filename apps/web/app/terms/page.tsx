import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Terms of Service — MedLink' }

export default function TermsPage() {
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

        <h1 className="mb-2 text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mb-10 text-sm text-gray-400">Last updated: October 2026</p>

        <div className="prose prose-gray max-w-none text-sm leading-relaxed text-gray-700 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-gray-900 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1">

          <p>
            These Terms of Service ("Terms") govern your access to and use of the MedLink Cloud
            platform ("Service"), operated by MedLink Technologies. By registering an account or
            using the Service, you agree to be bound by these Terms.
          </p>

          <h2>1. Use of the Service</h2>
          <p>
            MedLink Cloud is a pharmacy management platform intended for licensed pharmacies and
            healthcare businesses. You must be at least 18 years old and have the legal authority
            to bind your business to these Terms to use the Service.
          </p>
          <ul>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must keep your login credentials confidential and notify us immediately of any unauthorized access.</li>
            <li>You may not use the Service for any unlawful purpose or in violation of any applicable regulations.</li>
            <li>You must comply with all applicable pharmaceutical and healthcare regulations in Ghana and any other jurisdiction where you operate.</li>
          </ul>

          <h2>2. Subscription and Payment</h2>
          <p>
            Access to the Service is provided on a subscription basis. Subscription fees are billed
            monthly in Ghana Cedis (GHS) via Paystack. Your subscription automatically renews each
            month unless cancelled before the renewal date.
          </p>
          <ul>
            <li><strong>Free Trial:</strong> New accounts receive a 14-day free trial. No payment is required during this period.</li>
            <li><strong>Starter Plan:</strong> GHS 150 per month — one branch, up to 5 staff accounts.</li>
            <li><strong>Pro Plan:</strong> GHS 350 per month — up to 3 branches, up to 15 staff accounts.</li>
            <li>We reserve the right to change pricing with 30 days' notice.</li>
            <li>All fees are non-refundable except where required by law.</li>
          </ul>

          <h2>3. Data and Privacy</h2>
          <p>
            You retain ownership of all data you input into the Service, including patient records,
            inventory data, and sales records. By using the Service, you grant MedLink a limited
            licence to store and process that data solely to provide the Service to you.
          </p>
          <p>
            We do not sell your data to third parties. Please see our{' '}
            <Link href="/privacy" className="font-medium text-teal-700 underline">
              Privacy Policy
            </Link>{' '}
            for full details of how we handle your data.
          </p>

          <h2>4. Patient Data Responsibilities</h2>
          <p>
            As a licensed pharmacy, you are the data controller for any patient information entered
            into the Service. You are responsible for:
          </p>
          <ul>
            <li>Obtaining any necessary patient consent before entering personal data.</li>
            <li>Complying with Ghana's Data Protection Act 2012 and all applicable health data regulations.</li>
            <li>Ensuring that staff access to patient data is appropriately restricted using the role-based access controls provided.</li>
          </ul>

          <h2>5. Service Availability</h2>
          <p>
            We aim to maintain high availability but do not guarantee uninterrupted access to the
            Service. The Point of Sale module is designed to function offline; other features require
            an internet connection. We are not liable for losses arising from downtime.
          </p>

          <h2>6. Intellectual Property</h2>
          <p>
            The MedLink platform, including its software, design, and documentation, is owned by
            MedLink Technologies and protected by applicable intellectual property laws. Your
            subscription grants you a limited, non-transferable right to use the Service; it does
            not transfer ownership of any intellectual property to you.
          </p>

          <h2>7. Termination</h2>
          <p>
            You may cancel your subscription at any time from your account settings. We reserve
            the right to suspend or terminate your account if you breach these Terms, fail to pay
            subscription fees, or engage in behaviour that harms other users or the integrity of
            the Service.
          </p>
          <p>
            Upon termination, you will have 30 days to export your data. After this period,
            your data may be permanently deleted.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, MedLink Technologies shall not be liable for
            any indirect, incidental, or consequential damages arising from your use of the Service.
            Our total liability shall not exceed the amount you paid in the three months preceding
            the claim.
          </p>

          <h2>9. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the Republic of Ghana. Any disputes shall be
            resolved in the courts of Ghana.
          </p>

          <h2>10. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material changes
            by email or via an in-app notification at least 14 days before the changes take effect.
            Continued use of the Service after changes take effect constitutes acceptance of the
            updated Terms.
          </p>

          <h2>11. Contact</h2>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href="mailto:legal@medlinkcloud.com" className="font-medium text-teal-700 underline">
              legal@medlinkcloud.com
            </a>.
          </p>
        </div>
      </div>
    </div>
  )
}
