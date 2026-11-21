/* ---------- adding and removing players and cones ---------- */
import { edModel, edPos } from './canvas.js';
import { deselect, draft } from './session.js';
import { nextFreeLabel } from '../model/labels.js';
import { pos } from '../model/motion.js';
import { f2, newPid, r2 } from '../util.js';

export const usedLabels = () => new Set(draft.players.filter(p => p.team === 'O').map(p => p.label));
/* the next free label for a new attacker (see nextFreeLabel); '?' once that start has no room left */
export function nextLabel(start = '', used = usedLabels()){ return nextFreeLabel(used, start) ?? '?'; }
export function nearestAttacker(at){
  let best = null, bd = 6;
  draft.players.forEach(p => { if (p.team !== 'O' || !p.at || draft.players.some(q => q.follow === p.id)) return;
    const d = Math.hypot(p.at[0]-at[0], p.at[1]-at[1]); if (d < bd){ bd = d; best = p; } });
  return best;
}
/* team 'O', 'D' or 'cone'. The tool options decide the rest: prefix starts an attacker's label,
   follow makes a new defender follow the nearest attacker who has nobody on them. */
export function addPiece(team, at, {prefix = '', follow = false} = {}){
  const p = {id:newPid(), team, at};
  if (team === 'O') p.label = nextLabel(prefix);
  if (team === 'D' && follow){
    const t = nearestAttacker(at);
    if (t){ p.follow = t.id; p.offset = [r2(at[0]-t.at[0]), r2(at[1]-t.at[1])]; p.lag = t.id === draft.disc ? .12 : .35; delete p.at; }
  }
  draft.players.push(p);
  if (team === 'O' && !draft.disc) draft.disc = p.id;
  return p;
}

export function removePiece(id){
  const p = draft.players.find(q => q.id === id); if (!p) return;
  draft.players.forEach(q => { if (q.follow === id){ const at = pos(edModel, q.id, 0); q.at = [f2(at[0]), f2(at[1])]; delete q.follow; delete q.offset; delete q.lag; } });
  draft.players = draft.players.filter(q => q.id !== id);
  draft.players.forEach(q => { if (q.mark){ q.mark.order = (q.mark.order || []).filter(x => x !== id); if (q.mark.mode !== 'disc' && !q.mark.order.length){ const at = edPos(q.id); q.at = [f2(at[0]), f2(at[1])]; delete q.mark; } } });
  draft.steps.forEach(st => { delete st.moves[id]; if (st.throw && (st.throw.from === id || st.throw.to === id)) st.throw = null; });
  if (draft.disc === id){ const o = draft.players.find(q => q.team === 'O'); draft.disc = o ? o.id : null; }
  deselect(id);
}
