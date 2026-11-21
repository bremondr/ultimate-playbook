#!/usr/bin/env node
/* Checks the module graph under js/: no import cycles, and every import points down the layers
     base (util, events) → data → model → render → services (library, storage, share) → UI (player, nav, editor) → main
   Imports within one layer are allowed as long as they form no cycle.
   js/vendor/<module>/ is a copy of a module released in bremondr/web-kit: it may only import from itself.
   Plain Node, no packages:  node tools/check-imports.mjs   (exit code 1 when something is wrong) */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = join(root, 'js');
const LAYERS = ['base', 'data', 'model', 'render', 'services', 'ui', 'main'];
function layerOf(m){
  if (m === 'util.js' || m === 'events.js') return 'base';
  if (m === 'main.js') return 'main';
  if (['library.js', 'storage.js', 'share.js'].includes(m)) return 'services';
  const top = m.split('/')[0];
  if (['data', 'model', 'render'].includes(top)) return top;
  return 'ui';   // player.js, nav.js, editor/
}

const files = [];
(function walk(dir){ for (const f of readdirSync(dir)){ const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } })(jsDir);
const name = p => relative(jsDir, p).split('\\').join('/');

// static imports only: `import x from '…'`, `import {a} from '…'`, `import '…'` (comments are stripped first)
const graph = {};
for (const f of files){
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const deps = [...src.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]);
  graph[name(f)] = deps.map(d => {
    if (!d.startsWith('.')) throw new Error(`${name(f)}: only relative imports are allowed, found ${d}`);
    return name(resolve(dirname(f), d));
  });
}

const problems = [];
for (const [m, deps] of Object.entries(graph)) for (const d of deps){
  if (!graph[d]) problems.push(`${m} imports ${d}, which does not exist`);
  else if (LAYERS.indexOf(layerOf(d)) > LAYERS.indexOf(layerOf(m))) problems.push(`${m} (${layerOf(m)}) imports ${d} (${layerOf(d)}): up the layers`);
  const own = m.startsWith('vendor/') && m.split('/').slice(0, 2).join('/') + '/';
  if (own && !d.startsWith(own)) problems.push(`${m} imports ${d}: a vendored module may only import from itself`);
}
// depth-first search; a module met again while still on the path closes a cycle
const state = {}, path = [];
function visit(m){
  state[m] = 'open'; path.push(m);
  for (const d of graph[m] || []){
    if (state[d] === 'open') problems.push('cycle: ' + [...path.slice(path.indexOf(d)), d].join(' → '));
    else if (!state[d]) visit(d);
  }
  path.pop(); state[m] = 'done';
}
Object.keys(graph).sort().forEach(m => { if (!state[m]) visit(m); });

const edges = Object.values(graph).reduce((n, d) => n + d.length, 0);
const count = l => Object.keys(graph).filter(m => layerOf(m) === l).length;
console.log(`${files.length} modules, ${edges} imports. Per layer: ${LAYERS.map(l => `${l} ${count(l)}`).join(', ')}.`);
if (problems.length){ problems.forEach(p => console.log('PROBLEM ' + p)); process.exit(1); }
console.log('No import cycles; every import points down the layers.');
