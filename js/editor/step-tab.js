import { hint, labelOf, renderEditor, stepWarn } from './canvas.js';
import { commit } from './history.js';
import { setStep } from './tools.js';
import { curveOf, GRIPS, OVER_GRIPS, typeOf } from '../model/throws.js';
import { draft, edPlay, es } from '../state.js';
import { $ } from '../util.js';

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
$('#st-left').addEventListener('click', () => moveStep(-1));
$('#st-right').addEventListener('click', () => moveStep(1));
$('#e-rmstep').addEventListener('click', () => {
  if (draft.steps.length < 2) return;
  const before = JSON.stringify(draft); draft.steps.splice(es, 1); commit(before);
  setStep(Math.min(es, draft.steps.length - 1));
});

/* throws: the Step tab edits this step's throw; the tray sets up the next one */
export let throwDefaults = {grip:'', curve:0, fake:''};
export function newThrow(from, to){
  const th = {from, to, curve: throwDefaults.curve};
  if (throwDefaults.grip) th.grip = throwDefaults.grip;
  if (throwDefaults.fake) th.fake = throwDefaults.fake;
  th.type = typeOf(th); return th;
}
export function fillThrowControls(prefix, src){
  const sel_ = $(`#${prefix}-grip`);
  if (!sel_.options.length){ sel_.add(new Option('Not specified', '')); for (const k in GRIPS) sel_.add(new Option(GRIPS[k], k)); }
  sel_.value = src.grip && GRIPS[src.grip] ? src.grip : '';
  const cv = src.from ? curveOf(src) : src.curve, fl = Math.abs(cv) < .03 ? 0 : cv < 0 ? -1 : 1;
  document.querySelectorAll(`#${prefix}-flight button`).forEach(b => b.setAttribute('aria-pressed', +b.dataset.fl === fl ? 'true' : 'false'));
  $(`#${prefix}-fake`).value = src.fake || '';
}
export function refreshThrowPanel(){
  if (es < 0) return;
  const th = draft.steps[es].throw;
  $('#tb-none').hidden = !!th; $('#tb-body').hidden = !th;
  $('#tb-title').textContent = th ? `Throw: ${labelOf(th.from)} → ${labelOf(th.to)}` : 'Throw';
  if (th) fillThrowControls('tb', th);
}
function wireThrowControls(prefix, target){
  const apply = fn => {
    const th = target();
    if (!th){ fn(throwDefaults); fillThrowControls(prefix, throwDefaults); return; }
    const before = JSON.stringify(draft); fn(th); th.type = typeOf(th); commit(before); renderEditor();
  };
  $(`#${prefix}-grip`).addEventListener('change', e => apply(t => { if (e.target.value) t.grip = e.target.value; else delete t.grip; }));
  $(`#${prefix}-flight`).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    apply(t => { t.curve = +b.dataset.fl * (OVER_GRIPS.includes(t.grip) ? .1 : .14); }); });
  $(`#${prefix}-fake`).addEventListener('change', e => apply(t => { if (e.target.value) t.fake = e.target.value; else delete t.fake; }));
}
wireThrowControls('tb', () => es >= 0 ? draft.steps[es].throw : null);
wireThrowControls('nt', () => null);
$('#tb-remove').addEventListener('click', () => { if (es < 0 || !draft.steps[es].throw) return; const before = JSON.stringify(draft); draft.steps[es].throw = null; commit(before); renderEditor(); });

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
