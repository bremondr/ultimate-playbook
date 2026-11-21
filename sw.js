/* Service worker: lets the app open and run offline, and from the iPad home screen.
   - Every app file is stored at install, in a cache named after VERSION, and served from there first.
   - The page itself (index.html) is fetched from the network first, so updates arrive, with the stored copy as fallback.
   - Google Fonts are stored the first time they load, and refreshed in the background.
   - Older app caches are deleted when a new version takes over.
   - Previews of pull requests (under preview/, see README) are left alone.
   VERSION and APP_FILES are filled in when the site is built (tools/build-site.mjs): a hash of the published
   files and their list. The values here are only used when the folder is served as it is, for local testing. */
const VERSION = 'v2';
const CACHE = 'playbook-' + VERSION;
const FONT_CACHE = 'playbook-fonts';
const PREVIEWS = new URL('./preview/', self.registration.scope).pathname;
const APP_FILES = [
  './',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/base.css',
  './css/features.css',
  './css/player.css',
  './css/shared.css',
  './css/studio.css',
  './css/tokens.css',
  './index.html',
  './js/data/angel.js',
  './js/data/builtins.js',
  './js/data/fields.js',
  './js/data/formations.js',
  './js/editor/canvas.js',
  './js/editor/drill-tab.js',
  './js/editor/hint.js',
  './js/editor/history.js',
  './js/editor/keys.js',
  './js/editor/pieces.js',
  './js/editor/pointer.js',
  './js/editor/rail.js',
  './js/editor/selection.js',
  './js/editor/session.js',
  './js/editor/step-tab.js',
  './js/editor/studio.js',
  './js/editor/tabs.js',
  './js/editor/text-fields.js',
  './js/editor/tools/cone.js',
  './js/editor/tools/defense.js',
  './js/editor/tools/erase.js',
  './js/editor/tools/group.js',
  './js/editor/tools/index.js',
  './js/editor/tools/offense.js',
  './js/editor/tools/place.js',
  './js/editor/tools/select.js',
  './js/editor/tools/throw.js',
  './js/editor/viewport.js',
  './js/events.js',
  './js/features/backup.js',
  './js/features/feedback-issue.js',
  './js/features/feedback.js',
  './js/features/present.js',
  './js/features/qr.js',
  './js/feedback-kit/feedback-kit.css',
  './js/feedback-kit/issue.js',
  './js/feedback-kit/kit.js',
  './js/feedback-kit/picture.js',
  './js/feedback-kit/sketch.js',
  './js/library.js',
  './js/main.js',
  './js/model/compile.js',
  './js/model/drafts.js',
  './js/model/facing.js',
  './js/model/formation.js',
  './js/model/labels.js',
  './js/model/motion.js',
  './js/model/throws.js',
  './js/model/timing.js',
  './js/nav.js',
  './js/player.js',
  './js/pwa.js',
  './js/render/pieces.js',
  './js/render/pitch.js',
  './js/render/svg.js',
  './js/render/thumb.js',
  './js/render/view.js',
  './js/share.js',
  './js/storage.js',
  './js/util.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(APP_FILES.map(u => new Request(u, {cache: 'reload'}))))   // skip the browser's HTTP cache
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('playbook-') && k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// network first, stored copy when offline (or when the network takes too long)
async function pageFirstFromNetwork(req){
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 4000))]);
    if (res.ok) cache.put('./index.html', res.clone());
    return res;
  } catch (err){
    return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
  }
}
// stored copy first; anything not stored yet is fetched and kept
async function cacheFirst(req){
  const hit = await caches.match(req, {ignoreSearch: true});
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok){ const cache = await caches.open(CACHE); cache.put(req, res.clone()); }
  return res;
}
// stored copy at once, refreshed in the background for next time. The page's stylesheet <link> stores an opaque copy,
// which a CORS request (Send feedback reading the font for its picture) can't use: that waits for the network instead.
async function staleWhileRevalidate(req){
  const cache = await caches.open(FONT_CACHE), stored = await cache.match(req);
  const hit = stored && !(stored.type === 'opaque' && req.mode === 'cors') ? stored : null;
  const fresh = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // previews of pull requests live under preview/ on the same site: they are not this app, so leave them to the network
  if (url.origin === self.location.origin && url.pathname.startsWith(PREVIEWS)) return;
  if (url.origin === self.location.origin){
    const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.href === self.registration.scope;
    e.respondWith(isPage ? pageFirstFromNetwork(req) : cacheFirst(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(staleWhileRevalidate(req));
  }
});
