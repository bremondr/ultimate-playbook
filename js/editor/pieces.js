/* ---------- adding and removing players and cones; the Group tool ---------- */
import { edPos, hint } from './canvas.js';
import { snapPt } from './drafts.js';
import { renderTray } from './tools.js';
import { pos } from '../model/motion.js';
import { el, M } from '../render/svg.js';
import { draft, edModel, put, selIds } from '../state.js';
import { $, f2, newPid, r2 } from '../util.js';

/* group tool */
export const grp = {team:'O', count:4, shape:'line', gap:2.5};
const GAPS = {line:2.5, row:4, stack:4.5};
(() => {
  const c = $('#g-count'); for (let i = 2; i <= 10; i++) c.add(new Option(String(i), String(i))); c.value = '4';
  const g = $('#g-gap'); [1.5,2,2.5,3,4,4.5,5,6,8,10].forEach(v => g.add(new Option(String(v), String(v)))); g.value = '2.5';
})();
$('#g-team').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; grp.team = b.dataset.gt;
  document.querySelectorAll('#g-team button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); renderTray(); });
$('#g-shape').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; grp.shape = b.dataset.gs; grp.gap = GAPS[grp.shape]; $('#g-gap').value = String(grp.gap);
  document.querySelectorAll('#g-shape button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); });
$('#g-count').addEventListener('change', e => { grp.count = +e.target.value; });
$('#g-gap').addEventListener('change', e => { grp.gap = +e.target.value; });
export function groupPoints(start, end){
  const n = grp.count, pts = [];
  if (end && Math.hypot(end[0]-start[0], end[1]-start[1]) > 1.5){
    for (let i = 0; i < n; i++){ const u = n > 1 ? i/(n-1) : 0; pts.push(snapPt([start[0] + (end[0]-start[0])*u, start[1] + (end[1]-start[1])*u])); }
  } else {
    const dir = grp.shape === 'line' ? [-1, 0] : grp.shape === 'row' ? [0, 1] : [1, 0];
    for (let i = 0; i < n; i++) pts.push(snapPt([start[0] + dir[0]*grp.gap*i, start[1] + dir[1]*grp.gap*i]));
  }
  return pts;
}
export function nextLabel(prefix = ''){
  const used = new Set(draft.players.filter(p => p.team === 'O').map(p => p.label)); let n = 1;
  while (used.has((prefix + n).slice(0, 3))) n++; return (prefix + n).slice(0, 3);
}
const labelPrefix = () => $('#g-prefix').value.trim().slice(0, 2);
export function nearestAttacker(at){
  let best = null, bd = 6;
  draft.players.forEach(p => { if (p.team !== 'O' || !p.at || draft.players.some(q => q.follow === p.id)) return;
    const d = Math.hypot(p.at[0]-at[0], p.at[1]-at[1]); if (d < bd){ bd = d; best = p; } });
  return best;
}
export function addPiece(team, at){
  const p = {id:newPid(), team, at};
  if (team === 'O') p.label = nextLabel(labelPrefix());
  if (team === 'D' && $('#def-auto').checked){
    const t = nearestAttacker(at);
    if (t){ p.follow = t.id; p.offset = [r2(at[0]-t.at[0]), r2(at[1]-t.at[1])]; p.lag = t.id === draft.disc ? .12 : .35; delete p.at; }
  }
  draft.players.push(p);
  if (team === 'O' && !draft.disc) draft.disc = p.id;
  return p;
}
export function addGroup(start, end){
  const pts = groupPoints(start, end), ids = pts.map(at => addPiece(grp.team, at).id);
  put.selIds(new Set(ids));
  const what = grp.team === 'O' ? 'attackers' : grp.team === 'D' ? 'defenders' : 'cones';
  hint(`Added ${pts.length} ${what}. They’re selected, so you can drag them together or arrange them.`);
}
export function drawGhosts(pts, team){
  const gh = $('#g-handles');
  pts.forEach(at => {
    const q = M(...at);
    if (team === 'cone') el('path',{d:`M${f2(q[0])} ${f2(q[1]-1)} L${f2(q[0]+.95)} ${f2(q[1]+.7)} L${f2(q[0]-.95)} ${f2(q[1]+.7)} Z`,fill:'var(--cone)',opacity:.55,'pointer-events':'none'},gh);
    else el('circle',{cx:f2(q[0]),cy:f2(q[1]),r: team === 'O' ? 1.3 : 1.05,fill: team === 'O' ? 'var(--off)' : 'var(--def)',opacity:.55,stroke:'var(--chalk)','stroke-width':.15,'stroke-dasharray':'.4 .3','pointer-events':'none'},gh);
  });
}

export function removePiece(id){
  const p = draft.players.find(q => q.id === id); if (!p) return;
  draft.players.forEach(q => { if (q.follow === id){ const at = pos(edModel, q.id, 0); q.at = [f2(at[0]), f2(at[1])]; delete q.follow; delete q.offset; delete q.lag; } });
  draft.players = draft.players.filter(q => q.id !== id);
  draft.players.forEach(q => { if (q.mark){ q.mark.order = (q.mark.order || []).filter(x => x !== id); if (q.mark.mode !== 'disc' && !q.mark.order.length){ const at = edPos(q.id); q.at = [f2(at[0]), f2(at[1])]; delete q.mark; } } });
  draft.steps.forEach(st => { delete st.moves[id]; if (st.throw && (st.throw.from === id || st.throw.to === id)) st.throw = null; });
  if (draft.disc === id){ const o = draft.players.find(q => q.team === 'O'); draft.disc = o ? o.id : null; }
  selIds.delete(id);
}
