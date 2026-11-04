// 單機版打包：把 index.html、CSS 與所有 ES module 合併成「單一 HTML 檔」，
// 不需要伺服器，雙擊就能用瀏覽器開啟（file://）。只用 Node 內建模組，沒有第三方套件。
//
//   node scripts/build-standalone.js        → dist/翻牌配對.html
//
// 這不是通用打包器，只支援本專案用到的寫法：
//   import { a, b } from './x.js';     （不支援 default、* as、改名 as）
//   export function / const / let / class
// 遇到不支援的寫法、重複的頂層名稱，或匯入了不存在的名稱時，會直接報錯而不是產出壞檔。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT_LINE = /^import\s+\{([^}]*)\}\s+from\s+'(\.[^']+)';[ \t]*\r?$/gm;
const EXPORT_DECL = /^export\s+((?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*))/gm;
const TOP_DECL = /^(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

function parseModule(file) {
  const rel = relative(root, file).replaceAll('\\', '/');
  const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const imports = [];
  let body = source.replace(IMPORT_LINE, (_, names, from) => {
    const list = names.split(',').map((n) => n.trim()).filter(Boolean);
    if (list.some((n) => /\s/.test(n))) throw new Error(`${rel}：不支援改名匯入（${names.trim()}）`);
    imports.push({ names: list, file: resolve(dirname(file), from) });
    return '';
  });
  if (/^\s*import\b/m.test(body) || /\bimport\s*\(/.test(body)) throw new Error(`${rel}：有不支援的 import 寫法`);
  if (/^export\s+(\{|default|\*)/m.test(body)) throw new Error(`${rel}：不支援 export { } / default / *`);
  const exports = new Set([...body.matchAll(EXPORT_DECL)].map((m) => m[2]));
  body = body.replace(EXPORT_DECL, '$1');
  const declared = [...body.matchAll(TOP_DECL)].map((m) => m[1]);
  return { file, rel, imports, exports, declared, body };
}

// 依賴先、使用者後（深度優先）。
function collect(entry) {
  const modules = new Map();
  const visiting = new Set();
  const visit = (file) => {
    if (modules.has(file)) return;
    if (visiting.has(file)) throw new Error(`循環匯入：${relative(root, file)}`);
    visiting.add(file);
    const mod = parseModule(file);
    for (const imp of mod.imports) visit(imp.file);
    visiting.delete(file);
    modules.set(file, mod);
  };
  visit(entry);
  return [...modules.values()];
}

export function buildStandalone() {
  const mods = collect(resolve(root, 'src/ui/main.js'));

  const owner = new Map();
  for (const m of mods) {
    for (const name of m.declared) {
      if (owner.has(name)) throw new Error(`頂層名稱重複：${name}（${owner.get(name)} 與 ${m.rel}）`);
      owner.set(name, m.rel);
    }
  }
  const byFile = new Map(mods.map((m) => [m.file, m]));
  for (const m of mods) {
    for (const imp of m.imports) {
      for (const name of imp.names) {
        if (!byFile.get(imp.file).exports.has(name)) throw new Error(`${m.rel} 匯入了不存在的 ${name}（來自 ${relative(root, imp.file)}）`);
      }
    }
  }

  const script = mods.map((m) => `// ---- ${m.rel} ----\n${m.body.trim()}\n`).join('\n');
  if (/<\/script/i.test(script)) throw new Error('程式碼含有 </script，無法內嵌');
  const css = readFileSync(resolve(root, 'src/ui/style.css'), 'utf8');
  if (/<\/style/i.test(css)) throw new Error('CSS 含有 </style，無法內嵌');

  let html = readFileSync(resolve(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  const link = '<link rel="stylesheet" href="src/ui/style.css">';
  const tag = '<script type="module" src="src/ui/main.js"></script>';
  if (!html.includes(link) || !html.includes(tag)) throw new Error('index.html 的 CSS／script 標籤與腳本預期的不同');
  html = html.replace(link, () => `<style>\n${css}</style>`).replace(tag, () => `<script type="module">\n${script}</script>`);
  return html;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = buildStandalone();
  mkdirSync(resolve(root, 'dist'), { recursive: true });
  const out = resolve(root, 'dist', '翻牌配對.html');
  writeFileSync(out, html);
  console.log(`已產生 ${relative(root, out)}（${(Buffer.byteLength(html) / 1024).toFixed(0)} KB）`);
}
