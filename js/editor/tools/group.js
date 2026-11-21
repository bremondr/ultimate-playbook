/* ---------- Group tool: tap to place several players or cones at once, or drag to spread them along a line ---------- */
import { renderEditor } from '../canvas.js';
import { hint } from '../hint.js';
import { commit } from '../history.js';
import { addPiece } from '../pieces.js';
import { setSelIds, snapPt } from '../session.js';
import { setTab } from '../tabs.js';
import { followsNearest } from './defense.js';
import { labelPrefix } from './offense.js';
import { emit } from '../../events.js';
import { el, M } from '../../render/svg.js';
import { $, f2 } from '../../util.js';

/* tool options */
const grp = {team:'O', count:4, shape:'line', gap:2.5};
const GAPS = {line:2.5, row:4, stack:4.5};
(() => {
  const c = $('#g-count'); for (let i = 2; i <= 10; i++) c.add(new Option(String(i), String(i))); c.value = '4';
  const g = $('#g-gap'); [1.5,2,2.5,3,4,4.5,5,6,8,10].forEach(v => g.add(new Option(String(v), String(v)))); g.value = '2.5';
})();
// the label prefix only applies to attackers, so the tray changes shape with the team
$('#g-team').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; grp.team = b.dataset.gt;
  document.querySelectorAll('#g-team button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); emit('tray-changed'); });
$('#g-shape').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; grp.shape = b.dataset.gs; grp.gap = GAPS[grp.shape]; $('#g-gap').value = String(grp.gap);
  document.querySelectorAll('#g-shape button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); });
$('#g-count').addEventListener('change', e => { grp.count = +e.target.value; });
$('#g-gap').addEventListener('change', e => { grp.gap = +e.target.value; });

function groupPoints(start, end){
  const n = grp.count, pts = [];
  if (end && Math.hypot(end[0]-start[0], end[1]-start[1]) > 1.5){
    for (let i = 0; i < n; i++){ const u = n > 1 ? i/(n-1) : 0; pts.push(snapPt([start[0] + (end[0]-start[0])*u, start[1] + (end[1]-start[1])*u])); }
  } else {
    const dir = grp.shape === 'line' ? [-1, 0] : grp.shape === 'row' ? [0, 1] : [1, 0];
    for (let i = 0; i < n; i++) pts.push(snapPt([start[0] + dir[0]*grp.gap*i, start[1] + dir[1]*grp.gap*i]));
  }
  return pts;
}
function addGroup(start, end){
  const pts = groupPoints(start, end), ids = pts.map(at => addPiece(grp.team, at, {prefix: labelPrefix(), follow: followsNearest()}).id);
  setSelIds(ids);
  const what = grp.team === 'O' ? 'attackers' : grp.team === 'D' ? 'defenders' : 'cones';
  hint(`Added ${pts.length} ${what}. They’re selected, so you can drag them together or arrange them.`);
}
// see-through previews of where the group will go while dragging
function drawGhosts(pts, team){
  const gh = $('#g-handles');
  pts.forEach(at => {
    const q = M(...at);
    if (team === 'cone') el('path',{d:`M${f2(q[0])} ${f2(q[1]-1)} L${f2(q[0]+.95)} ${f2(q[1]+.7)} L${f2(q[0]-.95)} ${f2(q[1]+.7)} Z`,fill:'var(--cone)',opacity:.55,'pointer-events':'none'},gh);
    else el('circle',{cx:f2(q[0]),cy:f2(q[1]),r: team === 'O' ? 1.3 : 1.05,fill: team === 'O' ? 'var(--off)' : 'var(--def)',opacity:.55,stroke:'var(--chalk)','stroke-width':.15,'stroke-dasharray':'.4 .3','pointer-events':'none'},gh);
  });
}

export default {
  id: 'group', key: 'g',
  tray: {title: 'Group', sections: () => ['#tray-group', grp.team === 'O' && '#tray-prefix']},
  hint: setup => setup ? 'Tap to place a whole group, or drag to spread it along a line.' : 'Groups are added to the setup, so they stand there from the start.',
  down({pt, before, capture}){ capture(); return {type:'group', start:pt, end:null, before}; },
  move(drag, raw, pt){ drag.end = pt; renderEditor(); drawGhosts(groupPoints(drag.start, drag.end), grp.team); },
  up(d0){ addGroup(d0.start, d0.end); commit(d0.before); renderEditor(); setTab('sel'); }
};
