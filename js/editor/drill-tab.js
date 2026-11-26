/* ---------- the Drill tab: type, summary, players per side, field, formations, defense, copy from another drill ---------- */
import { renderEditor } from './canvas.js';
import { hint } from './hint.js';
import { commit } from './history.js';
import { setTool } from './rail.js';
import { byIdIn, draft, labelOf, setEs, setPendingThrow, setSelIds } from './session.js';
import { fillStep } from './step-tab.js';
import { layoutField, refitView, zoom } from './viewport.js';
import { fieldOf } from '../data/fields.js';
import { FORMATIONS } from '../data/formations.js';
import { libEntries } from '../library.js';
import { copyOfEntry } from '../model/drafts.js';
import { addPersonDefense, FORCES, formation, formationSummary, personOffset } from '../model/formation.js';
import { formationThumb } from '../render/thumb.js';
import { orient, setField } from '../render/view.js';
import { $, clamp, clone, r2 } from '../util.js';

export function fillDetails(){
  $('#s-name').value = draft.name; $('#e-sum').value = draft.summary || '';
  const press = (sel_, attr, v) => document.querySelectorAll(sel_ + ' button').forEach(b => b.setAttribute('aria-pressed', b.dataset[attr] === String(v) ? 'true' : 'false'));
  press('#e-kind', 'k', draft.kind); press('#e-format', 'f', draft.format); press('#e-field', 'fd', draft.field); press('#e-force', 'fc', draft.force);
  renderForms(); fillFromSelect();
  $('#e-delete').hidden = !draft.docId;
}
export function renderForms(){
  const fm = $('#e-forms'); fm.replaceChildren();
  FORMATIONS.forEach(f => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fbtn'; b.dataset.form = f.id;
    b.innerHTML = formationThumb(f.id, draft.format, orient); b.append(f.name); b.title = `Place a ${draft.format} v ${draft.format} ${f.name.toLowerCase()}`;
    fm.appendChild(b);
  });
}
/* The summary follows the formation while it is empty or still the text the last formation wrote; once the
   person has written their own, a new formation leaves it alone and says so. */
let autoSummary = '';
function followSummary(text){
  const cur = (draft.summary || '').trim();
  if (cur && cur !== autoSummary.trim()) return false;
  draft.summary = autoSummary = text; $('#e-sum').value = text;
  return true;
}
function applyFormation(type){
  const before = JSON.stringify(draft), cones = draft.players.filter(p => p.team === 'cone');
  draft.players = [...formation(type, draft.format, draft.field, $('#e-formdef').checked, draft.force), ...cones];
  draft.disc = 'h1';
  draft.steps.forEach(st => { st.moves = {}; st.throw = null; });
  const summed = followSummary(formationSummary(type, draft.format));
  setSelIds([]); setPendingThrow(null); setEs(-1);
  commit(before); fillStep(); setTool('select'); refitView(); if (zoom === 'fit') layoutField(true); renderEditor();
  const name = FORMATIONS.find(f => f.id === type).name;
  hint(`${name} placed for ${draft.format} v ${draft.format}${$('#e-formdef').checked ? ', ' + FORCES[draft.force].toLowerCase() : ''}. Drag anyone to adjust, then add a step to draw the cuts.${/"moves":\{"|"throw":\{/.test(before) ? ' Runs and throws were cleared. Undo brings them back.' : ''}${summed ? '' : ' Your summary was kept.'}`);
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
$('#e-force').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  const before = JSON.stringify(draft); draft.force = b.dataset.fc;
  const byId = byIdIn(), disc = byId[draft.disc];
  let n = 0;
  draft.players.forEach(p => { if (p.team !== 'D' || !p.follow || !byId[p.follow]) return;
    p.offset = personOffset(draft.force, p.follow === draft.disc, byId[p.follow].at, disc && disc.at); p.lag = p.follow === draft.disc ? .12 : .35; n++; });
  commit(before); fillDetails(); renderEditor();
  hint(n ? `${FORCES[draft.force]}: ${n} defender${n > 1 ? 's' : ''} repositioned.` : `${FORCES[draft.force]} selected. Put a defender on every attacker to see it.`); });
$('#e-person').addEventListener('click', () => {
  const os = draft.players.filter(p => p.team === 'O');
  if (!os.length){ hint('Add attackers first, or start from a formation.', true); return; }
  const before = JSON.stringify(draft), gone = draft.players.filter(p => p.team === 'D').map(p => p.id);
  draft.players = draft.players.filter(p => p.team !== 'D');
  draft.steps.forEach(st => gone.forEach(id => delete st.moves[id]));
  addPersonDefense(draft.players, draft.disc, draft.force);
  setSelIds([]); commit(before); renderEditor();
  hint(`${os.length} defender${os.length > 1 ? 's' : ''}, ${FORCES[draft.force].toLowerCase()}. ${draft.disc ? 'The mark is on ' + labelOf(draft.disc) + '. ' : ''}Each defender follows their player through every step.`); });
$('#e-forms').addEventListener('click', e => { const b = e.target.closest('.fbtn'); if (b) applyFormation(b.dataset.form); });
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
  if (!keepName) draft.name = c.name;
  setSelIds([]); setPendingThrow(null); setEs(-1); setField(fieldOf(draft.field));
  commit(before); fillDetails(); fillStep(); refitView(); layoutField(true); renderEditor();
  hint(`Copied everything from ${entry.play.name}. Undo brings back what you had.`);
  e.target.value = '';
});
