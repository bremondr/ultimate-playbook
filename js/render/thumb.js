import { fieldOf } from '../data/fields.js';
import { formation } from '../model/formation.js';
import { clamp, r2 } from '../util.js';

/* Small preview of a set of players for the Drill tab: a 44 m long window of the full field around them,
   with the goal lines when they are in view. Offense is drawn with its colour, defense with its colour,
   and a white dot by whoever holds the disc. */
export function playersThumb(ps, discId, o = 'h'){
  const F = fieldOf('full'), xs = ps.map(p => p.at[0]), span = 44;
  const c = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : F.L/2, x0 = clamp(c - span/2, 0, F.L - span), x1 = x0 + span;
  // same mapping as the main field: attack to the right when wide, attack up when upright
  const P = (x, y) => o === 'h' ? [r2(x - x0), r2(y)] : [r2(y), r2(x1 - x)];
  const w = o === 'h' ? span : F.W, ht = o === 'h' ? F.W : span;
  const lines = [F.ez, F.L - F.ez].filter(x => x > x0 && x < x1).map(x => {
    const a = P(x, 0), b = P(x, F.W); return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="rgba(255,255,255,.55)" stroke-width=".5"/>`; }).join('');
  const dot = p => { const q = P(...p.at), d = p.team === 'D';
    return `<circle cx="${q[0]}" cy="${q[1]}" r="${p.id === discId ? 2.4 : d ? 1.6 : 1.9}" fill="var(${d ? '--def' : '--off'})" stroke="rgba(0,0,0,.35)" stroke-width=".3"/>`; };
  const parts = [...ps.filter(p => p.team === 'O'), ...ps.filter(p => p.team === 'D')].map(dot).join('');
  const h = ps.find(p => p.id === discId), dq = h && P(h.at[0]+1.6, h.at[1]-1.6);
  return `<svg viewBox="0 0 ${w} ${ht}" aria-hidden="true"><rect width="${w}" height="${ht}" fill="var(--turf)"/>${lines}${parts}${dq ? `<circle cx="${dq[0]}" cy="${dq[1]}" r="1" fill="#fff"/>` : ''}</svg>`;
}

// small preview of a formation for the Drill tab
export function formationThumb(type, n, o = 'h'){
  return playersThumb(formation(type, n, 'full', false), 'h1', o);
}
