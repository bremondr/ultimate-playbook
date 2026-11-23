/* ---------- Throw tool ----------
   Whoever has the disc throws, so one tap on the receiver is enough: the throw goes from the disc holder. Tapping
   another player then continues with the next throw in the next step, which is added when needed. Dragging from the
   thrower to the receiver does the same. Tapping the holder first, then a receiver, redraws this step's throw.
   In Setup the throw goes into the step after the last throw, and the editor shows that step. If nobody has the disc
   yet, the first tap says who starts with it.
   The tray (tap Throw again; it doesn't open by itself) sets up the next throw's type, flight and fake; the Step tab
   edits a throw already drawn with the same controls. */
import { edModel, edPos, renderEditor } from '../canvas.js';
import { hint } from '../hint.js';
import { commit } from '../history.js';
import { draft, es, labelOf, pendingThrow, setPendingThrow } from '../session.js';
import { setTab } from '../tabs.js';
import { emit } from '../../events.js';
import { curveOf, GRIPS, OVER_GRIPS, typeOf } from '../../model/throws.js';
import { el, M } from '../../render/svg.js';
import { $, f2 } from '../../util.js';

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

/* ---------- who has the disc, and where a throw goes ---------- */
const isAttacker = id => draft.players.some(p => p.id === id && p.team === 'O');
// who has the disc at the start of step i (i may be one past the last step): the starter, then each throw's receiver,
// and whoever gets a new disc at a step's start (the model works out who stands at a spot)
function holderFor(i){
  let h = isAttacker(draft.disc) ? draft.disc : null;
  for (let k = 0; k < draft.steps.length && k <= i; k++){
    const fresh = edModel && edModel.newDiscs ? edModel.newDiscs[k] : null;
    if (fresh) h = fresh;
    if (k < i && draft.steps[k].throw) h = draft.steps[k].throw.to;
  }
  return h && isAttacker(h) ? h : null;
}
function lastThrowStep(){ for (let i = draft.steps.length - 1; i >= 0; i--) if (draft.steps[i].throw) return i; return -1; }
// in Setup, a throw goes into the step after the last throw
const setupTarget = () => lastThrowStep() + 1;
// who throws next where the tap happens: in a step that already has its throw, its receiver (for the next step)
function holderHere(){
  if (es < 0) return holderFor(setupTarget());
  const th = draft.steps[es].throw;
  return th ? th.to : holderFor(es);
}

// a throw in step i, adding a step there when i is past the end or that step already has a throw
function addThrow(i, from, to, before){
  if (i >= draft.steps.length || draft.steps[i].throw) draft.steps.splice(i, 0, {title:'', note:'', dur:null, moves:{}, throw:null});
  draft.steps[i].throw = newThrow(from, to);
  commit(before);
  if (i !== es) emit('show-step', i); else setTab('step');
  hint(`Throw ${labelOf(from)} → ${labelOf(to)} in step ${i + 1}. Tap another player for the next throw.`);
}
// a throw from `from` to `to`, wherever it fits from here (a tap on a picked thrower, or a drag)
function throwFrom(from, to, before){
  if (es < 0){
    const at = setupTarget(), h = holderFor(at);
    if (h && h !== from){ hint(`${labelOf(h)} has the disc at that point. Throw from them.`, true); return; }
    if (!h) draft.disc = from;
    addThrow(at, from, to, before);
    return;
  }
  const st = draft.steps[es], h = holderFor(es);
  if (!h || from === h){
    if (!h) draft.disc = from;
    st.throw = st.throw ? {...st.throw, from, to} : newThrow(from, to);
    commit(before); setTab('step');
    hint(`Throw ${labelOf(from)} → ${labelOf(to)} in step ${es + 1}.${st.throw ? ' Tap another player for the next throw.' : ''}`);
  }
  else if (st.throw && from === st.throw.to) addThrow(es + 1, from, to, before);
  else hint(st.throw
    ? `${labelOf(from)} doesn’t have the disc here. Throw from ${labelOf(h)} to redraw this throw, or from ${labelOf(st.throw.to)} for the next one.`
    : `${labelOf(h)} has the disc at the start of this step. Throw from them.`, true);
}
// a tap on an attacker
function tap(id, before){
  if (pendingThrow){
    const from = pendingThrow; setPendingThrow(null);
    if (from !== id) throwFrom(from, id, before);
    return;
  }
  const holder = holderHere();
  if (!holder){ draft.disc = id; commit(before); hint(`${labelOf(id)} starts with the disc. Now tap the receiver.`); return; }
  // the holder (or, where this step has its throw, the one who threw it): wait for the receiver
  if (id === holder || (es >= 0 && draft.steps[es].throw && id === holderFor(es))){ setPendingThrow(id); return; }
  throwFrom(holder, id, before);
}

/* ---------- dragging from the thrower to the receiver ---------- */
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the attacker nearest to a point on the field, within reach of a finger
function attackerAt(pt){
  let best = null, bd = 2.6;
  draft.players.forEach(p => { if (p.team !== 'O') return; const d = dist(edPos(p.id), pt); if (d < bd){ bd = d; best = p.id; } });
  return best;
}
function drawPreview(d){
  const a = M(...edPos(d.from)), b = M(...d.last);
  if (!d.line || !d.line.isConnected) d.line = el('line', {stroke: 'var(--chalk)', 'stroke-width': .35, 'stroke-dasharray': '.8 .5', 'stroke-linecap': 'round', 'marker-end': 'url(#ah-t)', 'pointer-events': 'none'}, $('#g-handles'));
  d.line.setAttribute('x1', f2(a[0])); d.line.setAttribute('y1', f2(a[1]));
  d.line.setAttribute('x2', f2(b[0])); d.line.setAttribute('y2', f2(b[1]));
}

export default {
  id: 'throw', key: 't',
  tray: {title: 'Next throw', opensItself: false, sections: () => ['#tray-throw'], fill: () => fillThrowControls('nt', throwDefaults)},
  hint(setup){
    if (pendingThrow) return 'Now tap the receiver.';
    const holder = holderHere();
    if (!holder) return 'Tap the attacker who starts with the disc, then the receiver.';
    const options = 'Tap Throw again for the type and flight.';
    if (setup) return `Tap the receiver for a throw from ${labelOf(holder)}; it goes in step ${setupTarget() + 1}. Or drag from thrower to receiver. ${options}`;
    const th = draft.steps[es].throw;
    if (th) return `Tap a receiver for the next throw, from ${labelOf(th.to)} in a new step. To redraw this one, tap ${labelOf(th.from)} first.`;
    return `Tap the receiver for a throw from ${labelOf(holder)}. Or drag from thrower to receiver. ${options}`;
  },
  // a tap or a drag starts on an attacker; which one it was is known when the finger lifts
  down({kind, id, raw, before, capture}){
    const p = kind === 'player' && draft.players.find(q => q.id === id);
    if (!p){ setPendingThrow(null); return null; }
    if (p.team !== 'O'){ hint('Only attackers throw and catch. Pick a yellow player.', true); return null; }
    capture();
    return {from: id, start: raw, last: raw, moved: false, before, line: null};
  },
  move(d, raw){
    if (!d.moved && dist(raw, d.start) < 1.5) return;
    d.moved = true; d.last = raw; drawPreview(d);
  },
  up(d){
    if (d.line) d.line.remove();
    if (!d.moved) tap(d.from, d.before);
    else {
      const to = attackerAt(d.last);
      setPendingThrow(null);
      if (to && to !== d.from) throwFrom(d.from, to, d.before);
      else hint('Let go on the receiver to draw a throw.');
    }
    renderEditor();
  }
};
