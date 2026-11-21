/* PREVIEW RUNTIME
   Added by tools/build-site.mjs to preview builds only (a pull request published under /preview/pr-<n>/), as the
   first script of the page. Production and the app's own source never contain it. It does two things:

   1. Gives the preview its own browser storage. Every version on the GitHub Pages site shares one origin, so
      without this a preview would read and overwrite the drills and settings saved by production and by the
      other previews. Every localStorage and sessionStorage key gets a per-preview prefix instead, unseen by the app.
   2. Shows a small badge, so nobody mistakes a preview for the real app.

   The `null` after the BUILD marker below is replaced with this preview's description when it is built. */
(function (root) {
  'use strict';

  const build = /*BUILD*/ null;

  /* ---- storage ---- */

  // Patches the prototype: assigning methods on a Storage instance would store items named "getItem" instead.
  function installStoragePrefix(StorageClass, prefix) {
    const proto = StorageClass.prototype;
    const original = {getItem: proto.getItem, setItem: proto.setItem, removeItem: proto.removeItem, key: proto.key};
    const realLength = Object.getOwnPropertyDescriptor(proto, 'length').get;

    function ownNames(storage) {
      const names = [], count = realLength.call(storage);
      for (let i = 0; i < count; i++) {
        const key = original.key.call(storage, i);
        if (key !== null && key.startsWith(prefix)) names.push(key.slice(prefix.length));
      }
      return names;
    }

    proto.getItem = function (key) { return original.getItem.call(this, prefix + key); };
    proto.setItem = function (key, value) { return original.setItem.call(this, prefix + key, value); };
    proto.removeItem = function (key) { return original.removeItem.call(this, prefix + key); };
    proto.key = function (index) { const names = ownNames(this); return index < names.length ? names[index] : null; };
    proto.clear = function () { ownNames(this).forEach(name => original.removeItem.call(this, prefix + name)); };
    Object.defineProperty(proto, 'length', {configurable: true, get() { return ownNames(this).length; }});
  }

  /* ---- badge ---- */

  // A small tab in the bottom-right corner, so it covers as little of the app as it can. Tapping it shows the
  // commit and the links; × hides it until the page is loaded again.
  function showBadge(info, doc) {
    const badge = doc.createElement('div');
    badge.className = 'preview-badge';
    badge.setAttribute('role', 'note');
    badge.style.cssText = 'position:fixed;right:calc(8px + env(safe-area-inset-right, 0px));bottom:0;z-index:2147483000;'
      + 'display:flex;align-items:center;gap:8px;max-width:calc(100vw - 16px);overflow:hidden;'
      + 'padding:3px 6px calc(3px + env(safe-area-inset-bottom, 0px)) 6px;border-radius:8px 8px 0 0;'
      + 'background:#7a3e00;color:#fff;font:600 12px/1.2 system-ui,sans-serif;box-shadow:0 -2px 10px rgba(0,0,0,.25)';

    const toggle = doc.createElement('button');
    toggle.type = 'button';
    toggle.textContent = 'Preview ' + info.label;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.style.cssText = 'border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:4px 6px;white-space:nowrap';
    badge.appendChild(toggle);

    const more = doc.createElement('span');
    more.hidden = true;
    more.style.cssText = 'display:flex;align-items:center;gap:10px;white-space:nowrap';
    const link = (label, href) => {
      const a = doc.createElement('a');
      a.textContent = label;
      a.href = href;
      a.style.cssText = 'color:#ffd9a8;text-decoration:underline';
      return a;
    };
    if (info.sha) { const c = doc.createElement('span'); c.textContent = info.sha; c.style.cssText = 'font-weight:400;opacity:.8'; more.appendChild(c); }
    if (info.pullUrl) more.appendChild(link('pull request', info.pullUrl));
    more.appendChild(link('live app', info.productionUrl));
    more.appendChild(link('all previews', info.indexUrl));
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Hide the preview badge');
    close.style.cssText = 'border:0;background:transparent;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:2px 6px;min-width:28px;min-height:28px';
    close.addEventListener('click', () => badge.remove());
    more.appendChild(close);
    badge.appendChild(more);

    toggle.addEventListener('click', () => {
      more.hidden = !more.hidden;
      more.style.display = more.hidden ? 'none' : 'flex';
      toggle.setAttribute('aria-expanded', String(!more.hidden));
    });
    more.style.display = 'none';
    doc.body.appendChild(badge);
  }

  if (build) {
    root.PLAYBOOK_PREVIEW = build;
    if (typeof root.Storage === 'function') installStoragePrefix(root.Storage, build.storagePrefix);
    if (typeof root.document !== 'undefined') {
      const doc = root.document;
      // after parsing, when <title> exists: this script runs before it
      const show = () => { doc.title = build.label + ' · ' + doc.title; showBadge(build, doc); };
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', show);
      else show();
    }
  }

  root.__playbookPreview = {installStoragePrefix, showBadge};
})(typeof window !== 'undefined' ? window : globalThis);
