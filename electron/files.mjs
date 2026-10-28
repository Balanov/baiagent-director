import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const MAX_FILE_BYTES = 8_000_000;
const MAX_FILES = 10;
const MAX_DEPTH = 5;
const MAX_VISITED = 1000;
const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.pdf', '.docx']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', '.svn', '.hg']);

export async function scanLocalFolder(folderPath) {
  const root = await fs.realpath(folderPath);
  const rootStat = await fs.stat(root);
  if (!rootStat.isDirectory()) throw new Error('Выберите папку, а не файл');
  const candidates = [];
  let totalSupported = 0;
  let visited = 0;
  let truncated = false;
  async function walk(directory, depth) {
    if (depth > MAX_DEPTH || visited >= MAX_VISITED) { truncated = true; return; }
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (visited >= MAX_VISITED) { truncated = true; return; }
      visited += 1;
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) await walk(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      try {
        const stat = await fs.stat(fullPath);
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
        totalSupported += 1;
        candidates.push({ path: fullPath, modifiedAt: stat.mtimeMs });
      } catch { /* A disappearing file is skipped without stopping the scan. */ }
    }
  }
  await walk(root, 0);
  candidates.sort((a, b) => b.modifiedAt - a.modifiedAt || a.path.localeCompare(b.path));
  if (candidates.length > MAX_FILES) truncated = true;
  return {
    root,
    totalSupported,
    truncated,
    filePaths: candidates.slice(0, MAX_FILES).map(item => item.path),
  };
}

export async function readLocalDocuments(filePaths) {
  const documents = [];
  for (const filePath of filePaths.slice(0, MAX_FILES)) {
    const extension = path.extname(filePath).toLowerCase();
    if (!['.txt', '.md', '.csv', '.json', '.pdf', '.docx'].includes(extension)) continue;
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
    let text = '';
    if (['.txt', '.md', '.csv', '.json'].includes(extension)) {
      text = await fs.readFile(filePath, 'utf8');
    } else if (extension === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.text;
    } else if (extension === '.pdf') {
      const parser = new PDFParse({ data: await fs.readFile(filePath) });
      try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
    }
    text = text.replace(/\s+/g, ' ').trim().slice(0, 24000);
    if (text) documents.push({
      id: `local-${documents.length + 1}`, kind: 'local-document', url: `local://${path.basename(filePath)}`,
      title: path.basename(filePath), text, retrievedAt: new Date().toISOString(),
    });
  }
  return documents;
}
