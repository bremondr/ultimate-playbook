/* ---------- defenses placed on top of the attackers on the field (the Drill tab's defense picker) ----------
   The offense attacks +x and the thrower's left is -y, as everywhere in the model. Each defense is placed where
   the tactic says, relative to the disc, the thrower and the field, even when it makes little sense against the
   offense in front of it.

   Person defense: one defender follows each attacker (so they move with the offense in later steps); the one on
   the thrower marks, on the side the force closes off. Zones: free defenders who hold their spot and watch the
   disc, plus a mark that moves with the disc where the zone has one (cup point, wall rabbit, clam mark). */
import { fieldOf } from '../data/fields.js';
import { defenseOf } from '../data/formations.js';
import { personOffset, uniqueId } from './formation.js';
import { clamp, r2 } from '../util.js';

const SIDE = {left:-1, straight:0, right:1};
const forceToward = s => s < 0 ? 'left' : s > 0 ? 'right' : 'straight';

/* Returns {players, force}: the players with the old defenders replaced, and the force the person-style part
   uses (left, straight or right; null when the defense has none), so the drill's own force can follow it. */
export function placeDefense(type, players, discId, fieldKey){
  const out = players.filter(p => p.team !== 'D'), def = defenseOf(type);
  const O = out.filter(p => p.team === 'O' && p.at);
  if (!def || !def.kind || !O.length) return {players: out, force: null};
  const Fd = fieldOf(fieldKey), W = Fd.W, cy = W/2, k = Fd.L < 90 ? .75 : 1;
  const disc = O.find(p => p.id === discId) || O.reduce((a, b) => b.at[0] < a.at[0] ? b : a);
  const [dx, dy] = disc.at;
  const person = (att, force) => {
    const mark = att === disc;
    out.push({id: uniqueId(out, 'd' + att.id), team:'D', follow: att.id, offset: personOffset(force, mark, att.at, disc.at), lag: mark ? .12 : .35});
  };
  const free = (id, x, y) => out.push({id: uniqueId(out, id), team:'D', at:[r2(clamp(x, 1, Fd.L - 1)), r2(clamp(y, 1, W - 1))], face:'disc'});
  const mark = force => out.push({id: uniqueId(out, 'dm'), team:'D', mark:{mode:'disc', order:[disc.id], force}});

  if (def.kind === 'person'){
    if (SIDE[type] !== undefined){ O.forEach(a => person(a, type)); return {players: out, force: type}; }
    if (type === 'middle'){
      // the mark takes away the near sideline; everyone downfield shades toward the middle of the field
      const s = dy - cy, f = Math.abs(s) < 2*k ? 'straight' : forceToward(-s);
      O.forEach(a => a === disc ? person(a, f) : person(a, Math.abs(a.at[1] - cy) < 1.5 ? 'straight' : forceToward(cy - a.at[1])));
      return {players: out, force: f};
    }
    // trap: the mark forces toward that sideline and a second defender helps trap the thrower there: the one whose
    // player is nearest the line lane (just downfield, between the thrower and that sideline) leaves them for it
    const side = type === 'trap-l' ? -1 : 1, f = forceToward(side), room = side < 0 ? dy : W - dy;
    const spot = [dx + 5*k, dy + side*Math.max(1.5, Math.min(5*k, room - 1.5))];
    const helpOn = O.filter(a => a !== disc).reduce((a, b) => !a || dist(b.at, spot) < dist(a.at, spot) ? b : a, null);
    O.forEach(a => { if (a !== helpOn) person(a, f); });
    if (helpOn) free('dhelp', ...spot);
    return {players: out, force: f};
  }

  // zones: spots in order of importance, the 7 v 7 shape for six or more attackers, the 5 v 5 shape below that
  const seven = O.length >= 6, lean = (y, f) => y + (dy - cy)*f;   // the zone shifts toward the disc's side
  const cup = [[dx + 4*k, dy - 5*k], [dx + 4*k, dy + 5*k]];
  let spots, force = 'straight', persons = [];
  if (type === 'cup') spots = seven
    ? [...cup, [dx + 14*k, lean(W*.12, .3)], [dx + 14*k, lean(W*.88, .3)], [dx + 30*k, lean(cy - W*.2, .3)], [dx + 30*k, lean(cy + W*.2, .3)]]
    : [...cup, [dx + 22*k, lean(cy - W*.2, .3)], [dx + 22*k, lean(cy + W*.2, .3)]];
  else if (type === '331') spots = seven
    ? [...cup, [dx + 14*k, W*.15], [dx + 14*k, lean(cy, .5)], [dx + 14*k, W*.85], [dx + 30*k, lean(cy, .3)]]
    : [...cup, [dx + 13*k, lean(cy, .5)], [dx + 26*k, lean(cy, .3)]];
  else if (type === '232'){
    const off = [dx + 5*k, dy + (dy <= cy ? 1 : -1)*5*k];   // the second front defender takes the throw into the middle
    spots = seven
      ? [off, [dx + 14*k, W*.2], [dx + 14*k, lean(cy, .4)], [dx + 14*k, W*.8], [dx + 30*k, lean(cy - W*.2, .3)], [dx + 30*k, lean(cy + W*.2, .3)]]
      : [off, [dx + 13*k, lean(W*.3, .3)], [dx + 13*k, lean(W*.7, .3)], [dx + 26*k, lean(cy, .3)]];
  }
  else if (type === 'wall') spots = seven
    ? [[dx + 10*k, lean(W*.25, .3)], [dx + 10*k, lean(W*.5, .3)], [dx + 10*k, lean(W*.75, .3)], [dx + 24*k, lean(W*.2, .2)], [dx + 24*k, lean(W*.5, .2)], [dx + 24*k, lean(W*.8, .2)]]
    : [[dx + 10*k, lean(W/3, .3)], [dx + 10*k, lean(W*2/3, .3)], [dx + 24*k, lean(W*.3, .2)], [dx + 24*k, lean(W*.7, .2)]];
  else {
    // clam: the mark and the handlers' defenders play person with the force; two clams sit in the under lanes in
    // front of the thrower (the open side first), then the deep, a middle defender on the open side, a second deep
    const fs = type === 'clam-l' ? -1 : 1;
    force = forceToward(fs);
    persons = O.filter(a => a === disc || /^h\d/i.test(a.id));
    spots = [[dx + 9*k, dy + fs*7*k], [dx + 11*k, dy - fs*5*k], [dx + 32*k, lean(cy + fs*W*.12, .3)], [dx + 20*k, dy + fs*3*k],
      [dx + 32*k, lean(cy - fs*W*.2, .3)], [dx + 20*k, dy - fs*7*k]];
  }
  if (persons.length) persons.forEach(a => person(a, force)); else mark(force);
  spots.slice(0, Math.max(0, O.length - out.filter(p => p.team === 'D').length)).forEach(([x, y], i) => free('z' + (i + 1), x, y));
  return {players: out, force: type.startsWith('clam') ? force : null};
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/* Where each defender stands before step 1: followers at their player plus offset, a disc mark beside the thrower.
   Used for the small pictures and by the tests. */
export function standAt(players, discId){
  const by = Object.fromEntries(players.map(p => [p.id, p]));
  return players.map(p => {
    if (p.team !== 'D' || p.at) return p;
    if (p.follow && by[p.follow] && by[p.follow].at){ const a = by[p.follow].at; return {...p, at:[r2(a[0] + p.offset[0]), r2(a[1] + p.offset[1])]}; }
    const t = p.mark && by[(p.mark.mode === 'disc' && discId) || (p.mark.order || [])[0]];
    if (t && t.at){ const o = personOffset(p.mark.force || 'right', true, t.at, null); return {...p, at:[r2(t.at[0] + o[0]), r2(t.at[1] + o[1])]}; }
    return p;
  });
}
