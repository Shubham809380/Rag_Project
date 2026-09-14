import { useState, useEffect, useCallback } from 'react';
import { getDocuments, getKnowledgeBases } from '../services/api';

export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDocuments();
      const list = Array.isArray(data) ? data : data.documents || [];
      setDocuments(list);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { documents, loading, error, reload: load };
}

export function useKnowledgeBases() {
  const [kbs, setKbs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeBases();
      setKbs(Array.isArray(data) ? data : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { kbs, loading, reload: load };
}
