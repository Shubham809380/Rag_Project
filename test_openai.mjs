import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });
const model = 'gpt-3.5-turbo'; // ya gpt-4, jo bhi chaho

async function testAll() {
  console.log('=== 1. Text (Chat Completion) ===');
  try {
    const chat = await openai.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: 'Say "Hello, API is working!" in 3 words' }],
      max_tokens: 20,
    });
    console.log('✅ Text:', chat.choices[0].message.content);
  } catch (e) {
    console.log('❌ Text Error:', e.message);
  }

  console.log('\n=== 2. Text-to-Speech (TTS) ===');
  try {
    const tts = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: 'Hello, this is a test of text to speech.',
    });
    const buffer = Buffer.from(await tts.arrayBuffer());
    console.log('✅ TTS: Generated', buffer.length, 'bytes of audio');
  } catch (e) {
    console.log('❌ TTS Error:', e.message);
  }

  console.log('\n=== 3. Embeddings ===');
  try {
    const emb = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: 'Test embedding',
    });
    const dims = emb.data[0].embedding.length;
    console.log('✅ Embedding: dimension =', dims, ', first 5 values =', emb.data[0].embedding.slice(0, 5));
  } catch (e) {
    console.log('❌ Embedding Error:', e.message);
  }
}

testAll();
