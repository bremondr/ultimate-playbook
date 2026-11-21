/* ---------- the property tabs (Selected, Step, Drill) and the bottom sheet that holds them on small screens ---------- */
import { $ } from '../util.js';

export function setTab(t){
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'));
  $('#p-sel').hidden = t !== 'sel'; $('#p-step').hidden = t !== 'step'; $('#p-drill').hidden = t !== 'drill';
}
$('.tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b){ setTab(b.dataset.tab); fold(false); } });
// the bottom-sheet layouts start folded so the field gets the screen; tapping a tab opens the sheet
export const sheetLayout = () => getComputedStyle($('#sheet-toggle')).display !== 'none';
export function fold(on){ $('.sgrid').classList.toggle('folded', on); $('#sheet-toggle').setAttribute('aria-expanded', on ? 'false' : 'true'); }
$('#sheet-toggle').addEventListener('click', () => fold(!$('.sgrid').classList.contains('folded')));
