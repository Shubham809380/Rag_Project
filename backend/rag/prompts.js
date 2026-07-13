/**
 * Prompt templates for the RAG pipeline
 *
 * Ensures:
 * - Strict context-only answering
 * - Citation tracking
 * - Confidence assessment
 * - Follow-up generation
 * - Language matching
 */

export const SYSTEM_PROMPT = `You are InsightRAG, an AI document assistant.

## CRITICAL RULES — READ CAREFULLY

1. **CONTEXT ONLY**: You MUST answer STRICTLY and ONLY from the provided document context below. Never use outside knowledge. Never use your own memory.
2. **NO HALLUCINATION**: If the context does not contain the answer, you MUST reply exactly: "I couldn't find this information in your uploaded documents." Do NOT guess. Do NOT improvise. Do NOT use your own knowledge.
3. **LANGUAGE**: Reply in the SAME language as the user's question.
4. **CITATIONS**: When stating facts, reference the specific document and page (e.g., "According to [Document], page X...").
5. **NATURAL**: Write complete, natural sentences. Do not copy-paste raw document text verbatim.
6. **CONCISE**: Keep answers focused. Expand only when asked.
7. **CONTACT INFO**: If the user asks for an email, phone number, URL, or any specific data point, extract it EXACTLY as written in the context. Do not paraphrase contact details.

## DOCUMENT CONTEXT`;

export const buildRAGPrompt = (context, question, conversationHistory = []) => {
  const messages = [];

  // System message with strict instructions + context embedded directly
  let systemContent = SYSTEM_PROMPT;

  if (context) {
    systemContent += `\n\n<context>\n${context}\n</context>`;
  } else {
    systemContent += `\n\n<context>\nNo document context available.\n</context>`;
  }

  messages.push({ role: 'system', content: systemContent });

  // Add conversation history (last 6 messages for multi-turn context)
  const recentHistory = conversationHistory.slice(-6);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.message,
    });
  }

  // User question
  messages.push({ role: 'user', content: question });

  return messages;
};

/**
 * Build context string from retrieved chunks with source markers
 */
export function buildContext(chunks) {
  if (!chunks || chunks.length === 0) return '';

  const contextParts = chunks.map((chunk, i) => {
    const source = chunk.metadata?.source || 'Unknown';
    const page = chunk.metadata?.page || '?';
    const section = chunk.metadata?.section || '';
    const sectionLabel = section ? ` > ${section}` : '';

    return `[Source ${i + 1}: ${source} | Page ${page}${sectionLabel}]\n${chunk.pageContent}`;
  });

  return contextParts.join('\n\n---\n\n');
}

/**
 * Generate follow-up suggestions based on the question and answer
 */
export function generateFollowUps(question, answer) {
  const lowerQ = question.toLowerCase();
  const suggestions = [];

  if (lowerQ.includes('summar') || lowerQ.includes('overview')) {
    suggestions.push('List key points from this section');
    suggestions.push('What are the main takeaways?');
  } else if (lowerQ.includes('key point') || lowerQ.includes('important')) {
    suggestions.push('Explain this in more detail');
    suggestions.push('What are the exceptions?');
  } else if (lowerQ.includes('policy') || lowerQ.includes('rule') || lowerQ.includes('guideline')) {
    suggestions.push('What are the consequences of violating this policy?');
    suggestions.push('Are there any exceptions to this rule?');
  } else if (lowerQ.includes('date') || lowerQ.includes('deadline') || lowerQ.includes('when')) {
    suggestions.push('What happens if the deadline is missed?');
    suggestions.push('List all important dates mentioned');
  } else if (lowerQ.includes('compare') || lowerQ.includes('difference')) {
    suggestions.push('Which option is better?');
    suggestions.push('What are the trade-offs?');
  } else {
    suggestions.push('Can you elaborate on this?');
    suggestions.push('What are the related sections?');
    suggestions.push('Summarize the key points');
  }

  return suggestions.slice(0, 3);
}
