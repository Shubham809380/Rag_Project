import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

// InsightRAG v2 schema: knowledge bases, usage analytics, summaries,
// research/study sessions, feedback, RAG evaluation, user settings.
// These statements are idempotent (CREATE IF NOT EXISTS / ADD IF NOT EXISTS)
// and safe to run on every startup.
export const MIGRATIONS_V2 = `
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kb_user_id ON knowledge_bases(user_id);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type VARCHAR(20) DEFAULT '';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS pages INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ready';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding_status VARCHAR(30) DEFAULT 'ready';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_documents_kb_id ON documents(knowledge_base_id);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_kb_id ON conversations(knowledge_base_id);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  section VARCHAR(500),
  page INTEGER DEFAULT 0,
  chunk_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_user_id ON document_chunks(user_id);

-- Keyword / full-text search index (BM25-ish via PostgreSQL FTS)
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS search_tsv tsvector;
UPDATE document_chunks SET search_tsv = to_tsvector('english', coalesce(text,'')) WHERE search_tsv IS NULL;
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON document_chunks USING GIN(search_tsv);

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  query TEXT,
  document_ids JSONB,
  latency_ms INTEGER DEFAULT 0,
  chunks_retrieved INTEGER DEFAULT 0,
  confidence VARCHAR(20),
  model VARCHAR(100),
  tokens_used INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_code VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_type ON usage_logs(type);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_logs(created_at);

CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feedback VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feedback_message ON message_feedback(message_id);

CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_summaries_user ON summaries(user_id);

CREATE TABLE IF NOT EXISTS research_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  mode VARCHAR(30) DEFAULT 'kb',
  report TEXT NOT NULL,
  sources JSONB,
  progress JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_research_user ON research_sessions(user_id);

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(200),
  difficulty VARCHAR(20),
  questions JSONB,
  answers JSONB,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_sessions(user_id);

CREATE TABLE IF NOT EXISTS rag_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  precision REAL, recall REAL,
  context_relevance REAL, answer_faithfulness REAL,
  citation_correctness REAL, hallucination_rate REAL,
  latency_ms INTEGER, model VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_eval_created ON rag_evaluations(created_at);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  model VARCHAR(100) DEFAULT 'gemini-2.0-flash',
  temperature REAL DEFAULT 0.2,
  response_length VARCHAR(20) DEFAULT 'balanced',
  retrieval_depth INTEGER DEFAULT 5,
  rag_mode VARCHAR(20) DEFAULT 'hybrid',
  agent_mode BOOLEAN DEFAULT FALSE,
  web_research BOOLEAN DEFAULT FALSE,
  language VARCHAR(10) DEFAULT 'en',
  voice_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS rating VARCHAR(10);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);
`;

// Helper used by server.js on startup
export async function runMigrationsV2(pool) {
  try {
    await pool.query(MIGRATIONS_V2);
    return { success: true };
  } catch (err) {
    console.error('[migrate-v2] failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await client.query(MIGRATIONS_V2);
    console.log('Migration v2 completed successfully!');
  } catch (err) {
    console.error('Migration v2 failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].includes('migrate-v2')) {
  main();
}
