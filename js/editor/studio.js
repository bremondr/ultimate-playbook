/* ---------- editor (studio) ---------- */
import { BUILTIN } from '../data/builtins.js';
import { fieldOf } from '../data/fields.js';
import { renderEditor } from './canvas.js';
import { fillDetails, renderForms } from './drill-tab.js';
import { updateState } from './history.js';
import { fillStep } from './step-tab.js';
import { fold, positionFlyout, setTab, setTool, sheetLayout } from './tools.js';
import { FORCES } from '../model/formation.js';
import { timeDraft } from '../model/timing.js';
import { buildNav, markNav } from '../nav.js';
import { select, setPlaying, showPlay } from '../player.js';
import { drawPitch } from '../render/pitch.js';
import { svg } from '../render/svg.js';
import { dirty, draft, F, fitView, mode, orient, put, storeMode, team, tool, zoom } from '../state.js';
import { errText, readRaw, removeDrill, saveDrill, serialize } from '../storage.js';
import { $, newDocId, screenOrient } from '../util.js';

const studio = $('#studio'), sfield = $('#sfield');

/* open / close */
function enterStudio(){
  put.mode('edit'); setPlaying(false); put.current(null); markNav();
  document.body.classList.add('editing'); studio.hidden = false;
  svg.classList.remove('no-def'); sfield.prepend(svg); svg.dataset.tool = tool;
  put.F(fieldOf(draft.field));
  layoutField(true);
}
export function openEditor(d){
  put.draft(d); put.es(-1); put.selIds(new Set()); put.pendingThrow(null); put.undoStack([]); put.redoStack([]); put.dirty(false); put.drag(null); put.hintMsg(null); put.tab('sel');
  draft.field = draft.field === 'small' ? 'small' : 'full'; draft.format = draft.format === 5 ? 5 : 7; if (!FORCES[draft.force]) draft.force = 'right';
  put.zoom('half'); markZoom(); put.F(fieldOf(draft.field)); refitView();
  put.tool(d.players.length > 1 ? 'select' : 'off');
  fold(false); enterStudio(); armClose(false); armDelete(false); status(''); if (sheetLayout()) fold(true);
  setTool(tool); fillDetails(); fillStep(); renderEditor(); setTab(d.players.length > 1 ? 'step' : 'drill');
  updateState();
}
function leaveStudio(){
  studio.hidden = true; document.body.classList.remove('editing'); put.mode('view'); $('#tray').hidden = true;
  $('.stage').appendChild(svg); delete svg.dataset.tool; $('#g-handles').replaceChildren(); put.orient(screenOrient());
}
function closeEditor(){ leaveStudio(); put.draft(null); put.dirty(false); }
export function backToEditor(){ if (!draft) return; enterStudio(); renderEditor(); }

/* field size, orientation and zoom */
function editorView(){
  if (zoom === 'full') return [0, F.L];
  if (zoom === 'half') return [Math.round(F.L*.36), F.L];
  return fitView || [0, F.L];
}
export function refitView(){
  const xs = [];
  const pl = timeDraft(draft); pl.players.forEach(p => { if (p.at) xs.push(p.at[0]); });
  draft.steps.forEach(st => Object.values(st.moves || {}).forEach(m => (m.path || []).forEach(q => xs.push(q[0]))));
  if (!xs.length){ put.fitView([0, F.L]); return; }
  let x0 = Math.min(...xs) - 8, x1 = Math.max(...xs) + 8;
  const minSpan = Math.min(44, F.L);
  if (x1 - x0 < minSpan){ const c = (x0 + x1)/2; x0 = c - minSpan/2; x1 = c + minSpan/2; }
  if (x0 < 0){ x1 -= x0; x0 = 0; } if (x1 > F.L){ x0 -= x1 - F.L; x1 = F.L; }
  put.fitView([Math.max(0, Math.floor(x0)), Math.min(F.L, Math.ceil(x1))]);
}
// pick the orientation that draws the field biggest in the space available
export function layoutField(force){
  if (mode !== 'edit') return;
  const o = screenOrient();
  if (o !== orient || force){ const turned = o !== orient; put.orient(o); drawPitch(editorView()); if (draft){ if (turned) renderForms(); renderEditor(); } positionFlyout(); }
}
let roPending = false;
new ResizeObserver(() => { if (roPending) return; roPending = true; requestAnimationFrame(() => { roPending = false; layoutField(false); positionFlyout(); }); }).observe(sfield);
function markZoom(){ document.querySelectorAll('#zoom button').forEach(x => x.setAttribute('aria-pressed', x.dataset.z === zoom ? 'true' : 'false')); }
$('#zoom').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  put.zoom(b.dataset.z); if (zoom === 'fit') refitView(); markZoom(); layoutField(true); });

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
  const id = draft.docId;
  try { await removeDrill(id); put.team(team.filter(x => x.id !== id)); buildNav(); closeEditor(); if (location.hash.slice(1) === id) location.hash = BUILTIN[0].id; else select(BUILTIN[0].id); }
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
    const raw = readRaw(body), entry = {id, raw, play: {...timeDraft({...raw, id}), id}};
    const i = team.findIndex(x => x.id === id); if (i >= 0) team[i] = entry; else team.push(entry);
    draft.docId = id; draft.createdAt = body.createdAt; put.dirty(false);
    buildNav(); fillDetails(); status(storeMode === 'db' ? 'Saved for the team' : 'Saved in this browser');
  } catch (err){ status(errText(err), true); }
  finally { $('#s-save').disabled = false; }
});
function status(msg, err){
  const s = $('#s-state'); s.classList.toggle('err', !!err);
  if (msg) s.textContent = msg; else { s.classList.remove('err'); updateState(); }
  $('#e-status').textContent = err ? msg : ''; $('#e-status').classList.toggle('err', !!err);
}
