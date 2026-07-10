import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';
dotenv.config();

async function queryRAG(question) {
  console.log(`\nQuestion: ${question}\n`);

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-embedding-001',
  });

  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  // Embed question
  console.log('Embedding question...');
  const queryVector = await embeddings.embedQuery(question);

  // Direct Pinecone query
  console.log('Querying Pinecone...');
  const queryResponse = await pineconeIndex.query({
    vector: queryVector,
    topK: 6,
    includeMetadata: true,
  });

  const matches = queryResponse.matches || [];
  console.log(`Found ${matches.length} matches`);

  // Extract context
  const contextParts = [];
  matches.forEach((match, i) => {
    const content = match.metadata?.pageContent || '';
    console.log(`  Match ${i + 1}: score=${match.score?.toFixed(4)}, ${content.length} chars`);
    if (content && content.trim().length > 0) {
      contextParts.push(content);
    }
  });

  const context = contextParts.join('\n\n---\n\n');

  if (!context) {
    console.log('No context found!');
    return;
  }

  // Generate answer with Gemini
  const llm = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxRetries: 2,
    timeout: 60000,
  });

  const messages = [
    {
      role: 'system',
      content: `You are a helpful document assistant. Answer the user's question based ONLY on the provided document context.

CRITICAL RULES:
1. Reply in the SAME language as the user's question.
2. Write complete, natural, conversational sentences. Do NOT copy-paste raw lines.
3. Never output raw labels like "Company Name:" — write full sentences instead.
4. Use ONLY the document context. Do NOT make up information.
5. If context doesn't have the answer, say so politely in the user's language.`,
    },
    {
      role: 'user',
      content: `Document context:\n<context>\n${context}\n</context>\n\nQuestion: ${question}\n\nAnswer naturally in the same language as the question:`,
    },
  ];

  console.log('Generating answer...');
  const response = await llm.invoke(messages);
  console.log(`\nAnswer: ${response.content}\n`);
}

const question = process.argv[2];
if (!question) {
  console.log('Usage: node query.js "your question here"');
  process.exit(1);
}

queryRAG(question).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
