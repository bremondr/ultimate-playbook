/* ---------- the tool rail, the tool options tray beside it, and the hint line that explains the tool in hand ---------- */
import { holderAtStep, renderEditor, stepWarn } from './canvas.js';
import { hint, hintMsg, clearHint, paintHint } from './hint.js';
import { draft, es, labelOf, setPendingThrow, tool, useTool } from './session.js';
import { TOOLS } from './tools/index.js';
import { svg } from '../render/svg.js';
import { mode } from '../render/view.js';
import { $ } from '../util.js';

/* Rail state. Other modules read these; only this module changes them. */
export let flyOpen = false;   // the tray is wanted open (it shows only for tools that have options)
export let multi = false;     // multi-select: each tap adds or removes an item

export function setTool(tl){
  useTool(tl); setPendingThrow(null); clearHint();
  document.querySelectorAll('#trail .tool[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === tl ? 'true' : 'false'));
  svg.dataset.tool = tl;
  renderTray();
  if (mode === 'edit' && draft) renderEditor();
}
// switching to a tool opens its options, unless they wait to be asked for (the Throw tool's: they're for later)
const opensItself = tl => !(TOOLS[tl].tray && TOOLS[tl].tray.opensItself === false);
// a tool's key: switch to it, or toggle its options when it is already in hand
export function pickToolByKey(tl){ flyOpen = tl !== tool ? opensItself(tl) : !flyOpen; setTool(tl); }
export function closeTray(){ flyOpen = false; renderTray(); }
$('#trail').addEventListener('click', e => { const b = e.target.closest('.tool[data-tool]'); if (!b) return;
  if (b.dataset.tool === tool){ flyOpen = !flyOpen; renderTray(); } else { flyOpen = opensItself(b.dataset.tool); setTool(b.dataset.tool); } });
$('#tray-close').addEventListener('click', closeTray);
$('#s-multi').addEventListener('click', () => { multi = !multi; $('#s-multi').setAttribute('aria-pressed', multi ? 'true' : 'false');
  hint(multi ? 'Multi-select is on: each tap adds or removes an item.' : 'Multi-select is off.'); });

/* tool tray: options for the tool in hand */
const TRAY_SECTIONS = ['#tray-group', '#tray-prefix', '#tray-def', '#tray-throw'];
export function renderTray(){
  const tray = TOOLS[tool].tray;
  $('#tray').hidden = !(tray && flyOpen && mode === 'edit'); if ($('#tray').hidden) return;
  $('#tray-title').textContent = tray.title;
  const shown = tray.sections();
  TRAY_SECTIONS.forEach(s => { $(s).hidden = !shown.includes(s); });
  if (tray.fill) tray.fill();
  positionFlyout();
}
// the options open beside their tool, like a drawing app's tool palette
export function positionFlyout(){
  const fl = $('#tray'); if (fl.hidden) return;
  const btn = $(`#trail .tool[data-tool="${tool}"]`), g = $('.sgrid').getBoundingClientRect(), r = btn.getBoundingClientRect();
  const rail = $('#trail').getBoundingClientRect(), horizontal = rail.width > rail.height;
  if (horizontal){ fl.style.left = '8px'; fl.style.top = (rail.bottom - g.top + 6) + 'px'; fl.style.width = `min(340px, ${g.width - 16}px)`; fl.style.maxHeight = (g.bottom - rail.bottom - 16) + 'px'; }
  else {
    fl.style.left = (rail.right - g.left + 8) + 'px'; fl.style.width = '';
    const top = Math.max(8, Math.min(r.top - g.top, g.height - fl.offsetHeight - 8));
    fl.style.top = top + 'px'; fl.style.maxHeight = (g.height - 16) + 'px';
  }
}

/* the hint line: a message if there is one, else what the tool in hand does here, else a warning about this step's throw */
export function renderHint(){
  if (hintMsg){ paintHint(hintMsg.text, hintMsg.warn); return; }
  let txt = TOOLS[tool].hint(es < 0), warn = false;
  if (es >= 0 && stepWarn(es)){
    const holder = holderAtStep(es);
    warn = true; txt = `${labelOf(draft.steps[es].throw.from)} doesn’t have the disc at the start of this step. Redraw the throw from ${holder ? labelOf(holder) : 'the disc holder'}.`;
  }
  paintHint(txt, warn);
}
