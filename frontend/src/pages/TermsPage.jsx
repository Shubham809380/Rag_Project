import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LandingNavbar from '../components/layout/LandingNavbar';
import LandingFooter from '../components/layout/LandingFooter';

export default function TermsPage() {
  return (
    <div className="min-h-screen text-fg" style={{ background: 'var(--bg-base)' }}>
      <LandingNavbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-blue-400 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-6">Terms and Conditions</h1>
          <p className="text-sm text-fg-muted mb-8">Last updated: July 2026</p>

          <div className="space-y-8 text-fg-secondary leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-heading mb-3">1. Acceptance of Terms</h2>
              <p className="text-sm">
                By accessing or using InsightRAG, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-heading mb-3">2. Description of Service</h2>
              <p className="text-sm">
                InsightRAG is an AI-powered document analysis platform that allows users to upload documents and ask questions to receive AI-generated answers based on the document content.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-heading mb-3">3. User Accounts</h2>
              <p className="text-sm">
                You must authenticate using your Google account to access the dashboard and use the document analysis features. You are responsible for maintaining the security of your account and for all activities that occur under your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-heading mb-3">4. Acceptable Use</h2>
              <p className="text-sm">
                You agree not to upload documents that contain malicious content, violate intellectual property rights, or are prohibited by law. You may not attempt to circumvent usage limits or abuse the service in any way.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-heading mb-3">5. Intellectual Property</h2>
              <p className="text-sm">
                You retain full ownership of the documents you upload. InsightRAG does not claim any ownership over your content. The AI-generated answers are provided for informational purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-heading mb-3">6. Limitation of Liability</h2>
              <p className="text-sm">
                InsightRAG is provided "as is" without warranties of any kind. We are not liable for any damages arising from the use of our service. AI-generated answers may contain inaccuracies and should be verified independently.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-heading mb-3">7. Service Availability</h2>
              <p className="text-sm">
                We strive to keep InsightRAG available at all times but do not guarantee uninterrupted access. We may perform maintenance or updates that temporarily affect service availability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-heading mb-3">8. Changes to Terms</h2>
              <p className="text-sm">
                We reserve the right to modify these Terms and Conditions at any time. Continued use of the service after changes constitutes acceptance of the updated terms.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
      <LandingFooter />
    </div>
  );
}
