/* Offense formations (js/model/formation.js). Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATIONS } from '../js/data/formations.js';
import { FIELDS } from '../js/data/fields.js';
import { formation } from '../js/model/formation.js';

const CASES = [7, 5].flatMap(n => ['full', 'small'].map(f => [n, f]));

test('every formation puts the right number of attackers on the field, H1 with the disc', () => {
  for (const {id} of FORMATIONS) for (const [n, fk] of CASES){
    const ps = formation(id, n, fk), F = FIELDS[fk], what = `${id} ${n} v ${n} on ${fk}`;
    assert.equal(ps.length, n, what);
    assert.ok(ps.every(p => p.team === 'O'), what);
    assert.equal(new Set(ps.map(p => p.id)).size, n, `${what}: ids are unique`);
    assert.ok(ps.some(p => p.id === 'h1'), `${what}: H1 is there`);
    for (const p of ps){
      assert.ok(p.at[0] >= 0 && p.at[0] <= F.L && p.at[1] >= 0 && p.at[1] <= F.W, `${what}: ${p.label} on the field`);
      for (const q of ps) if (q !== p) assert.ok(Math.hypot(p.at[0]-q.at[0], p.at[1]-q.at[1]) >= 2.5, `${what}: ${p.label} and ${q.label} apart`);
    }
  }
});

test('left and right versions are mirror images', () => {
  const lefts = FORMATIONS.filter(f => f.id.endsWith('-l'));
  assert.equal(lefts.length, 5);
  for (const {id} of lefts){
    const rid = id.replace(/-l$/, '-r');
    assert.ok(FORMATIONS.some(f => f.id === rid), `${rid} is offered`);
    for (const [n, fk] of CASES){
      const W = FIELDS[fk].W, l = formation(id, n, fk), r = formation(rid, n, fk);
      l.forEach((p, i) => {
        assert.equal(r[i].id, p.id);
        assert.ok(Math.abs(r[i].at[0] - p.at[0]) < .011 && Math.abs(r[i].at[1] - (W - p.at[1])) < .011, `${id} / ${rid} ${n} v ${n} ${fk}: ${p.label}`);
      });
      assert.notDeepEqual(l.map(p => p.at), r.map(p => p.at), `${id} is not symmetric`);
    }
  }
});

test('the shapes match the tactics', () => {
  const W = FIELDS.full.W, cy = W/2, get = (ps, id) => ps.find(p => p.id === id).at;
  const cut = ps => ps.filter(p => p.label[0] !== 'H'), hand = ps => ps.filter(p => p.label[0] === 'H');
  // vertical stack: cutters in one line down the middle, three handlers in 7 v 7
  let ps = formation('vert', 7, 'full');
  assert.equal(hand(ps).length, 3); assert.ok(cut(ps).every(p => p.at[1] === cy));
  // side stack left: all cutters on the thrower's left (small y)
  assert.ok(cut(formation('side-l', 7, 'full')).every(p => p.at[1] < cy));
  // iso left: exactly one cutter on the left half
  assert.equal(cut(formation('iso-l', 7, 'full')).filter(p => p.at[1] < cy).length, 1);
  // split 3-2 left: three cutters left, two right
  ps = cut(formation('split-l', 7, 'full'));
  assert.equal(ps.filter(p => p.at[1] < cy).length, 3); assert.equal(ps.filter(p => p.at[1] > cy).length, 2);
  // spread: cutters near the sidelines, nobody in the middle third
  assert.ok(cut(formation('spread', 7, 'full')).every(p => Math.abs(p.at[1] - cy) > W/3));
  // dump and swing left: the disc on the left, the swing handler on the right
  ps = formation('swing-l', 7, 'full');
  assert.ok(get(ps, 'h1')[1] < cy && get(ps, 'h3')[1] > cy && get(ps, 'h2')[0] < get(ps, 'h1')[0]);
  // end zone sets: handlers outside the attacking end zone, cutters inside it
  for (const id of ['ez-iso-l', 'ez-vert']) for (const fk of ['full', 'small']){
    const F = FIELDS[fk], gl = F.L - F.ez, s = formation(id, 7, fk);
    assert.ok(hand(s).every(p => p.at[0] < gl) && cut(s).every(p => p.at[0] > gl), `${id} ${fk}`);
  }
  // zone offense: three handlers across, two poppers in front of them, two deep
  ps = formation('zone-o', 7, 'full');
  const hx = Math.max(...hand(ps).map(p => p.at[0])), c = cut(ps).map(p => p.at[0]).sort((a, b) => a - b);
  assert.equal(hand(ps).length, 3); assert.ok(c[0] > hx && c[1] > hx && c[2] > c[1] + 10);
});
