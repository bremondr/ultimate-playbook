/* ---------- what the Offense, Defense and Cone tools share: tap a piece to select it, tap the grass to add one ---------- */
import { hint } from '../hint.js';
import { commit } from '../history.js';
import { addPiece } from '../pieces.js';
import { labelOf, setSelIds } from '../session.js';
import { setSel } from '../selection.js';

export function placeOrPick({kind, id, pt, before}, team, opts){
  if (kind === 'player' || kind === 'cone'){ setSel([id]); return; }
  const p = addPiece(team, pt, opts); setSelIds([p.id]); commit(before);
  if (p.follow) hint(`Defender added, following ${labelOf(p.follow)}.`);
  if (p.label === '?') hint(`No free label starting with “${opts.prefix}” fits in four characters. Type one in the Selected tab, or change the start.`, true);
}
// new players always go into the setup, whichever step is on screen
export const ADDED_TO_SETUP = 'New players are added to the setup, so they stand there from the start.';
