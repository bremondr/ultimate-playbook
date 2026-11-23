/* A step's run arrows can be turned off (issue #38): saved, read back, timed and copied. Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankDraft, copyOfBuiltin } from '../js/model/drafts.js';
import { timeDraft } from '../js/model/timing.js';
import { readRaw, serialize } from '../js/storage.js';

function drill(){
  const d = blankDraft();
  d.players.push({id: 'p2', team: 'O', label: '2', at: [50, 18.5]});
  d.steps = [
    {title: 'Cut', note: '', dur: null, moves: {p2: {path: [[60, 10]]}}, throw: {from: 'p1', to: 'p2', curve: 0}},
    {title: 'Back to the line', note: '', dur: null, moves: {p2: {path: [[50, 18.5]]}}, throw: null, arrows: false}
  ];
  return d;
}

test('only a step with its arrows off says so when saved', () => {
  const body = serialize(drill());
  assert.equal('arrows' in body.steps[0], false);
  assert.equal(body.steps[1].arrows, false);
});

test('reading a saved drill keeps it, and ignores anything but false', () => {
  const raw = readRaw(serialize(drill()));
  assert.equal(raw.steps[0].arrows, undefined);
  assert.equal(raw.steps[1].arrows, false);
  const odd = serialize(drill()); odd.steps[0].arrows = 'no';
  assert.equal(readRaw(odd).steps[0].arrows, undefined);
});

test('the timed drill and a copy of it keep it', () => {
  const play = timeDraft(drill());
  assert.equal(play.steps[0].arrows, undefined);
  assert.equal(play.steps[1].arrows, false);
  const copy = copyOfBuiltin({...play, id: 'x', name: 'X', summary: '', field: 'full'});
  assert.equal(copy.steps[1].arrows, false);
  assert.equal('arrows' in copy.steps[0], false);
});

test('a drill without the setting is saved exactly as before', () => {
  const d = drill(); delete d.steps[1].arrows;
  assert.ok(!JSON.stringify(serialize(d)).includes('arrows'));
});
