/* ---------- where everyone and the disc are at time t ---------- */
import { personOffset } from './formation.js';
import { clamp } from '../util.js';

const ease = u => 0.5 - 0.5*Math.cos(Math.PI*Math.min(1,Math.max(0,u)));
// runs that end in a catch speed up and arrive at full pace
const easeIn = u => 1 - Math.cos(Math.PI/2*Math.min(1,Math.max(0,u)));
function along(seg, u){
  const d = (seg.catch ? easeIn(u) : ease(u)) * seg.L;
  for (let k = 1; k < seg.pts.length; k++){
    if (seg.cum[k] >= d || k === seg.pts.length-1){
      const span = seg.cum[k]-seg.cum[k-1] || 1, f = Math.min(1,(d-seg.cum[k-1])/span), a = seg.pts[k-1], b = seg.pts[k];
      return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f];
    }
  }
  return seg.end;
}
/* The mark stands an arm's length from the player they mark, on the side the force closes off.
   When their player throws (or, marking the disc, when the disc moves) they run to the next one. */
function markEvent(m, id, t){ const ev = m.marks && m.marks[id]; if (!ev) return null; let k = 0; for (let i = 0; i < ev.length; i++) if (ev[i].t <= t) k = i; return {ev, k}; }
export function markTargetAt(m, id, t){ const r = markEvent(m, id, t); const g = r ? r.ev[r.k].target : null; return g === '@spot' ? null : g; }
function markSpot(m, def, target, t, depth){
  const a = target === '@spot' ? m.marks[def.id].spot : pos(m, target, Math.max(0, t - .12), depth + 1), o = personOffset(def.mark.force || 'right', true, a, null); return [a[0]+o[0], a[1]+o[1]]; }
function markPos(m, id, t, depth){
  const p = m.P[id], r = markEvent(m, id, t);
  const cur = r.ev[r.k], to = markSpot(m, p.def, cur.target, t, depth);
  if (r.k === 0) return to;
  const from = markSpot(m, p.def, r.ev[r.k-1].target, cur.t, depth);
  const dur = clamp(Math.hypot(to[0]-from[0], to[1]-from[1])/6.5 + .2, .4, 3), u = (t - cur.t)/dur;
  if (u >= 1) return to;
  const e = ease(u); return [from[0] + (to[0]-from[0])*e, from[1] + (to[1]-from[1])*e];
}
// facing: a mark looks at the player they mark; everyone else uses their own setting
export function facingDef(m, def, t){
  if (!def.mark) return def;
  const r = markEvent(m, def.id, t), g = r ? r.ev[r.k].target : null;
  return g === '@spot' ? {...def, follow: undefined, spotPt: r.ev.spot} : {...def, follow: g || undefined};
}
export function pos(m, id, t, depth = 0){
  const p = m.P[id], F = m.field;
  if (!p) return [F.L/2, F.W/2];
  if (p.def.mark && m.marks && m.marks[id] && depth < 4) return markPos(m, id, t, depth);
  if (p.def.follow && m.P[p.def.follow] && depth < 4){
    const tp = pos(m, p.def.follow, Math.max(0, t-(p.def.lag??.3)), depth+1);
    return [tp[0]+p.def.offset[0], tp[1]+p.def.offset[1]];
  }
  let q = p.init || [F.L/2, F.W/2];
  for (const s of p.segs){ if (t >= s.t1) q = s.end; else if (t > s.t0) return along(s, (t-s.t0)/(s.t1-s.t0)); else break; }
  return q;
}
export const hand = (m, id, t) => { const p = pos(m, id, t); return [p[0]+0.85, p[1]-0.85]; };
// a pump fake: the thrower shows the disc toward `dir` and pulls it back
export function fakeDir(m, f, t){
  if (f.kind === 'mirror'){
    const p = pos(m, f.by, t), q = hand(m, f.to, f.tc), dx = q[0]-p[0], dy = -(q[1]-p[1]), L = Math.hypot(dx, dy) || 1;
    return [dx/L, dy/L];
  }
  return [1, 0];
}
export function bez(a, b, curve){
  const dx=b[0]-a[0], dy=b[1]-a[1], dist=Math.hypot(dx,dy)||1;
  return {a, b, c:[(a[0]+b[0])/2 - dy/dist*curve*dist, (a[1]+b[1])/2 + dx/dist*curve*dist], dist};
}
export function discAt(m, t){
  let holder = m.play.disc && m.P[m.play.disc] ? m.play.disc : null, since = null;
  const log = m.discLog || m.throws;
  if (!holder && !log.some(e => e.nd)) return null;
  for (const th of log){
    if (t < th.t0) break;
    // a new disc at a step's start: it appears in the new holder's hand
    if (th.nd){ holder = th.to; since = th.t0; continue; }
    since = null;
    if (t < th.t1){
      const z = bez(hand(m, th.from, th.t0), hand(m, th.to, th.t1), th.curve||0), u = (t-th.t0)/(th.t1-th.t0), v = 1-u;
      const hmax = th.type === 'over' ? Math.min(3.2, z.dist/7) : Math.min(1.6, z.dist/14);
      return {x:v*v*z.a[0]+2*v*u*z.c[0]+u*u*z.b[0], y:v*v*z.a[1]+2*v*u*z.c[1]+u*u*z.b[1], h:Math.sin(Math.PI*u)*hmax, holder:null};
    }
    holder = th.to;
  }
  if (!holder) return null;
  const h = hand(m, holder, t), appear = since === null ? 1 : Math.min(1, (t - since)/.35);
  if (appear < 1) return {x:h[0], y:h[1], h:0, holder, appear};
  for (const f of (m.fakes || [])){
    if (f.by === holder && t > f.t0 && t < f.t1){
      const dir = fakeDir(m, f, t), k = Math.sin(Math.PI*(t-f.t0)/(f.t1-f.t0))*1.7;
      return {x:h[0]+dir[0]*k, y:h[1]+dir[1]*k, h:0, holder};
    }
  }
  return {x:h[0], y:h[1], h:0, holder};
}
/* The old discs still in someone's hand after a new disc was given out (see compile.js): [{x, y, opacity}].
   Each fades out over .4 s once its holder starts their next run. */
export function sparesAt(m, t){
  return (m.spares || []).filter(s => t >= s.t0 - 1e-6 && t < s.t1 + .4).map(s => {
    const h = hand(m, s.holder, t);
    return {x: h[0], y: h[1], opacity: t <= s.t1 ? 1 : 1 - (t - s.t1)/.4};
  });
}
export function stepAt(m, t){ let i = 0; for (let k = 0; k < m.starts.length; k++) if (t >= m.starts[k] - 1e-6) i = k; return i; }
