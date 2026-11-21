/* ---------- the editor's field: how much of it shows (zoom) and which way it is turned ---------- */
import { renderEditor } from './canvas.js';
import { positionFlyout } from './rail.js';
import { draft } from './session.js';
import { emit } from '../events.js';
import { timeDraft } from '../model/timing.js';
import { drawPitch } from '../render/pitch.js';
import { F, mode, orient, setOrient } from '../render/view.js';
import { $, screenOrient } from '../util.js';

/* Viewport state. Other modules read these; only this module changes them. */
export let zoom = 'fit';   // 'fit' the drill, the attacking 'half', or the 'full' field
let fitView = null;        // the part of the field that 'fit' shows, [x0, x1] in metres

function editorView(){
  if (zoom === 'full') return [0, F.L];
  if (zoom === 'half') return [Math.round(F.L*.36), F.L];
  return fitView || [0, F.L];
}
export function refitView(){
  const xs = [];
  const pl = timeDraft(draft); pl.players.forEach(p => { if (p.at) xs.push(p.at[0]); });
  draft.steps.forEach(st => Object.values(st.moves || {}).forEach(m => (m.path || []).forEach(q => xs.push(q[0]))));
  if (!xs.length){ fitView = [0, F.L]; return; }
  let x0 = Math.min(...xs) - 8, x1 = Math.max(...xs) + 8;
  const minSpan = Math.min(44, F.L);
  if (x1 - x0 < minSpan){ const c = (x0 + x1)/2; x0 = c - minSpan/2; x1 = c + minSpan/2; }
  if (x0 < 0){ x1 -= x0; x0 = 0; } if (x1 > F.L){ x0 -= x1 - F.L; x1 = F.L; }
  fitView = [Math.max(0, Math.floor(x0)), Math.min(F.L, Math.ceil(x1))];
}
// pick the orientation that draws the field biggest in the space available
export function layoutField(force){
  if (mode !== 'edit') return;
  const o = screenOrient();
  if (o !== orient || force){ const turned = o !== orient; setOrient(o); drawPitch(editorView()); if (draft){ if (turned) emit('field-turned'); renderEditor(); } positionFlyout(); }
}
let roPending = false;
new ResizeObserver(() => { if (roPending) return; roPending = true; requestAnimationFrame(() => { roPending = false; layoutField(false); positionFlyout(); }); }).observe($('#sfield'));
function markZoom(){ document.querySelectorAll('#zoom button').forEach(x => x.setAttribute('aria-pressed', x.dataset.z === zoom ? 'true' : 'false')); }
// a drill opens on the attacking half
export function resetZoom(){ zoom = 'half'; markZoom(); }
$('#zoom').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  zoom = b.dataset.z; if (zoom === 'fit') refitView(); markZoom(); layoutField(true); });
