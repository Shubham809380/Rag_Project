import { policy } from '../../security/policy.js';
import { getSovereignDB } from '../../storage/sovereignDB.js';
import { sovereignSearch } from '../../rag/sovereignPipeline.js';
import { ToolError } from '../registry.js';

// ── Knowledge base tools ─────────────────────────────────────────────────────
// Access control is enforced here (not in the agent) so that a misbehaving
// agent still cannot retrieve documents the user is not allowed to see.

export const searchKnowledgeBase = {
  name: 'search_knowledge_base',
  description: 'Hybrid semantic + BM25 search over local knowledge base collections with access control. Returns ranked chunks with citations.',
  permissionLevel: 0,
  timeoutMs: 30000,
  inputSchema: { type: 'object', properties: { question: { type: 'string' }, collectionId: { type: 'string' }, documentIds: { type: 'array' }, topK: { type: 'number' } } },
  outputSchema: { type: 'object', properties: { results: { type: 'array' }, citations: { type: 'array' } } },
  async run(args, ctx) {
    const { question, collectionId = null, documentIds = null, topK = 8 } = args;
    if (!question) throw new ToolError('search_knowledge_base requires "question"', { code: 'INVALID_ARGS' });
    const user = policy().normalizeUser(ctx.user);
    const search = await sovereignSearch({ question, user, collectionId, documentIds, topK });
    return {
      results: search.results,
      citations: search.results.map(r => ({ documentId: r.documentId, document: r.document, page: r.page, section: r.section })),
      totalDocs: search.totalDocs,
      note: search.note,
      confidence: search.confidence,
    };
  },
};

export const readDocument = {
  name: 'read_document',
  description: 'Read the extracted text/chunks of a specific uploaded document (page-filtered). Resolves documentId or a filename prefix.',
  permissionLevel: 0,
  timeoutMs: 20000,
  inputSchema: { type: 'object', properties: { documentId: { type: 'string' }, documentName: { type: 'string' }, page: { type: 'number' }, maxChunks: { type: 'number' } } },
  outputSchema: { type: 'object', properties: { documentId: { type: 'string' }, title: { type: 'string' }, chunks: { type: 'array' } } },
  async run(args, ctx) {
    const db = getSovereignDB();
    const user = policy().normalizeUser(ctx.user);
    let doc = args.documentId ? db.getDocument(args.documentId) : args.documentName ? db.getDocumentByFilenamePrefix(args.documentName) : null;
    if (!doc) throw new ToolError('Document not found', { code: 'DOCUMENT_NOT_FOUND' });
    const access = policy().canAccessDocument(user, doc);
    if (!access.allowed) throw new ToolError(`Access denied to ${doc.filename}`, { code: 'ACCESS_DENIED' });
    let chunks = db.getChunksForDocument(doc.id);
    if (args.page) chunks = chunks.filter(c => c.page === args.page);
    const maxChunks = args.maxChunks || chunks.length;
    return { documentId: doc.id, title: doc.filename, classification: doc.classification, department: doc.department, pages: doc.pages, chunks: chunks.slice(0, maxChunks).map(c => ({ index: c.chunkIndex, page: c.page, section: c.section || null, text: c.text })) };
  },
};