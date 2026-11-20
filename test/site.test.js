// The offline cache (sw.js FILES) and the deployed site (workflow copy list) must
// both contain every file the page loads. Missing one breaks offline use silently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { posix } from 'node:path';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

/**
 * Relative module specifiers in JS source: `import ... from`, `export ... from`,
 * side-effect `import '...'`, and dynamic `import('...')` with a literal.
 */
function importsOf(source) {
  const re = /(?:^\s*(?:import|export)\s[^'"]*?\bfrom\s*|^\s*import\s*|\bimport\(\s*)['"](\.{1,2}\/[^'"]+)['"]/gm;
  return [...source.matchAll(re)].map((m) => m[1]);
}

/** Every site file reachable from index.html: its src/href assets, the manifest's icons, and the module import graph. */
function siteFiles() {
  const files = new Set(['index.html', 'sw.js']);
  const html = read('index.html');
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!/^[a-z]+:|^\/\//i.test(ref)) files.add(posix.normalize(ref));
  }
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const icon of manifest.icons) files.add(posix.normalize(icon.src));

  const queue = [...files].filter((f) => f.endsWith('.js'));
  while (queue.length) {
    const file = queue.pop();
    for (const spec of importsOf(read(file))) {
      const dep = posix.normalize(posix.join(posix.dirname(file), spec));
      if (!files.has(dep)) {
        files.add(dep);
        queue.push(dep);
      }
    }
  }
  return [...files].sort();
}

function cachedFiles() {
  const list = read('sw.js').match(/const FILES = \[([\s\S]*?)\];/);
  assert.ok(list, 'sw.js has a FILES array');
  return [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
}

function deployedEntries() {
  const line = read('.github/workflows/pages.yml').match(/^\s*cp -r (.+) _site\/\s*$/m);
  assert.ok(line, 'workflow has a "cp -r ... _site/" line');
  return line[1].trim().split(/\s+/);
}

test('import scanner finds every relative module reference form', () => {
  const src = [
    "import { a } from './a.js';",
    'import {\n  b,\n  c,\n} from "../b.js";',
    "import './side.js';",
    "export { d } from './d.js';",
    "export * from './e.js';",
    "const m = await import('./lazy.js');",
    "import x from 'pkg';",
    "const s = './not-an-import.js';",
    "export const t = 'string';",
  ].join('\n');
  assert.deepEqual(importsOf(src), ['./a.js', '../b.js', './side.js', './d.js', './e.js', './lazy.js']);
});

test('import/asset graph finds the expected core files', () => {
  const files = siteFiles();
  for (const f of ['app.js', 'src/encoder.js', 'src/fsk.js', 'src/audio.js', 'style.css', 'manifest.webmanifest']) {
    assert.ok(files.includes(f), f);
  }
});

test('every site file exists and is in the service worker cache list', () => {
  const cached = new Set(cachedFiles());
  for (const f of siteFiles()) {
    assert.ok(existsSync(new URL(f, root)), `${f} exists`);
    if (f !== 'sw.js') assert.ok(cached.has(f), `${f} missing from sw.js FILES`);
  }
});

test('every cached file exists', () => {
  for (const f of cachedFiles()) assert.ok(existsSync(new URL(f, root)), `${f} in FILES but not on disk`);
});

test('every site file is copied by the deploy workflow', () => {
  const entries = deployedEntries();
  for (const f of siteFiles()) {
    assert.ok(entries.some((e) => f === e || f.startsWith(`${e}/`)), `${f} not copied to _site`);
  }
});
