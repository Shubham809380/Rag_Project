import { Navigate, useLocation } from 'react-router-dom';
import { useSovereignAuth } from '../../context/SovereignAuthContext';
import LoadingSpinner from '../common/LoadingSpinner';

export default function SovereignProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useSovereignAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/workbench/login" state={{ from: location }} replace />;
  }

  if (user?.status && user.status !== 'active') {
    return <Navigate to="/workbench/login" state={{ from: location, inactive: true }} replace />;
  }

  // Forced password change: only the change-password page is reachable.
  if (user?.mustChangePassword && location.pathname !== '/workbench/change-password') {
    return <Navigate to="/workbench/change-password" replace />;
  }

  return children;
}