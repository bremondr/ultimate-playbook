/* ---------- selection and the Selected tab ---------- */
import { currentFacing, edModel, edPos, renderEditor } from './canvas.js';
import { hint } from './hint.js';
import { commit } from './history.js';
import { nearestAttacker, nextLabel, removePiece } from './pieces.js';
import { draft, es, labelOf, selIds, selPlayers, setSelIds, snapPt } from './session.js';
import { setTab } from './tabs.js';
import { FORCES, personOffset, uniqueId } from '../model/formation.js';
import { pos } from '../model/motion.js';
import { $, f2, newPid, r2 } from '../util.js';

/* selection */
export function setSel(ids, keepTab){
  setSelIds(ids);
  if (selIds.size && !keepTab) setTab('sel');
  renderSelPanel();
}

/* selected panel */
export function renderSelPanel(){
  const ps = draft ? selPlayers() : [];
  $('#sel-badge').hidden = !ps.length; $('#sel-badge').textContent = ps.length;
  $('#sel-empty').hidden = !!ps.length; $('#sel-body').hidden = !ps.length;
  if (!ps.length) return;
  const nO = ps.filter(p => p.team === 'O').length, nD = ps.filter(p => p.team === 'D').length, nC = ps.filter(p => p.team === 'cone').length;
  const parts = []; if (nO) parts.push(`${nO} attacker${nO>1?'s':''}`); if (nD) parts.push(`${nD} defender${nD>1?'s':''}`); if (nC) parts.push(`${nC} cone${nC>1?'s':''}`);
  const one = ps.length === 1 ? ps[0] : null;
  $('#sel-title').textContent = one && one.team === 'O' ? `Attacker ${one.label}` : parts.join(', ');
  $('#sel-labelf').hidden = !(one && one.team === 'O');
  if (one && one.team === 'O' && document.activeElement !== $('#sel-label')) $('#sel-label').value = one.label;
  const onlyD = nD && !nO && !nC;
  const oneD = one && one.team === 'D', role = oneD ? (one.mark ? 'mark' : one.follow ? 'follow' : 'free') : null;
  $('#sel-rolef').hidden = !oneD;
  $('#sel-followf').hidden = role !== 'follow'; $('#sel-markf').hidden = role !== 'mark';
  if (oneD){
    document.querySelectorAll('#sel-role button').forEach(b => b.setAttribute('aria-pressed', b.dataset.r === role ? 'true' : 'false'));
    const s = $('#sel-follow'); s.replaceChildren();
    draft.players.filter(q => q.team === 'O').forEach(q => s.add(new Option(`Attacker ${q.label}`, q.id)));
    s.value = one.follow || '';
  }
  if (role === 'mark'){
    const mk = one.mark;
    document.querySelectorAll('#sel-markmode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mm === mk.mode ? 'true' : 'false'));
    document.querySelectorAll('#sel-markforce button').forEach(b => b.setAttribute('aria-pressed', b.dataset.fc === (mk.force || 'right') ? 'true' : 'false'));
    $('#sel-markstartf').hidden = mk.mode === 'disc';
    const st = $('#sel-markstart'); st.replaceChildren();
    draft.players.filter(q => q.team === 'O').forEach(q => st.add(new Option(`Attacker ${q.label}`, q.id)));
    st.value = (mk.order || [])[0] || '';
    $('#sel-markorder').textContent = mk.mode === 'row'
      ? `Marks ${(mk.order || []).map(labelOf).join(' → ')}. Moves to the next one as soon as the player they mark throws.`
      : mk.mode === 'handler'
      ? `Stays on ${labelOf((mk.order || [])[0])}’s starting spot. Marks whoever from this row (${(mk.order || []).map(labelOf).join(', ')}) has the disc there, and never follows anyone downfield.`
      : 'Marks whoever has the disc and runs to the new thrower after every throw.';
  }
  $('#sel-facef').hidden = !onlyD; $('#sel-facetip').hidden = !oneD;
  if (onlyD){ const faces = new Set(ps.map(p => p.face || 'auto')); $('#sel-face').value = faces.size === 1 ? [...faces][0] : 'auto'; }
  $('#sel-disc').hidden = !(one && one.team === 'O') || draft.disc === one.id;
  const canArrange = es < 0 && ps.filter(p => !p.follow).length >= 2;
  $('#sel-arrange').hidden = !canArrange;
  $('#sel-adddef').hidden = !nO;
  $('#sel-addmark').hidden = !(one && one.team === 'O');
  $('#sel-adddef').textContent = nO > 1 ? `Add a defender to each (${FORCES[draft.force].toLowerCase()})` : `Add a defender (${FORCES[draft.force].toLowerCase()})`;
  $('#sel-tip').textContent = es >= 0
    ? (ps.length > 1 ? 'Drag any selected player to give all of them the same run in this step.' : 'Drag the player to draw their run in this step.')
    : (ps.length > 1 ? 'Drag any selected item to move them together. Arrow keys nudge by half a metre.' : 'Drag to move. Arrow keys nudge by half a metre.');
}
function arrange(kind){
  const ps = selPlayers().filter(p => !p.follow); if (ps.length < 2) return;
  const before = JSON.stringify(draft);
  if (kind === 'row'){ const x = r2(ps.reduce((a, p) => a + p.at[0], 0)/ps.length); ps.forEach(p => p.at = snapPt([x, p.at[1]])); }
  else if (kind === 'line'){ const y = r2(ps.reduce((a, p) => a + p.at[1], 0)/ps.length); ps.forEach(p => p.at = snapPt([p.at[0], y])); }
  else {
    // the two players furthest apart set the line; everyone else gets an equal share of it
    let a = ps[0], b = ps[1], best = -1;
    ps.forEach(p => ps.forEach(q => { const d = Math.hypot(p.at[0]-q.at[0], p.at[1]-q.at[1]); if (d > best){ best = d; a = p; b = q; } }));
    const dx = b.at[0]-a.at[0], dy = b.at[1]-a.at[1];
    const sorted = ps.slice().sort((p, q) => ((p.at[0]-a.at[0])*dx + (p.at[1]-a.at[1])*dy) - ((q.at[0]-a.at[0])*dx + (q.at[1]-a.at[1])*dy));
    const A = a.at.slice();
    sorted.forEach((p, i) => { const u = i/(sorted.length-1); p.at = [r2(A[0] + dx*u), r2(A[1] + dy*u)]; });
  }
  commit(before); renderEditor();
}
document.querySelectorAll('#sel-arrange [data-ar]').forEach(b => b.addEventListener('click', () => arrange(b.dataset.ar)));
$('#sel-del').addEventListener('click', () => deleteSelection());
export function deleteSelection(){
  if (!selIds.size) return;
  const before = JSON.stringify(draft), n = selIds.size;
  [...selIds].forEach(removePiece); setSelIds([]); commit(before); renderEditor();
  hint(`Deleted ${n} item${n > 1 ? 's' : ''}. Undo brings ${n > 1 ? 'them' : 'it'} back.`);
}
$('#sel-dup').addEventListener('click', () => {
  const ps = selPlayers(); if (!ps.length) return;
  const before = JSON.stringify(draft), map = {};
  ps.forEach(p => { map[p.id] = newPid(); });
  const copies = ps.map(p => {
    const c = {id:map[p.id], team:p.team};
    if (p.team === 'O') c.label = nextLabel();
    if (p.follow && map[p.follow]){ c.follow = map[p.follow]; c.offset = p.offset.slice(); c.lag = p.lag; }
    else { const at = edPos(p.id); c.at = snapPt([at[0] + 3, at[1] + 3]); }
    if (p.face) c.face = p.face;
    draft.players.push(c); return c;
  });
  commit(before); setSelIds(copies.map(c => c.id)); renderEditor();
  hint(`Duplicated ${copies.length}. The copies are selected, so you can drag them into place.`);
});
$('#sel-disc').addEventListener('click', () => { const ps = selPlayers(); if (ps.length !== 1) return;
  const before = JSON.stringify(draft); draft.disc = ps[0].id; commit(before); renderEditor(); });
$('#sel-adddef').addEventListener('click', () => {
  const os = selPlayers().filter(p => p.team === 'O'); if (!os.length) return;
  const before = JSON.stringify(draft), disc = draft.players.find(p => p.id === draft.disc), added = [];
  os.forEach(p => {
    if (draft.players.some(q => q.follow === p.id)) return;
    const mark = p.id === draft.disc, d = {id:uniqueId(draft.players, 'd' + p.id), team:'D', follow:p.id, offset:personOffset(draft.force, mark, p.at, disc && disc.at), lag: mark ? .12 : .35};
    draft.players.push(d); added.push(d.id);
  });
  commit(before); renderEditor();
  hint(added.length ? `Added ${added.length} defender${added.length > 1 ? 's' : ''}, ${FORCES[draft.force].toLowerCase()}.` : 'Each selected attacker already has a defender.');
});
$('#sel-face').addEventListener('change', e => {
  const ds = selPlayers().filter(p => p.team === 'D'); if (!ds.length) return;
  const before = JSON.stringify(draft), v = e.target.value;
  ds.forEach(p => {
    if (v === 'auto'){ delete p.face; delete p.angle; return; }
    if (v === 'angle' && typeof p.angle !== 'number') p.angle = currentFacing(p);   // start from where they look now
    p.face = v;
  });
  commit(before); renderEditor(); });
/* defender roles: free, follows one attacker, or marks (a row in turn, or whoever has the disc) */
// the attackers standing in a line with `startId`, nearest first: along the field or across it, whichever holds more
function rowOrder(startId){
  const os = draft.players.filter(p => p.team === 'O' && p.at), s0 = os.find(p => p.id === startId); if (!s0) return [startId];
  const along = os.filter(p => Math.abs(p.at[1] - s0.at[1]) <= 1.6), across = os.filter(p => Math.abs(p.at[0] - s0.at[0]) <= 1.6);
  const row = along.length >= across.length ? along : across;
  return row.sort((a, b) => Math.hypot(a.at[0]-s0.at[0], a.at[1]-s0.at[1]) - Math.hypot(b.at[0]-s0.at[0], b.at[1]-s0.at[1])).map(p => p.id);
}
function setRole(p, role){
  const cur = pos(edModel, p.id, 0);
  delete p.follow; delete p.offset; delete p.lag; delete p.mark;
  if (role === 'free'){ p.at = [f2(cur[0]), f2(cur[1])]; return; }
  delete p.at; draft.steps.forEach(st => delete st.moves[p.id]);
  if (role === 'follow'){
    const t = nearestAttacker(cur) || draft.players.find(q => q.team === 'O');
    if (!t){ p.at = [f2(cur[0]), f2(cur[1])]; return; }
    p.follow = t.id; p.offset = [r2(cur[0]-t.at[0]), r2(cur[1]-t.at[1])]; p.lag = .35;
    if (Math.hypot(p.offset[0], p.offset[1]) > 6) p.offset = [1.2, -1.2];
  } else {
    const start = draft.disc || (draft.players.find(q => q.team === 'O') || {}).id;
    if (!start){ p.at = [f2(cur[0]), f2(cur[1])]; return; }
    p.mark = {mode:'row', order:rowOrder(start), force:draft.force || 'right'};
  }
}
$('#sel-role').addEventListener('click', e => { const b = e.target.closest('button'); const p = selPlayers()[0]; if (!b || !p || p.team !== 'D') return;
  const before = JSON.stringify(draft); setRole(p, b.dataset.r); commit(before); renderEditor(); });
$('#sel-markmode').addEventListener('click', e => { const b = e.target.closest('button'); const p = selPlayers()[0]; if (!b || !p || !p.mark) return;
  const before = JSON.stringify(draft); p.mark.mode = b.dataset.mm; commit(before); renderEditor(); });
$('#sel-markforce').addEventListener('click', e => { const b = e.target.closest('button'); const p = selPlayers()[0]; if (!b || !p || !p.mark) return;
  const before = JSON.stringify(draft); p.mark.force = b.dataset.fc; commit(before); renderEditor(); });
$('#sel-markstart').addEventListener('change', e => { const p = selPlayers()[0]; if (!p || !p.mark) return;
  const before = JSON.stringify(draft); p.mark.order = rowOrder(e.target.value); commit(before); renderEditor(); });
$('#sel-addmark').addEventListener('click', () => {
  const a = selPlayers()[0]; if (!a || a.team !== 'O') return;
  const before = JSON.stringify(draft), order = rowOrder(a.id);
  const d = {id:newPid(), team:'D', mark:{mode: order.length > 1 ? 'row' : 'disc', order, force:draft.force || 'right'}};
  draft.players.push(d); commit(before); setSelIds([d.id]); renderEditor();
  hint(order.length > 1 ? `Mark added on ${a.label}. After ${a.label} throws, they move to ${order.slice(1).map(labelOf).join(', then ')}.` : `Mark added. ${a.label} has nobody next to them in a row, so the mark follows whoever has the disc.`);
});
$('#sel-follow').addEventListener('change', e => {
  const p = selPlayers()[0]; if (!p || p.team !== 'D') return;
  const before = JSON.stringify(draft), v = e.target.value, cur = pos(edModel, p.id, 0);
  if (v){
    const tp = draft.players.find(q => q.id === v);
    p.follow = v; p.offset = [f2(cur[0]-tp.at[0]), f2(cur[1]-tp.at[1])]; p.lag = .35;
    if (Math.hypot(p.offset[0], p.offset[1]) > 6) p.offset = [1.2, -1.2];
    draft.steps.forEach(st => delete st.moves[p.id]);
  } else { p.at = [f2(cur[0]), f2(cur[1])]; delete p.follow; delete p.offset; delete p.lag; }
  commit(before); renderEditor();
});
