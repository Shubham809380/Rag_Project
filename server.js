import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isVercel = !!process.env.VERCEL;

app.use(cors());
app.use(express.json());

const uploadsDir = isVercel ? '/tmp' : path.join(__dirname, 'uploads');
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, TXT files are allowed'));
    }
  },
});

const uploadMultiple = upload.array('files', 10);

if (!isVercel && !fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

const history = [];
const fileStore = {};

function getEmbeddings() {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-embedding-001',
  });
}

function getPineconeIndex() {
  const pc = new Pinecone();
  return pc.Index(process.env.PINECONE_INDEX_NAME);
}

// Helper: process a single file and index into Pinecone
async function processFile(file) {
  const filePath = file.path;
  const fileName = file.originalname;
  const fileExt = path.extname(fileName).toLowerCase();

  console.log(`\n=== UPLOAD: ${fileName} ===`);

  let rawDocs = [];
  if (fileExt === '.pdf') {
    const loader = new PDFLoader(filePath);
    rawDocs = await loader.load();
  } else {
    const content = fs.readFileSync(filePath, 'utf-8');
    rawDocs = [{ pageContent: content, metadata: { source: fileName } }];
  }

  console.log(`Loaded ${rawDocs.length} pages`);

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
  const chunks = await splitter.splitDocuments(rawDocs);
  console.log(`Split into ${chunks.length} chunks`);

  const embeddings = getEmbeddings();
  const pineconeIndex = getPineconeIndex();
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  let totalUpserted = 0;
  const BATCH_SIZE = 20;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE).filter((doc) => doc.pageContent.trim().length > 10);
    if (batch.length === 0) continue;

    const texts = batch.map((doc) => doc.pageContent);
    const vectors = await embeddings.embedDocuments(texts);

    const records = [];
    for (let idx = 0; idx < batch.length; idx++) {
      if (vectors[idx] && vectors[idx].length > 0) {
        records.push({
          id: `${fileId}-chunk-${i + idx}`,
          values: vectors[idx],
          metadata: {
            pageContent: batch[idx].pageContent.substring(0, 1000),
            source: fileName,
            fileId: fileId,
            page: batch[idx].metadata?.loc?.pageNumber || 0,
          },
        });
      }
    }

    if (records.length > 0) {
      await pineconeIndex.upsert({ records });
      totalUpserted += records.length;
    }
  }

  fileStore[fileId] = { fileName, chunks: totalUpserted, date: new Date().toISOString() };

  try { fs.unlinkSync(filePath); } catch {}

  console.log(`=== INDEXED: ${fileName} → ${totalUpserted} chunks ===`);

  return {
    fileId,
    fileName,
    pages: rawDocs.length,
    chunks: totalUpserted,
  };
}

// Upload single or multiple files
app.post('/api/upload', (req, res) => {
  uploadMultiple(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({ message: 'Upload error: ' + err.message });
      }

      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }

      const results = [];
      for (const file of files) {
        const result = await processFile(file);
        results.push(result);
      }

      console.log(`\n=== ALL DONE: ${results.length} files indexed ===\n`);

      res.json({
        files: results,
        message: `${results.length} document(s) uploaded and indexed successfully`,
      });
    } catch (error) {
      console.error('Upload error:', error.message);
      console.error(error.stack);
      res.status(500).json({ message: 'Failed to process document: ' + error.message });
    }
  });
});

// Analyze document
app.post('/api/analyze', async (req, res) => {
  try {
    const { question, fileId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Question is required' });
    }

    console.log(`\n=== ANALYZE: "${question}" ===`);

    const embeddings = getEmbeddings();
    const pineconeIndex = getPineconeIndex();

    // Embed the question
    const queryVector = await embeddings.embedQuery(question);
    console.log(`Query embedded (${queryVector.length} dimensions)`);

    // Direct Pinecone query - bypass LangChain PineconeStore
    const queryResponse = await pineconeIndex.query({
      vector: queryVector,
      topK: 10,
      includeMetadata: true,
    });

    const matches = queryResponse.matches || [];
    console.log(`Pinecone returned ${matches.length} matches`);

    // Filter by score and deduplicate
    const MIN_SCORE = 0.5;
    const seen = new Set();
    const contextParts = [];
    
    matches.forEach((match, i) => {
      const content = match.metadata?.pageContent || '';
      const score = match.score;
      
      // Skip low score matches
      if (score < MIN_SCORE) {
        console.log(`  Match ${i + 1}: SKIPPED (score=${score.toFixed(4)} < ${MIN_SCORE})`);
        return;
      }
      
      // Skip duplicate content
      const fingerprint = content.substring(0, 100).trim().toLowerCase();
      if (seen.has(fingerprint)) {
        console.log(`  Match ${i + 1}: SKIPPED (duplicate)`);
        return;
      }
      seen.add(fingerprint);
      
      console.log(`  Match ${i + 1}: score=${score.toFixed(4)}, ${content.length} chars`);
      if (content && content.trim().length > 0) {
        contextParts.push(content);
      }
    });

    const context = contextParts.join('\n\n---\n\n');

    if (!context) {
      console.log('No context found!');
      res.json({ answer: "I don't have enough information to answer this. No relevant content was found in the indexed documents." });
      return;
    }

    console.log(`Context length: ${context.length} chars`);

    // Generate answer with Gemini
    const llm = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      temperature: 0.3,
      maxRetries: 2,
      timeout: 60000,
    });

    const systemMessage = `You are a helpful document assistant. Your job is to answer questions based ONLY on the provided document context.

CRITICAL RULES:
1. LANGUAGE: You MUST reply in the SAME language as the user's question. If the user asks in Hindi, reply entirely in Hindi. If in English, reply in English. If in Spanish, reply in Spanish. Always match the question's language.
2. NATURAL ANSWERING: Write complete, natural, conversational sentences. Do NOT just copy-paste raw lines, labels, or bullet points from the document. Explain the answer like you are talking to a person.
3. NO RAW LABELS: Never output things like "Company Name: XYZ" or "Working Hours: 9-5". Instead write "The company's name is XYZ" or "Working hours are from 9 to 5."
4. CONTEXT ONLY: Use ONLY the information from the provided document context. Do NOT add any outside knowledge or make assumptions.
5. INSUFFICIENT INFO: If the document context does not contain enough information to answer the question, say so politely in the user's language.`;

    const messages = [
      { role: 'system', content: systemMessage },
      {
        role: 'user',
        content: `Document context:\n<context>\n${context}\n</context>\n\nQuestion: ${question}\n\nAnswer naturally in the same language as the question, using complete sentences:`,
      },
    ];

    // Generate answer with Gemini - try multiple models as fallback
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest'];
    let llmResponse = null;
    let lastError = null;

    for (const modelName of models) {
      try {
        const llm = new ChatGoogleGenerativeAI({
          apiKey: process.env.GEMINI_API_KEY,
          model: modelName,
          temperature: 0.3,
          maxRetries: 1,
          timeout: 30000,
        });
        console.log(`Trying model: ${modelName}...`);
        llmResponse = await llm.invoke(messages);
        console.log(`Success with ${modelName}`);
        break;
      } catch (err) {
        lastError = err;
        console.log(`  ${modelName} failed: ${err.message?.substring(0, 80)}`);
        continue;
      }
    }

    if (!llmResponse) {
      console.error('All models failed:', lastError?.message);
      res.status(503).json({ 
        message: 'AI service quota exceeded. Please try again after some time.' 
      });
      return;
    }

    const answer = llmResponse.content;
    console.log(`Answer length: ${answer.length} chars`);
    console.log(`Answer preview: ${answer.substring(0, 150)}...`);

    const historyItem = {
      id: `analysis-${Date.now()}`,
      question: question,
      answer: answer,
      fileId: fileId || null,
      fileName: fileStore[fileId]?.fileName || req.body.fileName || 'Document',
      date: new Date().toISOString(),
    };
    history.unshift(historyItem);
    if (history.length > 50) history.pop();

    console.log(`=== ANSWER READY ===\n`);

    res.json({
      answer: answer,
      id: historyItem.id,
    });
  } catch (error) {
    console.error('Analyze error:', error.message);
    console.error(error.stack);
    res.status(500).json({ message: 'Analysis failed: ' + error.message });
  }
});

// Debug: check what's in Pinecone
app.get('/api/debug', async (req, res) => {
  try {
    const pineconeIndex = getPineconeIndex();
    const stats = await pineconeIndex.describeIndexStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// History
app.get('/api/history', (req, res) => {
  res.json(history);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend build (for production deploy)
const frontendBuild = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.use((req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// Error handler (must be last)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: 'File upload error: ' + err.message });
  }
  res.status(500).json({ message: err.message || 'Internal server error' });
});

// Listen only when running directly (not on Vercel)
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  POST /api/upload    - Upload & index document`);
    console.log(`  POST /api/analyze   - Ask question about document`);
    console.log(`  GET  /api/history   - Get analysis history`);
    console.log(`  GET  /api/debug     - Check Pinecone data`);
    console.log(`  GET  /api/health    - Health check`);
  });
}

export { app };
