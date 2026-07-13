import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import DashboardHeader from '../components/layout/DashboardHeader';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatView from '../components/chat/ChatView';
import DocumentPanel from '../components/documents/DocumentPanel';
import DocumentPreview from '../components/chat/DocumentPreview';
import ConfirmModal from '../components/common/ConfirmModal';
import {
  getConversations,
  deleteConversation,
  getConversationMessages,
  getDocuments,
  deleteDocument,
  uploadDocument,
  analyzeDocument,
} from '../services/api';

export default function DashboardPage() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [docsPanelOpen, setDocsPanelOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);



  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(Array.isArray(data) ? data : data.conversations || []);
    } catch { setConversations([]); }
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const data = await getDocuments();
      setDocuments(Array.isArray(data) ? data : data.documents || []);
    } catch { setDocuments([]); }
  }, []);

  useEffect(() => { loadConversations(); loadDocuments(); }, [loadConversations, loadDocuments]);

  useEffect(() => {
    if (!activeConversationId) { setMessages([]); return; }
    (async () => {
      try {
        const data = await getConversationMessages(activeConversationId);
        const msgs = Array.isArray(data) ? data : data.messages || [];
        setMessages(msgs.map(m => ({
          ...m,
          content: m.content || m.message || '',
          sources: m.sources || [],
          followUps: m.followUps || [],
        })));
      } catch { setMessages([]); }
    })();
  }, [activeConversationId]);

  const handleNewChat = () => { setActiveConversationId(null); setMessages([]); };

  const handleSelectConversation = (id) => {
    setActiveConversationId(id);
    setMobileSidebarOpen(false);
    setPreviewOpen(false);
    setPreviewSource(null);
  };

  const handleDeleteConversation = async (id) => {
    try {
      await deleteConversation(id);
      if (activeConversationId === id) { setActiveConversationId(null); setMessages([]); }
      loadConversations();
      toast.success('Conversation deleted');
    } catch { toast.error('Failed to delete conversation'); }
  };

  const handleSend = async (text) => {
    if (!text.trim() || isLoading) return;
    const userMessage = { id: `temp-${Date.now()}`, role: 'user', content: text.trim(), createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    try {
      const data = await analyzeDocument({ question: text.trim(), fileId: null, conversationId: activeConversationId });
      const answer = data.answer || data.result || data.response || '';
      if (data.conversationId && !activeConversationId) {
        setActiveConversationId(data.conversationId);
        setConversations((prev) => [{ id: data.conversationId, title: text.trim().slice(0, 60), created_at: new Date().toISOString() }, ...prev]);
      }
      setMessages((prev) => [...prev, {
        id: `msg-${Date.now()}`, role: 'assistant', content: answer, createdAt: new Date().toISOString(),
        sources: data.sources || [], confidence: data.confidence || null, followUps: data.followUps || [], model: data.model || null,
      }]);
      loadConversations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to get response');
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', createdAt: new Date().toISOString() }]);
    } finally { setIsLoading(false); }
  };

  // Accepts a File object from DocumentPanel
  const handleFileUpload = async (input) => {
    const file = input instanceof File ? input : null;
    if (!file) return;
    const t = toast.loading(`Uploading ${file.name}...`);
    try {
      await uploadDocument(file);
      toast.success(`${file.name} uploaded!`, { id: t });
      loadDocuments();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      toast.error(`Upload failed: ${msg}`, { id: t, duration: 5000 });
    }
  };

  const handleDeleteDocument = async (id) => {
    try { await deleteDocument(id); setDocuments((prev) => prev.filter((d) => d.id !== id)); toast.success('Document deleted'); loadDocuments(); }
    catch { toast.error('Failed to delete document'); }
  };

  const handlePreviewSource = (source) => {
    setPreviewSource(source);
    setPreviewOpen(true);
    setDocsPanelOpen(false);
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      <Toaster position="top-right" toastOptions={{
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' },
        duration: 3000,
        success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
        error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
      }} />


      <ChatSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onDelete={(id) => setDeleteTarget({ type: 'conversation', id })}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <DashboardHeader
          onToggleSidebar={() => setMobileSidebarOpen(true)}
          onToggleDocs={() => { setDocsPanelOpen((v) => !v); setPreviewOpen(false); }}
          docsPanelOpen={docsPanelOpen}
        />

        <div className="flex-1 flex overflow-hidden relative">
          <ChatView
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            onOpenDocs={() => setDocsPanelOpen(true)}
            onPreviewSource={handlePreviewSource}
          />

          <DocumentPreview
            source={previewSource}
            isOpen={previewOpen}
            onClose={() => { setPreviewOpen(false); setPreviewSource(null); }}
          />

          <DocumentPanel
            documents={documents}
            onUpload={handleFileUpload}
            onDelete={(id) => setDeleteTarget({ type: 'document', id })}
            isOpen={docsPanelOpen}
            onClose={() => setDocsPanelOpen(false)}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'conversation') handleDeleteConversation(deleteTarget.id);
          else if (deleteTarget?.type === 'document') handleDeleteDocument(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title={deleteTarget?.type === 'conversation' ? 'Delete Conversation' : 'Delete Document'}
        message={deleteTarget?.type === 'conversation'
          ? 'This will permanently delete this conversation and all its messages.'
          : 'This will permanently delete this document and remove all its chunks from the vector database.'}
        confirmLabel="Delete"
      />
    </div>
  );
}
