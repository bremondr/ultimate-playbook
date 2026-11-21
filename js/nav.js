/* ---------- drill list (drawer), popovers (info, options, share), and the new-drill chooser ---------- */
import { dirty, draft, endSession } from './editor/session.js';
import { emit } from './events.js';
import { libEntries, team } from './library.js';
import { blankDraft, copyOfEntry } from './model/drafts.js';
import { current, model, select, sharedRaw } from './player.js';
import { builtinLink, drillLink } from './share.js';
import { canWrite, storeMode } from './storage.js';
import { $ } from './util.js';

export function buildNav(){
  const nav = $('#nav'); nav.replaceChildren();
  const entries = libEntries();
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
      if (e.source === 'team'){ const tg = document.createElement('span'); tg.className = 'tag'; tg.textContent = storeMode === 'db' ? 'Team' : 'Mine'; nm.appendChild(tg); }
      const sm = document.createElement('small'); sm.textContent = `${p.steps.length} step${p.steps.length>1?'s':''} · ${throws} throw${throws===1?'':'s'} · ${total.toFixed(0)} s`;
      b.append(nm, sm);
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
$('#drawer-close').addEventListener('click', () => openDrawer(false));
$('#scrim').addEventListener('click', () => openDrawer(false));
$('#info').addEventListener('click', () => togglePop('#info', '#info-pop'));
$('#opts').addEventListener('click', () => togglePop('#opts', '#opts-pop'));
document.addEventListener('pointerdown', e => { if (!e.target.closest('.pop, #info, #opts, #share')) closePops(); });

/* ---------- share popover ---------- */
async function shareLink(){
  if (!current) return null;
  if (current.source === 'builtin') return builtinLink(current.id);
  let raw = null;
  if (current.source === 'team'){ const e = team.find(x => x.id === current.id); raw = e && e.raw; }
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
