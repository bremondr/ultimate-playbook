/* Send feedback: the filled-in issue (js/features/feedback-issue.js) and the time in a link (js/share.js).
   Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueBody, issueTitle, issueUrl, NEW_ISSUE } from '../js/features/feedback-issue.js';
import { splitTime, withTime } from '../js/share.js';

const player = {
  where: 'Preview PR #29', commit: 'abc1234', page: 'https://bremondr.github.io/ultimate-playbook/preview/pr-29/',
  field: 'Full field, 100 × 37 m', orient: 'h', width: 1180, height: 820, dpr: 2, orientation: 'landscape',
  theme: 'dark', standalone: false, userAgent: 'Mozilla/5.0 (iPad)', screen: 'player', drill: 'Angel drill',
  source: 'built in', step: 2, steps: 4, stepTitle: 'Cut | and throw', time: 2.84, total: 9.5, presenting: false,
  reopen: 'https://bremondr.github.io/ultimate-playbook/preview/pr-29/#angel&t=2.84'
};
const params = url => new URL(url).searchParams;

test('the issue has a title, the feedback label and a body with what was on screen', () => {
  const {url, reopenLeftOut} = issueUrl(player);
  assert.ok(url.startsWith(NEW_ISSUE + '?'));
  assert.equal(reopenLeftOut, false);
  const q = params(url);
  assert.equal(q.get('title'), 'Feedback: Angel drill (step 2)');
  assert.equal(q.get('labels'), 'feedback');
  const body = q.get('body');
  assert.match(body, /^## What’s wrong, and what should happen\n/);
  assert.ok(body.includes('[Open this drill at step 2 (2.8 s)](' + player.reopen + ')'));
  assert.ok(body.includes('| Where | Preview PR #29 (commit abc1234) |'));
  assert.ok(body.includes('Player: step 2 of 4 (Cut \\| and throw), 2.8 s of 9.5 s'), 'a | in a cell is escaped');
  assert.ok(body.includes('| Screen | 1180 × 820 px, landscape, pixel ratio 2, dark mode |'));
});

test('the editor says the step, the tool and the tab', () => {
  const c = {...player, screen: 'editor', source: 'being drawn', step: 0, time: 0, tool: 'Throw', tab: 'Step', unsaved: true};
  assert.equal(issueTitle(c), 'Feedback: Angel drill (editor, setup)');
  const body = issueBody(c, c.reopen);
  assert.ok(body.includes('| On screen | Editor: setup, tool Throw, Step tab, unsaved changes |'));
  assert.ok(body.includes('[Open this drill at the start (0.0 s)]'));
});

test('a reopen link that is too long is left out, and the body says so', () => {
  const reopen = 'https://example.org/#d=z' + 'x'.repeat(9000);
  const {url, reopenLeftOut} = issueUrl({...player, reopen});
  assert.ok(url.length <= 8000);
  assert.equal(reopenLeftOut, true);
  assert.match(params(url).get('body'), /too long to pack into a link here \(9024 characters\)/);
});

test('without a reopen link the body says there is none', () => {
  const {url, reopenLeftOut} = issueUrl({...player, reopen: null});
  assert.equal(reopenLeftOut, false);
  assert.match(params(url).get('body'), /No link: this drill can’t be packed into one/);
});

test('a link carries a playback time, and reading it back gives the drill and the time', () => {
  assert.equal(withTime('https://x/#angel', 2.8456), 'https://x/#angel&t=2.85');
  assert.deepEqual(splitTime('angel&t=2.85'), {id: 'angel', t: 2.85});
  assert.deepEqual(splitTime('d=zAbC-_9&t=0'), {id: 'd=zAbC-_9', t: 0});
  assert.deepEqual(splitTime('angel'), {id: 'angel', t: null});
  assert.deepEqual(splitTime('angel&t=oops'), {id: 'angel', t: null});
  assert.deepEqual(splitTime(''), {id: '', t: null});
});
