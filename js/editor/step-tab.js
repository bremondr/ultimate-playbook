/* ---------- steps: the step strip under the field, and the Step tab (title, note, length, the step's throw) ---------- */
import { edModel, edPlay, edPos, renderEditor, stepWarn } from './canvas.js';
import { clearHint, hint } from './hint.js';
import { commit } from './history.js';
import { setTool } from './rail.js';
import { draft, es, labelOf, setEs, setPendingThrow, tool } from './session.js';
import { setTab } from './tabs.js';
import { fillThrowControls, wireThrowControls } from './tools/throw.js';
import { $ } from '../util.js';

export function setStep(i){ setEs(i); setPendingThrow(null); clearHint(); fillStep(); renderEditor(); setTab('step'); }

/* the step strip */
export function renderStrip(){
  const s = $('#strip'); s.replaceChildren();
  const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = 'Steps'; s.appendChild(lbl);
  const mk = (text, i, warn, title) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn'; b.textContent = text; b.title = title || '';
    b.setAttribute('aria-current', es === i ? 'true' : 'false');
    if (warn){ const dt = document.createElement('i'); dt.className = 'dot'; b.appendChild(dt); b.title += ' (throw needs fixing)'; }
    b.addEventListener('click', () => setStep(i)); s.appendChild(b);
  };
  mk('Setup', -1, false, 'Starting positions');
  draft.steps.forEach((st, i) => mk(String(i+1), i, stepWarn(i), edPlay.steps[i].title));
  const add = document.createElement('button'); add.type = 'button'; add.className = 'sbtn add'; add.textContent = '+ Add step';
  add.addEventListener('click', () => {
    const before = JSON.stringify(draft), at = es < 0 ? draft.steps.length : es + 1;
    draft.steps.splice(at, 0, {title:'', note:'', dur:null, moves:{}, throw:null});
    // the tools that add players work on the setup; keep one that works on the new step
    commit(before); if (!['select','throw','erase'].includes(tool)) setTool('select');
    setStep(at);
  });
  s.appendChild(add);
}

/* step tab */
export function fillStep(){
  const setup = es < 0;
  $('#st-setup').hidden = !setup; $('#st-step').hidden = setup;
  if (!setup){
    const st = draft.steps[es];
    $('#st-h').textContent = `Step ${es+1} of ${draft.steps.length}`;
    $('#e-title').value = st.title; $('#e-title').placeholder = `Step ${es+1}`;
    $('#e-note').value = st.note;
    $('#e-dur').value = typeof st.dur === 'number' ? st.dur : '';
    fillNewDisc(st);
    $('#e-rmstep').disabled = draft.steps.length < 2;
    $('#st-left').disabled = es === 0; $('#st-right').disabled = es === draft.steps.length - 1;
  }
  refreshDiscSelect(true);
}
export function refreshStepExtras(){ if (es >= 0 && edPlay) $('#e-dur').placeholder = `Automatic: ${edPlay.autoDurs[es].toFixed(1)}`; }
function moveStep(dir){
  const j = es + dir; if (es < 0 || j < 0 || j >= draft.steps.length) return;
  const before = JSON.stringify(draft); const [st] = draft.steps.splice(es, 1); draft.steps.splice(j, 0, st);
  commit(before); setStep(j);
  if (draft.steps.some((_, i) => stepWarn(i))) hint('Moved. Some throws no longer start with the disc holder; the marked steps need a new throw.', true);
}
/* a new disc at the start of this step: continues, with a player, or at the spot where a player stands now */
function fillNewDisc(st){
  const s = $('#e-newdisc'), nd = st.newDisc, os = draft.players.filter(p => p.team === 'O');
  // each option says it all: a closed menu shows only the option, not its group
  s.replaceChildren(new Option('Continues from the last step', ''));
  const withP = document.createElement('optgroup'); withP.label = 'A new disc for a player';
  os.forEach(p => withP.appendChild(new Option(`New disc with ${p.label}`, 'to:' + p.id)));
  const atP = document.createElement('optgroup'); atP.label = 'A new disc for whoever stands at a spot';
  if (nd && nd.at) atP.appendChild(new Option('New disc at the marked spot', 'at:keep'));
  os.forEach(p => atP.appendChild(new Option(`New disc at ${p.label}’s spot (whoever is there)`, 'at:' + p.id)));
  s.append(withP, atP);
  s.value = !nd ? '' : nd.to ? 'to:' + nd.to : 'at:keep';
}
$('#e-newdisc').addEventListener('change', e => {
  if (es < 0) return;
  const before = JSON.stringify(draft), st = draft.steps[es], [kind, id] = e.target.value.split(':');
  if (!kind) delete st.newDisc;
  else if (kind === 'to') st.newDisc = {to: id};
  else if (id !== 'keep') st.newDisc = {at: edPos(id).map(v => Math.round(v * 2) / 2)};   // where they stand as the step starts
  commit(before); renderEditor(); fillNewDisc(st);
  const who = edModel.newDiscs[es];
  hint(!st.newDisc ? 'The disc continues from the last step.'
    : st.newDisc.to ? `${labelOf(id)} gets a new disc as this step starts. The old disc stays with its player until they move.`
    : who ? `A new disc for whoever stands at the marked spot: ${labelOf(who)} now.` : 'Nobody stands at that spot as this step starts, so there is no new disc.', !!st.newDisc && !who);
});
$('#st-left').addEventListener('click', () => moveStep(-1));
$('#st-right').addEventListener('click', () => moveStep(1));
$('#e-rmstep').addEventListener('click', () => {
  if (draft.steps.length < 2) return;
  const before = JSON.stringify(draft); draft.steps.splice(es, 1); commit(before);
  setStep(Math.min(es, draft.steps.length - 1));
});

/* this step's throw, with the same controls as the Throw tool's options */
export function refreshThrowPanel(){
  if (es < 0) return;
  const th = draft.steps[es].throw;
  $('#tb-none').hidden = !!th; $('#tb-body').hidden = !th;
  $('#tb-title').textContent = th ? `Throw: ${labelOf(th.from)} → ${labelOf(th.to)}` : 'Throw';
  if (th) fillThrowControls('tb', th);
}
wireThrowControls('tb', () => es >= 0 ? draft.steps[es].throw : null);
$('#tb-remove').addEventListener('click', () => { if (es < 0 || !draft.steps[es].throw) return; const before = JSON.stringify(draft); draft.steps[es].throw = null; commit(before); renderEditor(); });

/* Setup: who starts with the disc */
let discSig = '';
export function refreshDiscSelect(force){
  const os = draft.players.filter(p => p.team === 'O');
  const sig = os.map(p => p.id + ':' + p.label).join('|') + '#' + draft.disc;
  if (!force && sig === discSig) return; discSig = sig;
  const s = $('#e-disc'); s.replaceChildren(); s.add(new Option('Nobody', ''));
  os.forEach(p => s.add(new Option(`Player ${p.label}`, p.id)));
  s.value = draft.disc && os.some(p => p.id === draft.disc) ? draft.disc : '';
}
$('#e-disc').addEventListener('change', e => { const before = JSON.stringify(draft); draft.disc = e.target.value || null; commit(before); renderEditor(); });
