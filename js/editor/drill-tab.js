/* ---------- the Drill tab: type, summary, players per side, field, formations, defenses, copy from another drill ---------- */
import { renderEditor } from './canvas.js';
import { hint } from './hint.js';
import { commit } from './history.js';
import { setTool } from './rail.js';
import { draft, labelOf, setEs, setPendingThrow, setSelIds } from './session.js';
import { fillStep } from './step-tab.js';
import { layoutField, refitView, zoom } from './viewport.js';
import { fieldOf } from '../data/fields.js';
import { defenseOf, DEFENSES, FORMATIONS } from '../data/formations.js';
import { libEntries } from '../library.js';
import { copyOfEntry } from '../model/drafts.js';
import { placeDefense, standAt } from '../model/defense.js';
import { formation, formationSummary } from '../model/formation.js';
import { formationThumb, playersThumb } from '../render/thumb.js';
import { orient, setField } from '../render/view.js';
import { $, clamp, clone, r2 } from '../util.js';

export function fillDetails(){
  $('#s-name').value = draft.name; $('#e-sum').value = draft.summary || '';
  const press = (sel_, attr, v) => document.querySelectorAll(sel_ + ' button').forEach(b => b.setAttribute('aria-pressed', b.dataset[attr] === String(v) ? 'true' : 'false'));
  press('#e-kind', 'k', draft.kind); press('#e-format', 'f', draft.format); press('#e-field', 'fd', draft.field);
  if (defenseOf(draft.defense)) defChoice = draft.defense;
  renderForms(); fillFromSelect();
  $('#e-delete').hidden = !draft.docId;
}
// the defense picked in the Drill tab: tapping a formation places it with this defense
let defChoice = 'right';
export function renderForms(){
  const fm = $('#e-forms'); fm.replaceChildren();
  FORMATIONS.forEach(f => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fbtn'; b.dataset.form = f.id;
    b.innerHTML = formationThumb(f.id, draft.format, orient); b.append(f.name); b.title = `Place a ${draft.format} v ${draft.format} ${f.name.toLowerCase()}`;
    b.setAttribute('aria-pressed', f.id === draft.formation ? 'true' : 'false');
    fm.appendChild(b);
  });
  pickedName('#e-forms-tb', FORMATIONS.find(f => f.id === draft.formation));
  renderDefs();
}
/* Each picker folds to the button picked, with its name in the header; the open or folded state is remembered
   in this browser (a convenience: without storage both start open). */
const FOLD_KEY = 'ub-drill-pickers';
function pickedName(sel, item){ $(sel + ' .foldh b').textContent = item ? item.name : ''; }
function setFolded(tb, on){ tb.classList.toggle('folded', on); tb.querySelector('.foldh').setAttribute('aria-expanded', on ? 'false' : 'true'); }
try { const f = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); ['e-forms-tb', 'e-defs-tb'].forEach(id => setFolded($('#' + id), !!f[id])); } catch (e) {}
document.querySelectorAll('.pick .foldh').forEach(h => h.addEventListener('click', () => {
  const tb = h.closest('.pick'); setFolded(tb, !tb.classList.contains('folded'));
  try { const f = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'); f[tb.id] = tb.classList.contains('folded'); localStorage.setItem(FOLD_KEY, JSON.stringify(f)); } catch (e) {}
}));
// each defense drawn on the attackers on the field now (or a vertical stack when there are none)
export function renderDefs(){
  const el = $('#e-defs'); el.replaceChildren();
  const os = draft.players.filter(p => p.team === 'O' && p.at), ps = os.length ? os : formation('vert', draft.format, draft.field), disc = os.length ? draft.disc : 'h1';
  DEFENSES.forEach(d => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fbtn'; b.dataset.def = d.id;
    b.setAttribute('aria-pressed', d.id === defChoice ? 'true' : 'false');
    b.innerHTML = playersThumb(standAt(placeDefense(d.id, ps, disc, draft.field).players, disc), disc, orient, draft.field); b.append(d.name);
    b.title = d.kind ? `Put ${d.name.toLowerCase()} on the attackers` : 'Remove the defense';
    el.appendChild(b);
  });
  pickedName('#e-defs-tb', defenseOf(defChoice));
}
// puts the chosen defense on draft.players (replacing any defenders) and keeps the drill's force in step with it
function putDefense(){
  const gone = draft.players.filter(p => p.team === 'D').map(p => p.id), r = placeDefense(defChoice, draft.players, draft.disc, draft.field);
  draft.players = r.players;
  draft.steps.forEach(st => gone.forEach(id => delete st.moves[id]));
  if (r.force) draft.force = r.force;
  if (defenseOf(defChoice).kind) draft.defense = defChoice; else delete draft.defense;
  return draft.players.filter(p => p.team === 'D').length;
}
/* The summary follows the formation and defense while it is empty or still the text they last wrote; once the
   person has written their own, a new formation or defense leaves it alone and says so. */
let autoSummary = '';
// the formation placed last, and the defense on it
const summaryNow = () => { const d = defenseOf(defChoice); return formationSummary(draft.formation, draft.format) + (d && d.kind ? ` Defense: ${d.name.toLowerCase()}.` : ''); };
function followSummary(text){
  const cur = (draft.summary || '').trim();
  if (cur && cur !== autoSummary.trim()) return false;
  draft.summary = autoSummary = text; $('#e-sum').value = text;
  return true;
}
function applyFormation(type){
  const before = JSON.stringify(draft), cones = draft.players.filter(p => p.team === 'cone');
  draft.players = [...formation(type, draft.format, draft.field), ...cones];
  draft.disc = 'h1';
  draft.steps.forEach(st => { st.moves = {}; st.throw = null; });
  putDefense(); draft.formation = type;
  const summed = followSummary(summaryNow());
  setSelIds([]); setPendingThrow(null); setEs(-1);
  commit(before); fillStep(); setTool('select'); refitView(); if (zoom === 'fit') layoutField(true); renderEditor(); renderForms();
  const name = FORMATIONS.find(f => f.id === type).name, d = defenseOf(defChoice);
  hint(`${name} placed for ${draft.format} v ${draft.format}, ${d.kind ? 'with ' + d.name.toLowerCase() : 'no defense'}. Drag anyone to adjust, then add a step to draw the cuts.${/"moves":\{"|"throw":\{/.test(before) ? ' Runs and throws were cleared. Undo brings them back.' : ''}${summed ? '' : ' Your summary was kept.'}`);
}
function applyDefense(id){
  defChoice = id;
  const d = defenseOf(id), os = draft.players.filter(p => p.team === 'O');
  if (!os.length){ renderDefs(); hint(d.kind ? `${d.name} picked. Start from a formation, or add attackers and tap it again.` : 'No defense picked.'); return; }
  const before = JSON.stringify(draft), n = putDefense(), summed = !draft.formation || followSummary(summaryNow());
  setSelIds([]); commit(before); renderEditor(); renderDefs();
  const kept = summed ? '' : ' Your summary was kept.';
  if (!d.kind) return hint('Defense removed.' + kept);
  hint((d.kind === 'person'
    ? `${d.name}: ${n} defender${n > 1 ? 's' : ''}. ${draft.disc ? 'The mark is on ' + labelOf(draft.disc) + '. ' : ''}${id.startsWith('trap') ? 'One defender leaves their player to help trap on that side; the others follow' : 'Each defender follows'} their player through every step.`
    : `${d.name}: ${n} defender${n > 1 ? 's' : ''}. ${id.startsWith('clam') ? 'The mark and the handlers\u2019 defenders follow their player; the others' : 'The mark moves with the disc; the others'} hold their spot and watch the disc.`) + kept);
}
function rescaleDraft(from, to){
  const sx = to.L/from.L, sy = to.W/from.W, sc = q => [r2(clamp(q[0]*sx,0,to.L)), r2(clamp(q[1]*sy,0,to.W))];
  draft.players.forEach(p => { if (p.at) p.at = sc(p.at); });
  draft.steps.forEach(st => Object.values(st.moves).forEach(m => { m.path = m.path.map(sc); }));
}

$('#e-kind').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const before = JSON.stringify(draft); draft.kind = b.dataset.k; commit(before); fillDetails(); });
$('#e-format').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  const v = +b.dataset.f; if (v === draft.format) return;
  const before = JSON.stringify(draft); draft.format = v; commit(before); fillDetails(); renderEditor();
  hint(`Formations now place ${v} v ${v}. Pick one to reset the setup, or keep your players.`); });
$('#e-field').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  const v = b.dataset.fd; if (v === draft.field) return;
  const before = JSON.stringify(draft), from = fieldOf(draft.field), to = fieldOf(v);
  rescaleDraft(from, to); draft.field = v; setField(to); commit(before);
  fillDetails(); refitView(); layoutField(true); renderEditor();
  hint(`Field changed to ${to.label}. Everyone moved to the same spot on the new field.`); });
$('#e-forms').addEventListener('click', e => { const b = e.target.closest('.fbtn'); if (b) applyFormation(b.dataset.form); });
$('#e-defs').addEventListener('click', e => { const b = e.target.closest('.fbtn'); if (b) applyDefense(b.dataset.def); });
// the pictures show the attackers on the field, which may have moved since the tab was last drawn
$('#tab-drill').addEventListener('click', renderDefs);
function fillFromSelect(){
  const s = $('#e-from'); s.replaceChildren(); s.add(new Option('Choose a drill to copy…', ''));
  libEntries().forEach(e => s.add(new Option(`${e.play.name} (${e.play.kind.toLowerCase()})`, e.source + ':' + e.id)));
  s.value = '';
}
$('#e-from').addEventListener('change', e => {
  const v = e.target.value; if (!v) return;
  const [src, ...rest] = v.split(':'), id = rest.join(':'), entry = libEntries().find(x => x.source === src && x.id === id);
  if (!entry) return;
  const before = JSON.stringify(draft), c = copyOfEntry(entry), keepName = draft.name && draft.name !== 'New drill';
  ['players','steps','disc','field','format','force','kind','summary'].forEach(k => { if (c[k] !== undefined) draft[k] = clone(c[k]); });
  ['defense', 'formation'].forEach(k => { if (c[k]) draft[k] = c[k]; else delete draft[k]; });
  if (!keepName) draft.name = c.name;
  setSelIds([]); setPendingThrow(null); setEs(-1); setField(fieldOf(draft.field));
  commit(before); fillDetails(); fillStep(); refitView(); layoutField(true); renderEditor();
  hint(`Copied everything from ${entry.play.name}. Undo brings back what you had.`);
  e.target.value = '';
});
