import { ToolError } from '../registry.js';
import { artifactDir, saveArtifact } from '../../artifacts/index.js';

// Workbooks are parsed to a clean row/column representation (safe), and
// generated via the ArtifactStore (no templates/macros). No formula execution
// ever happens — the workbench never runs untrusted spreadsheet formulas.

const MAX_CELLS = 50_000;
const MAX_ROWS = 2_000;

export const readExcel = {
  name: 'read_excel',
  description: 'Read an Excel workbook from a stored upload into plain rows/columns. Never executes spreadsheet formulas.',
  permissionLevel: 0,
  timeoutMs: 60000,
  inputSchema: { type: 'object', properties: { documentId: { type: 'string' }, documentName: { type: 'string' }, sheet: { type: 'string' }, maxRows: { type: 'number' } } },
  outputSchema: { type: 'object', properties: { sheets: { type: 'array' }, rows: { type: 'array' } } },
  async run(args, ctx) {
    const { getSovereignDB } = await import('../../storage/sovereignDB.js');
    const namespace = await import('xlsx');
    const XLSX = namespace.default || namespace;
    const db = getSovereignDB();
    let doc = args.documentId ? db.getDocument(args.documentId) : args.documentName ? db.getDocumentByFilenamePrefix(args.documentName) : null;
    if (!doc) throw new ToolError('Document not found', { code: 'DOCUMENT_NOT_FOUND' });
    if (!/\.(xlsx|xls)$/i.test(doc.filename)) throw new ToolError('Not an Excel file', { code: 'INVALID_ARGS' });
    if (!doc.filePath) throw new ToolError('Source file not stored on this host.', { code: 'SOURCE_MISSING' });
    const wb = XLSX.readFile(doc.filePath, { cellFormula: false, cellNF: false });
    const sheets = [];
    let selected = args.sheet;
    if (!selected) selected = wb.SheetNames[0];
    let total = 0;
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const rows = aoa.slice(0, args.maxRows || MAX_ROWS).map(r => r.map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : v)));
      total += rows.length * (rows[0]?.length || 0);
      if (total > MAX_CELLS) throw new ToolError(`Workbook exceeds ${MAX_CELLS} cells read limit`, { code: 'RESOURCE_LIMIT' });
      sheets.push({ name, rowCount: aoa.length, colCount: Math.max(...aoa.map(r => r.length), 0), rows });
      if (name === selected && args.sheet) {
        return { sheet, sheets, rows };
      }
    }
    const target = sheets.find(s => s.name === selected);
    return { sheet: selected, sheets, rows: target ? target.rows : [] };
  },
};

export const writeExcel = {
  name: 'write_excel',
  description: 'Generate a new Excel artifact from rows/columns and save it to the artifact store.',
  permissionLevel: 2,
  timeoutMs: 60000,
  inputSchema: { type: 'object', properties: { name: { type: 'string' }, sheets: { type: 'array' } } },
  outputSchema: { type: 'object', properties: { artifact: { type: 'object' } } },
  async run(args, ctx) {
    const namespace = await import('xlsx');
    const XLSX = namespace.default || namespace;
    if (!args.name) throw new ToolError('write_excel requires "name"', { code: 'INVALID_ARGS' });
    if (!/\.xlsx$/i.test(args.name)) args.name = `${args.name}.xlsx`;
    const wb = XLSX.utils.book_new();
    for (const s of args.sheets || []) {
      if (!s.rows) continue;
      const ws = s.header ? XLSX.utils.aoa_to_sheet([s.header, ...s.rows.map(r => Array.isArray(r) ? r : Object.values(r))]) : XLSX.utils.aoa_to_sheet(s.rows.map(r => Array.isArray(r) ? r : Object.values(r)));
      XLSX.utils.book_append_sheet(wb, ws, (s.name || 'Sheet1').slice(0, 31));
    }
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const artifact = await saveArtifact({ taskId: ctx.taskId, userId: ctx.user?.id, name: args.name, type: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer, meta: { tool: 'write_excel', sheets: args.sheets?.length } });
    return { artifact: { id: artifact.id, name: artifact.name, path: artifact.path, size: artifact.size } , downloadPath: `/api/sovereign/artifacts/${artifact.id}/download` };
  },
};