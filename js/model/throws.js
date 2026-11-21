/* ---------- throws ---------- */
/* throw kinds: straight (solid line), bent (dotted curve), over (hammer/overhead: long dashes, light blue, higher flight) */
export const THROW_TYPES = ['straight','bent','over'];
export const GRIPS = {bh:'Backhand', fh:'Forehand (flick)', hammer:'Hammer', scoober:'Scoober', thumber:'Thumber', blade:'Blade', push:'Push pass'};
export const GRIP_TAG = {bh:'BH', fh:'FH', hammer:'HAMMER', scoober:'SCOOBER', thumber:'THUMBER', blade:'BLADE', push:'PUSH'};
export const OVER_GRIPS = ['hammer','scoober','thumber'];   // thrown over the top: drawn as the light-blue arc
export const typeOf = th => {
  if (th.grip && GRIPS[th.grip]) return OVER_GRIPS.includes(th.grip) ? 'over' : (Math.abs(th.curve||0) < .03 ? 'straight' : 'bent');
  return THROW_TYPES.includes(th.type) ? th.type : (Math.abs(th.curve||0) < .03 ? 'straight' : 'bent');
};
export function throwText(th){
  const k = typeOf(th), cv = curveOf(th), parts = [];
  if (th.grip && GRIPS[th.grip]) parts.push(GRIPS[th.grip].toLowerCase());
  else if (k === 'over') parts.push('over the top');
  parts.push(Math.abs(cv) < .03 ? 'straight' : cv < 0 ? 'bent left' : 'bent right');
  if (th.fake) parts.push(th.fake === 'up' ? 'fake upline first' : 'fake the other way first');
  return parts.join(' · ');
}
export const curveOf = th => { const k = typeOf(th); return k === 'straight' ? 0 : (typeof th.curve === 'number' ? th.curve : (k === 'over' ? .08 : .14)); };
