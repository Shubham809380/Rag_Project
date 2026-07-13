import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import LandingNavbar from '../components/layout/LandingNavbar';
import LandingFooter from '../components/layout/LandingFooter';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg-base)' }}>
      <LandingNavbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-6">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mb-8">Last updated: July 2026</p>

          <div className="space-y-8 text-slate-300 leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
              <p className="text-sm">
                When you use InsightRAG, we collect your Google account information (name, email, profile picture) for authentication purposes. We also store documents you upload for analysis and chat history associated with your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
              <p className="text-sm">
                Your information is used solely to provide and improve the InsightRAG service. We use your documents to generate AI-powered answers to your questions. We do not use your documents or data for training AI models.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">3. Document Processing</h2>
              <p className="text-sm">
                Documents you upload are processed to extract text and create embeddings for semantic search. Original files are processed in-memory and deleted after indexing. The indexed content is stored securely and associated with your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">4. Data Security</h2>
              <p className="text-sm">
                We implement industry-standard security measures to protect your data. Authentication is handled via Google OAuth, and we use secure HTTP-only cookies for session management. Your data is encrypted in transit using TLS.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">5. Data Sharing</h2>
              <p className="text-sm">
                We do not sell, trade, or share your personal information or document content with third parties. Your documents are accessible only to you through your authenticated account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">6. Data Retention</h2>
              <p className="text-sm">
                Your account data and document indexes are retained as long as your account is active. You may request deletion of your data by contacting us. Upon account deletion, all associated data will be removed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">7. Changes to This Policy</h2>
              <p className="text-sm">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page with an updated effective date.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
              <p className="text-sm">
                If you have questions about this Privacy Policy, please contact us through our GitHub repository.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
      <LandingFooter />
    </div>
  );
}
