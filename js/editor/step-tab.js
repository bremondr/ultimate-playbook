/* ---------- steps: the step strip under the field, and the Step tab (title, note, length, the step's throw) ---------- */
import { edPlay, renderEditor, stepWarn } from './canvas.js';
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
    $('#e-arrows').checked = st.arrows !== false;
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
// this step's run arrows in playback: stored only when off
$('#e-arrows').addEventListener('change', e => {
  if (es < 0) return;
  const before = JSON.stringify(draft), st = draft.steps[es];
  if (e.target.checked) delete st.arrows; else st.arrows = false;
  commit(before); renderEditor();
  hint(e.target.checked ? 'This step’s runs show arrows when playing.' : 'This step’s runs play without arrows; they’re drawn faintly here so you can still edit them.');
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
