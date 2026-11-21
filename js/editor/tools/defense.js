/* ---------- Defense tool: tap the field to add defenders ---------- */
import { placeOrPick, ADDED_TO_SETUP } from './place.js';
import { $ } from '../../util.js';

// tool option, shared with the Group tool: a new defender follows the nearest attacker who has nobody on them
export const followsNearest = () => $('#def-auto').checked;

export default {
  id: 'def', key: 'd',
  tray: {title: 'Defense', sections: () => ['#tray-def']},
  hint: setup => setup ? 'Tap the field to add defenders.' : ADDED_TO_SETUP,
  down: ctx => placeOrPick(ctx, 'D', {follow: followsNearest()})
};
