/* Defenses placed on a formation (js/model/defense.js). Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFENSES, FORMATIONS } from '../js/data/formations.js';
import { FIELDS } from '../js/data/fields.js';
import { formation } from '../js/model/formation.js';
import { placeDefense, standAt } from '../js/model/defense.js';

const CASES = [7, 5].flatMap(n => ['full', 'small'].map(f => [n, f]));
const place = (def, form, n = 7, fk = 'full') => standAt(placeDefense(def, formation(form, n, fk), 'h1', fk).players, 'h1');
const D = ps => ps.filter(p => p.team === 'D'), at = (ps, id) => ps.find(p => p.id === id).at;
const markOf = ps => D(ps).find(p => p.follow === 'h1' || p.mark);

test('every defense on every formation: one defender per attacker, all on the field, attackers untouched', () => {
  for (const {id: form} of FORMATIONS) for (const [n, fk] of CASES){
    const off = formation(form, n, fk), F = FIELDS[fk];
    for (const {id, kind} of DEFENSES){
      const what = `${id} on ${form} ${n} v ${n} ${fk}`, {players} = placeDefense(id, off, 'h1', fk), ps = standAt(players, 'h1');
      assert.deepEqual(ps.filter(p => p.team === 'O'), off, `${what}: offense unchanged`);
      assert.equal(D(ps).length, kind ? n : 0, what);
      assert.equal(new Set(ps.map(p => p.id)).size, ps.length, `${what}: ids are unique`);
      for (const p of D(ps)) assert.ok(p.at[0] >= 0 && p.at[0] <= F.L && p.at[1] >= 0 && p.at[1] <= F.W, `${what}: ${p.id} on the field`);
    }
  }
});

test('placing a defense replaces the one there before', () => {
  const once = placeDefense('cup', formation('ho', 7, 'full'), 'h1', 'full').players;
  assert.equal(D(placeDefense('left', once, 'h1', 'full').players).length, 7);
  assert.equal(D(placeDefense('none', once, 'h1', 'full').players).length, 0);
});

test('person defense: everyone follows their own player, and the mark is on the side the force closes', () => {
  for (const force of ['left', 'right', 'straight']){
    const {players, force: f} = placeDefense(force, formation('vert', 7, 'full'), 'h1', 'full'), ps = standAt(players, 'h1');
    assert.equal(f, force);
    assert.deepEqual(D(ps).map(p => p.follow).sort(), ps.filter(p => p.team === 'O').map(p => p.id).sort());
    const m = markOf(ps).at, h = at(ps, 'h1');
    // force left leaves the thrower's left (-y) open, so the mark stands on their right (+y)
    if (force === 'left') assert.ok(m[1] > h[1]);
    if (force === 'right') assert.ok(m[1] < h[1]);
    if (force === 'straight') assert.equal(m[1], h[1]);
    assert.ok(m[0] > h[0], 'the mark stands downfield of the thrower');
  }
});

test('force middle: the mark takes the near sideline away; downfield defenders shade to the middle', () => {
  const cy = FIELDS.full.W/2;
  let ps = place('middle', 'swing-l');                  // disc near the left sideline: the open side is the right
  assert.ok(markOf(ps).at[1] < at(ps, 'h1')[1]);
  ps = place('middle', 'swing-r');
  assert.ok(markOf(ps).at[1] > at(ps, 'h1')[1]);
  ps = place('middle', 'side-l');                       // cutters on the left: their defenders stand on their right
  for (const d of D(ps)) if (d.follow.startsWith('c')) assert.ok(d.at[1] > at(ps, d.follow)[1] && at(ps, d.follow)[1] < cy);
  ps = place('middle', 'vert');                         // disc in the middle: straight up
  assert.equal(markOf(ps).at[1], at(ps, 'h1')[1]);
});

test('trap: the mark forces to that sideline and one defender leaves their player to help on that side', () => {
  for (const [id, s] of [['trap-l', -1], ['trap-r', 1]]){
    const {players, force} = placeDefense(id, formation('vert', 7, 'full'), 'h1', 'full'), ps = standAt(players, 'h1'), h = at(ps, 'h1');
    assert.equal(force, s < 0 ? 'left' : 'right');
    assert.ok((markOf(ps).at[1] - h[1]) * s < 0, `${id}: the mark closes the other side`);
    const help = D(ps).filter(p => !p.follow);
    assert.equal(help.length, 1);
    assert.ok((help[0].at[1] - h[1]) * s > 0 && help[0].at[0] > h[0], `${id}: help is downfield on the trap side`);
  }
});

test('zones have their shape: free defenders in rows downfield, a mark where the zone has one', () => {
  const h = at(formation('ho', 7, 'full'), 'h1');
  const rows = ps => { const xs = D(ps).filter(p => !p.mark).map(p => Math.round(p.at[0] - h[0])); return xs.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {}); };
  const shape = (def, n = 7) => { const ps = place(def, 'ho', n); return {marks: D(ps).filter(p => p.mark).length, rows: Object.values(rows(ps))}; };
  assert.deepEqual(shape('cup'), {marks: 1, rows: [2, 2, 2]});             // cup of three (mark + two), two wings, two deep
  assert.deepEqual(shape('331'), {marks: 1, rows: [2, 3, 1]});             // cup, three across, one deep
  assert.deepEqual(shape('232'), {marks: 1, rows: [1, 3, 2]});             // two in front (mark + one), three, two deep
  assert.deepEqual(shape('wall'), {marks: 1, rows: [3, 3]});               // rabbit, three across, three behind
  assert.deepEqual(shape('cup', 5), {marks: 1, rows: [2, 2]});
  assert.deepEqual(shape('331', 5), {marks: 1, rows: [2, 1, 1]});
  assert.deepEqual(shape('232', 5), {marks: 1, rows: [1, 2, 1]});
  assert.deepEqual(shape('wall', 5), {marks: 1, rows: [2, 2]});
  // the zone mark moves with the disc and the free defenders watch it
  const z = D(place('cup', 'ho'));
  assert.equal(z.find(p => p.mark).mark.mode, 'disc');
  assert.ok(z.filter(p => !p.mark).every(p => p.face === 'disc' && !p.follow));
});

test('clam: the mark and handler defenders play person, the rest cover lanes', () => {
  const ps = place('clam-l', 'vert'), d = D(ps);
  assert.deepEqual(d.filter(p => p.follow).map(p => p.follow).sort(), ['h1', 'h2', 'h3']);
  assert.ok(markOf(ps).at[1] > at(ps, 'h1')[1], 'clam left forces left');
  assert.equal(d.filter(p => !p.follow).length, 4);
});

test('left and right versions of a defense are mirror images', () => {
  for (const [l, r] of [['left', 'right'], ['trap-l', 'trap-r'], ['clam-l', 'clam-r']]) for (const fk of ['full', 'small']) for (const n of [7, 5]){
    const W = FIELDS[fk].W, a = D(place(l, 'swing-l', n, fk)), b = D(place(r, 'swing-r', n, fk));   // on mirrored offenses
    assert.equal(a.length, b.length);
    a.forEach((p, i) => assert.ok(Math.abs(b[i].at[0] - p.at[0]) < .02 && Math.abs(b[i].at[1] - (W - p.at[1])) < .02, `${l}/${r} ${n} ${fk}: ${p.id}`));
  }
  // on a mirrored offense, a symmetric zone is mirrored too
  for (const z of ['cup', '331', '232', 'wall', 'middle']){
    const W = FIELDS.full.W, a = D(place(z, 'swing-l')), b = D(place(z, 'swing-r'));
    assert.equal(a.length, b.length);
    a.forEach(p => assert.ok(b.some(q => Math.abs(q.at[0] - p.at[0]) < .02 && Math.abs(q.at[1] - (W - p.at[1])) < .02), `${z}: ${p.id}`));
  }
});
