/* Tests for the site build and the preview runtime. Plain Node: node --test tools/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build, buildInfo, contentVersion, stampServiceWorker, eligiblePreviews, localReferences, previewIndexHtml, previewsIndexHtml, runtimeSource, STUB_SERVICE_WORKER } from './build-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = fs.readFileSync(path.join(HERE, 'preview-runtime.js'), 'utf8');

test('the runtime goes first in <head>, with noindex', () => {
  const html = previewIndexHtml('<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<script type="module" src="js/main.js"></script>\n</head></html>');
  const head = html.slice(html.indexOf('<head>'));
  assert.ok(head.indexOf('preview-runtime.js') < head.indexOf('charset'));
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.throws(() => previewIndexHtml('<html><body></body></html>'));
});

test('the runtime gets the build description', () => {
  const info = buildInfo({name: 'pr-7', label: 'PR #7', sha: '0123456789abcdef', number: 7, repo: 'o/r'});
  assert.equal(info.sha, '0123456');
  assert.equal(info.storagePrefix, 'preview:pr-7:');
  assert.equal(info.pullUrl, 'https://github.com/o/r/pull/7');
  const source = runtimeSource(TEMPLATE, info);
  assert.ok(source.includes('"storagePrefix":"preview:pr-7:"'));
  assert.ok(!source.includes('/*BUILD*/ null'));
  assert.throws(() => runtimeSource('no marker', info));
});

test('forks and malformed entries never become previews', () => {
  const pulls = [{number: 3, ref: 'a'}, {number: 4, ref: 'b', isCrossRepository: true}, {number: 'x', ref: 'c'}, {number: 5}];
  assert.deepEqual(eligiblePreviews(pulls).map(p => p.number), [3]);
});

test('local references: relative files only', () => {
  const refs = localReferences(`<link rel="stylesheet" href="css/a.css"><link href="https://fonts.googleapis.com/x">
    <!-- <script src="old.js"></script> --><script type="module" src="./js/main.js?v=2"></script><img src="data:image/png;base64,AA">`, 'index.html');
  assert.deepEqual(refs.sort(), ['css/a.css', 'js/main.js']);
});

test('the previews list escapes titles', () => {
  const html = previewsIndexHtml([{number: 9, title: '<b>x</b>', isDraft: true, sha: 'abc1234'}], 'o/r');
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(html.includes('href="pr-9/"'));
  assert.ok(html.includes('draft'));
});

/* a minimal Storage, enough to check the prefixing */
function fakeStorageClass() {
  class Storage {
    constructor() { this._m = new Map(); }
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }
    setItem(k, v) { this._m.set(k, String(v)); }
    removeItem(k) { this._m.delete(k); }
    key(i) { return [...this._m.keys()][i] ?? null; }
    clear() { this._m.clear(); }
    get length() { return this._m.size; }
  }
  return Storage;
}

test('a preview sees only its own storage', () => {
  const Storage = fakeStorageClass();
  const store = new Storage();
  store.setItem('ub-prefs', 'live');
  const sandbox = {Storage};
  vm.runInNewContext(runtimeSource(TEMPLATE, buildInfo({name: 'pr-2', label: 'PR #2'})), sandbox);
  assert.equal(store.getItem('ub-prefs'), null);
  store.setItem('ub-prefs', 'preview');
  assert.equal(store.getItem('ub-prefs'), 'preview');
  assert.equal(store.length, 1);
  assert.equal(store.key(0), 'ub-prefs');
  store.clear();
  assert.equal(store._m.get('ub-prefs'), 'live');   // the live app's value is untouched
  assert.equal(store._m.size, 1);
});

test('builds the live app and a preview from git', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  try {
    const summary = build({out, main: 'HEAD', previews: [{number: 1, ref: 'HEAD', title: 'Same'}, {number: 2, ref: 'refs/heads/does-not-exist'}], repo: 'o/r'});
    assert.ok(fs.existsSync(path.join(out, 'index.html')));
    assert.ok(fs.existsSync(path.join(out, '.nojekyll')));
    assert.ok(!fs.existsSync(path.join(out, 'tools')), 'tools are not published');
    assert.ok(!fs.existsSync(path.join(out, 'README.md')), 'the README is not published');
    const page = fs.readFileSync(path.join(out, 'preview', 'pr-1', 'index.html'), 'utf8');
    assert.match(page, /preview-runtime\.js/);
    assert.ok(fs.existsSync(path.join(out, 'preview', 'pr-1', 'preview-runtime.js')));
    if (fs.existsSync(path.join(out, 'sw.js'))) {
      assert.equal(fs.readFileSync(path.join(out, 'preview', 'pr-1', 'sw.js'), 'utf8'), STUB_SERVICE_WORKER);
      assert.notEqual(fs.readFileSync(path.join(out, 'sw.js'), 'utf8'), STUB_SERVICE_WORKER);
    }
    assert.deepEqual(summary.results.map(r => [r.number, r.status]), [[1, 'built'], [2, 'skipped']]);
    assert.ok(!fs.existsSync(path.join(out, 'preview', 'pr-2')));
    assert.match(fs.readFileSync(path.join(out, 'preview', 'index.html'), 'utf8'), /pr-1\//);
  } finally {
    fs.rmSync(out, {recursive: true, force: true});
  }
});

test('the cap counts built previews only', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'site-'));
  try {
    const summary = build({out, main: 'HEAD', limit: 1, previews: [{number: 5, ref: 'refs/heads/nope'}, {number: 4, ref: 'HEAD'}, {number: 3, ref: 'HEAD'}]});
    assert.deepEqual(summary.results.map(r => [r.number, r.status]), [[5, 'skipped'], [4, 'built'], [3, 'over-cap']]);
  } finally {
    fs.rmSync(out, {recursive: true, force: true});
  }
});

test('the live service worker gets its version and file list from what is published', () => {
  const sw = "const VERSION = 'v2';\nconst APP_FILES = [\n  './',\n  './old.js'\n];\nself.x = 1;\n";
  const out = stampServiceWorker(sw, 'abc123', ['js/b.js', 'index.html', 'sw.js', 'css/a.css']);
  assert.match(out, /const VERSION = 'abc123';/);
  assert.ok(out.includes("const APP_FILES = [\n  './',\n  './css/a.css',\n  './index.html',\n  './js/b.js'\n];"));
  assert.ok(!out.includes('old.js') && !out.includes("'./sw.js'") && out.endsWith('self.x = 1;\n'));
  assert.throws(() => stampServiceWorker('nothing here', 'x', []));
  const a = contentVersion([['a.js', 'one'], ['b.js', 'two']]);
  assert.equal(a, contentVersion([['b.js', 'two'], ['a.js', 'one']]), 'order does not matter');
  assert.notEqual(a, contentVersion([['a.js', 'one!'], ['b.js', 'two']]), 'content does');
  assert.notEqual(a, contentVersion([['a.js', 'one'], ['c.js', 'two']]), 'names do');
});

test('the preview tab’s Feedback link falls back to a new issue about the preview', () => {
  const sandbox = {};
  vm.runInNewContext(runtimeSource(TEMPLATE, buildInfo({name: 'pr-2', label: 'PR #2', sha: 'abcdef1234'})), sandbox);
  const win = {location: {href: 'https://x.github.io/app/preview/pr-2/#box'}, navigator: {userAgent: 'UA'}, innerWidth: 820, innerHeight: 1180};
  const url = new URL(sandbox.__playbookPreview.feedbackUrl(sandbox.PLAYBOOK_PREVIEW, win));
  assert.equal(url.origin + url.pathname, 'https://github.com/bremondr/ultimate-playbook/issues/new');
  assert.equal(url.searchParams.get('labels'), 'feedback');
  assert.equal(url.searchParams.get('title'), 'Feedback on preview PR #2');
  assert.match(url.searchParams.get('body'), /- Where: Preview PR #2 \(commit abcdef1\)\n- Page: https:\/\/x\.github\.io\/app\/preview\/pr-2\/#box\n- Screen: 820 × 1180 px/);
});
