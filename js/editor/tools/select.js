/* ---------- Select tool ----------
   Setup: tap to select, drag to move (everything selected moves together), drag a box on the grass to select several.
   A step: drag a player to draw their run (everyone selected gets the same run), drag a run's dots to bend it.
   Either: drag the handle in front of a selected defender to turn them. */
import { edPos, renderEditor } from '../canvas.js';
import { hint } from '../hint.js';
import { commit } from '../history.js';
import { draft, es, isSel, labelOf, selIds, setSelIds, snapPt } from '../session.js';
import { setSel } from '../selection.js';
import { setTab } from '../tabs.js';
import { el, M } from '../../render/svg.js';
import { $, clone, f2, r2 } from '../../util.js';

function startMove(ids, raw, before){
  // setup: move every selected item; a follower keeps its offset when its player moves with it
  const set = new Set(ids), items = [];
  draft.players.filter(p => set.has(p.id)).forEach(p => {
    if (p.mark) return;
    if (p.follow){ if (!set.has(p.follow)) items.push({p, follower:true, o:p.offset.slice()}); }
    else items.push({p, o:p.at.slice()});
  });
  return {type:'move', start:raw, items, before, moved:false};
}
function startRuns(ids, raw, before, anchor){
  const ps = draft.players.filter(p => ids.includes(p.id) && p.team !== 'cone' && !p.follow && !p.mark);
  return {type:'runs', start:raw, ids:ps.map(p => p.id), anchor, origin:Object.fromEntries(ps.map(p => [p.id, edPos(p.id).slice()])),
    old:Object.fromEntries(ps.map(p => [p.id, draft.steps[es].moves[p.id] ? clone(draft.steps[es].moves[p.id]) : null])), before, created:false};
}

/* Pieces on top of each other: a tap selects the one on top, and each tap after that on the same spot selects the
   next one down (and round again). A drag still moves the one selected. */
function describe(id){
  const p = draft.players.find(q => q.id === id); if (!p) return '';
  if (p.team === 'O') return `Attacker ${p.label}`;
  if (p.team === 'cone') return 'A cone';
  const on = p.follow || (p.mark && (p.mark.order || [])[0]);
  return on ? `The defender on ${labelOf(on)}` : 'A defender';
}
function stackHint(id, stack){
  hint(`${describe(id)} selected. ${stack.length} are on this spot: tap again for the next one.`);
}
function pickInStack(id, stack){ setSel([id]); stackHint(id, stack); }

/* Pointer down returns the drag it starts, if any; move and up then get that drag back. Drag types: 'rot' (turn a
   defender), 'wp' (a point of a run), 'move' (setup), 'runs' (a step), 'box' (select by box). */
function down(ctx){
  const {kind, additive, stack = []} = ctx;
  if ((kind === 'player' || kind === 'cone') && !additive && stack.length > 1){
    const cur = selIds.size === 1 ? [...selIds][0] : null, at = cur ? stack.indexOf(cur) : -1;
    if (at >= 0){
      // the selected piece is in the pile: a drag moves it, a tap goes on to the next one (see up)
      const next = stack[(at + 1) % stack.length], d = pieceDown({...ctx, id: cur});
      if (d){ d.cycle = {next, stack}; return d; }
      pickInStack(next, stack); return null;
    }
    const d = pieceDown(ctx);
    if (isSel(ctx.id)) stackHint(ctx.id, stack);
    return d;
  }
  return pieceDown(ctx);
}
function pieceDown({kind, id, idx, raw, pt, before, additive, capture}){
  if (kind === 'rot'){ capture(); return {type:'rot', id, before}; }
  if (kind === 'wp' && es >= 0){ capture(); return {type:'wp', id, idx, before}; }
  if (kind === 'mid' && es >= 0){ draft.steps[es].moves[id].path.splice(idx, 0, pt); capture(); return {type:'wp', id, idx, before, inserted:true, moved:false}; }
  if (kind === 'player' || kind === 'cone'){
    if (additive){ const s = new Set(selIds); if (s.has(id)) s.delete(id); else s.add(id); setSel(s); }
    else if (!isSel(id)) setSel([id]);
    if (!isSel(id)) return null;
    const ids = [...selIds], p = draft.players.find(q => q.id === id);
    if (es < 0){
      if (p.mark && ids.length === 1){ hint('This defender marks automatically, so they stand where the force puts them. Change it in the Selected tab.'); return null; }
      capture(); return startMove(ids, raw, before);
    }
    if (p.team === 'cone') hint('Cones stay put for the whole drill. Move them in Setup.');
    else if (p.mark && ids.length === 1) hint('This defender marks automatically. Change who they mark and the force in the Selected tab.');
    else if (p.follow && ids.length === 1) hint('This defender follows an attacker. Set “Follows” to Nobody to draw their runs yourself.');
    else { capture(); return startRuns(ids, raw, before, id); }
    return null;
  }
  if (kind === 'run'){ setSel(additive ? [...selIds, id] : [id]); return null; }
  if (kind === 'throw'){ setTab('step'); return null; }
  capture(); return {type:'box', start:raw, end:raw, additive, base:additive ? new Set(selIds) : new Set()};
}

function move(drag, raw, pt){
  if (drag.type === 'box'){
    drag.end = raw;
    const x0 = Math.min(drag.start[0], raw[0]), x1 = Math.max(drag.start[0], raw[0]), y0 = Math.min(drag.start[1], raw[1]), y1 = Math.max(drag.start[1], raw[1]);
    const inside = draft.players.filter(p => { const q = p.team === 'cone' ? p.at : edPos(p.id); return q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1; }).map(p => p.id);
    setSelIds([...drag.base, ...inside]);
    renderEditor();
    const a = M(x0, y0), b = M(x1, y1);
    el('rect',{x:f2(Math.min(a[0],b[0])),y:f2(Math.min(a[1],b[1])),width:f2(Math.abs(b[0]-a[0])),height:f2(Math.abs(b[1]-a[1])),fill:'color-mix(in srgb, var(--chalk) 14%, transparent)',stroke:'var(--chalk)','stroke-width':.18,'stroke-dasharray':'.6 .4','pointer-events':'none'},$('#g-handles'));
    return;
  }
  if (drag.type === 'rot'){
    const p = draft.players.find(q => q.id === drag.id); if (!p) return;
    const self = edPos(p.id);
    p.face = 'angle'; p.angle = Math.round(Math.atan2(raw[1]-self[1], raw[0]-self[0]) * 180/Math.PI / 5) * 5;
    renderEditor(); return;
  }
  if (drag.type === 'move'){
    const dx = Math.round((raw[0]-drag.start[0])*2)/2, dy = Math.round((raw[1]-drag.start[1])*2)/2;
    if (dx || dy) drag.moved = true;
    drag.items.forEach(it => {
      if (it.follower) it.p.offset = [r2(it.o[0]+dx), r2(it.o[1]+dy)];
      else it.p.at = snapPt([it.o[0]+dx, it.o[1]+dy]);
    });
  } else if (drag.type === 'wp'){
    const mv = draft.steps[es].moves[drag.id]; if (mv){ if (mv.path[drag.idx][0] !== pt[0] || mv.path[drag.idx][1] !== pt[1]) drag.moved = true; mv.path[drag.idx] = pt; }
  } else if (drag.type === 'runs'){
    const dx = raw[0]-drag.start[0], dy = raw[1]-drag.start[1];
    if (!drag.created && Math.hypot(dx, dy) < .9) return;
    drag.created = true;
    drag.ids.forEach(id => { const o = drag.origin[id]; draft.steps[es].moves[id] = {path:[snapPt([o[0]+dx, o[1]+dy])]}; });
  }
  renderEditor();
}

function up(d0){
  if (d0.cycle && !(d0.type === 'move' ? d0.moved : d0.created)){
    // a tap, not a drag (so nothing moved): select the next piece in the pile
    pickInStack(d0.cycle.next, d0.cycle.stack); renderEditor(); return;
  }
  if (d0.type === 'box'){
    const moved = Math.hypot(d0.end[0]-d0.start[0], d0.end[1]-d0.start[1]) > .6;
    if (!moved && !d0.additive) setSelIds([]);
    setSel(selIds); renderEditor();
    if (moved && selIds.size) hint(`${selIds.size} selected. ${es < 0 ? 'Drag any of them to move them together.' : 'Drag any of them to give all the same run.'}`);
    return;
  }
  if (d0.type === 'wp' && d0.inserted && !d0.moved){ const mv = draft.steps[es].moves[d0.id]; if (mv) mv.path.splice(d0.idx, 1); }
  if (d0.type === 'runs' && d0.created){
    // a tiny drag is a tap, not a run: put back what was there
    const a = d0.anchor, mv = draft.steps[es].moves[a], o = d0.origin[a];
    if (mv && Math.hypot(mv.path[0][0]-o[0], mv.path[0][1]-o[1]) < 1) d0.ids.forEach(id => { if (d0.old[id]) draft.steps[es].moves[id] = d0.old[id]; else delete draft.steps[es].moves[id]; });
  }
  commit(d0.before); renderEditor();
}

export default {
  id: 'select', key: 'v',
  hint: setup => setup ? 'Setup: drag players and cones into place. Drag a box on empty grass to select several, then move them together.'
    : 'Drag a player to draw their run. Select several first to give them all the same run. Drag the small dot on a run to add a bend.',
  down, move, up
};
