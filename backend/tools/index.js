import { ToolRegistry, toolRegistry } from './registry.js';
import { searchKnowledgeBase, readDocument } from './impl/kbTools.js';
import { ocrDocument, analyzeImage } from './impl/docIntelligence.js';
import { readExcel, writeExcel } from './impl/spreadsheetTools.js';
import { calculate } from './impl/calcTool.js';
import { executePython, runTests } from './impl/codeTools.js';
import { createWord, createPdf, createPptx } from './impl/artifactTools.js';
import { readFile, writeFile } from './impl/fileTools.js';

// ─────────────────────────────────────────────────────────────────────────────
// Sovereign tool suite — declaratively registered so the registry applies
// policy, timeouts, audit and resource limits uniformly.
// ─────────────────────────────────────────────────────────────────────────────

export function buildSovereignTools() {
  const reg = toolRegistry();
  const tools = [
    searchKnowledgeBase, readDocument,
    ocrDocument, analyzeImage,
    readExcel, writeExcel,
    calculate,
    executePython, runTests,
    createWord, createPdf, createPptx,
    readFile, writeFile,
  ];
  for (const t of tools) {
    if (!reg.get(t.name)) reg.register(t);
  }
  return reg;
}

export const sovereignTools = buildSovereignTools();
export { toolRegistry, ToolRegistry };
export default sovereignTools;