import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStandalone } from '../scripts/build-standalone.js';

const html = buildStandalone();
const script = html.match(/<script type="module">\n([\s\S]*)<\/script>/)[1];

test('單機版：CSS 與程式都內嵌，不再引用外部檔案', () => {
  assert.ok(html.includes('<style>'));
  assert.ok(!html.includes('src="src/'));
  assert.ok(!html.includes('href="src/'));
  assert.ok(html.includes('<title>翻牌配對</title>'));
});

test('單機版：合併後沒有殘留 import／export', () => {
  assert.ok(!/^\s*import\b/m.test(script));
  assert.ok(!/^export\b/m.test(script));
});

test('單機版：所有模組都有被合併進來', () => {
  for (const name of ['src/game/state.js', 'src/store/db.js', 'src/ui/editor.js', 'src/ui/main.js']) {
    assert.ok(script.includes(`// ---- ${name} ----`), name);
  }
});

test('單機版：合併後的程式語法正確', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mm-build-'));
  try {
    const file = join(dir, 'bundle.mjs');
    writeFileSync(file, script);
    execFileSync(process.execPath, ['--check', file]); // 語法錯誤會丟例外
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
