/* ---------- the practice plan editor: a full-screen list, not the field editor ----------
   Name and note at the top with the total time; each item with a drag handle, its name, minutes (− / +), a note,
   Move up / Move down and remove. "Add drill" opens a picker of the library (search and tags, as in the drawer);
   "Add block" adds a warm-up, water break or your own block. Save keeps you here; Close asks first when there are
   unsaved changes; Undo takes back the last change. Plans are stored by storage.js. */
import { emit } from '../events.js';
import { dropPlanEntry, libEntries, savePlanEntry } from '../library.js';
import { BLOCK_TITLES, blockItem, drillItem, itemTitle, MAX_ITEMS, MAX_MINUTES, minutesText, moveItem, resolveItems, totalMinutes } from '../model/plans.js';
import { matchesQuery, matchesTags } from '../model/search.js';
import { tagsInUse } from '../model/tags.js';
import { errText, removePlan, savePlan, storeMode } from '../storage.js';
import { $, clone, newDocId } from '../util.js';

let id = null, plan = null, dirty = false, undo = [], after = null, closeArmed = null, delArmed = null;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const say = t => { $('#plan-status').textContent = t; };

/* open the editor on a plan (id null for a new one); `then` runs when it closes (back to stepping through, say) */
export function editPlan(planId, p, then = null){
  id = planId; plan = clone(p); dirty = !planId; undo = []; after = then;
  armClose(false); armDelete(false); say('');
  $('#plan-name').value = plan.name; $('#plan-note').value = plan.note || '';
  $('#plan-delete').hidden = !id;
  showPicker(false); showBlocks(false);
  $('#plan-edit').hidden = false;
  render();
  if (!id) { $('#plan-name').focus(); $('#plan-name').select(); }
}
// every change goes through here: one step of undo, and the list redrawn
function change(fn){ undo.push(clone(plan)); if (undo.length > 50) undo.shift(); fn(); dirty = true; armClose(false); render(); }

function render(){
  const ol = $('#plan-items'); ol.replaceChildren();
  resolveItems(plan, libEntries()).forEach(({item, entry, missing}, k) => {
    const li = el('li', 'plan-row' + (missing ? ' missing' : '')); li.dataset.k = k;
    const grip = el('button', 'plan-grip', '⠿'); grip.type = 'button'; grip.title = 'Drag to move'; grip.setAttribute('aria-label', 'Drag to move');
    grip.addEventListener('pointerdown', ev => startDrag(ev, li));
    const main = el('div', 'plan-main');
    if (item.kind === 'block'){
      const t = el('input', 'plan-blocktitle'); t.value = item.title; t.maxLength = 60; t.setAttribute('aria-label', 'Block title');
      t.addEventListener('change', () => { const v = t.value.trim(); if (v && v !== item.title) change(() => { plan.items[k].title = v; }); else t.value = item.title; });
      main.append(t, el('small', null, 'Block'));
    } else main.append(el('b', null, itemTitle(item, entry)), el('small', missing ? 'warnline' : null, missing ? 'This drill is no longer available' : 'Drill'));
    const note = el('input', 'plan-itemnote'); note.value = item.note || ''; note.maxLength = 200; note.placeholder = 'Note for this session (optional)'; note.setAttribute('aria-label', 'Note');
    note.addEventListener('change', () => change(() => { plan.items[k].note = note.value; }));
    main.appendChild(note);
    // minutes: − and + in steps of 1, or typed
    const mins = el('div', 'plan-mins-ed');
    const minus = el('button', 'ghost', '−'), plus = el('button', 'ghost', '+'), num = el('input');
    minus.type = plus.type = 'button'; minus.setAttribute('aria-label', 'One minute less'); plus.setAttribute('aria-label', 'One minute more');
    num.type = 'number'; num.min = '0'; num.max = String(MAX_MINUTES); num.inputMode = 'numeric'; num.value = item.minutes; num.setAttribute('aria-label', 'Minutes');
    const setMin = v => { v = Math.max(0, Math.min(MAX_MINUTES, Math.round(+v || 0))); if (v !== plan.items[k].minutes) change(() => { plan.items[k].minutes = v; }); else num.value = v; };
    minus.addEventListener('click', () => setMin(item.minutes - 1)); plus.addEventListener('click', () => setMin(item.minutes + 1));
    num.addEventListener('change', () => setMin(num.value));
    mins.append(minus, num, el('span', 'small', 'min'), plus);
    const tools = el('div', 'plan-tools');
    const up = el('button', 'ibtn', '↑'), down = el('button', 'ibtn', '↓'), rm = el('button', 'ibtn', '×');
    [up, down, rm].forEach(b => { b.type = 'button'; });
    up.title = 'Move up'; down.title = 'Move down'; rm.title = 'Remove';
    up.setAttribute('aria-label', 'Move up'); down.setAttribute('aria-label', 'Move down'); rm.setAttribute('aria-label', 'Remove');
    up.disabled = k === 0; down.disabled = k === plan.items.length - 1;
    up.addEventListener('click', () => change(() => { plan = moveItem(plan, k, k - 1); }));
    down.addEventListener('click', () => change(() => { plan = moveItem(plan, k, k + 1); }));
    rm.addEventListener('click', () => change(() => { plan.items.splice(k, 1); }));
    tools.append(up, down, rm);
    li.append(grip, main, mins, tools);
    ol.appendChild(li);
  });
  $('#plan-empty').hidden = plan.items.length > 0;
  $('#plan-edit-total').textContent = `${plan.items.length} item${plan.items.length === 1 ? '' : 's'} · ${minutesText(totalMinutes(plan))}`;
  $('#plan-undo').disabled = !undo.length;
  $('#plan-add-drill').disabled = $('#plan-add-block').disabled = plan.items.length >= MAX_ITEMS;
  $('#plan-save').textContent = dirty ? 'Save' : 'Saved';
}

/* dragging a row by its handle: the row moves in the list as the finger passes the middle of its neighbours */
function startDrag(ev, li){
  ev.preventDefault();
  const ol = $('#plan-items'), from = +li.dataset.k;
  li.classList.add('dragging');
  try { ev.target.setPointerCapture(ev.pointerId); } catch (e){}
  const move = e => {
    const rows = [...ol.children].filter(r => r !== li);
    const before = rows.find(r => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    ol.insertBefore(li, before || null);
  };
  const up = () => {
    ev.target.removeEventListener('pointermove', move); ev.target.removeEventListener('pointerup', up); ev.target.removeEventListener('pointercancel', up);
    li.classList.remove('dragging');
    const to = [...ol.children].indexOf(li);
    if (to !== from) change(() => { plan = moveItem(plan, from, to); }); else render();
  };
  ev.target.addEventListener('pointermove', move); ev.target.addEventListener('pointerup', up); ev.target.addEventListener('pointercancel', up);
}

/* adding a drill: the library, with search and tags as in the drawer */
let pickTags = [];
function showPicker(on){
  $('#plan-picker').hidden = !on; $('#plan-add-drill').setAttribute('aria-expanded', String(on));
  if (on){ showBlocks(false); $('#plan-pick-search').value = ''; pickTags = []; renderPicker(); $('#plan-pick-search').focus(); }
}
function renderPicker(){
  const all = libEntries(), q = $('#plan-pick-search').value, tags = tagsInUse(all.map(e => e.tags));
  const box = $('#plan-pick-tags'); box.replaceChildren();
  tags.forEach(t => {
    const b = el('button', 'tagchip', t); b.type = 'button'; b.setAttribute('aria-pressed', String(pickTags.includes(t)));
    b.addEventListener('click', () => { pickTags = pickTags.includes(t) ? pickTags.filter(x => x !== t) : [...pickTags, t]; renderPicker(); });
    box.appendChild(b);
  });
  const ul = $('#plan-pick-list'); ul.replaceChildren();
  const list = all.filter(e => { const p = {...e.play, tags: e.tags}; return matchesQuery(p, q) && matchesTags(p, pickTags); });
  if (!list.length) ul.appendChild(el('li', 'small', 'No drills match.'));
  list.forEach(e => {
    const li = el('li'), b = el('button', 'item'); b.type = 'button';
    b.append(el('b', null, e.play.name), el('small', null, `${e.play.kind}${e.tags && e.tags.length ? ' · ' + e.tags.join(' · ') : ''}`));
    b.addEventListener('click', () => { change(() => { plan.items.push(drillItem(e)); }); say(`Added “${e.play.name}”.`); showPicker(false); });
    li.appendChild(b); ul.appendChild(li);
  });
}
$('#plan-add-drill').addEventListener('click', () => showPicker($('#plan-picker').hidden));
$('#plan-pick-search').addEventListener('input', renderPicker);

/* adding a block: a quick title, or your own */
function showBlocks(on){
  $('#plan-blocks').hidden = !on; $('#plan-add-block').setAttribute('aria-expanded', String(on));
  if (on){ showPicker(false); $('#plan-block-title').value = ''; }
}
BLOCK_TITLES.forEach(t => {
  const b = el('button', 'ghost', t); b.type = 'button';
  b.addEventListener('click', () => { change(() => { plan.items.push(blockItem(t, t === 'Water break' ? 3 : 10)); }); showBlocks(false); });
  $('#plan-block-quick').appendChild(b);
});
const addOwnBlock = () => { const t = $('#plan-block-title').value.trim(); if (!t) return; change(() => { plan.items.push(blockItem(t.slice(0, 60))); }); showBlocks(false); };
$('#plan-block-add').addEventListener('click', addOwnBlock);
$('#plan-block-title').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); addOwnBlock(); } });
$('#plan-add-block').addEventListener('click', () => showBlocks($('#plan-blocks').hidden));

/* name and note */
$('#plan-name').addEventListener('change', e => change(() => { plan.name = e.target.value.trim() || 'Untitled plan'; }));
$('#plan-note').addEventListener('change', e => change(() => { plan.note = e.target.value; }));

/* undo, save, delete, close */
$('#plan-undo').addEventListener('click', () => {
  if (!undo.length) return;
  plan = undo.pop(); dirty = true;
  $('#plan-name').value = plan.name; $('#plan-note').value = plan.note || '';
  render();
});
async function save(){
  // a name or note still being typed counts
  plan.name = $('#plan-name').value.trim() || 'Untitled plan'; plan.note = $('#plan-note').value;
  $('#plan-save').disabled = true; say('Saving…');
  try {
    const newId = id || newDocId();
    const saved = await savePlan(newId, id ? plan : {...plan, createdAt: Date.now()});
    id = newId; plan = {...plan, createdAt: saved.plan.createdAt};
    if (storeMode === 'local'){ savePlanEntry(saved); emit('plans-changed'); }
    dirty = false; $('#plan-delete').hidden = false; say(storeMode === 'db' ? 'Saved for the team.' : 'Saved in this browser.');
  } catch (err){ say(errText(err)); }
  finally { $('#plan-save').disabled = false; render(); }
}
$('#plan-save').addEventListener('click', save);

function armClose(on){
  clearTimeout(closeArmed); closeArmed = null;
  $('#plan-edit-close').textContent = on ? 'Discard changes?' : 'Close';
  $('#plan-edit-close').classList.toggle('danger', on);
  if (on) closeArmed = setTimeout(() => armClose(false), 4000);
}
function close(){
  if (dirty && plan.items.length + (id ? 1 : 0) && !closeArmed){ armClose(true); return; }
  armClose(false);
  $('#plan-edit').hidden = true;
  const then = after; after = null;
  if (then && id) then();
}
$('#plan-edit-close').addEventListener('click', close);

function armDelete(on){
  clearTimeout(delArmed); delArmed = null;
  $('#plan-delete').textContent = on ? 'Tap again to delete this plan' : 'Delete this plan';
  if (on) delArmed = setTimeout(() => armDelete(false), 4000);
}
$('#plan-delete').addEventListener('click', async () => {
  if (!id) return;
  if (!delArmed){ armDelete(true); return; }
  armDelete(false);
  try {
    await removePlan(id);
    if (storeMode === 'local'){ dropPlanEntry(id); emit('plans-changed'); }
    after = null; dirty = false; $('#plan-edit').hidden = true;
  } catch (err){ say(errText(err)); }
});

// Escape: put away the picker, else close (asking first when there are unsaved changes); Ctrl/Cmd+Z: undo
document.addEventListener('keydown', e => {
  if ($('#plan-edit').hidden) return;
  if (e.key === 'Escape'){
    e.preventDefault(); e.stopPropagation();
    if (!$('#plan-picker').hidden) showPicker(false); else if (!$('#plan-blocks').hidden) showBlocks(false); else close();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input,textarea')){ e.preventDefault(); $('#plan-undo').click(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's'){ e.preventDefault(); save(); }
}, true);
export const planEditorOpen = () => !$('#plan-edit').hidden;
