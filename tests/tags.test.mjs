/* Tags on drills (js/model/tags.js, issue #54): cleaning, saving, timing, copies, built-ins. Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTags, MAX_TAGS, normTag, tagsInUse } from '../js/model/tags.js';
import { blankDraft, copyOfEntry } from '../js/model/drafts.js';
import { timeDraft } from '../js/model/timing.js';
import { readRaw, serialize } from '../js/storage.js';
import { builtins, libEntries } from '../js/library.js';

test('a tag is lower case, single-spaced and short; commas and # go', () => {
  assert.equal(normTag('  Zone   Defense '), 'zone defense');
  assert.equal(normTag('#cutting,'), 'cutting');
  assert.equal(normTag('x'.repeat(40)).length, 24);
  assert.equal(normTag(''), '');
});

test('a drill has each tag once, at most 8, strings only', () => {
  assert.deepEqual(cleanTags(['Cutting', 'cutting ', 'zone', 3, null, '']), ['cutting', 'zone']);
  assert.equal(cleanTags(Array.from({length: 12}, (_, k) => 't' + k)).length, MAX_TAGS);
  assert.deepEqual(cleanTags('not a list'), []);
});

test('the tags in use: the most used first, then alphabetical', () => {
  assert.deepEqual(tagsInUse([['b', 'a'], ['a'], ['c'], undefined]), ['a', 'b', 'c']);
});

test('saved, read back, timed and copied with the drill; nothing written without tags', () => {
  const d = {...blankDraft(), tags: ['Handlers', 'reset']};
  const body = serialize(d);
  assert.deepEqual(body.tags, ['handlers', 'reset']);
  assert.deepEqual(readRaw(body).tags, ['handlers', 'reset']);
  assert.deepEqual(readRaw({...body, tags: ['ok', 7, '  ']}).tags, ['ok']);
  assert.equal('tags' in serialize(blankDraft()), false);
  const raw = readRaw(body);
  assert.deepEqual(timeDraft(raw).tags, ['handlers', 'reset']);
  assert.deepEqual(copyOfEntry({raw, play: timeDraft(raw)}).tags, ['handlers', 'reset']);
});

test('built-in drills have tags in the library, not in their play data', () => {
  const entries = libEntries().filter(e => e.source === 'builtin');
  assert.ok(entries.length >= 7);
  entries.forEach(e => assert.ok(e.tags.length > 0, `${e.id} has tags`));
  builtins().forEach(p => assert.equal('tags' in p, false, `${p.id}'s play data stays as it was`));
  const vert = entries.find(e => e.id === 'vert-stack');
  assert.deepEqual(copyOfEntry(vert).tags, vert.tags, 'a copy of a built-in keeps its tags');
});
