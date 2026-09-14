import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { sovereignMe, sovereignLogout } from '../services/sovereignAuthService';

const SovereignAuthContext = createContext(null);

export function SovereignAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sovereignMe();
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/workbench')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    try {
      await sovereignLogout();
    } catch {}
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    checkAuth,
    logout,
    setUser,
  };

  return (
    <SovereignAuthContext.Provider value={value}>
      {children}
    </SovereignAuthContext.Provider>
  );
}

export function useSovereignAuth() {
  const context = useContext(SovereignAuthContext);
  if (!context) {
    throw new Error('useSovereignAuth must be used within a SovereignAuthProvider');
  }
  return context;
}