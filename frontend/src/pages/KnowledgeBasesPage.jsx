import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Database, Plus, Trash2, Edit2 } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import { Card, PageHeader, EmptyState, PageLoader, PrimaryButton, GhostButton, TextInput, Badge } from '../components/common/ui';
import ConfirmModal from '../components/common/ConfirmModal';
import { useKnowledgeBases } from '../hooks/useCatalog';
import { createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase } from '../services/api';
import { useLanguage } from '../i18n';

export default function KnowledgeBasesPage() {
  const { kbs, loading, reload } = useKnowledgeBases();
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openCreate = () => { setEditing(null); setName(''); setDescription(''); setModalOpen(true); };
  const openEdit = (kb) => { setEditing(kb); setName(kb.name); setDescription(kb.description || ''); setModalOpen(true); };

  const save = async () => {
    if (!name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      if (editing) { await updateKnowledgeBase(editing.id, { name: name.trim(), description }); toast.success('Knowledge base updated'); }
      else { await createKnowledgeBase({ name: name.trim(), description }); toast.success('Knowledge base created'); }
      setModalOpen(false);
      await reload();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <AppLayout title={t('knowledgeBases')}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '13px' } }} />
      <div className="max-w-5xl mx-auto p-6">
        <PageHeader
          title={t('knowledgeBases')}
          subtitle="Organize your documents into collections and scope chat & research to them"
          actions={<PrimaryButton onClick={openCreate}><Plus size={16} /> New Knowledge Base</PrimaryButton>}
        />

        {loading ? <PageLoader /> : kbs.length === 0 ? (
          <Card>
            <EmptyState icon={Database} title="No knowledge bases yet"
              description="Create a knowledge base to group related documents together."
              action={<PrimaryButton onClick={openCreate}><Plus size={16} /> Create Knowledge Base</PrimaryButton>} />
          </Card>
        ) : (
          <div className="grid gap-3">
            {kbs.map((kb) => (
              <Card key={kb.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(139,92,246,0.1)' }}>
                  <Database size={18} style={{ color: '#8B5CF6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-fg truncate">{kb.name}</p>
                  {kb.description && <p className="text-[13px] text-fg-muted truncate">{kb.description}</p>}
                  <div className="flex items-center gap-2 mt-1 text-[12px] text-fg-muted">
                    <Badge color="#8B5CF6">{kb.doc_count ?? 0} documents</Badge>
                    <Badge color="#3B82F6">{kb.conv_count ?? 0} conversations</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <GhostButton onClick={() => openEdit(kb)}><Edit2 size={15} /></GhostButton>
                  <button onClick={() => setDeleteTarget(kb)} className="p-2 rounded-lg text-fg-muted hover:bg-card-hover hover:text-error"><Trash2 size={16} /></button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6">
            <h3 className="text-lg font-bold text-heading mb-4">{editing ? 'Edit Knowledge Base' : 'New Knowledge Base'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Name</label>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product Docs" />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg mb-1">Description (optional)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  className="w-full rounded-xl border bg-input px-4 py-3 text-sm text-fg focus-ring outline-none"
                  style={{ borderColor: 'var(--border-default)' }} placeholder="What is this knowledge base about?" />
              </div>
              <div className="flex justify-end gap-2">
                <GhostButton onClick={() => setModalOpen(false)}>Cancel</GhostButton>
                <PrimaryButton onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          try { await deleteKnowledgeBase(deleteTarget.id); toast.success('Knowledge base deleted'); }
          catch { toast.error('Failed to delete'); }
          setDeleteTarget(null); await reload();
        }}
        title="Delete Knowledge Base"
        message={`This will remove "${deleteTarget?.name}" and its associated conversations. Documents will be kept but unassigned.`}
        confirmLabel="Delete" />
    </AppLayout>
  );
}
