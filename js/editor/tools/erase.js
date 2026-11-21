/* ---------- Erase tool: tap a player, cone, run, bend or throw to remove it ---------- */
import { commit } from '../history.js';
import { removePiece } from '../pieces.js';
import { draft, es } from '../session.js';

export default {
  id: 'erase', key: 'e',
  hint: setup => setup ? 'Tap a player or cone to remove it.' : 'Tap a run, a throw, a bend or a player to remove it.',
  down({kind, id, idx, before}){
    if (kind === 'player' || kind === 'cone') removePiece(id);
    else if (kind === 'run') delete draft.steps[es].moves[id];
    else if (kind === 'throw') draft.steps[es].throw = null;
    else if (kind === 'wp'){ const mv = draft.steps[es].moves[id]; if (mv.path.length > 1) mv.path.splice(idx, 1); else delete draft.steps[es].moves[id]; }
    commit(before);
  }
};
