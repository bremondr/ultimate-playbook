/* ---------- pointer input on the field while editing ----------
   A small dispatcher: it turns the event into field metres and what was hit, and hands it to the tool in hand
   (editor/tools/). A tool's down() may start a drag; moves and the release then go to the tool that started it. */
import { renderEditor } from './canvas.js';
import { clearHint } from './hint.js';
import { commit } from './history.js';
import { closeTray, flyOpen, multi } from './rail.js';
import { draft, es, snapPt, tool } from './session.js';
import { TOOLS } from './tools/index.js';
import { svg } from '../render/svg.js';
import { mode, orient } from '../render/view.js';
import { $ } from '../util.js';

let drag = null;   // the drag in progress: whatever the tool's down() returned, plus the tool's id
// opening a drill drops any drag left over
export function dropDrag(){ drag = null; }

function toField(e){
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse());
  return orient === 'h' ? [q.x, q.y] : [-q.y, q.x];
}
// every player and cone under the pointer, the one drawn on top first (so a tool can reach those hidden underneath)
function stackAt(e){
  const ids = document.elementsFromPoint(e.clientX, e.clientY)
    .map(n => n.closest && n.closest('#g-players [data-kind="player"], #g-cones [data-kind="cone"]')).filter(Boolean).map(n => n.dataset.id);
  return [...new Set(ids)];
}
svg.addEventListener('pointerdown', e => {
  if (mode !== 'edit' || e.button > 0) return;
  // tapping the field puts the tool options away
  if (flyOpen && !$('#tray').hidden) closeTray();
  const raw = toField(e), pt = snapPt(raw);
  const tg = e.target.closest('[data-kind]');
  const kind = tg && tg.dataset.kind, id = tg && tg.dataset.id, idx = tg ? +tg.dataset.idx : -1;
  const before = JSON.stringify(draft), additive = multi || e.shiftKey || e.metaKey || e.ctrlKey;
  clearHint();
  const capture = () => { try { svg.setPointerCapture(e.pointerId); } catch(_){} };
  const started = TOOLS[tool].down({kind, id, idx, raw, pt, before, additive, capture, stack: stackAt(e)});
  if (started) drag = Object.assign(started, {tool});
  renderEditor();
  if (drag) e.preventDefault();
});
svg.addEventListener('pointermove', e => {
  if (!drag || mode !== 'edit') return;
  const raw = toField(e), pt = snapPt(raw);
  TOOLS[drag.tool].move(drag, raw, pt);
});
function endDrag(){
  if (!drag) return;
  const d0 = drag; drag = null;
  TOOLS[d0.tool].up(d0);
}
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);
// a double tap on a point of a run removes it, whatever the tool
svg.addEventListener('dblclick', e => {
  if (mode !== 'edit' || es < 0) return;
  const tg = e.target.closest('[data-kind="wp"]'); if (!tg) return;
  const before = JSON.stringify(draft), mv = draft.steps[es].moves[tg.dataset.id], idx = +tg.dataset.idx;
  if (!mv) return;
  if (idx < mv.path.length - 1) mv.path.splice(idx, 1); else delete draft.steps[es].moves[tg.dataset.id];
  commit(before); renderEditor();
});
