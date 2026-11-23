/* A new disc at a step's start (issue #39): who gets it, the old disc, marks, saving. Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../js/model/compile.js';
import { copyOfBuiltin } from '../js/model/drafts.js';
import { discAt, markTargetAt, sparesAt } from '../js/model/motion.js';
import { timeDraft } from '../js/model/timing.js';
import { readRaw, serialize } from '../js/storage.js';

// two lines, A at y 12 and B at y 25; B1 throws to a cutting A1, then B2 (front of line B) gets a new disc
function drill(newDisc = {to: 'B2'}){
  return {id: 't', name: 'Two lines', kind: 'Drill', summary: '', field: 'full', format: 7, force: 'right', disc: 'B1',
    players: [
      {id: 'A1', team: 'O', label: 'A1', at: [40, 12]},
      {id: 'B1', team: 'O', label: 'B1', at: [40, 25]},
      {id: 'B2', team: 'O', label: 'B2', at: [37.5, 25]},
      {id: 'A2', team: 'O', label: 'A2', at: [37.5, 12]},
      {id: 'D1', team: 'D', mark: {mode: 'disc', order: [], force: 'right'}}
    ],
    steps: [
      {title: 'Cut', note: '', dur: null, moves: {A1: {path: [[45, 24]]}}, throw: {from: 'B1', to: 'A1', curve: 0}},
      {title: 'Back to the line', note: '', dur: null, moves: {A1: {path: [[32, 12]]}, B1: {path: [[32, 25]]}}, throw: null, newDisc},
      {title: 'Next pair', note: '', dur: null, moves: {A2: {path: [[45, 24]]}}, throw: {from: 'B2', to: 'A2', curve: 0}}
    ]};
}
const model = nd => compile(timeDraft(drill(nd)));

test('the new disc goes to the player named, at the step’s start, fading in', () => {
  const m = model();
  assert.deepEqual(m.newDiscs, [null, 'B2', null]);
  const t = m.starts[1];
  const d = discAt(m, t + .05);
  assert.equal(d.holder, 'B2');
  assert.ok(d.appear > 0 && d.appear < 1, 'fading in');
  assert.equal(discAt(m, t + 1).appear, undefined, 'fully there after a moment');
  assert.equal(discAt(m, t - .05).holder, 'A1', 'A1 still has it just before');
});

test('the old disc stays in A1’s hand until A1 runs back, then is put away', () => {
  const m = model();
  assert.equal(m.spares.length, 1);
  const s = m.spares[0];
  assert.equal(s.holder, 'A1');
  assert.equal(s.t0, m.starts[1]);
  const run = m.P.A1.segs.find(x => x.step === 1);
  assert.equal(s.t1, run.t0, 'until A1’s run back starts');
  assert.equal(sparesAt(m, m.starts[1] + .01).length, 1);
  assert.equal(sparesAt(m, run.t0 + .2)[0].opacity < 1, true, 'fading out as A1 starts running');
  assert.equal(sparesAt(m, run.t0 + .5).length, 0, 'gone');
});

test('the throw after it starts from the new holder', () => {
  const m = model(), th = m.throws.find(x => x.step === 2);
  assert.equal(discAt(m, th.t0 - .01).holder, 'B2');
  assert.equal(discAt(m, th.t1 + .01).holder, 'A2');
});

test('a spot gives the disc to whoever stands there, within reach', () => {
  assert.equal(model({at: [37.5, 25]}).newDiscs[1], 'B2');
  assert.equal(model({at: [38.5, 25]}).newDiscs[1], 'B2', 'the nearest one');
  const nobody = model({at: [80, 30]});
  assert.equal(nobody.newDiscs[1], null);
  assert.equal(nobody.spares.length, 0);
  assert.equal(discAt(nobody, nobody.starts[1] + 1).holder, 'A1', 'nobody there: the disc stays');
});

test('a mark on the disc goes to the new holder', () => {
  const m = model();
  assert.equal(markTargetAt(m, 'D1', m.starts[1] - .05), 'A1');
  assert.equal(markTargetAt(m, 'D1', m.starts[1] + .05), 'B2');
});

test('without a new disc, nothing changes', () => {
  const m = model(null);
  assert.deepEqual(m.newDiscs, [null, null, null]);
  assert.equal(m.spares.length, 0);
  assert.equal(m.discLog.length, m.throws.length);
  assert.equal(discAt(m, m.starts[1] + 1).holder, 'A1');
});

test('saved, read back and copied only when used; nonsense is dropped', () => {
  const body = serialize(drill());
  assert.deepEqual(body.steps[1].newDisc, {to: 'B2'});
  assert.equal('newDisc' in body.steps[0], false);
  assert.deepEqual(readRaw(body).steps[1].newDisc, {to: 'B2'});
  assert.deepEqual(readRaw(serialize(drill({at: [37.456, 25]}))).steps[1].newDisc, {at: [37.46, 25]});
  const bad = serialize(drill()); bad.steps[1].newDisc = {to: 'D1'};
  assert.equal(readRaw(bad).steps[1].newDisc, undefined, 'only an attacker gets a disc');
  bad.steps[1].newDisc = {at: 'here'};
  assert.equal(readRaw(bad).steps[1].newDisc, undefined);
  const copy = copyOfBuiltin(timeDraft(drill()));
  assert.deepEqual(copy.steps[1].newDisc, {to: 'B2'});
  assert.ok(!JSON.stringify(serialize(drill(null))).includes('newDisc'));
});
