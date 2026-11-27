/* ---------- drawn drills: automatic timing ---------- */
import { fieldOf, FIELDS } from '../data/fields.js';
import { defenseOf } from '../data/formations.js';
import { FORCES } from './formation.js';
import { curveOf, GRIPS, typeOf } from './throws.js';
import { clamp } from '../util.js';

export function timeDraft(d){
  const Fd = fieldOf(d.field), format = d.format === 5 ? 5 : 7;
  const byId = {}, last = {};
  d.players.forEach(p => { byId[p.id] = p; if (p.at && !p.follow) last[p.id] = p.at; });
  const RUN = 6.5, ACC = .35, DELAY = .25;
  const runLen = (a, path) => { let L = 0, q = a; for (const r of path){ L += Math.hypot(r[0]-q[0], r[1]-q[1]); q = r; } return L; };
  const autoDurs = [];
  const steps = d.steps.map((st, i) => {
    const secs = {};
    for (const [id, mv] of Object.entries(st.moves || {})){
      if (!byId[id] || byId[id].follow || !last[id] || !mv || !mv.path || !mv.path.length) continue;
      secs[id] = {len: runLen(last[id], mv.path), path: mv.path};
    }
    let th = st.throw;
    if (th && !(byId[th.from] && byId[th.to] && th.from !== th.to && last[th.from] && last[th.to])) th = null;
    let rel = null, cat = null;
    if (th){
      const to = secs[th.to] ? secs[th.to].path[secs[th.to].path.length-1] : last[th.to];
      const from = last[th.from], dist = Math.hypot(to[0]-from[0], to[1]-from[1]);
      const flight = typeOf(th) === 'over' ? clamp(dist/11, .8, 2.4) : clamp(dist/16, .5, 1.8), minRel = th.fake ? 1.2 : .3;
      if (secs[th.to]){ cat = DELAY + secs[th.to].len/RUN + ACC + .1; rel = cat - flight; if (rel < minRel){ rel = minRel; cat = rel + flight; } }
      else { rel = th.fake ? 1.2 : .5; cat = rel + flight; }
    }
    let need = 1.6;
    for (const id in secs){
      const s = secs[id]; s.s0 = (th && id === th.from) ? rel + .25 : DELAY; s.s1 = s.s0 + s.len/RUN + ACC; need = Math.max(need, s.s1 + .4);
    }
    if (cat) need = Math.max(need, cat + .5);
    need = Math.round(need*10)/10; autoDurs.push(need);
    const dur = (typeof st.dur === 'number' && st.dur > 0) ? st.dur : need;
    const moves = {};
    for (const id in secs){
      const s = secs[id]; let a = Math.min(.92, s.s0/dur), b = Math.min(1, s.s1/dur); if (b < a + .06) b = Math.min(1, a + .06);
      moves[id] = {path: s.path, start:a, end:b}; last[id] = s.path[s.path.length-1];
    }
    const out = {dur, title: st.title || `Step ${i+1}`, note: st.note || '', moves};
    if (st.arrows === false) out.arrows = false;   // this step's runs play without arrows
    // a new disc at the start: to a player (an attacker) or to whoever is at a spot; compile.js works out who
    if (st.newDisc && st.newDisc.to && byId[st.newDisc.to] && byId[st.newDisc.to].team === 'O') out.newDisc = {to: st.newDisc.to};
    else if (st.newDisc && Array.isArray(st.newDisc.at)) out.newDisc = {at: st.newDisc.at.slice()};
    if (th){ out.throw = {from:th.from, to:th.to, type:typeOf(th), curve:curveOf(th), start: Math.min(.9, rel/dur), end: Math.min(1, cat/dur)}; if (th.fake) out.throw.fake = th.fake; if (GRIPS[th.grip]) out.throw.grip = th.grip; }
    return out;
  });
  // view: fit everything that appears, at least 40 m long
  const xs = [];
  d.players.forEach(p => {
    if (p.at) xs.push(p.at[0]);
    if (p.follow && byId[p.follow] && byId[p.follow].at) xs.push(byId[p.follow].at[0] + (p.offset ? p.offset[0] : 0));
  });
  d.steps.forEach(st => Object.values(st.moves || {}).forEach(m => (m.path || []).forEach(q => xs.push(q[0]))));
  let x0 = xs.length ? Math.min(...xs) - 6 : 20, x1 = xs.length ? Math.max(...xs) + 6 : 60;
  const minSpan = Math.min(40, Fd.L*.55);
  if (x1 - x0 < minSpan){ const c = (x0 + x1)/2; x0 = c - minSpan/2; x1 = c + minSpan/2; }
  if (x0 < 0){ x1 -= x0; x0 = 0; } if (x1 > Fd.L){ x0 -= x1 - Fd.L; x1 = Fd.L; } x0 = Math.max(0, x0);
  const nO = d.players.filter(p => p.team === 'O').length, nD = d.players.filter(p => p.team === 'D').length, nC = d.players.filter(p => p.team === 'cone').length;
  const chips = [['Game', `${format} v ${format}`], ['Players', nD ? `${nO} + ${nD} D` : String(nO)], ['Throws', String(steps.filter(s => s.throw).length)]];
  const dn = defenseOf(d.defense)?.kind ? defenseOf(d.defense).name : FORCES[d.force];
  if (nD && dn) chips.splice(1, 0, ['Defense', dn.toLowerCase()]);
  if (Fd !== FIELDS.full) chips.push(['Field', Fd.label]);
  if (nC) chips.push(['Cones', String(nC)]);
  const disc = d.disc && byId[d.disc] && byId[d.disc].team === 'O' ? d.disc : null;
  return {id:d.id, kind:d.kind, name:d.name || 'Untitled drill', summary:d.summary || '', chips, view:[x0, x1], disc, field: d.field === 'small' ? 'small' : 'full', format,
    players: d.players.map(p => ({...p})), steps, autoDurs, ...(d.tags && d.tags.length ? {tags: d.tags.slice()} : {})};
}
