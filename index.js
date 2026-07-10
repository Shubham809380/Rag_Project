import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import * as dotenv from 'dotenv';
dotenv.config();
import { Pinecone } from '@pinecone-database/pinecone';

async function indexDocument() {
  const PDF_PATH = './dsa.pdf';

  console.log('Loading PDF...');
  const pdfLoader = new PDFLoader(PDF_PATH);
  const rawDocs = await pdfLoader.load();
  console.log('Loaded PDF:', rawDocs.length, 'pages');

  console.log('Splitting into chunks...');
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunkedDocs = await textSplitter.splitDocuments(rawDocs);
  console.log('Chunks:', chunkedDocs.length);

  console.log('Initializing embeddings...');
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-embedding-001',
  });

  console.log('Connecting to Pinecone...');
  const pinecone = new Pinecone();
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

  const BATCH_SIZE = 20;
  for (let i = 0; i < chunkedDocs.length; i += BATCH_SIZE) {
    const batch = chunkedDocs.slice(i, i + BATCH_SIZE);
    const validBatch = batch.filter((doc) => doc.pageContent.trim().length > 10);
    if (validBatch.length === 0) continue;

    const texts = validBatch.map((doc) => doc.pageContent);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chunkedDocs.length / BATCH_SIZE);

    console.log(`Embedding batch ${batchNum}/${totalBatches} (${validBatch.length} docs)...`);
    const vectors = await embeddings.embedDocuments(texts);

    const records = [];
    for (let idx = 0; idx < validBatch.length; idx++) {
      if (vectors[idx] && vectors[idx].length > 0) {
        records.push({
          id: `chunk-${i + idx}`,
          values: vectors[idx],
          metadata: {
            pageContent: validBatch[idx].pageContent.substring(0, 1000),
            source: validBatch[idx].metadata?.source || PDF_PATH,
            page: validBatch[idx].metadata?.loc?.pageNumber || 0,
          },
        });
      }
    }

    if (records.length > 0) {
      console.log(`Upserting ${records.length} records...`);
      await pineconeIndex.upsert({ records });
    }
  }

  console.log('Indexing complete!');
}

indexDocument().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
