import { edPos, hint, holderAtStep, labelOf, renderEditor, renderHint } from './canvas.js';
import { snapPt } from './drafts.js';
import { commit } from './history.js';
import { addGroup, addPiece, drawGhosts, groupPoints, grp, removePiece } from './pieces.js';
import { isSel, setSel } from './selection.js';
import { newThrow } from './step-tab.js';
import { renderTray, setTab } from './tools.js';
import { el, M, svg } from '../render/svg.js';
import { draft, drag, es, flyOpen, hintMsg, mode, multi, orient, pendingThrow, put, selIds, tool } from '../state.js';
import { $, clone, f2, r2 } from '../util.js';

/* pointer input on the field */
function toField(e){
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse());
  return orient === 'h' ? [q.x, q.y] : [-q.y, q.x];
}
function startMove(ids, raw, before){
  // setup: move every selected item; a follower keeps its offset when its player moves with it
  const set = new Set(ids), items = [];
  draft.players.filter(p => set.has(p.id)).forEach(p => {
    if (p.mark) return;
    if (p.follow){ if (!set.has(p.follow)) items.push({p, follower:true, o:p.offset.slice()}); }
    else items.push({p, o:p.at.slice()});
  });
  put.drag({type:'move', start:raw, items, before, moved:false});
}
function startRuns(ids, raw, before, anchor){
  const ps = draft.players.filter(p => ids.includes(p.id) && p.team !== 'cone' && !p.follow && !p.mark);
  put.drag({type:'runs', start:raw, ids:ps.map(p => p.id), anchor, origin:Object.fromEntries(ps.map(p => [p.id, edPos(p.id).slice()])),
    old:Object.fromEntries(ps.map(p => [p.id, draft.steps[es].moves[p.id] ? clone(draft.steps[es].moves[p.id]) : null])), before, created:false});
}
svg.addEventListener('pointerdown', e => {
  if (mode !== 'edit' || e.button > 0) return;
  if (flyOpen && !$('#tray').hidden){ put.flyOpen(false); renderTray(); }
  const raw = toField(e), pt = snapPt(raw);
  const tg = e.target.closest('[data-kind]');
  const kind = tg && tg.dataset.kind, id = tg && tg.dataset.id, idx = tg ? +tg.dataset.idx : -1;
  const before = JSON.stringify(draft), additive = multi || e.shiftKey || e.metaKey || e.ctrlKey;
  put.hintMsg(null);
  const capture = () => { try { svg.setPointerCapture(e.pointerId); } catch(_){} };
  if (tool === 'select'){
    if (kind === 'rot'){ put.drag({type:'rot', id, before}); capture(); }
    else if (kind === 'wp' && es >= 0){ put.drag({type:'wp', id, idx, before}); capture(); }
    else if (kind === 'mid' && es >= 0){ draft.steps[es].moves[id].path.splice(idx, 0, pt); put.drag({type:'wp', id, idx, before, inserted:true, moved:false}); capture(); }
    else if (kind === 'player' || kind === 'cone'){
      if (additive){ const s = new Set(selIds); if (s.has(id)) s.delete(id); else s.add(id); setSel(s); }
      else if (!isSel(id)) setSel([id]);
      if (isSel(id)){
        const ids = [...selIds];
        if (es < 0){
          const p = draft.players.find(q => q.id === id);
          if (p.mark && ids.length === 1) hint('This defender marks automatically, so they stand where the force puts them. Change it in the Selected tab.');
          else { startMove(ids, raw, before); capture(); }
        }
        else {
          const p = draft.players.find(q => q.id === id);
          if (p.team === 'cone') hint('Cones stay put for the whole drill. Move them in Setup.');
          else if (p.mark && ids.length === 1) hint('This defender marks automatically. Change who they mark and the force in the Selected tab.');
          else if (p.follow && ids.length === 1) hint('This defender follows an attacker. Set “Follows” to Nobody to draw their runs yourself.');
          else { startRuns(ids, raw, before, id); capture(); }
        }
      }
    } else if (kind === 'run'){ setSel(additive ? [...selIds, id] : [id]); }
    else if (kind === 'throw'){ setTab('step'); }
    else { put.drag({type:'box', start:raw, end:raw, additive, base:additive ? new Set(selIds) : new Set()}); capture(); }
  } else if (tool === 'group'){
    put.drag({type:'group', start:pt, end:null, before}); capture();
  } else if (tool === 'off' || tool === 'def' || tool === 'cone'){
    if (kind === 'player' || kind === 'cone'){ setSel([id]); }
    else { const p = addPiece(tool === 'off' ? 'O' : tool === 'def' ? 'D' : 'cone', pt); put.selIds(new Set([p.id])); commit(before);
      if (p.follow) hint(`Defender added, following ${labelOf(p.follow)}.`); }
  } else if (tool === 'throw'){
    const p = kind === 'player' && draft.players.find(q => q.id === id);
    if (!p) { put.pendingThrow(null); }
    else if (p.team !== 'O') hint('Only attackers throw and catch. Pick a yellow player.', true);
    else if (es < 0){ draft.disc = id; commit(before); }
    else if (!pendingThrow){
      const holder = holderAtStep(es);
      if (holder && holder !== id) hint(`${labelOf(holder)} has the disc at the start of this step. Tap them first.`, true);
      else put.pendingThrow(id);
    } else if (id === pendingThrow){ put.pendingThrow(null); }
    else {
      const old = draft.steps[es].throw;
      draft.steps[es].throw = old ? {...old, from:pendingThrow, to:id} : newThrow(pendingThrow, id);
      put.pendingThrow(null); commit(before); setTab('step');
    }
  } else if (tool === 'erase'){
    if (kind === 'player' || kind === 'cone') removePiece(id);
    else if (kind === 'run') delete draft.steps[es].moves[id];
    else if (kind === 'throw') draft.steps[es].throw = null;
    else if (kind === 'wp'){ const mv = draft.steps[es].moves[id]; if (mv.path.length > 1) mv.path.splice(idx, 1); else delete draft.steps[es].moves[id]; }
    commit(before);
  }
  renderEditor();
  if (drag) e.preventDefault();
});
svg.addEventListener('pointermove', e => {
  if (!drag || mode !== 'edit') return;
  const raw = toField(e), pt = snapPt(raw);
  if (drag.type === 'group'){ drag.end = pt; renderEditor(); drawGhosts(groupPoints(drag.start, drag.end), grp.team); return; }
  if (drag.type === 'box'){
    drag.end = raw;
    const x0 = Math.min(drag.start[0], raw[0]), x1 = Math.max(drag.start[0], raw[0]), y0 = Math.min(drag.start[1], raw[1]), y1 = Math.max(drag.start[1], raw[1]);
    const inside = draft.players.filter(p => { const q = p.team === 'cone' ? p.at : edPos(p.id); return q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1; }).map(p => p.id);
    put.selIds(new Set([...drag.base, ...inside]));
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
});
function endDrag(){
  if (!drag) return;
  const d0 = drag; put.drag(null);
  if (d0.type === 'group'){ addGroup(d0.start, d0.end); commit(d0.before); const msg = hintMsg; renderEditor(); put.hintMsg(msg); renderHint(); setTab('sel'); return; }
  if (d0.type === 'box'){
    const moved = Math.hypot(d0.end[0]-d0.start[0], d0.end[1]-d0.start[1]) > .6;
    if (!moved && !d0.additive) put.selIds(new Set());
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
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);
svg.addEventListener('dblclick', e => {
  if (mode !== 'edit' || es < 0) return;
  const tg = e.target.closest('[data-kind="wp"]'); if (!tg) return;
  const before = JSON.stringify(draft), mv = draft.steps[es].moves[tg.dataset.id], idx = +tg.dataset.idx;
  if (!mv) return;
  if (idx < mv.path.length - 1) mv.path.splice(idx, 1); else delete draft.steps[es].moves[tg.dataset.id];
  commit(before); renderEditor();
});
