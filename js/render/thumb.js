import { formation } from '../model/formation.js';
import { r2 } from '../util.js';

// small preview of a formation for the Drill tab
export function formationThumb(type, n, o = 'h'){
  const ps = formation(type, n, 'full', false), x0 = 30, x1 = 74, L = x1 - x0;
  // same mapping as the main field: attack to the right when wide, attack up when upright
  const P = (x, y) => o === 'h' ? [r2(x - x0), r2(y)] : [r2(y), r2(x1 - x)];
  const parts = ps.map(p => { const q = P(...p.at); return `<circle cx="${q[0]}" cy="${q[1]}" r="${p.id==='h1'?2.4:1.9}" fill="var(--off)" stroke="rgba(0,0,0,.35)" stroke-width=".3"/>`; }).join('');
  const h = ps.find(p => p.id === 'h1'), dq = P(h.at[0]+1.6, h.at[1]-1.6), w = o === 'h' ? L : 37, ht = o === 'h' ? 37 : L;
  return `<svg viewBox="0 0 ${w} ${ht}" aria-hidden="true"><rect width="${w}" height="${ht}" fill="var(--turf)"/>${parts}<circle cx="${dq[0]}" cy="${dq[1]}" r="1" fill="#fff"/></svg>`;
}
