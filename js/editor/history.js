import { fieldOf } from '../data/fields.js';
import { renderEditor } from './canvas.js';
import { fillDetails } from './drill-tab.js';
import { fillStep } from './step-tab.js';
import { layoutField } from './studio.js';
import { dirty, draft, es, F, put, redoStack, selIds, undoStack } from '../state.js';
import { $ } from '../util.js';

/* history */
export function commit(before){
  if (before !== JSON.stringify(draft)){ undoStack.push(before); if (undoStack.length > 120) undoStack.shift(); put.redoStack([]); put.dirty(true); }
  updateState();
}
function restore(json){
  put.draft(JSON.parse(json));
  if (es >= draft.steps.length) put.es(draft.steps.length - 1);
  put.selIds(new Set([...selIds].filter(id => draft.players.some(p => p.id === id))));
  put.pendingThrow(null); put.dirty(true);
  if (fieldOf(draft.field) !== F){ put.F(fieldOf(draft.field)); layoutField(true); }
  fillDetails(); fillStep(); renderEditor(); updateState();
}
export function undo(){ if (!undoStack.length) return; redoStack.push(JSON.stringify(draft)); restore(undoStack.pop()); }
export function redo(){ if (!redoStack.length) return; undoStack.push(JSON.stringify(draft)); restore(redoStack.pop()); }
export function updateState(){
  $('#s-undo').disabled = !undoStack.length; $('#s-redo').disabled = !redoStack.length;
  const st = $('#s-state'); if (st.classList.contains('err')) return;
  st.textContent = dirty ? 'Unsaved changes' : draft && draft.docId ? 'Saved' : '';
}

$('#s-undo').addEventListener('click', undo);
$('#s-redo').addEventListener('click', redo);
