/* ---------- the field while editing: pieces, runs, throws, handles ----------
   renderEditor() times and compiles the draft, draws it, then announces 'editor-drawn' so the panels around the
   field (step strip, hint line, tabs) catch up. Anything that changes the draft just calls renderEditor(). */
import { draft, es, isSel, pendingThrow, selIds } from './session.js';
import { emit } from '../events.js';
import { faceTarget } from '../model/facing.js';
import { compile } from '../model/compile.js';
import { bez, discAt, facingDef, hand, markTargetAt, pos } from '../model/motion.js';
import { timeDraft } from '../model/timing.js';
import { drawFake, drawThrow, faceAngle, makeCone, makePlayer, placeDisc } from '../render/pieces.js';
import { dPath, el, M, svg } from '../render/svg.js';
import { $, f2 } from '../util.js';

// the draft timed (edPlay) and compiled (edModel), rebuilt on every redraw
export let edPlay = null, edModel = null;

/* where things are at the start of the step on screen */
export function edStart(){ return es < 0 ? 0 : edModel.starts[es]; }
export function edPos(id){ const p = draft.players.find(q => q.id === id); if (es < 0 && p && !p.follow && !p.mark) return p.at; return pos(edModel, id, edStart()); }
export function holderAtStep(i){ const d = discAt(edModel, edModel.starts[i]); return d ? d.holder : null; }
// a step's throw must start with whoever holds the disc when the step starts
export function stepWarn(i){ const st = draft.steps[i]; return !!(st.throw && holderAtStep(i) !== st.throw.from); }
// field-coordinate facing (degrees, 0 = downfield) of a defender at the current editor time
export function currentFacing(p){
  const self = edPos(p.id), d = discAt(edModel, edStart());
  const tg = faceTarget(self, facingDef(edModel, p, edStart()), edPos, d ? [d.x, d.y] : null);
  return Math.round(Math.atan2(tg[1]-self[1], tg[0]-self[0]) * 180/Math.PI);
}

export function renderEditor(){
  edPlay = timeDraft(draft); edModel = compile(edPlay);
  const gp = $('#g-paths'), gc = $('#g-cones'), gpl = $('#g-players'), gh = $('#g-handles');
  [gp, gc, gpl, gh].forEach(g => g.replaceChildren());
  if (es < 0) draft.players.forEach(p => {
    const tgt = p.follow || (p.mark && markTargetAt(edModel, p.id, 0)); if (!tgt) return;
    el('path',{d:dPath([edPos(p.id), edPos(tgt)]),stroke:'var(--def)','stroke-width':.18,'stroke-dasharray':'.3 .3',fill:'none',opacity:.8,'pointer-events':'none'},gp);
  });
  let d = null;
  if (es < 0){ if (draft.disc && draft.players.some(p => p.id === draft.disc)){ const h = edPos(draft.disc); d = {x:h[0]+.85, y:h[1]-.85, h:0, holder:draft.disc}; } }
  else d = discAt(edModel, edStart());
  const selRing = (g, r) => el('circle',{r,fill:'color-mix(in srgb, var(--chalk) 22%, transparent)',stroke:'var(--chalk)','stroke-width':.3},g);
  draft.players.forEach(p => {
    if (p.team === 'cone'){
      if (isSel(p.id)){ const c = M(...p.at); const g = el('g',{transform:`translate(${f2(c[0])} ${f2(c[1])})`,'pointer-events':'none'},gc); selRing(g, 1.7); }
      makeCone(p, p.at, gc, {'data-kind':'cone','data-id':p.id}); return;
    }
    const fp = edPos(p.id), q = M(...fp);
    let rot = '';
    if (p.team === 'D') rot = ` rotate(${f2(faceAngle(fp, facingDef(edModel, p, edStart()), edPos, d ? [d.x, d.y] : null, 0))})`;
    if (isSel(p.id)){ const g0 = el('g',{transform:`translate(${f2(q[0])} ${f2(q[1])})`,'pointer-events':'none'},gpl); selRing(g0, 2.2); }
    const g = makePlayer(p, gpl, {'data-kind':'player','data-id':p.id, transform:`translate(${f2(q[0])} ${f2(q[1])})${rot}`});
    if (pendingThrow === p.id) el('circle',{r:2.2,fill:'none',stroke:'var(--chalk)','stroke-width':.32,'stroke-dasharray':'.6 .4'},g);
  });
  placeDisc(d);
  if (d && d.holder) { const r = gpl.querySelector(`[data-id="${CSS.escape(d.holder)}"] .ring`); if (r) r.setAttribute('opacity', 1); }
  // rotate handle: drag it to fix the direction a single selected defender faces
  const sd = selIds.size === 1 && draft.players.find(p => selIds.has(p.id) && p.team === 'D');
  if (sd){
    const self = edPos(sd.id), deg = currentFacing(sd), r = deg * Math.PI/180, hp = [self[0] + Math.cos(r)*3.4, self[1] + Math.sin(r)*3.4];
    el('path',{d:dPath([self, hp]),stroke:'var(--chalk)','stroke-width':.14,'stroke-dasharray':'.3 .25',opacity:.8,'pointer-events':'none'},gh);
    const q = M(...hp);
    el('circle',{cx:f2(q[0]),cy:f2(q[1]),r:.75,fill:'var(--def)',stroke:'var(--chalk)','stroke-width':.22,'data-kind':'rot','data-id':sd.id,style:'cursor:grab'},gh);
  }

  if (es >= 0){
    const st = draft.steps[es];
    Object.entries(st.moves).forEach(([id, mv]) => {
      const p = draft.players.find(q => q.id === id); if (!p || p.follow) return;
      const start = edPos(id), pts = [start, ...mv.path], isD = p.team === 'D', vis = pts.slice();
      const a = vis[vis.length-2], b = vis[vis.length-1], dl = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, cut = Math.min(1.6, dl*.4);
      vis[vis.length-1] = [b[0]-(b[0]-a[0])/dl*cut, b[1]-(b[1]-a[1])/dl*cut];
      el('path',{d:dPath(pts),fill:'none',stroke:'transparent','stroke-width':1.6,'data-kind':'run','data-id':id,'pointer-events':'stroke'},gp);
      el('path',{d:dPath(vis),fill:'none',stroke:isD?'var(--def)':'var(--off)','stroke-width':.3,'stroke-dasharray':'.9 .55','stroke-linejoin':'round','marker-end':isD?'url(#ah-d)':'url(#ah-o)','pointer-events':'none'},gp);
      for (let k = 0; k < pts.length-1; k++){
        if (Math.hypot(pts[k+1][0]-pts[k][0], pts[k+1][1]-pts[k][1]) < 3) continue;
        const m = M((pts[k][0]+pts[k+1][0])/2, (pts[k][1]+pts[k+1][1])/2);
        el('circle',{cx:f2(m[0]),cy:f2(m[1]),r:.55,fill:'var(--turf)',stroke:'var(--chalk)','stroke-width':.16,'data-kind':'mid','data-id':id,'data-idx':k},gh);
      }
      mv.path.forEach((q, k) => {
        const m = M(...q);
        if (k < mv.path.length-1) el('circle',{cx:f2(m[0]),cy:f2(m[1]),r:.7,fill:'var(--chalk)',stroke:'rgba(0,0,0,.4)','stroke-width':.12,'data-kind':'wp','data-id':id,'data-idx':k},gh);
        else {
          const g = el('g',{'data-kind':'wp','data-id':id,'data-idx':k, transform:`translate(${f2(m[0])} ${f2(m[1])})`, opacity:.55},gh);
          el('circle',{r:1.3,fill:isD?'var(--def)':'var(--off)',stroke:'var(--chalk)','stroke-width':.18,'stroke-dasharray':'.4 .3'},g);
          if (!isD){ const tx = el('text',{'text-anchor':'middle','dominant-baseline':'central','font-size':p.label.length>1?1.2:1.45,'font-weight':700,fill:'var(--off-ink)',y:.05},g); tx.textContent = p.label; }
        }
      });
    });
    const th = edModel.throws.find(x => x.step === es);
    if (th){
      const z = bez(hand(edModel, th.from, th.t0), hand(edModel, th.to, th.t1), th.curve||0);
      const dd = drawThrow(gp, z, th.type, {'pointer-events':'none'}, th.grip);
      el('path',{d:dd,fill:'none',stroke:'transparent','stroke-width':1.4,'data-kind':'throw','pointer-events':'stroke'},gp);
      edModel.fakes.filter(f => f.step === es).forEach(f => drawFake(gp, edModel, f, {'pointer-events':'none'}));
    }
  }
  if (document.activeElement !== $('#s-name')) $('#s-name').value = draft.name;
  emit('editor-drawn');
  svg.setAttribute('aria-label', `Editing ${draft.name}, ${es < 0 ? 'setup' : 'step ' + (es+1)}`);
}
