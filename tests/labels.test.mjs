/* Attacker labels (js/model/labels.js). Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitLabel, labelSize, MAX_LABEL, nextFreeLabel } from '../js/model/labels.js';

const run = (start, count, used = new Set()) => Array.from({length: count}, () => { const l = nextFreeLabel(used, start); used.add(l); return l; });

test('plain numbers and a letter go from 9 to 10', () => {
  assert.deepEqual(run('', 11).slice(7), ['8', '9', '10', '11']);
  assert.deepEqual(run('H', 11).slice(8), ['H9', 'H10', 'H11']);
});

test('a two-letter start counts on instead of freezing', () => {
  assert.deepEqual(run('AB', 12).slice(8), ['AB9', 'AB10', 'AB11', 'AB12']);
});

test('digits at the end of the start say where to count from', () => {
  assert.deepEqual(run('A1', 11).slice(8), ['A9', 'A10', 'A11']);   // not A11, A12 …
  assert.deepEqual(run('7', 4), ['7', '8', '9', '10']);
  assert.equal(nextFreeLabel(new Set(['A1', 'A2', 'A3', 'A4']), 'A4'), 'A5');   // a copy of A4
  assert.equal(nextFreeLabel(new Set(['A4']), 'A4'), 'A5');
  assert.equal(nextFreeLabel(new Set(['A4', 'A5']), 'A4'), 'A6');
  assert.equal(nextFreeLabel(new Set(['9']), '9'), '10');
});

test('fills gaps from the start on', () => {
  assert.equal(nextFreeLabel(new Set(['1', '3']), ''), '2');
  assert.equal(nextFreeLabel(new Set(['H1', 'H2', 'H4']), 'H'), 'H3');
});

test('never longer than the limit; null when a start runs out', () => {
  assert.equal(nextFreeLabel(new Set(['ABC1', 'ABC2', 'ABC3', 'ABC4', 'ABC5', 'ABC6', 'ABC7', 'ABC8', 'ABC9']), 'ABC'), null);
  for (const l of run('AB', 99)) assert.ok(l.length <= MAX_LABEL, l);
  assert.equal(nextFreeLabel(new Set(run('AB', 99)), 'AB'), null);
});

test('labels are cut to the limit, and smaller text fits longer ones', () => {
  assert.equal(fitLabel('  ABCDE '), 'ABCD');
  assert.ok(labelSize('AB10') < labelSize('A10') && labelSize('A10') < labelSize('1'));
});
