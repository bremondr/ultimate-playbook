/* ---------- drill list (drawer), popovers (info, options, share), and the new-drill chooser ---------- */
import { dirty, draft, endSession } from './editor/session.js';
import { emit } from './events.js';
import { libEntries, team } from './library.js';
import { blankDraft, copyOfEntry } from './model/drafts.js';
import { matchesQuery, matchesTags } from './model/search.js';
import { tagsInUse } from './model/tags.js';
import { current, model, select, sharedRaw } from './player.js';
import { builtinLink, drillLink } from './share.js';
import { canWrite, storeMode } from './storage.js';
import { $ } from './util.js';

/* tags: the drill list shows only drills with every tag picked (remembered in this browser) */
const withTags = e => e.tags ? {...e.play, tags: e.tags} : e.play;
let picked = (() => { try { const v = JSON.parse(localStorage.getItem('ub-nav-tags') || '[]'); return Array.isArray(v) ? v.filter(t => typeof t === 'string') : []; } catch (err){ return []; } })();
function setPicked(list){ picked = list; try { localStorage.setItem('ub-nav-tags', JSON.stringify(picked)); } catch (err){} }
function renderTagFilter(all){
  const box = $('#nav-tags'), tags = tagsInUse(all.map(e => e.tags));
  // a tag nobody has any more is let go, once the saved drills have loaded (before that, they just aren't there yet)
  if (storeMode !== 'pending' && picked.some(t => !tags.includes(t))) setPicked(picked.filter(t => tags.includes(t)));
  picked.filter(t => !tags.includes(t)).forEach(t => tags.push(t));   // still shown, so it can be cleared
  box.replaceChildren(); box.hidden = !tags.length;
  tags.forEach(t => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tagchip'; b.textContent = t;
    b.setAttribute('aria-pressed', picked.includes(t) ? 'true' : 'false');
    b.addEventListener('click', () => { setPicked(picked.includes(t) ? picked.filter(x => x !== t) : [...picked, t]); buildNav(); });
    box.appendChild(b);
  });
  if (picked.length){
    const c = document.createElement('button'); c.type = 'button'; c.className = 'link'; c.textContent = 'Clear';
    c.addEventListener('click', () => { setPicked([]); buildNav(); }); box.appendChild(c);
  }
}

/* Integration point (practice plans, js/features/plans.js): sections drawn above the plays and drills. Each is a
   function (search text) → an element, or null for nothing. */
const sections = [];
export function addNavSection(fn){ sections.push(fn); }

/* the drill list, filtered by the search box (all words, any order; case and accents don't matter) */
export function buildNav(){
  const nav = $('#nav'); nav.replaceChildren();
  const query = $('#nav-search').value, all = libEntries();
  renderTagFilter(all);
  sections.forEach(fn => { const el = fn(query); if (el) nav.appendChild(el); });
  const entries = all.filter(e => matchesQuery(withTags(e), query) && matchesTags(withTags(e), picked));
  if (!entries.length && (query.trim() || picked.length)){
    const p = document.createElement('p'); p.className = 'small navnone'; p.textContent = 'No drills match. ';
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'link'; clear.textContent = 'Clear the search and tags';
    clear.addEventListener('click', () => { $('#nav-search').value = ''; setPicked([]); buildNav(); $('#nav-search').focus(); });
    p.appendChild(clear); nav.appendChild(p);
  }
  ['Play','Drill'].forEach(kind => {
    const list = entries.filter(e => e.play.kind === kind);
    if (!list.length) return;
    const grp = document.createElement('div'); grp.className = 'group';
    const h = document.createElement('h2'); h.textContent = kind + 's'; grp.appendChild(h);
    const ul = document.createElement('ul'); ul.className = 'list';
    list.forEach(e => {
      const p = e.play, total = p.steps.reduce((a,s)=>a+s.dur,0), throws = p.steps.filter(s=>s.throw).length;
      const li = document.createElement('li'), b = document.createElement('button');
      b.className = 'item'; b.dataset.id = e.id; b.type = 'button';
      const nm = document.createElement('b'); nm.textContent = p.name;
      if (e.source === 'team' || e.source === 'repo'){
        const tg = document.createElement('span'); tg.className = e.source === 'repo' ? 'tag team' : 'tag';
        tg.textContent = e.source === 'repo' ? e.label : storeMode === 'db' ? 'Team' : 'Mine'; nm.appendChild(tg);
      }
      const sm = document.createElement('small'); sm.textContent = `${p.steps.length} step${p.steps.length>1?'s':''} · ${throws} throw${throws===1?'':'s'} · ${total.toFixed(0)} s`;
      b.append(nm, sm);
      if (e.tags && e.tags.length){ const tg = document.createElement('small'); tg.className = 'itags'; tg.textContent = e.tags.join(' · '); b.appendChild(tg); }
      b.setAttribute('aria-current', current && current.id === e.id && current.source !== 'preview' ? 'true' : 'false');
      b.addEventListener('click', () => {
        // previewing a drill being drawn: keep unsaved work, otherwise let the draft go
        if (current?.source === 'preview' && draft){ if (dirty){ emit('back-to-editor', 'Save the drill you are drawing, or go back to playback and discard it, first.'); return; } endSession(); }
        openDrawer(false);
        if (location.hash.slice(1) !== e.id) location.hash = e.id; else select(e.id);
      });
      li.appendChild(b); ul.appendChild(li);
    });
    grp.appendChild(ul); nav.appendChild(grp);
  });
}
export function markNav(){ document.querySelectorAll('.item').forEach(b => b.setAttribute('aria-current', current && current.source !== 'preview' && b.dataset.id === current.id ? 'true' : 'false')); }

/* new drills: blank, or a copy of any built-in or saved drill */
function fillNewPick(){
  const ul = $('#new-from'); ul.replaceChildren();
  libEntries().forEach(e => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = 'item';
    const nm = document.createElement('b'); nm.textContent = e.play.name;
    const sm = document.createElement('small'); sm.textContent = `${e.play.kind} · ${e.play.steps.length} step${e.play.steps.length > 1 ? 's' : ''}`;
    b.append(nm, sm);
    b.addEventListener('click', () => { openDrawer(false); showNewPick(false); emit('edit', copyOfEntry(e)); });
    li.appendChild(b); ul.appendChild(li);
  });
}
function showNewPick(on){ $('#new-pick').hidden = !on; $('#new').setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) fillNewPick(); }
$('#new').addEventListener('click', () => showNewPick($('#new-pick').hidden));
$('#new-blank').addEventListener('click', () => { openDrawer(false); showNewPick(false); emit('edit', blankDraft()); });
// viewers without write access to the team store can't draw new drills
export function showWriteAccess(){ $('#new').hidden = canWrite === false; }

/* ---------- drawer and popovers ---------- */
export function openDrawer(on){
  if (!on) showNewPick(false);
  $('#drawer').hidden = !on; $('#scrim').hidden = !on; $('#menu').setAttribute('aria-expanded', on ? 'true' : 'false');
  if (on){ closePops(); const cur = $('#nav .item[aria-current="true"]') || $('#nav .item'); if (cur) cur.focus({preventScroll:false}); }
}
export function closePops(except){
  [['#info','#info-pop'],['#opts','#opts-pop'],['#share','#share-pop']].forEach(([b, p]) => { if (p === except) return; $(p).hidden = true; $(b).setAttribute('aria-expanded', 'false'); });
}
export function togglePop(btn, pop){
  const open = $(pop).hidden; closePops(pop); $(pop).hidden = !open; $(btn).setAttribute('aria-expanded', open ? 'true' : 'false');
}
$('#menu').addEventListener('click', () => openDrawer($('#drawer').hidden));
// search: filter as you type; Escape clears it (a second Escape closes the drawer); Enter opens the only match
const search = $('#nav-search');
search.addEventListener('input', buildNav);
search.addEventListener('keydown', e => {
  if (e.key === 'Escape' && search.value){ e.preventDefault(); e.stopPropagation(); search.value = ''; buildNav(); }
  else if (e.key === 'Enter'){ const items = $('#nav').querySelectorAll('.item'); if (items.length === 1){ e.preventDefault(); items[0].click(); } }
});
// "/" anywhere outside a text field opens the drawer on the search box
export function focusSearch(){ openDrawer(true); search.focus(); search.select(); }
$('#drawer-close').addEventListener('click', () => openDrawer(false));
$('#scrim').addEventListener('click', () => openDrawer(false));
$('#info').addEventListener('click', () => togglePop('#info', '#info-pop'));
$('#opts').addEventListener('click', () => togglePop('#opts', '#opts-pop'));
// taps in the team panel (js/features/team.js, over the share popover while publishing) leave the popovers open
document.addEventListener('pointerdown', e => { if (!e.target.closest('.pop, #info, #opts, #share, .gs')) closePops(); });

/* ---------- share popover ---------- */
// also used by Send feedback (js/features/feedback.js) for its reopen link
export async function shareLink(){
  if (!current) return null;
  if (current.source === 'builtin') return builtinLink(current.id);
  let raw = null;
  if (current.source === 'team'){ const e = team.find(x => x.id === current.id); raw = e && e.raw; }
  else if (current.source === 'repo'){ const e = libEntries().find(x => x.id === current.id); raw = e && e.raw; }
  else if (current.source === 'preview') raw = draft;
  else if (current.source === 'shared') raw = sharedRaw;
  if (!raw) return null;
  return drillLink(raw);
}
// Integration point (QR code, js/features/qr.js): announce each new link, or null while there is none.
const announceLink = url => document.dispatchEvent(new CustomEvent('playbook:share-link', {detail: {url}}));
async function openShare(){
  const pop = $('#share-pop');
  if (!pop.hidden){ togglePop('#share', '#share-pop'); return; }
  togglePop('#share', '#share-pop');
  $('#share-status').textContent = ''; $('#share-link').value = 'Making the link…'; announceLink(null);
  $('#share-what').textContent = current && current.source === 'builtin'
    ? 'Anyone with this link sees this drill on the Ultimate Playbook site.'
    : 'The whole drill is packed into the link itself, so it works without any account or server. Whoever opens it can watch it and save their own copy.';
  try {
    const url = await shareLink();
    $('#share-link').value = url || 'This drill can’t be shared.';
    $('#share-native').hidden = !(url && navigator.share && window.top === window);
    announceLink(url);
  } catch (err){ $('#share-link').value = 'Couldn’t make a link in this browser.'; announceLink(null); }
}
$('#share').addEventListener('click', openShare);
$('#share-copy').addEventListener('click', () => {
  const inp = $('#share-link'), url = inp.value;
  const done = () => { $('#share-status').textContent = 'Link copied.'; };
  const fallback = () => { inp.focus(); inp.select(); $('#share-status').textContent = 'Press Ctrl+C (or ⌘C) to copy the selected link.'; };
  try { navigator.clipboard.writeText(url).then(done, fallback); } catch (e){ fallback(); }
});
$('#share-native').addEventListener('click', () => {
  const url = $('#share-link').value;
  navigator.share({title: model ? model.play.name : 'Ultimate Playbook', url}).catch(() => {});
});
