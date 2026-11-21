/* ---------- undo and redo ----------
   Every change records the draft as JSON before it (`before`) and commits it here. Undo and redo swap the whole
   draft and announce 'draft-replaced'; studio.js then refreshes the panels and the field. */
import { draft, dirty, restoreDraft, setDirty } from './session.js';
import { emit } from '../events.js';
import { $ } from '../util.js';

let undoStack = [], redoStack = [];
export function resetHistory(){ undoStack = []; redoStack = []; }
export function commit(before){
  if (before !== JSON.stringify(draft)){ undoStack.push(before); if (undoStack.length > 120) undoStack.shift(); redoStack = []; setDirty(true); }
  updateState();
}
function restore(json){ restoreDraft(JSON.parse(json)); emit('draft-replaced'); }
export function undo(){ if (!undoStack.length) return; redoStack.push(JSON.stringify(draft)); restore(undoStack.pop()); }
export function redo(){ if (!redoStack.length) return; undoStack.push(JSON.stringify(draft)); restore(redoStack.pop()); }
export function updateState(){
  $('#s-undo').disabled = !undoStack.length; $('#s-redo').disabled = !redoStack.length;
  const st = $('#s-state'); if (st.classList.contains('err')) return;
  st.textContent = dirty ? 'Unsaved changes' : draft && draft.docId ? 'Saved' : '';
}

$('#s-undo').addEventListener('click', undo);
$('#s-redo').addEventListener('click', redo);
