/* ---------- the view: which field is drawn, which way it is turned, and which screen has it ----------
   A small store. Other modules read these live bindings; only the functions below change them. The player and the
   editor share one field drawing, so both set it when they take over the screen. */
import { FIELDS } from '../data/fields.js';

export let F = FIELDS.full;   // field size (data/fields.js)
export let orient = 'h';      // 'h': attack to the right, 'v': attack upward. main.js sets it from the screen at boot.
export let mode = 'view';     // 'view' while the player has the field, 'edit' while the editor has it

export function setField(f){ F = f; }
export function setOrient(o){ orient = o; }
export function setMode(m){ mode = m; }
