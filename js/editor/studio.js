/* ---------- editor (studio): open, close, preview, save, delete ----------
   The top of the editor. It also wires the editor's own events: the lower editor modules announce what happened
   (events.js) and the reactions are listed here, at the end of the file. */
import { renderEditor } from './canvas.js';
import { fillDetails, renderForms } from './drill-tab.js';
import { clearHint, hint } from './hint.js';
import { resetHistory, updateState } from './history.js';
import { dropDrag } from './pointer.js';
import { renderHint, renderTray, setTool } from './rail.js';
import { renderSelPanel } from './selection.js';
import { draft, dirty, endSession, setDirty, startSession, tool } from './session.js';
import { fillStep, refreshDiscSelect, refreshStepExtras, refreshThrowPanel, renderStrip } from './step-tab.js';
import { fold, setTab, sheetLayout } from './tabs.js';
import { layoutField, refitView, resetZoom } from './viewport.js';
import './text-fields.js';
import { fieldOf } from '../data/fields.js';
import { on } from '../events.js';
import { builtins, dropEntry, saveEntry } from '../library.js';
import { FORCES } from '../model/formation.js';
import { timeDraft } from '../model/timing.js';
import { buildNav, markNav } from '../nav.js';
import { leavePlayback, select, showPlay } from '../player.js';
import { svg } from '../render/svg.js';
import { F, setField, setMode, setOrient } from '../render/view.js';
import { entryFrom, errText, removeDrill, saveDrill, serialize, storeMode } from '../storage.js';
import { $, newDocId, screenOrient } from '../util.js';

const studio = $('#studio'), sfield = $('#sfield');

/* open / close */
function enterStudio(){
  setMode('edit'); leavePlayback(); markNav();
  document.body.classList.add('editing'); studio.hidden = false;
  svg.classList.remove('no-def'); sfield.prepend(svg); svg.dataset.tool = tool;
  setField(fieldOf(draft.field));
  layoutField(true);
}
export function openEditor(d){
  // a drill with players opens on the Select tool; a blank field opens on Offense
  startSession(d, d.players.length > 1 ? 'select' : 'off'); resetHistory(); dropDrag(); clearHint();
  draft.field = draft.field === 'small' ? 'small' : 'full'; draft.format = draft.format === 5 ? 5 : 7; if (!FORCES[draft.force]) draft.force = 'right';
  resetZoom(); setField(fieldOf(draft.field)); refitView();
  fold(false); enterStudio(); armClose(false); armDelete(false); status(''); if (sheetLayout()) fold(true);
  setTool(tool); fillDetails(); fillStep(); renderEditor(); setTab(d.players.length > 1 ? 'step' : 'drill');
  updateState();
}
function leaveStudio(){
  studio.hidden = true; document.body.classList.remove('editing'); setMode('view'); $('#tray').hidden = true;
  $('.stage').appendChild(svg); delete svg.dataset.tool; $('#g-handles').replaceChildren(); setOrient(screenOrient());
}
function closeEditor(){ leaveStudio(); endSession(); }
// warning: shown in the hint line, for example when the drill list sent you back here
export function backToEditor(warning){ if (!draft) return; enterStudio(); renderEditor(); if (warning) hint(warning, true); }

$('#s-preview').addEventListener('click', () => {
  const play = timeDraft(draft);
  leaveStudio();
  showPlay(play, {source:'preview', id:null});
});
let closeArmed = null;
function armClose(on){
  clearTimeout(closeArmed); closeArmed = null;
  $('#s-close').classList.toggle('armed', on); $('#s-close-t').textContent = on ? 'Discard changes and go back?' : 'Back to playback';
  if (on) closeArmed = setTimeout(() => armClose(false), 4000);
}
$('#s-close').addEventListener('click', () => {
  if (dirty && !closeArmed){ armClose(true); return; }
  armClose(false);
  const back = draft && draft.docId; closeEditor();
  if (back && location.hash.slice(1) !== back) location.hash = back; else select(back || location.hash.slice(1));
});
let delArmed = null;
function armDelete(on){
  clearTimeout(delArmed); delArmed = null;
  const b = $('#e-delete'); b.textContent = on ? 'Tap again to delete for everyone' : 'Delete this drill';
  if (on) delArmed = setTimeout(() => armDelete(false), 4000);
}
$('#e-delete').addEventListener('click', async () => {
  if (!draft || !draft.docId) return;
  if (!delArmed){ armDelete(true); return; }
  armDelete(false);
  const id = draft.docId, first = builtins()[0].id;
  try { await removeDrill(id); dropEntry(id); buildNav(); closeEditor(); if (location.hash.slice(1) === id) location.hash = first; else select(first); }
  catch (err){ status(errText(err), true); }
});
// Save keeps you in the editor; Back to playback takes you to the saved drill
$('#s-save').addEventListener('click', async () => {
  if (!draft) return;
  if (!draft.name.trim()){ draft.name = 'Untitled drill'; $('#s-name').value = draft.name; }
  const id = draft.docId || newDocId(), now = Date.now();
  const body = serialize(draft); body.updatedAt = now; body.createdAt = draft.createdAt || now;
  $('#s-save').disabled = true; status('Saving…');
  try {
    await saveDrill(id, body);
    saveEntry(entryFrom(id, body));
    draft.docId = id; draft.createdAt = body.createdAt; setDirty(false);
    buildNav(); fillDetails(); status(storeMode === 'db' ? 'Saved for the team' : 'Saved in this browser');
  } catch (err){ status(errText(err), true); }
  finally { $('#s-save').disabled = false; }
});
function status(msg, err){
  const s = $('#s-state'); s.classList.toggle('err', !!err);
  if (msg) s.textContent = msg; else { s.classList.remove('err'); updateState(); }
  $('#e-status').textContent = err ? msg : ''; $('#e-status').classList.toggle('err', !!err);
}

/* ---------- editor wiring: what the lower editor modules announce, and what happens then ---------- */
// the field was redrawn: the panels around it catch up
on('editor-drawn', () => { renderStrip(); renderHint(); refreshStepExtras(); refreshDiscSelect(); renderSelPanel(); refreshThrowPanel(); });
// undo or redo swapped the draft: it may even be on another field size
on('draft-replaced', () => {
  if (fieldOf(draft.field) !== F){ setField(fieldOf(draft.field)); layoutField(true); }
  fillDetails(); fillStep(); renderEditor(); updateState();
});
// the formation pictures turn with the field
on('field-turned', renderForms);
on('tray-changed', renderTray);
