/* ---------- drill list (drawer), popovers, and the new-drill chooser ---------- */
import { hint } from './editor/canvas.js';
import { blankDraft, copyOfEntry } from './editor/drafts.js';
import { backToEditor, openEditor } from './editor/studio.js';
import { libEntries } from './library.js';
import { select } from './player.js';
import { current, dirty, draft, put, storeMode } from './state.js';
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
        if (current?.source === 'preview' && draft){ if (dirty){ backToEditor(); hint('Save the drill you are drawing, or go back to playback and discard it, first.', true); return; } put.draft(null); }
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
    b.addEventListener('click', () => { openDrawer(false); showNewPick(false); openEditor(copyOfEntry(e)); });
    li.appendChild(b); ul.appendChild(li);
  });
}
function showNewPick(on){ $('#new-pick').hidden = !on; $('#new').setAttribute('aria-expanded', on ? 'true' : 'false'); if (on) fillNewPick(); }
$('#new').addEventListener('click', () => showNewPick($('#new-pick').hidden));
$('#new-blank').addEventListener('click', () => { openDrawer(false); showNewPick(false); openEditor(blankDraft()); });

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
