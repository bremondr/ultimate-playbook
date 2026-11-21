import { hint, renderEditor } from './canvas.js';
import { grp } from './pieces.js';
import { fillStep, fillThrowControls, throwDefaults } from './step-tab.js';
import { svg } from '../render/svg.js';
import { draft, flyOpen, mode, multi, put, tool } from '../state.js';
import { $ } from '../util.js';

/* tools, steps, tabs */
export const TOOL_KEYS = {v:'select', o:'off', d:'def', g:'group', c:'cone', t:'throw', e:'erase'};
export function setTool(tl){
  put.tool(tl); put.pendingThrow(null); put.hintMsg(null);
  document.querySelectorAll('#trail .tool[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === tl ? 'true' : 'false'));
  svg.dataset.tool = tl;
  renderTray();
  if (mode === 'edit' && draft) renderEditor();
}
export function setStep(i){ put.es(i); put.pendingThrow(null); put.hintMsg(null); fillStep(); renderEditor(); setTab('step'); }
export function setTab(t){
  put.tab(t);
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'));
  $('#p-sel').hidden = t !== 'sel'; $('#p-step').hidden = t !== 'step'; $('#p-drill').hidden = t !== 'drill';
}
$('.tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b){ setTab(b.dataset.tab); fold(false); } });
// the bottom-sheet layouts start folded so the field gets the screen; tapping a tab opens the sheet
export const sheetLayout = () => getComputedStyle($('#sheet-toggle')).display !== 'none';
export function fold(on){ $('.sgrid').classList.toggle('folded', on); $('#sheet-toggle').setAttribute('aria-expanded', on ? 'false' : 'true'); }
$('#sheet-toggle').addEventListener('click', () => fold(!$('.sgrid').classList.contains('folded')));
$('#trail').addEventListener('click', e => { const b = e.target.closest('.tool[data-tool]'); if (!b) return;
  if (b.dataset.tool === tool){ put.flyOpen(!flyOpen); renderTray(); } else { put.flyOpen(true); setTool(b.dataset.tool); } });
$('#tray-close').addEventListener('click', () => { put.flyOpen(false); renderTray(); });
$('#s-multi').addEventListener('click', () => { put.multi(!multi); $('#s-multi').setAttribute('aria-pressed', multi ? 'true' : 'false');
  hint(multi ? 'Multi-select is on: each tap adds or removes an item.' : 'Multi-select is off.'); });

/* tool tray: options for the tool in hand */
export function renderTray(){
  const show = {group:'Group', off:'Offense', def:'Defense', throw:'Next throw'}[tool];
  $('#tray').hidden = !(show && flyOpen && mode === 'edit'); if ($('#tray').hidden) return;
  $('#tray-title').textContent = show;
  $('#tray-group').hidden = tool !== 'group';
  $('#tray-prefix').hidden = !(tool === 'off' || (tool === 'group' && grp.team === 'O'));
  $('#tray-def').hidden = tool !== 'def';
  $('#tray-throw').hidden = tool !== 'throw';
  if (tool === 'throw') fillThrowControls('nt', throwDefaults);
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
