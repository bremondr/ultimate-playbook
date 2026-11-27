/* ---------- practice plans: the drawer group, stepping through a plan, adding a drill from the player, printing ----------
   A plan is drills and blocks in order, each with its minutes (model/plans.js). This file:
   - puts a "Practice plans" group at the top of the Drills drawer (nav.js addNavSection), with "New practice plan";
   - steps through a plan at practice: the current item large, the next one, Back and Next, the whole list. Opening
     a drill shows it in the player with a bar "Plan: … · 3 of 8 · Back to plan" under the field;
   - adds the drill on screen to a plan ("Add this drill to a practice plan…" in the options popover);
   - prints a plan as a clean list with start times (a print stylesheet in css/features.css).
   The plan editor is plan-editor.js. Plans are stored by storage.js (savePlan, removePlan), next to the drills. */
import { emit } from '../events.js';
import { libEntries, plans, savePlanEntry } from '../library.js';
import { matchesQuery } from '../model/search.js';
import { clock, drillItem, itemTitle, minutesText, newPlan, resolveItems, startTimes, totalMinutes } from '../model/plans.js';
import { addNavSection, closePops, openDrawer } from '../nav.js';
import { current, playing, setPlaying } from '../player.js';
import { canWrite, errText, savePlan, storeMode } from '../storage.js';
import { $, newDocId } from '../util.js';
import { editPlan } from './plan-editor.js';

const planById = id => plans.find(p => p.id === id);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/* ---------- the drawer: a group above the plays and drills ---------- */
addNavSection(query => {
  const list = plans.filter(e => matchesQuery({name: e.plan.name, summary: e.plan.note, steps: e.plan.items.map(i => ({title: i.title || i.name}))}, query));
  if (!list.length) return null;
  const grp = el('div', 'group plans'), ul = el('ul', 'list');
  grp.appendChild(el('h2', null, 'Practice plans'));
  list.forEach(e => {
    const li = el('li'), b = el('button', 'item');
    b.type = 'button'; b.dataset.plan = e.id;
    b.append(el('b', null, e.plan.name), el('small', null, `${plural(e.plan.items.length, 'item')} · ${minutesText(totalMinutes(e.plan))}`));
    b.addEventListener('click', () => { openDrawer(false); openRun(e.id, 0); });
    li.appendChild(b); ul.appendChild(li);
  });
  grp.appendChild(ul);
  return grp;
});
$('#plan-new').addEventListener('click', () => { openDrawer(false); editPlan(null, newPlan()); });
export function showPlanWriteAccess(){ $('#plan-new').hidden = canWrite === false; $('#plan-add-open').hidden = canWrite === false; }

/* ---------- stepping through a plan ---------- */
let run = null;   // {id, index}: the plan being stepped through, and where
const runPlan = () => run && planById(run.id);

export function openRun(id, index = 0){
  if (!planById(id)) return;
  run = {id, index};
  if (playing) setPlaying(false);
  closePops(); $('#plan-bar').hidden = true;
  $('#plan-run').hidden = false;
  renderRun();
  $('#plan-next').focus({preventScroll: true});
}
function closeRun(){ $('#plan-run').hidden = true; }
function endPlan(){ closeRun(); $('#plan-bar').hidden = true; run = null; }

function renderRun(){
  const e = runPlan();
  if (!e){ endPlan(); return; }
  const p = e.plan, items = resolveItems(p, libEntries()), starts = startTimes(p), total = totalMinutes(p);
  run.index = Math.max(0, Math.min(run.index, items.length - 1));
  $('#plan-run-name').textContent = p.name;
  $('#plan-run-meta').textContent = `${plural(items.length, 'item')} · ${minutesText(total)}`;
  $('#plan-run-note').textContent = p.note; $('#plan-run-note').hidden = !p.note;
  $('#plan-run-edit').hidden = canWrite === false;
  const now = $('#plan-now'); now.replaceChildren();
  if (!items.length){
    now.appendChild(el('p', 'small', 'This plan has no items yet. Tap Edit to add drills and blocks.'));
    ['#plan-back', '#plan-next'].forEach(s => { $(s).disabled = true; }); $('#plan-pos').textContent = '';
  } else {
    const {item, entry, missing} = items[run.index], k = run.index;
    now.append(
      el('span', 'k', `${k + 1} of ${items.length} · ${clock(starts[k])}–${clock(starts[k] + item.minutes)}`),
      el('h3', null, itemTitle(item, entry)),
      el('p', 'plan-mins', minutesText(item.minutes)));
    if (item.note) now.appendChild(el('p', 'plan-itemnote', item.note));
    if (entry){
      if (entry.play.summary) now.appendChild(el('p', 'small', entry.play.summary));
      const open = el('button', 'primary', 'Open the drill'); open.type = 'button';
      open.addEventListener('click', () => openDrill(entry.id));
      now.appendChild(open);
    } else if (missing) now.appendChild(el('p', 'small warnline', 'This drill is no longer available. Edit the plan to remove or replace it.'));
    $('#plan-back').disabled = k === 0;
    $('#plan-next').disabled = k === items.length - 1;
    $('#plan-pos').textContent = `${minutesText(starts[k])} of ${minutesText(total)} done`;
  }
  // the whole plan, to jump to any item
  const ol = $('#plan-list'); ol.replaceChildren();
  items.forEach(({item, entry, missing}, k) => {
    const li = el('li'), b = el('button', 'item' + (missing ? ' missing' : ''));
    b.type = 'button'; b.setAttribute('aria-current', k === run.index ? 'true' : 'false');
    b.append(el('span', 'plan-at', clock(starts[k])), el('b', null, itemTitle(item, entry)), el('small', null, minutesText(item.minutes) + (item.kind === 'block' ? '' : missing ? ' · no longer available' : ' · drill')));
    b.addEventListener('click', () => { run.index = k; renderRun(); });
    li.appendChild(b); ol.appendChild(li);
  });
}
$('#plan-back').addEventListener('click', () => { if (run){ run.index--; renderRun(); } });
$('#plan-next').addEventListener('click', () => { if (run){ run.index++; renderRun(); } });
$('#plan-run-close').addEventListener('click', endPlan);
$('#plan-run-edit').addEventListener('click', () => { const e = runPlan(); if (e){ closeRun(); editPlan(e.id, e.plan, () => openRun(e.id, run ? run.index : 0)); } });
$('#plan-run-print').addEventListener('click', () => { const e = runPlan(); if (e) printPlan(e.plan); });

// a drill of the plan in the player, with the bar that leads back
function openDrill(id){
  closeRun();
  if (location.hash.slice(1) !== id) location.hash = id;
  const e = runPlan(), n = e ? e.plan.items.length : 0;
  $('#plan-bar-name').textContent = e ? e.plan.name : '';
  $('#plan-bar-pos').textContent = `${run.index + 1} of ${n}`;
  $('#plan-bar').hidden = false;
}
$('#plan-bar-back').addEventListener('click', () => { if (run) openRun(run.id, run.index); });
$('#plan-bar-end').addEventListener('click', endPlan);

/* ---------- adding the drill on screen to a plan ---------- */
function drillOnScreen(){
  if (!current || !['builtin', 'team', 'repo'].includes(current.source)) return null;
  return libEntries().find(e => e.id === current.id) || null;
}
function openAdd(){
  closePops();
  const entry = drillOnScreen(), list = $('#plan-add-list');
  $('#plan-add-status').textContent = ''; list.replaceChildren();
  $('#plan-add-what').textContent = entry ? `“${entry.play.name}”, ${minutesText(10)} to start with; change it in the plan.`
    : 'Save this drill first: a plan can hold built-in drills and saved ones.';
  $('#plan-add-new').disabled = !entry;
  if (entry) plans.forEach(e => {
    const li = el('li'), b = el('button', 'item'); b.type = 'button';
    b.append(el('b', null, e.plan.name), el('small', null, `${plural(e.plan.items.length, 'item')} · ${minutesText(totalMinutes(e.plan))}`));
    b.addEventListener('click', () => addTo(e.id, e.plan, entry));
    li.appendChild(b); list.appendChild(li);
  });
  $('#plan-add').hidden = false;
  ($('#plan-add-list .item') || $('#plan-add-close')).focus({preventScroll: true});
}
async function addTo(id, plan, entry){
  const next = {...plan, items: [...plan.items, drillItem(entry)]};
  $('#plan-add-status').textContent = 'Adding…';
  try {
    const saved = await savePlan(id || newDocId(), id ? next : {...next, createdAt: Date.now()});
    if (storeMode === 'local'){ savePlanEntry(saved); emit('plans-changed'); }
    $('#plan-add').hidden = true;
    $('#pkind').textContent = `Added to “${saved.plan.name}”`;
  } catch (err){ $('#plan-add-status').textContent = errText(err); }
}
$('#plan-add-open').addEventListener('click', openAdd);
$('#plan-add-close').addEventListener('click', () => { $('#plan-add').hidden = true; });
$('#plan-add-new').addEventListener('click', () => { const entry = drillOnScreen(); if (entry){ $('#plan-add').hidden = true; editPlan(null, {...newPlan(), items: [drillItem(entry)]}); } });

/* ---------- printing: a clean list with start times ---------- */
function printPlan(p){
  const box = $('#plan-print'), items = resolveItems(p, libEntries()), starts = startTimes(p);
  box.replaceChildren(
    el('h1', null, p.name),
    el('p', 'pp-meta', `${new Date().toLocaleDateString()} · ${plural(items.length, 'item')} · ${minutesText(totalMinutes(p))}`));
  if (p.note) box.appendChild(el('p', 'pp-note', p.note));
  const ol = el('ol', 'pp-items');
  items.forEach(({item, entry, missing}, k) => {
    const li = el('li');
    li.append(el('span', 'pp-at', clock(starts[k])), el('span', 'pp-min', minutesText(item.minutes)));
    const body = el('div', 'pp-body');
    body.appendChild(el('b', null, itemTitle(item, entry) + (missing ? ' (no longer available)' : '')));
    if (item.note) body.appendChild(el('p', 'pp-note', item.note));
    if (entry){
      if (entry.play.summary) body.appendChild(el('p', null, entry.play.summary));
      body.appendChild(el('p', 'pp-steps', entry.play.steps.map((s, i) => `${i + 1}. ${s.title}`).join('   ')));
    }
    li.appendChild(body); ol.appendChild(li);
  });
  box.appendChild(ol);
  document.body.classList.add('printing-plan');
  const done = () => { document.body.classList.remove('printing-plan'); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 1000);   // browsers that don't send afterprint (or block printing) still get the app back
}

/* ---------- keeping up: plans reloaded or changed elsewhere; Escape closes what is open ---------- */
export function plansChanged(){ if (!$('#plan-run').hidden) renderRun(); }
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = ['#plan-add', '#plan-run'].find(s => !$(s).hidden);
  if (!open) return;
  e.preventDefault(); e.stopPropagation();
  if (open === '#plan-add') $('#plan-add').hidden = true; else endPlan();
}, true);
// the bar belongs to the plan's drills: another drill on screen (picked from the list, say) ends it
export function planShowing(){
  if ($('#plan-bar').hidden || !run) return;
  const e = runPlan(), item = e && e.plan.items[run.index];
  if (!item || !current || current.id !== item.drill) $('#plan-bar').hidden = true;
}
