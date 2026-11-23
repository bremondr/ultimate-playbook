/* ---------- players, cones, throws, fakes and the disc ---------- */
import { faceTarget } from '../model/facing.js';
import { labelSize } from '../model/labels.js';
import { fakeDir, hand } from '../model/motion.js';
import { GRIP_TAG } from '../model/throws.js';
import { dPath, el, M } from './svg.js';
import { $, f2 } from '../util.js';

export function drawThrow(g, z, type, extra = {}, grip){
  const a = M(...z.a), c = M(...z.c), b = M(...z.b);
  if (grip && GRIP_TAG[grip]){
    // tag at the middle of the flight, on the side away from the bow
    const mx = .25*z.a[0]+.5*z.c[0]+.25*z.b[0], my = .25*z.a[1]+.5*z.c[1]+.25*z.b[1];
    const dx = z.b[0]-z.a[0], dy = z.b[1]-z.a[1], L = Math.hypot(dx, dy) || 1;
    const side = ((z.c[0]-(z.a[0]+z.b[0])/2)*(-dy) + (z.c[1]-(z.a[1]+z.b[1])/2)*dx) > 0 ? -1 : 1;
    const tp = M(mx + side*(-dy/L)*1.3, my + side*(dx/L)*1.3);
    const tx = el('text',{x:f2(tp[0]),y:f2(tp[1]),'text-anchor':'middle','dominant-baseline':'central','font-size':1.15,'font-weight':700,'letter-spacing':.12,
      fill: type === 'over' ? 'var(--over)' : 'var(--chalk)', stroke:'var(--turf)','stroke-width':.35,'paint-order':'stroke','pointer-events':'none'},g);
    tx.textContent = GRIP_TAG[grip];
  }
  const d = type === 'straight' ? `M${f2(a[0])} ${f2(a[1])} L${f2(b[0])} ${f2(b[1])}` : `M${f2(a[0])} ${f2(a[1])} Q${f2(c[0])} ${f2(c[1])} ${f2(b[0])} ${f2(b[1])}`;
  if (type === 'straight') el('path',{d,fill:'none',stroke:'var(--chalk)','stroke-width':.24,'marker-end':'url(#ah-s)',opacity:.95,...extra},g);
  else if (type === 'over'){
    el('path',{d,fill:'none',stroke:'var(--over)','stroke-width':.75,opacity:.3,'stroke-linecap':'round',...extra},g);
    el('path',{d,fill:'none',stroke:'var(--over)','stroke-width':.3,'stroke-dasharray':'1.3 .55','marker-end':'url(#ah-h)',...extra},g);
  } else el('path',{d,fill:'none',stroke:'var(--chalk)','stroke-width':.34,'stroke-dasharray':'.05 .7','stroke-linecap':'round','marker-end':'url(#ah-t)',opacity:.9,...extra},g);
  return d;
}
export function makeCone(p, at, parent, attrs = {}){
  const c = M(...at);
  return el('path',{d:`M${f2(c[0])} ${f2(c[1]-1)} L${f2(c[0]+.95)} ${f2(c[1]+.7)} L${f2(c[0]-.95)} ${f2(c[1]+.7)} Z`,fill:'var(--cone)',stroke:'rgba(0,0,0,.25)','stroke-width':.1,...attrs},parent);
}
export function makePlayer(p, parent, attrs = {}){
  const grp = el('g',{class: p.team==='D' ? 'dteam' : 'oteam', ...attrs}, parent);
  if (p.team === 'O'){
    el('circle',{r:1.95,fill:'none',stroke:'var(--chalk)','stroke-width':.2,'stroke-dasharray':'.5 .35',class:'ring',opacity:0},grp);
    el('circle',{r:1.3,fill:'var(--off)',stroke:'rgba(0,0,0,.35)','stroke-width':.14},grp);
    const label = p.label ?? p.id;
    const tx = el('text',{'text-anchor':'middle','dominant-baseline':'central','font-size':labelSize(label),'font-weight':700,fill:'var(--off-ink)',y:.05},grp);
    tx.textContent = label;
  } else {
    // defender seen from above: arms spread across, a point toward where they face (local +x)
    el('circle',{r:1.8,fill:'transparent'},grp);
    el('line',{x1:0,y1:-1.4,x2:0,y2:1.4,stroke:'rgba(0,0,0,.35)','stroke-width':.78,'stroke-linecap':'round'},grp);
    el('line',{x1:0,y1:-1.4,x2:0,y2:1.4,stroke:'var(--def)','stroke-width':.52,'stroke-linecap':'round'},grp);
    el('path',{d:'M.5 -.5 L1.3 0 L.5 .5 Z',fill:'var(--def)',stroke:'rgba(0,0,0,.35)','stroke-width':.1,'stroke-linejoin':'round'},grp);
    el('circle',{r:.66,fill:'var(--def)',stroke:'rgba(0,0,0,.35)','stroke-width':.12},grp);
  }
  return grp;
}

// the angle a defender is drawn at, in screen degrees
export function faceAngle(selfPt, p, targetOf, discPt, prev){
  const tgt = faceTarget(selfPt, p, targetOf, discPt);
  const a = M(...selfPt), b = M(...tgt), dx = b[0]-a[0], dy = b[1]-a[1];
  if (Math.hypot(dx, dy) < .3) return prev ?? 0;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}
export function drawFake(g, m, f, extra = {}){
  const p = hand(m, f.by, f.t0), dir = fakeDir(m, f, f.t0), q = [p[0]+dir[0]*6, p[1]+dir[1]*6];
  el('path',{d:dPath([p, q]),fill:'none',stroke:'var(--chalk)','stroke-width':.2,'stroke-dasharray':'.45 .4',opacity:.65,'marker-end':'url(#ah-s)',...extra},g);
  const tp = M(p[0]+dir[0]*3 + dir[1]*1.3, p[1]+dir[1]*3 - dir[0]*1.3);
  const tx = el('text',{x:f2(tp[0]),y:f2(tp[1]),'text-anchor':'middle','dominant-baseline':'central','font-size':1.25,'font-weight':700,'letter-spacing':.15,fill:'var(--chalk)',opacity:.85},g);
  tx.textContent = 'FAKE';
}
export function placeDisc(d){
  const g = $('#g-disc');
  if (!d){ g.setAttribute('visibility','hidden'); return; }
  g.removeAttribute('visibility');
  // a new disc fades in (d.appear from 0 to 1)
  if (d.appear !== undefined) g.setAttribute('opacity', f2(d.appear)); else g.removeAttribute('opacity');
  const dp = M(d.x, d.y);
  $('#disc-shadow').setAttribute('transform', `translate(${f2(dp[0]+d.h*.5)} ${f2(dp[1]+d.h*.3)})`);
  $('#disc-shadow').setAttribute('opacity', d.h ? .55 : .35);
  const body = $('#disc-body'); body.setAttribute('cx', f2(dp[0])); body.setAttribute('cy', f2(dp[1]-d.h*1.4)); body.setAttribute('r', f2(.68+d.h*.12));
}
/* the old discs still in someone's hand after a new disc was given out (motion.js, sparesAt): resting, fading out */
export function placeSpares(list){
  const g = $('#g-spares'); g.replaceChildren();
  (list || []).forEach(d => {
    const dp = M(d.x, d.y), w = el('g', {opacity: f2(d.opacity), 'pointer-events': 'none'}, g);
    el('ellipse', {rx: .7, ry: .38, fill: 'var(--shadow)', opacity: .35, transform: `translate(${f2(dp[0])} ${f2(dp[1])})`}, w);
    el('circle', {cx: f2(dp[0]), cy: f2(dp[1]), r: .68, fill: 'var(--disc)', stroke: '#9fb0a2', 'stroke-width': .14}, w);
  });
}
