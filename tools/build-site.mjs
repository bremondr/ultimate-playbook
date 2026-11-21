#!/usr/bin/env node
/* Builds the folder published to GitHub Pages: the app from main at the root, and a preview of every open pull
   request under /preview/pr-<number>/. Nothing is copied from a working tree; every version is read straight
   from a git ref, so this works the same in CI and on a laptop. Plain Node, no packages.

     node tools/build-site.mjs --out _site --main main [--previews previews.json] [--repo owner/name] [--summary build-summary.json]

   previews.json:       [{"number": 16, "title": "...", "ref": "refs/previews/pr-16", "isDraft": false}, ...]
   build-summary.json:  (not published) for each pull request asked for: built (with the commit), skipped (and why)
                        or over the cap. The workflow turns it into one comment per pull request.

   A preview is the app exactly as in its pull request, with three changes made here:
   - tools/preview-runtime.js is the first script of its index.html (its own browser storage, and a badge);
   - a robots noindex tag, so previews stay out of search results;
   - its sw.js, if any, is replaced with one that does nothing, so a preview never caches files or deletes
     the live app's offline copy (all versions share one origin, and so one set of caches).
   See "Previews of pull requests" in the README. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/** What makes up the site. Everything else in the repository (tests, tools, README) is not published. Missing ones are fine. */
export const SITE_PATHS = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];
export const APP_PAGE = 'index.html';
export const MAX_PREVIEWS = 20;

/** What a preview's sw.js becomes: installs, takes over its own pages and lets every request through to the network. */
export const STUB_SERVICE_WORKER = `/* Previews don't work offline: this stands in for the app's service worker (see tools/build-site.mjs). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
`;

/* ---- pure helpers (tested in tools/build-site.test.mjs) ---- */

export const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

export const previewName = number => `pr-${Number(number)}`;

/** What a preview runs with: label, short commit, storage prefix and links (relative, so they hold wherever the site is). */
export function buildInfo({ name, label, sha, number, repo }) {
  return {
    name,
    label,
    sha: sha ? String(sha).slice(0, 7) : '',
    storagePrefix: `preview:${name}:`,
    productionUrl: '../../',
    indexUrl: '../',
    pullUrl: repo && number ? `https://github.com/${repo}/pull/${Number(number)}` : ''
  };
}

/** The preview's page: noindex, and the runtime first so storage is separate before any of the app runs. */
export function previewIndexHtml(html) {
  if (!/<head[^>]*>/i.test(html)) throw new Error('The page has no <head> to add the preview runtime to.');
  return html.replace(/<head[^>]*>/i, open => `${open}\n<meta name="robots" content="noindex">\n<script src="preview-runtime.js"></script>`);
}

/** The runtime with this preview's description filled in. */
export function runtimeSource(template, info) {
  const marker = '/*BUILD*/ null';
  if (!template.includes(marker)) throw new Error('preview-runtime.js has no build marker.');
  return template.replace(marker, () => JSON.stringify(info));
}

/** /preview/index.html: the live previews and where each came from. */
export function previewsIndexHtml(previews, repo) {
  const items = previews.map(p => {
    const title = p.title ? ` <span class="title">${escapeHtml(p.title)}</span>` : '';
    const draft = p.isDraft ? ' <span class="tag">draft</span>' : '';
    const sha = p.sha ? ` <code>${escapeHtml(p.sha)}</code>` : '';
    const source = repo ? ` <a class="src" href="https://github.com/${escapeHtml(repo)}/pull/${Number(p.number)}">PR #${Number(p.number)}</a>` : '';
    return `    <li><a href="${escapeHtml(previewName(p.number))}/">${escapeHtml(previewName(p.number))}</a>${title}${draft}${sha}${source}</li>`;
  });
  const body = items.length ? `  <ul>\n${items.join('\n')}\n  </ul>` : '  <p>No previews right now. Open a pull request to get one.</p>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ultimate Playbook previews</title>
<style>
  :root { color-scheme: light dark; --fg: #1b2420; --muted: #55625b; --tag: #e6eee9; --link: #1E6B39; }
  @media (prefers-color-scheme: dark) { :root { --fg: #e4ece7; --muted: #9fb0a6; --tag: #26332c; --link: #7fd19c; } }
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 16px; color: var(--fg); }
  a { color: var(--link); }
  li { margin: 0.5rem 0; }
  .title, code { color: var(--muted); }
  .tag { font-size: 0.75rem; background: var(--tag); border-radius: 4px; padding: 0 0.35rem; }
  .src { font-size: 0.85rem; }
</style>
</head>
<body>
  <h1>Ultimate Playbook previews</h1>
  <p>Work in progress, one per open pull request. Each preview keeps its own saved drills, separate from the <a href="../">live app</a>, and doesn't work offline.</p>
${body}
</body>
</html>
`;
}

/** Same-repository pull requests only, in the order given (newest first). Capped in build(), after skipping. */
export function eligiblePreviews(pulls) {
  return pulls.filter(p => p && Number.isInteger(p.number) && p.ref && !p.isCrossRepository);
}

const FILE_ATTRIBUTES = [['script', 'src'], ['link', 'href'], ['img', 'src']];

/** Local files a page loads: every relative <script src>, <link href> and <img src>, as site paths. */
export function localReferences(html, pagePath) {
  const found = new Set();
  const bare = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const [tag, attribute] of FILE_ATTRIBUTES) {
    for (const element of bare.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) || []) {
      const match = element.match(new RegExp(`\\s${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
      const value = match && (match[1] ?? match[2] ?? match[3]);
      if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(value)) continue;   // other sites, data: URLs, anchors
      let target = value.split(/[?#]/)[0];
      try { target = decodeURIComponent(target); } catch { /* keep it as written */ }
      if (target) found.add(path.posix.normalize(path.posix.join(path.posix.dirname(pagePath), target)));
    }
  }
  return [...found];
}

/** For a GitHub comment built from file names in a pull request: one short line, no markup. */
const plainText = text => String(text).replace(/[^\w./ @+,()-]/g, '?').slice(0, 200);

/* ---- reading a version out of git ---- */

const git = args => execFileSync('git', args, {cwd: ROOT, maxBuffer: 256 * 1024 * 1024});
const commitOf = ref => git(['rev-parse', '--verify', `${ref}^{commit}`]).toString().trim();

/** A pull request that can't have a preview; `reason` is what the comment on it says. */
export class SkipError extends Error {
  constructor(message, reason) { super(message); this.reason = reason; }
}

/** Writes the site's files as they are at `ref` into `dir`; returns their paths. */
function exportSite(ref, dir) {
  const listed = git(['ls-tree', '-r', '--name-only', '-z', ref, '--', ...SITE_PATHS]).toString().split('\0').filter(Boolean);
  if (!listed.includes(APP_PAGE)) throw new SkipError(`${ref} has no ${APP_PAGE}`, `the head has no ${APP_PAGE}`);
  for (const file of listed) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, git(['show', `${ref}:${file}`]));
  }
  return listed;
}

/** Throws a SkipError when the page loads a local file that isn't in the export. */
function checkExport(dir, listed) {
  const have = new Set(listed);
  const missing = localReferences(fs.readFileSync(path.join(dir, APP_PAGE), 'utf8'), APP_PAGE).filter(f => !have.has(f));
  if (missing.length) {
    const shown = missing.slice(0, 3).map(plainText).join(', ');
    throw new SkipError(`missing: ${missing.join(', ')}`, `files the page loads are missing from the head (${shown}${missing.length > 3 ? `, and ${missing.length - 3} more` : ''})`);
  }
}

/* ---- build ---- */

export function build({ out, main, previews = [], repo = '', limit = MAX_PREVIEWS }) {
  fs.rmSync(out, {recursive: true, force: true});
  fs.mkdirSync(out, {recursive: true});
  const summary = {production: commitOf(main), previews: [], results: []};

  exportSite(main, out);
  fs.writeFileSync(path.join(out, '.nojekyll'), '');

  const template = fs.readFileSync(path.join(HERE, 'preview-runtime.js'), 'utf8');
  const built = [];
  // the cap counts previews really built, so a skipped pull request doesn't use up a place
  for (const preview of eligiblePreviews(previews)) {
    const name = previewName(preview.number);
    const dir = path.join(out, 'preview', name);
    if (built.length >= limit) {
      summary.results.push({number: preview.number, name, status: 'over-cap', reason: `only the newest ${limit} previews are published`});
      continue;
    }
    try {
      let commit;
      try { commit = commitOf(preview.ref); } catch { throw new SkipError(`${preview.ref} is not available`, 'its head could not be fetched'); }
      const listed = exportSite(preview.ref, dir);
      checkExport(dir, listed);
      const info = buildInfo({name, label: `PR #${preview.number}`, sha: commit, number: preview.number, repo});
      fs.writeFileSync(path.join(dir, 'preview-runtime.js'), runtimeSource(template, info));
      const page = path.join(dir, APP_PAGE);
      fs.writeFileSync(page, previewIndexHtml(fs.readFileSync(page, 'utf8')));
      if (listed.includes('sw.js')) fs.writeFileSync(path.join(dir, 'sw.js'), STUB_SERVICE_WORKER);
      built.push({...preview, sha: info.sha});
      summary.previews.push({name, sha: info.sha});
      summary.results.push({number: preview.number, name, status: 'built', sha: info.sha});
    } catch (error) {
      // one pull request that can't be built must never stop the live app from being published
      console.warn(`Skipping ${name}: ${error.message}`);
      fs.rmSync(dir, {recursive: true, force: true});
      summary.results.push({number: preview.number, name, status: 'skipped', reason: error.reason || `it could not be prepared (${plainText(error.message)})`});
    }
  }
  fs.mkdirSync(path.join(out, 'preview'), {recursive: true});
  fs.writeFileSync(path.join(out, 'preview', 'index.html'), previewsIndexHtml(built, repo));
  return summary;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) throw new Error(`Unexpected argument ${argv[i]}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function cli() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.out || !args.main) throw new Error('Usage: node tools/build-site.mjs --out <dir> --main <ref> [--previews <file.json>] [--repo owner/name] [--summary <file.json>]');
  const previews = args.previews ? JSON.parse(fs.readFileSync(args.previews, 'utf8')) : [];
  const summary = build({out: path.resolve(args.out), main: args.main, previews, repo: args.repo || ''});
  if (args.summary) fs.writeFileSync(path.resolve(args.summary), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`live app ${summary.production.slice(0, 7)}; ${summary.previews.length} preview(s): ${summary.previews.map(p => `${p.name}@${p.sha}`).join(', ') || 'none'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) cli();
