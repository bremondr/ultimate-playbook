/* ---------- back up and restore saved drills as one .json file ----------
   "Back up to a file" saves every saved drill (this browser's, or the team store's) in one file.
   "Restore from a file" adds the drills in such a file. Nothing is overwritten: a drill that is already
   here unchanged is skipped, and one whose id is taken by a different drill is added under a new id.
   Every imported drill goes through readRaw, the same check shared links get, so a bad file can't break the app. */
import { emit } from '../events.js';
import { plans, setPlans, setTeam, team } from '../library.js';
import { readPlan, serializePlan } from '../model/plans.js';
import { timeDraft } from '../model/timing.js';
import { errText, readRaw, saveDrill, savePlan, serialize, storeMode } from '../storage.js';
import { $, newDocId } from '../util.js';

const FORMAT = 'ultimate-playbook-drills';
const MAX_BYTES = 5e6;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const say = t => { const el = $('#backup-status'); el.textContent = t; if (t) el.scrollIntoView({block: 'nearest'}); };
// the same drill always gives the same key, whatever its id or save time
const contentKey = raw => JSON.stringify(serialize(raw));

/* ----- back up ----- */
export function backupText(){
  const drills = team.map(e => ({id: e.id, ...serialize(e.raw), createdAt: e.raw.createdAt || 0}));
  // practice plans too (they refer to drills by id, so they travel with them)
  const planList = plans.map(e => ({id: e.id, ...serializePlan(e.plan), createdAt: e.plan.createdAt || 0}));
  return JSON.stringify({format: FORMAT, version: 1, app: 'Ultimate Playbook', exportedAt: new Date().toISOString(), drills, ...(planList.length ? {plans: planList} : {})}, null, 1);
}

/* Offer a file to the viewer.
   - As a claude.ai artifact, plain downloads are blocked: use the 'downloads' capability when it is there,
     and copy the text otherwise.
   - Everywhere else (GitHub Pages, a local server): a Blob and an <a download>. */
async function saveFile(filename, text){
  const c = window.claude;
  if (c && typeof c.use === 'function'){
    let dl = null;
    try { dl = await c.use('downloads'); } catch (e){ dl = null; }
    if (dl){
      try { await dl.save({filename, data: text}); return 'saved'; }
      catch (err){
        const code = err && err.code;
        if (code === 'declined') return 'declined';
        if (code === 'rate_limited') return 'busy';
      }
    }
    try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e){ return 'failed'; }
  }
  const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'saved';
}

async function backUp(){
  if (storeMode === 'pending'){ say('Still loading your drills. Try again in a moment.'); return; }
  if (!team.length && !plans.length){ say('No saved drills or plans to back up yet.'); return; }
  const n = team.length, filename = `ultimate-playbook-drills-${new Date().toISOString().slice(0, 10)}.json`;
  say('Saving…');
  const r = await saveFile(filename, backupText());
  say({
    saved: `Saved ${plural(n, 'drill')}${plans.length ? ` and ${plural(plans.length, 'practice plan')}` : ''} to ${filename}.`,
    declined: 'Backup not saved.',
    busy: 'Another save is waiting for an answer. Try again in a moment.',
    copied: `This page can’t save files, so the backup of ${plural(n, 'drill')} was copied. Paste it into a text file and save it as .json.`,
    failed: 'This page can’t save files. Open the app on its own site to back up your drills.'
  }[r]);
}

/* ----- restore ----- */
// Accepts a backup file ({drills:[…]}), a plain list of drills, the browser's own store ({id: drill}), or one drill.
export function drillsIn(data){
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data.drills)) return data.drills;
  if (Array.isArray(data.steps)) return [data];
  const vals = Object.entries(data).filter(([, v]) => v && typeof v === 'object' && Array.isArray(v.steps));
  return vals.length ? vals.map(([id, v]) => ({id, ...v})) : null;
}

/* Practice plans in a backup: added unless the same plan is already here; a taken id gets a new one. A plan's drill
   references follow drills that got a new id in this restore (`renamed`: id in the file → id here). Pure. */
export function plansImport(items, existing, renamed = {}){
  const key = p => JSON.stringify(serializePlan(p)), keys = new Set(existing.map(e => key(e.plan))), ids = new Set(existing.map(e => e.id));
  const add = []; let same = 0;
  (Array.isArray(items) ? items : []).slice(0, 200).forEach(item => {
    const plan = readPlan(item);
    if (!plan) return;
    plan.items.forEach(it => { if (it.kind === 'drill' && renamed[it.drill]) it.drill = renamed[it.drill]; });
    if (keys.has(key(plan))){ same++; return; }
    keys.add(key(plan));
    const wanted = item && typeof item.id === 'string' && /^[\w-]{1,64}$/.test(item.id) ? item.id : null;
    const id = wanted && !ids.has(wanted) ? wanted : newDocId();
    ids.add(id);
    add.push({id, plan: {...plan, createdAt: plan.createdAt || Date.now()}});
  });
  return {add, same};
}

/* Work out what to add: returns {add:[{id, body, copy}], same, bad}. Pure, so it can be tested on its own. */
export function planImport(items, existing){
  const keyToId = new Map(existing.map(e => [contentKey(e.raw), e.id])), ids = new Set(existing.map(e => e.id));
  const keys = new Set(keyToId.keys());
  // `renamed`: a drill's id in the file → its id here, when they differ, so restored practice plans still find it
  const add = [], renamed = {}; let same = 0, bad = 0;
  items.slice(0, 500).forEach(item => {
    const raw = readRaw(item);
    if (!raw){ bad++; return; }
    const key = contentKey(raw);
    const wanted = item && typeof item.id === 'string' && /^[\w-]{1,64}$/.test(item.id) ? item.id : null;
    if (keys.has(key)){ same++; if (wanted && keyToId.has(key) && keyToId.get(key) !== wanted) renamed[wanted] = keyToId.get(key); return; }
    keys.add(key);
    const copy = !!wanted && ids.has(wanted);
    const id = wanted && !copy ? wanted : newDocId();
    ids.add(id);
    const now = Date.now(), body = serialize(raw);
    body.createdAt = raw.createdAt || now; body.updatedAt = now;
    add.push({id, body, copy});
    if (wanted && wanted !== id) renamed[wanted] = id;
    keyToId.set(key, id);
  });
  return {add, same, bad, renamed};
}

async function restore(file){
  if (storeMode === 'pending'){ say('Still loading your drills. Try again in a moment.'); return; }
  if (file.size > MAX_BYTES){ say('That file is too big for a drill backup.'); return; }
  let data = null;
  try { data = JSON.parse(await file.text()); } catch (e){ data = null; }
  const items = drillsIn(data) || [], planItems = data && !Array.isArray(data) && Array.isArray(data.plans) ? data.plans : [];
  if (!drillsIn(data) && !planItems.length){ say('That file isn’t a drill backup. Choose a .json file saved with “Back up to a file”.'); return; }
  if (!items.length && !planItems.length){ say('No drills found in that file.'); return; }
  const {add, same, bad, renamed} = planImport(items, team);
  const planned = plansImport(planItems, plans, renamed);
  if (!add.length && !planned.add.length){
    say(bad && !same ? 'No drills could be read from that file.'
      : `Nothing new: everything in that file is already here.` + (bad ? ` ${plural(bad, 'drill')} couldn’t be read.` : ''));
    return;
  }
  say('Adding…');
  const saved = [];
  for (const d of add){
    try { await saveDrill(d.id, d.body); saved.push(d); }
    catch (err){ say(`Added ${saved.length} of ${add.length} drills. ${errText(err)}`); finish(saved); return; }
  }
  finish(saved);
  const savedPlans = [];
  for (const p of planned.add){
    try { savedPlans.push(await savePlan(p.id, p.plan)); }
    catch (err){ say(`Added ${plural(saved.length, 'drill')} and ${savedPlans.length} of ${planned.add.length} plans. ${errText(err)}`); finishPlans(savedPlans); return; }
  }
  finishPlans(savedPlans);
  const copies = saved.filter(d => d.copy).length;
  say([
    saved.length || !savedPlans.length ? `Added ${plural(saved.length, 'drill')}.` : '',
    savedPlans.length ? `Added ${plural(savedPlans.length, 'practice plan')}.` : '',
    copies ? `${copies === 1 ? 'One drill was' : copies + ' drills were'} added as a copy, because a different drill with the same id is already here.` : '',
    same || planned.same ? `Skipped ${same + planned.same} you already have.` : '',
    bad ? `${plural(bad, 'drill')} couldn’t be read.` : ''
  ].filter(Boolean).join(' '));
}
// In this browser, show the new plans now. The team store sends its own update.
function finishPlans(saved){
  if (!saved.length || storeMode !== 'local') return;
  setPlans([...plans, ...saved]);
  emit('plans-changed');
}
// In this browser, show the new drills now. The team store sends its own update.
function finish(saved){
  if (!saved.length || storeMode !== 'local') return;
  const entries = saved.map(({id, body}) => { const raw = readRaw(body); return {id, raw, play: {...timeDraft({...raw, id}), id}}; });
  setTeam([...team, ...entries].sort((a, b) => a.raw.createdAt - b.raw.createdAt));
  emit('drills-changed');
}

/* ----- drawer buttons ----- */
if ($('#backup-save')){
  $('#backup-save').addEventListener('click', backUp);
  $('#backup-load').addEventListener('click', () => { $('#backup-file').value = ''; $('#backup-file').click(); });
  $('#backup-file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) restore(f); });
}
