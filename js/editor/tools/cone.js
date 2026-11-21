/* ---------- Cone tool: tap the field to place cones ---------- */
import { placeOrPick } from './place.js';

export default {
  id: 'cone', key: 'c',
  hint: setup => setup ? 'Tap the field to place cones.' : 'Cones are placed for the whole drill.',
  down: ctx => placeOrPick(ctx, 'cone')
};
