/**
 * Smart Chunker - Section-aware with overlap
 *
 * Specs from architecture:
 * - Chunk size: 700-1000 chars
 * - Overlap: 150-200 chars
 * - Section-aware chunks
 * - Page metadata preserved
 */

const HEADING_PATTERNS = [
  /^(#{1,6})\s+(.+)/,
  /^([A-Z][A-Z\s]{2,80})$/,
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,8})$/,
  /^(\d+(\.\d+)*)\s+(.+)/,
  /^(Chapter|Section|Part|Article|Clause|Appendix|Paragraph)\s+/i,
  /^(Introduction|Conclusion|Summary|Abstract|Background|Methodology|Results|Discussion|References|Contact\s+Information|Company\s+Policy|Terms\s+and\s+Conditions|Privacy\s+Policy)\s*$/i,
];

const TABLE_ROW_PATTERN = /\|.*\|/;
const LIST_ITEM_PATTERN = /^\s*[-*•]\s+/;
const NUMBERED_LIST_PATTERN = /^\s*\d+[.)]\s+/;

const TARGET_CHARS = 850;
const MAX_CHARS = 1000;
const MIN_CHARS = 50;
const OVERLAP_CHARS = 180;

function detectLineType(line) {
  const trimmed = line.trim();
  if (!trimmed) return 'empty';
  if (TABLE_ROW_PATTERN.test(trimmed)) return 'table';
  if (LIST_ITEM_PATTERN.test(trimmed)) return 'list-item';
  if (NUMBERED_LIST_PATTERN.test(trimmed)) return 'numbered-list';
  for (const pattern of HEADING_PATTERNS) {
    if (pattern.test(trimmed)) return 'heading';
  }
  return 'text';
}

function detectHeadingTitle(line) {
  const trimmed = line.trim();
  for (const pattern of HEADING_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      if (match[3]) return match[3].trim();
      if (match[2]) return match[2].trim();
      return trimmed;
    }
  }
  return null;
}

function cleanText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/ {3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function groupIntoBlocks(lines) {
  const blocks = [];
  let currentBlock = null;

  for (const line of lines) {
    const type = detectLineType(line);

    if (type === 'heading') {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        type: 'heading',
        heading: detectHeadingTitle(line) || line.trim(),
        rawLines: [line],
      };
    } else if (type === 'empty') {
      if (currentBlock) {
        currentBlock.rawLines.push(line);
      }
    } else if (type === 'table') {
      if (!currentBlock || currentBlock.type !== 'table') {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'table', heading: '', rawLines: [] };
      }
      currentBlock.rawLines.push(line);
    } else if (type === 'list-item' || type === 'numbered-list') {
      if (!currentBlock || (currentBlock.type !== 'list' && currentBlock.type !== 'numbered-list')) {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: type === 'list-item' ? 'list' : 'numbered-list', heading: '', rawLines: [] };
      }
      currentBlock.rawLines.push(line);
    } else {
      if (!currentBlock || currentBlock.type !== 'text') {
        if (currentBlock) blocks.push(currentBlock);
        currentBlock = { type: 'text', heading: '', rawLines: [] };
      }
      currentBlock.rawLines.push(line);
    }
  }
  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

function blocksToChunks(blocks, metadata = {}) {
  const chunks = [];
  let currentHeading = '';
  let currentText = [];
  let currentChars = 0;
  let chunkIndex = 0;

  function flushChunk() {
    const text = currentText.join('\n\n').trim();
    if (text.length >= MIN_CHARS) {
      chunks.push({
        pageContent: text,
        metadata: {
          ...metadata,
          section: currentHeading || undefined,
          chunkIndex: chunkIndex++,
          charCount: text.length,
        },
      });
    }
    currentText = [];
    currentChars = 0;
  }

  function getOverlapText() {
    const full = currentText.join('\n\n').trim();
    if (full.length <= OVERLAP_CHARS) return full;
    return full.slice(-OVERLAP_CHARS);
  }

  for (const block of blocks) {
    const blockText = block.rawLines.join('\n').trim();
    const blockChars = blockText.length;

    if (block.type === 'heading') {
      if (currentText.length > 0) {
        flushChunk();
      }
      currentHeading = block.heading;
      currentText.push(blockText);
      currentChars += blockChars;
    } else if (block.type === 'table') {
      if (currentChars + blockChars > MAX_CHARS && currentText.length > 0) {
        flushChunk();
      }
      currentText.push(blockText);
      currentChars += blockChars;
    } else {
      if (currentChars + blockChars > TARGET_CHARS && currentText.length > 0) {
        const overlap = getOverlapText();
        flushChunk();
        if (overlap) {
          currentText.push(overlap);
          currentChars = overlap.length;
        }
      }
      currentText.push(blockText);
      currentChars += blockChars;
    }

    if (currentChars >= MAX_CHARS) {
      const overlap = getOverlapText();
      flushChunk();
      if (overlap) {
        currentText.push(overlap);
        currentChars = overlap.length;
      }
    }
  }

  flushChunk();
  return chunks;
}

export function smartChunk(text, metadata = {}) {
  const cleaned = cleanText(text);
  if (!cleaned || cleaned.length < 10) return [];

  const lines = cleaned.split('\n');
  const blocks = groupIntoBlocks(lines);
  return blocksToChunks(blocks, metadata);
}

export function chunkByPages(pages, baseMetadata = {}) {
  const allChunks = [];

  for (const page of pages) {
    const pageNum = page.pageNumber || 0;
    const text = page.text || '';
    const chunks = smartChunk(text, { ...baseMetadata, page: pageNum });
    allChunks.push(...chunks);
  }

  allChunks.forEach((chunk, i) => {
    chunk.metadata.chunkIndex = i;
  });

  return allChunks;
}
