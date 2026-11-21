/* Shared mutable state: the field and how it is turned, the drill on screen, the library, and the editor.
   Other modules import these and read them directly (F.L, draft, es …). An imported binding can't be
   assigned to, so changes go through put: put.draft(d) where the single-file version had draft = d. */
import { FIELDS } from './data/fields.js';
import { screenOrient } from './util.js';

export let F = FIELDS.full;
export let orient = screenOrient();

/* ---------- library (built-in + team drills) ---------- */
export let team = [];            // [{id, raw, play}]
export let canWrite = null;      // null = unknown, keep the controls
export let storeMode = 'pending';
export let pendingId = null;
export let current = null;       // {source:'builtin'|'team'|'preview', id}
export let sharedRaw = null;     // a drill opened from a #d= link

/* ---------- viewer ---------- */
export let model;

/* ---------- editor (studio) ---------- */
export let mode = 'view', draft = null, es = -1, tool = 'select', pendingThrow = null, undoStack = [], redoStack = [], dirty = false, drag = null, zoom = 'fit', hintMsg = null;
export let selIds = new Set(), multi = false, tab = 'sel', fitView = null, flyOpen = false;
export let edModel = null, edPlay = null;

export const put = {
  F: v => (F = v),
  orient: v => (orient = v),
  team: v => (team = v),
  canWrite: v => (canWrite = v),
  storeMode: v => (storeMode = v),
  pendingId: v => (pendingId = v),
  current: v => (current = v),
  sharedRaw: v => (sharedRaw = v),
  model: v => (model = v),
  mode: v => (mode = v),
  draft: v => (draft = v),
  es: v => (es = v),
  tool: v => (tool = v),
  pendingThrow: v => (pendingThrow = v),
  undoStack: v => (undoStack = v),
  redoStack: v => (redoStack = v),
  dirty: v => (dirty = v),
  drag: v => (drag = v),
  zoom: v => (zoom = v),
  hintMsg: v => (hintMsg = v),
  selIds: v => (selIds = v),
  multi: v => (multi = v),
  tab: v => (tab = v),
  fitView: v => (fitView = v),
  flyOpen: v => (flyOpen = v),
  edModel: v => (edModel = v),
  edPlay: v => (edPlay = v)
};
