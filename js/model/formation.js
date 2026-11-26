/* ---------- formations: starting positions, built for the chosen field and team size ---------- */
import { fieldOf } from '../data/fields.js';
import { r2 } from '../util.js';

/* Offense formations from the tactics overview, for the chosen field and team size (7 or 5).
   The offense attacks +x and the thrower's left is -y. H1 always holds the disc. A type ending in -r is the
   mirror image (across the field's long axis) of the same type ending in -l. */
export const MIRRORED = id => /-r$/.test(id);
export function formation(type, n, fieldKey, withDef, force){
  const Fd = fieldOf(fieldKey), W = Fd.W, L = Fd.L, cy = W/2, small = Fd.L < 90, seven = n >= 7;
  const k = small ? .75 : 1, x0 = Fd.ez + (small ? 12 : 22), gap = small ? 8 : 11, sp = small ? 3.5 : 4.5, gl = L - Fd.ez;
  const O = [];
  let nc = 0;
  const H = (x, y) => { const i = O.filter(p => p.label[0] === 'H').length + 1; O.push({id:'h'+i, team:'O', label:'H'+i, at:[x, y]}); };
  const C = (x, y) => { nc++; O.push({id:'c'+nc, team:'O', label:String(nc), at:[x, y]}); };
  const column = (count, x, y, s = sp) => { for (let i = 0; i < count; i++) C(x + i*s, y); };
  const base = String(type === 'side' ? 'side-l' : type).replace(/-r$/, '-l');
  switch (base){
    case 'vert-dump':            // two handlers, the dump close behind the thrower, the rest in one line
      H(x0, cy); H(x0 - (small ? 4.5 : 6), cy - (small ? 3.5 : 5));
      column(n - 2, x0 + gap, cy); break;
    case 'ho':                   // handlers across the back, cutters in a line across the field
      if (seven){ H(x0, cy); H(x0-2, cy - W*.3); H(x0-2, cy + W*.3); }
      else { H(x0, cy - W*.14); H(x0-2, cy + W*.24); }
      for (let i = 0, c = n - O.length; i < c; i++) C(x0 + (small ? 12 : 16), W*(i+1)/(c+1));
      break;
    case 'side-l':               // the stack along the left sideline, the right side open
      H(x0, cy); H(x0 - (small ? 4.5 : 6), cy - (small ? 3.5 : 5));
      column(n - 2, x0 + gap - 2, W*.2); break;
    case 'spread':               // handlers across the back, cutters in pairs near each sideline, the middle open
      if (seven){ H(x0, cy); H(x0-2, cy - W*.3); H(x0-2, cy + W*.3); } else H(x0, cy);
      [W*.12, W*.88].forEach(y => { C(x0 + 12*k, y); C(x0 + 20*k, y); });
      break;
    case 'iso-l':                // one cutter alone on the left, the others cleared to the right
      if (seven){ H(x0, cy); H(x0-2, cy - W*.3); H(x0-2, cy + W*.3); } else { H(x0, cy); H(x0-2, cy + W*.3); }
      C(x0 + 14*k, W*.2);
      column(n - O.length, x0 + gap, W*.82); break;
    case 'split-l':              // two short vertical stacks: three cutters on the left, two on the right (5 v 5: 2-1)
      H(x0, cy); H(x0 - 3*k, cy + W*.22);
      column(seven ? 3 : 2, x0 + gap, W*.27); column(seven ? 2 : 1, x0 + gap, W*.73); break;
    case 'swing-l':              // the disc near the left sideline, the dump behind toward the middle, the swing across
      H(x0, W*.2); H(x0 - 6*k, W*.42); H(x0 - 2, W*.75);
      column(n - 3, x0 + gap, cy); break;
    case 'ez-iso-l':             // just outside the end zone: handlers across, cutters at the back, one iso near the line
      if (seven){ H(gl - 6*k, cy); H(gl - 7*k, cy - W*.3); H(gl - 7*k, cy + W*.3); } else { H(gl - 6*k, cy); H(gl - 7*k, cy + W*.3); }
      C(gl + 3*k, W*.2);
      (seven ? [.4, .6, .8] : [.5, .75]).forEach(f => C(L - 3*k, W*f)); break;
    case 'ez-vert':              // the stack starts at the goal line and runs into the end zone
      H(gl - 6*k, cy); H(gl - 8*k, cy - W*.27); if (seven) H(gl - 7*k, cy + W*.27);
      column(n - O.length, gl + 2*k, cy); break;
    case 'zone-o':               // against a zone: handlers across the top, poppers in the gaps, deep behind
      if (seven){ H(x0, cy); H(x0-1, cy - W*.3); H(x0-1, cy + W*.3);
        C(x0 + 10*k, cy - W*.15); C(x0 + 10*k, cy + W*.15); C(x0 + 30*k, cy - W*.25); C(x0 + 30*k, cy + W*.25); }
      else { H(x0, cy - W*.18); H(x0, cy + W*.18); C(x0 + 10*k, cy - W*.2); C(x0 + 10*k, cy + W*.2); C(x0 + 28*k, cy); }
      break;
    default:                     // 'vert': handlers behind the disc, the cutters in one line down the middle
      H(x0, cy); H(x0-3*k, cy - W*.27); if (seven) H(x0-1, cy + W*.27);
      column(n - O.length, x0 + gap, cy);
  }
  const flip = MIRRORED(String(type));
  const players = O.map(p => ({...p, at:[r2(p.at[0]), r2(flip ? W - p.at[1] : p.at[1])]}));
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
