/* ---------- formations: starting positions, built for the chosen field and team size ---------- */
import { fieldOf } from '../data/fields.js';
import { r2 } from '../util.js';

export function formation(type, n, fieldKey, withDef, force){
  const Fd = fieldOf(fieldKey), W = Fd.W, cy = W/2, small = Fd.L < 90;
  const x0 = Fd.ez + (small ? 12 : 22), gap = small ? 8 : 11, sp = small ? 3.5 : 4.5;
  const O = [];
  const add = (id, label, x, y, role) => O.push({id, team:'O', label, at:[r2(x), r2(y)], role});
  let nh;
  if (type === 'ho'){
    nh = n >= 7 ? 3 : 2;
    if (nh === 3){ add('h1','H1',x0,cy,'h'); add('h2','H2',x0-2,cy-W*.3,'h'); add('h3','H3',x0-2,cy+W*.3,'h'); }
    else { add('h1','H1',x0,cy-W*.14,'h'); add('h2','H2',x0-2,cy+W*.24,'h'); }
    const k = n - nh, cx = x0 + (small ? 12 : 16);
    for (let i = 0; i < k; i++) add('c'+(i+1), String(i+1), cx, W*(i+1)/(k+1), 'c');
  } else {
    nh = 2;
    add('h1','H1',x0,cy,'h');
    if (type === 'vert') add('h2','H2',x0-1,cy-W*.27,'h');
    else add('h2','H2',x0-(small?4.5:6),cy-(small?3.5:5),'h');
    const k = n - 2, sy = type === 'side' ? W*.2 : cy, sx = x0 + gap - (type === 'side' ? 2 : 0);
    for (let i = 0; i < k; i++) add('c'+(i+1), String(i+1), sx + i*sp, sy, 'c');
  }
  const players = O.map(({role, ...p}) => p);
  if (withDef) addPersonDefense(players, 'h1', force);
  return players;
}

/* Person defense. Left and right are as the thrower sees it, looking toward the end zone being attacked
   (the offense attacks +x, so the thrower's left is -y). Force left: the mark stands on the thrower's right
   and the open side is the left; downfield defenders stand under their player, shaded to the open side. */
export const FORCES = {left:'Force left', straight:'Straight up', right:'Force right'};
export function personOffset(force, isMark, att, disc){
  const side = force === 'left' ? -1 : force === 'right' ? 1 : 0;
  if (isMark) return side ? [1.9, r2(-side*1.8)] : [2.5, 0];
  const under = disc && Math.abs(disc[0]-att[0]) > 1.5 ? Math.sign(disc[0]-att[0]) : -1;
  return side ? [r2(1.4*under), r2(side*2.1)] : [r2(2.5*under), 0];
}
export function addPersonDefense(players, discId, force){
  const disc = players.find(p => p.id === discId);
  players.filter(p => p.team === 'O').forEach(p => {
    const mark = p.id === discId;
    players.push({id: uniqueId(players, 'd' + p.id), team:'D', follow:p.id, offset: personOffset(force, mark, p.at, disc && disc.at), lag: mark ? .12 : .35});
  });
}
export function uniqueId(players, base){ let id = base, k = 2; while (players.some(p => p.id === id)) id = base + '-' + k++; return id; }
