/* ---------- Throw tool: tap the thrower, then the receiver. In Setup, tap who starts with the disc. ----------
   Its options (the tray) set up the next throw; the Step tab edits the throw already drawn with the same controls. */
import { holderAtStep, renderEditor } from '../canvas.js';
import { hint } from '../hint.js';
import { commit } from '../history.js';
import { draft, es, labelOf, pendingThrow, setPendingThrow } from '../session.js';
import { setTab } from '../tabs.js';
import { curveOf, GRIPS, OVER_GRIPS, typeOf } from '../../model/throws.js';
import { $ } from '../../util.js';

/* throws: the Step tab edits this step's throw; the tray sets up the next one */
export let throwDefaults = {grip:'', curve:0, fake:''};
export function newThrow(from, to){
  const th = {from, to, curve: throwDefaults.curve};
  if (throwDefaults.grip) th.grip = throwDefaults.grip;
  if (throwDefaults.fake) th.fake = throwDefaults.fake;
  th.type = typeOf(th); return th;
}
// the grip, flight and fake controls: prefix 'nt' in the tray, 'tb' in the Step tab
export function fillThrowControls(prefix, src){
  const sel_ = $(`#${prefix}-grip`);
  if (!sel_.options.length){ sel_.add(new Option('Not specified', '')); for (const k in GRIPS) sel_.add(new Option(GRIPS[k], k)); }
  sel_.value = src.grip && GRIPS[src.grip] ? src.grip : '';
  const cv = src.from ? curveOf(src) : src.curve, fl = Math.abs(cv) < .03 ? 0 : cv < 0 ? -1 : 1;
  document.querySelectorAll(`#${prefix}-flight button`).forEach(b => b.setAttribute('aria-pressed', +b.dataset.fl === fl ? 'true' : 'false'));
  $(`#${prefix}-fake`).value = src.fake || '';
}
// target() gives the throw to change; without one the controls change the defaults for the next throw
export function wireThrowControls(prefix, target){
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
wireThrowControls('nt', () => null);

export default {
  id: 'throw', key: 't',
  tray: {title: 'Next throw', sections: () => ['#tray-throw'], fill: () => fillThrowControls('nt', throwDefaults)},
  hint(setup){
    if (setup) return 'Tap the attacker who starts with the disc.';
    const holder = holderAtStep(es);
    return pendingThrow ? 'Now tap the receiver.' : holder ? `Tap ${labelOf(holder)} (has the disc at the start of this step), then the receiver.` : 'Nobody has the disc. Pick who starts with it in Setup.';
  },
  down({kind, id, before}){
    const p = kind === 'player' && draft.players.find(q => q.id === id);
    if (!p) { setPendingThrow(null); }
    else if (p.team !== 'O') hint('Only attackers throw and catch. Pick a yellow player.', true);
    else if (es < 0){ draft.disc = id; commit(before); }
    else if (!pendingThrow){
      const holder = holderAtStep(es);
      if (holder && holder !== id) hint(`${labelOf(holder)} has the disc at the start of this step. Tap them first.`, true);
      else setPendingThrow(id);
    } else if (id === pendingThrow){ setPendingThrow(null); }
    else {
      const old = draft.steps[es].throw;
      draft.steps[es].throw = old ? {...old, from:pendingThrow, to:id} : newThrow(pendingThrow, id);
      setPendingThrow(null); commit(before); setTab('step');
    }
  }
};
