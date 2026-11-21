/* ---------- compile a timed play into segments ---------- */
import { pos } from './motion.js';
import { curveOf, typeOf } from './throws.js';

export function compile(play){
  const P = {}, last = {};
  play.players.forEach(p => { P[p.id] = {def:p, init:p.at, segs:[]}; if (p.at && !p.follow) last[p.id] = p.at; });
  const starts = [], throws = [], fakes = []; let T = 0;
  play.steps.forEach((st, i) => {
    starts.push(T); const D = st.dur;
    Object.entries(st.moves || {}).forEach(([id, mv]) => {
      if (!P[id] || !last[id]) return;
      const sp = Array.isArray(mv) ? {path:mv} : mv;
      if (!sp.path || !sp.path.length) return;
      const pts = [last[id], ...sp.path], cum = [0];
      for (let k = 1; k < pts.length; k++) cum.push(cum[k-1] + Math.hypot(pts[k][0]-pts[k-1][0], pts[k][1]-pts[k-1][1]));
      P[id].segs.push({t0:T+(sp.start??0)*D, t1:T+(sp.end??1)*D, pts, cum, L:cum[cum.length-1], end:pts[pts.length-1], step:i, id});
      last[id] = pts[pts.length-1];
    });
    if (st.throw && P[st.throw.from] && P[st.throw.to]) {
      const th = st.throw, t0 = T+(th.start??.5)*D, t1 = T+(th.end??1)*D;
      throws.push({...th, type:typeOf(th), curve:curveOf(th), t0, t1, step:i, S:T, E:T+D});
    }
    T += D;
  });
  throws.forEach(th => meetOnTheRun(P, th));
  const m = {play, P, starts, throws, fakes, marks:{}, total:T};
  // a marking defender switches to a new player at these moments
  const order = throws.slice().sort((a, b) => a.t0 - b.t0);
  Object.values(P).forEach(({def}) => {
    const mk = def.mark; if (!mk || def.team !== 'D') return;
    const ev = [];
    if (mk.mode === 'disc'){ if (play.disc && P[play.disc]) ev.push({t:-1, target:play.disc}); order.forEach(th => ev.push({t:th.t0 + .1, target:th.to})); }
    else if (mk.mode === 'handler'){
      // marks a row player only while they hold the disc at the front spot; otherwise waits on that spot
      const seq = (mk.order || []).filter(id => P[id]); if (!seq.length || !P[seq[0]].init) return;
      const spot = P[seq[0]].init, near = (id, t) => { const q = pos(m, id, t); return Math.hypot(q[0]-spot[0], q[1]-spot[1]) <= 4; };
      let cur = seq.includes(play.disc) && near(play.disc, 0) ? play.disc : '@spot';
      ev.push({t:-1, target:cur});
      order.forEach(th => {
        if (th.from === cur){ cur = '@spot'; ev.push({t:th.t0 + .1, target:cur}); }
        if (seq.includes(th.to) && near(th.to, th.t1)){ cur = th.to; ev.push({t:Math.max(th.t0 + .15, th.t1 - .25), target:cur}); }
      });
      ev.spot = spot;
    }
    else {
      const seq = (mk.order || []).filter(id => P[id]); if (!seq.length) return;
      let k = 0; ev.push({t:-1, target:seq[0]});
      order.forEach(th => { if (th.from === seq[k] && k < seq.length - 1){ k++; ev.push({t:th.t0 + .15, target:seq[k]}); } });
    }
    if (ev.length){ const sp = ev.spot; ev.sort((a, b) => a.t - b.t); ev.spot = sp; m.marks[def.id] = ev; }
  });
  throws.forEach(th => {
    if (th.fake === 'up' || th.fake === 'mirror') fakes.push({by:th.from, to:th.to, kind:th.fake, t0:Math.max(th.S, th.t0-.85), t1:th.t0-.2, tc:th.t1, step:th.step});
  });
  return m;
}
/* Disc and receiver meet: when the receiver runs in the throw's step, the disc lands exactly as the
   run ends, and the receiver keeps running speed into the catch instead of slowing to a stop and waiting.
   The flight time stays as drawn; the release moves to fit. If the thrower had a run planned for after
   the release, that run moves with the release. */
function meetOnTheRun(P, th){
  const seg = P[th.to].segs.find(s => s.step === th.step);
  if (!seg) return;
  const flight = Math.max(.35, th.t1 - th.t0), minT0 = th.S + (th.fake ? 1 : .15), origT0 = th.t0;
  let t1 = Math.min(seg.t1, th.E), t0 = t1 - flight;
  if (t0 < minT0){
    // the run ends too soon for this flight: start the run later so both still finish together
    t0 = minT0; const want = t0 + flight, shift = Math.min(want, th.E) - seg.t1;
    if (shift > 0){ seg.t0 = Math.min(seg.t0 + shift, th.E - .3); seg.t1 = Math.min(seg.t1 + shift, th.E); }
    t1 = seg.t1; if (t1 - t0 < .35) t0 = Math.max(th.S, t1 - .35);
  }
  th.t0 = t0; th.t1 = t1; seg.catch = true;
  const ts = P[th.from].segs.find(s => s.step === th.step);
  if (ts && ts.t0 >= origT0 - 1e-6 && ts.t0 < t0 + .2){ const d = t0 + .2 - ts.t0; ts.t0 += d; ts.t1 = Math.min(th.E, ts.t1 + d); if (ts.t1 <= ts.t0) ts.t1 = ts.t0 + .2; }
}
