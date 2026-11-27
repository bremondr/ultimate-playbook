/* Searching the drill list (js/model/search.js, issue #55). Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold, matchesQuery, matchesTags } from '../js/model/search.js';
import { builtins } from '../js/library.js';

const drill = {name: 'Rozběh a hod', summary: 'Two lines facing the end zone.', steps: [{title: 'Diagonal cut'}, {title: 'Return to the line'}], tags: ['cutting', 'Beginners']};

test('case and accents don’t matter', () => {
  assert.equal(fold('Rozběh HOD'), 'rozbeh hod');
  assert.ok(matchesQuery(drill, 'rozbeh'));
  assert.ok(matchesQuery(drill, 'ROZBĚH'));
  assert.ok(matchesQuery(drill, 'hod'));
});

test('every word must appear, in any order, in the name, summary, step titles or tags', () => {
  assert.ok(matchesQuery(drill, 'line diagonal'));
  assert.ok(matchesQuery(drill, 'end zone'));
  assert.ok(matchesQuery(drill, 'beginners'));
  assert.ok(!matchesQuery(drill, 'diagonal hammer'));
});

test('an empty search matches everything', () => {
  assert.ok(matchesQuery(drill, ''));
  assert.ok(matchesQuery(drill, '   '));
});

test('tags: every picked tag, none picked matches all', () => {
  assert.ok(matchesTags(drill, []));
  assert.ok(matchesTags(drill, ['beginners']));
  assert.ok(matchesTags(drill, ['Cutting', 'beginners']));
  assert.ok(!matchesTags(drill, ['cutting', 'zone']));
  assert.ok(!matchesTags({name: 'x'}, ['cutting']));
});

test('the built-in drills can be found by their names', () => {
  const names = builtins().filter(p => matchesQuery(p, 'angel')).map(p => p.name);
  assert.ok(names.length >= 2, names.join(', '));
});
