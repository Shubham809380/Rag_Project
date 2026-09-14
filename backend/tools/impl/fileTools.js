import fs from 'fs';
import path from 'path';
import sovereign from '../../config/sovereign.js';
import { ToolError } from '../registry.js';

// Workspace-scoped file I/O. All paths are resolved and confined under
// sovereign.paths.workspaceDir — traversal is rejected, nothing else is
// readable/writable. Contents should be small text/JSON config snippets,
// never sensitive documents (use search_knowledge_base / read_document for those).

const MAX_WRITE_BYTES = 2 * 1024 * 1024;
const MAX_READ_BYTES = 2 * 1024 * 1024;

function resolveWorkspace(p) {
  const base = path.resolve(sovereign.paths.workspaceDir);
  fs.mkdirSync(base, { recursive: true });
  const target = path.resolve(base, String(p || '').replace(/^[/\\]+/, ''));
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new ToolError('Path escapes the agent workspace', { code: 'PATH_TRAVERSAL' });
  }
  return target;
}

export const readFile = {
  name: 'read_file',
  description: 'Read a small text/JSON file from the agent workspace (confined, traversal-blocked, 2MB cap).',
  permissionLevel: 0,
  timeoutMs: 10000,
  needsNetwork: false,
  inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { content: { type: 'string' } } },
  async run(args, ctx) {
    if (!args.path) throw new ToolError('read_file requires "path"', { code: 'INVALID_ARGS' });
    const target = resolveWorkspace(args.path);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new ToolError('File not found in workspace', { code: 'FILE_NOT_FOUND' });
    const stat = fs.statSync(target);
    if (stat.size > MAX_READ_BYTES) throw new ToolError('File exceeds 2MB read limit', { code: 'RESOURCE_LIMIT' });
    return { path: args.path, size: stat.size, content: fs.readFileSync(target, 'utf-8') };
  },
};

export const writeFile = {
  name: 'write_file',
  description: 'Write a small text/JSON file into the agent workspace (confined, traversal-blocked, 2MB cap). For durable deliverable documents use create_word / create_pdf instead.',
  permissionLevel: 2,
  timeoutMs: 10000,
  needsNetwork: false,
  inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
  outputSchema: { type: 'object', properties: { path: { type: 'string' }, bytes: { type: 'number' } } },
  async run(args, ctx) {
    if (!args.path) throw new ToolError('write_file requires "path"', { code: 'INVALID_ARGS' });
    const content = String(args.content ?? '');
    if (Buffer.byteLength(content) > MAX_WRITE_BYTES) throw new ToolError('File exceeds 2MB write limit', { code: 'RESOURCE_LIMIT' });
    const target = resolveWorkspace(args.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf-8');
    return { path: args.path, bytes: Buffer.byteLength(content) };
  },
};