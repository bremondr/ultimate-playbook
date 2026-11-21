/* ---------- the editing session: the drill being drawn and what the editor is doing with it ----------
   A small store. Editor modules (and nav.js, for the preview) read these live bindings; only the functions below
   change them. Other editor state lives with the module that owns it: undo stacks in history.js, the compiled
   draft in canvas.js, the hint message in hint.js, the tool options and tray in rail.js, zoom in viewport.js,
   a drag in progress in pointer.js. */
import { F } from '../render/view.js';
import { clamp } from '../util.js';

export let draft = null;          // the raw drill being drawn (model/drafts.js has its shape)
export let dirty = false;         // changed since it was opened or saved
export let es = -1;               // the step on screen: -1 is Setup
export let tool = 'select';       // the tool in hand (editor/tools/)
export let selIds = new Set();    // selected players and cones
export let pendingThrow = null;   // the Throw tool picked a thrower and waits for the receiver

export function startSession(d, firstTool){ draft = d; es = -1; selIds = new Set(); pendingThrow = null; dirty = false; tool = firstTool; }
export function endSession(){ draft = null; dirty = false; }
// undo and redo swap the whole draft; keep the step and the selection where they still make sense
export function restoreDraft(d){
  draft = d;
  if (es >= draft.steps.length) es = draft.steps.length - 1;
  selIds = new Set([...selIds].filter(id => draft.players.some(p => p.id === id)));
  pendingThrow = null; dirty = true;
}
export function setDirty(v){ dirty = v; }
export function setEs(i){ es = i; }
export function useTool(t){ tool = t; }
export function setSelIds(ids){ selIds = new Set(ids); }
export function deselect(id){ selIds.delete(id); }
export function setPendingThrow(id){ pendingThrow = id; }

/* ---------- questions about the draft ---------- */
export const snapPt = ([x, y]) => [clamp(Math.round(x*2)/2, 0, F.L), clamp(Math.round(y*2)/2, 0, F.W)];
export const byIdIn = () => Object.fromEntries(draft.players.map(p => [p.id, p]));
export const labelOf = id => { const p = draft.players.find(q => q.id === id); return p ? (p.team === 'O' ? p.label : p.team === 'D' ? 'Defender' : 'Cone') : '?'; };
export const isSel = id => selIds.has(id);
export const selPlayers = () => draft.players.filter(p => selIds.has(p.id));
