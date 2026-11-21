/* ---------- Offense tool: tap the field to add attackers ---------- */
import { placeOrPick, ADDED_TO_SETUP } from './place.js';
import { $ } from '../../util.js';

// tool option, shared with the Group tool: attacker labels can start with a letter or two
export const labelPrefix = () => $('#g-prefix').value.trim().slice(0, 2);

export default {
  id: 'off', key: 'o',
  tray: {title: 'Offense', sections: () => ['#tray-prefix']},
  hint: setup => setup ? 'Tap the field to add attackers.' : ADDED_TO_SETUP,
  down: ctx => placeOrPick(ctx, 'O', {prefix: labelPrefix()})
};
