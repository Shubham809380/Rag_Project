import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SovereignAuthProvider } from './context/SovereignAuthContext';
import { LanguageProvider } from './i18n';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SovereignProtectedRoute from './components/auth/SovereignProtectedRoute';
import { useEffect } from 'react';
import { trackVisit } from './services/api';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import KnowledgeBasesPage from './pages/KnowledgeBasesPage';
import ResearchPage from './pages/ResearchPage';
import AssistantPage from './pages/AssistantPage';
import ComparePage from './pages/ComparePage';
import StudyPage from './pages/StudyPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import AdminEvalPage from './pages/AdminEvalPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import NotFound from './pages/NotFound';
import SovereignLoginPage from './pages/SovereignLoginPage';
import SovereignSignupPage from './pages/sovereign/SovereignSignupPage';
import SovereignLanding from './pages/sovereign/SovereignLanding';
import SovereignChangePasswordPage from './pages/SovereignChangePasswordPage';
import SovereignShell from './components/sovereign/SovereignShell';
import SovereignDashboard from './pages/sovereign/SovereignDashboard';
import SovereignWorkbench from './pages/sovereign/SovereignWorkbench';
import SovereignDocuments from './pages/sovereign/SovereignDocuments';
import SovereignDocumentDetail from './pages/sovereign/SovereignDocumentDetail';
import SovereignDataAnalysis from './pages/sovereign/SovereignDataAnalysis';
import SovereignDeliverables from './pages/sovereign/SovereignDeliverables';
import SovereignVision from './pages/sovereign/SovereignVision';
import SovereignCoding from './pages/sovereign/SovereignCoding';
import SovereignApprovals from './pages/sovereign/SovereignApprovals';
import SovereignApprovalDetail from './pages/sovereign/SovereignApprovalDetail';
import SovereignAudit from './pages/sovereign/SovereignAudit';
import SovereignSovereignty from './pages/sovereign/SovereignSovereignty';
import SovereignSecurity from './pages/sovereign/SovereignSecurity';
import SovereignModels from './pages/sovereign/SovereignModels';
import SovereignTools from './pages/sovereign/SovereignTools';
import SovereignUsers from './pages/sovereign/SovereignUsers';
import SovereignMonitoring from './pages/sovereign/SovereignMonitoring';

function VisitTracker() {
  const location = useLocation();
  useEffect(() => {
    trackVisit(location.pathname);
  }, [location.pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <Routes location={location}>
        <Route path="/" element={<SovereignLanding />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
                <Route path="/knowledge-bases" element={<ProtectedRoute><KnowledgeBasesPage /></ProtectedRoute>} />
                <Route path="/research" element={<ProtectedRoute><ResearchPage /></ProtectedRoute>} />
                <Route path="/assistant" element={<ProtectedRoute><AssistantPage /></ProtectedRoute>} />
                <Route path="/compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
                <Route path="/study" element={<ProtectedRoute><StudyPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                <Route path="/admin/eval" element={<ProtectedRoute><AdminEvalPage /></ProtectedRoute>} />
                <Route path="/workbench/login" element={<SovereignLoginPage />} />
                <Route path="/workbench/signup" element={<SovereignSignupPage />} />
                <Route path="/workbench/change-password" element={<SovereignProtectedRoute><SovereignChangePasswordPage /></SovereignProtectedRoute>} />
                <Route path="/workbench" element={<SovereignProtectedRoute><SovereignShell /></SovereignProtectedRoute>}>
                  <Route index element={<SovereignDashboard />} />
                  <Route path="agent" element={<SovereignWorkbench />} />
                  <Route path="documents" element={<SovereignDocuments />} />
                  <Route path="documents/:id" element={<SovereignDocumentDetail />} />
                  <Route path="data-analysis" element={<SovereignDataAnalysis />} />
                  <Route path="deliverables" element={<SovereignDeliverables />} />
                  <Route path="vision" element={<SovereignVision />} />
                  <Route path="coding" element={<SovereignCoding />} />
                  <Route path="approvals" element={<SovereignApprovals />} />
                  <Route path="approvals/:id" element={<SovereignApprovalDetail />} />
                  <Route path="audit" element={<SovereignAudit />} />
                  <Route path="sovereignty" element={<SovereignSovereignty />} />
                  <Route path="security" element={<SovereignSecurity />} />
                  <Route path="models" element={<SovereignModels />} />
                  <Route path="tools" element={<SovereignTools />} />
                  <Route path="users" element={<SovereignUsers />} />
                  <Route path="monitoring" element={<SovereignMonitoring />} />
                </Route>
                <Route path="*" element={<NotFound />} />
      </Routes>
    </motion.div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SovereignAuthProvider>
          <LanguageProvider>
            <BrowserRouter>
              <div className="min-h-screen flex flex-col transition-colors duration-300">
                <VisitTracker />
                <AnimatedRoutes />
              </div>
            </BrowserRouter>
          </LanguageProvider>
        </SovereignAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
