// Export helpers. Markdown is generated directly; PDF uses a lightweight approach.
// PDF requires the 'pdfkit' optional dependency; if absent, falls back to plain text.

let pdfkit = null;
try { pdfkit = await import('pdfkit'); } catch { pdfkit = null; }

function stripMarkdown(md) {
  return (md || '')
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, '$2')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '- ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*|__|\*|_/g, '')
    .replace(/\|/g, ' ')
    .split('\n').map(l => l.trim()).filter(l => l).join('\n');
}

export function toMarkdown({ title = 'Sovereign AI Workbench Export', content, meta = {} }) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  if (Object.keys(meta).length) {
    lines.push(`**Exported:** ${new Date().toLocaleString()}`);
    for (const [k, v] of Object.entries(meta)) {
      if (v != null && v !== '') lines.push(`**${k}:** ${v}`);
    }
    lines.push('');
  }
  lines.push(content);
  return lines.join('\n');
}

export function toPDF({ title = 'Sovereign AI Workbench Export', content }) {
  if (!pdfkit) {
    // Fallback: return plain text document
    return { format: 'txt', buffer: Buffer.from(`# ${title}\n\n${stripMarkdown(content)}`, 'utf8') };
  }
  const PDFDocument = pdfkit.default || pdfkit;
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];
  return new Promise((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve({ format: 'pdf', buffer: Buffer.concat(chunks) }));
    doc.on('error', reject);
    doc.fontSize(20).text(title, { underline: true });
    doc.moveDown();
    stripMarkdown(content).split('\n').forEach((line) => {
      if (line.startsWith('- ')) {
        doc.fontSize(11).list([line.slice(2)]);
      } else {
        doc.fontSize(11).text(line);
      }
      doc.moveDown(0.3);
    });
    doc.end();
  });
}

export async function exportDocument({ format = 'markdown', title, content, meta }) {
  if (format === 'pdf') return toPDF({ title, content });
  if (format === 'txt') return { format: 'txt', buffer: Buffer.from(stripMarkdown(title + '\n\n' + content), 'utf8') };
  return { format: 'markdown', buffer: Buffer.from(toMarkdown({ title, content, meta }), 'utf8') };
}
