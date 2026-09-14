import { generateDocx, generatePdf, generatePptx, saveArtifact } from '../../artifacts/index.js';
import { ToolError } from '../registry.js';

// Document artifacts: Word (structured sections), PDF (text lines), PPTX (titles+bullets).
// All buffered → content-addressed → stored via ArtifactStore with provenance.

export const createWord = {
  name: 'create_word',
  description: 'Generate a .docx artifact with a title, metadata table and structured sections (heading + paragraphs + bullets), optional signature block.',
  permissionLevel: 1,
  timeoutMs: 30000,
  inputSchema: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, meta: { type: 'object' }, sections: { type: 'array' }, signature: { type: 'object' } } },
  outputSchema: { type: 'object', properties: { artifact: { type: 'object' } } },
  async run(args, ctx) {
    if (!args.name) throw new ToolError('create_word requires "name"', { code: 'INVALID_ARGS' });
    if (!/\.docx$/i.test(args.name)) args.name = `${args.name}.docx`;
    const gen = await generateDocx({ title: args.title || 'Workbench Generated Document', meta: args.meta, sections: args.sections, signature: args.signature });
    const buffer = await gen.packer.toBuffer(gen.doc);
    if (buffer.length > 25 * 1024 * 1024) throw new ToolError('Generated document exceeds 25MB limit', { code: 'RESOURCE_LIMIT' });
    const artifact = await saveArtifact({ taskId: ctx.taskId, userId: ctx.user?.id, name: args.name, type: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer, meta: { tool: 'create_word', sections: args.sections?.length || 0 } });
    return { artifact: { id: artifact.id, name: artifact.name, path: artifact.path, size: artifact.size }, downloadPath: `/api/sovereign/artifacts/${artifact.id}/download` };
  },
};

export const createPdf = {
  name: 'create_pdf',
  description: 'Generate a .pdf artifact (A4) with a title, metadata and plain text lines.',
  permissionLevel: 1,
  timeoutMs: 30000,
  inputSchema: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, meta: { type: 'object' }, lines: { type: 'array' } } },
  outputSchema: { type: 'object', properties: { artifact: { type: 'object' } } },
  async run(args, ctx) {
    if (!args.name) throw new ToolError('create_pdf requires "name"', { code: 'INVALID_ARGS' });
    if (!/\.pdf$/i.test(args.name)) args.name = `${args.name}.pdf`;
    const buffer = await generatePdf({ title: args.title || 'Workbench Document', meta: args.meta, lines: args.lines });
    if (buffer.length > 25 * 1024 * 1024) throw new ToolError('Generated document exceeds 25MB limit', { code: 'RESOURCE_LIMIT' });
    const artifact = await saveArtifact({ taskId: ctx.taskId, userId: ctx.user?.id, name: args.name, type: 'pdf', mime: 'application/pdf', buffer, meta: { tool: 'create_pdf' } });
    return { artifact: { id: artifact.id, name: artifact.name, path: artifact.path, size: artifact.size }, downloadPath: `/api/sovereign/artifacts/${artifact.id}/download` };
  },
};

export const createPptx = {
  name: 'create_pptx',
  description: 'Generate a .pptx artifact from slides with a title, bullets and speaker notes.',
  permissionLevel: 1,
  timeoutMs: 30000,
  inputSchema: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, slides: { type: 'array' } } },
  outputSchema: { type: 'object', properties: { artifact: { type: 'object' } } },
  async run(args, ctx) {
    if (!args.name) throw new ToolError('create_pptx requires "name"', { code: 'INVALID_ARGS' });
    if (!/\.pptx$/i.test(args.name)) args.name = `${args.name}.pptx`;
    const buffer = await generatePptx({ title: args.title || 'Workbench Presentation', slides: args.slides });
    if (buffer.length > 25 * 1024 * 1024) throw new ToolError('Generated presentation exceeds 25MB limit', { code: 'RESOURCE_LIMIT' });
    const artifact = await saveArtifact({ taskId: ctx.taskId, userId: ctx.user?.id, name: args.name, type: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer, meta: { tool: 'create_pptx', slides: args.slides?.length || 0 } });
    return { artifact: { id: artifact.id, name: artifact.name, path: artifact.path, size: artifact.size }, downloadPath: `/api/sovereign/artifacts/${artifact.id}/download` };
  },
};