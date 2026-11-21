/* Send feedback: the playbook's description of the issue (js/features/feedback-issue.js), the feedback kit's issue
   address (js/feedback-kit/issue.js) and the time in a link (js/share.js). Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueTitle, playbookIssue } from '../js/features/feedback-issue.js';
import { issueBody, issueUrl } from '../js/feedback-kit/issue.js';
import { splitTime, withTime } from '../js/share.js';

const player = {
  where: 'Preview PR #29', commit: 'abc1234', field: 'Full field, 100 × 37 m', orient: 'h', screen: 'player',
  drill: 'Angel drill', source: 'built in', step: 2, steps: 4, stepTitle: 'Cut | and throw', time: 2.84, total: 9.5,
  presenting: false, reopen: 'https://bremondr.github.io/ultimate-playbook/preview/pr-29/#angel&t=2.84'
};
const params = url => new URL(url).searchParams;
const kit = issue => issueUrl({repo: 'bremondr/ultimate-playbook', labels: ['feedback'], footer: 'Sent from the app.', ...issue});

test('the playbook describes the drill, the step and a link back', () => {
  const it = playbookIssue(player);
  assert.equal(it.title, 'Feedback: Angel drill (step 2)');
  assert.deepEqual(it.sections.map(s => s.heading), ['Reopen']);
  assert.equal(it.sections[0].text, '[Open this drill at step 2 (2.8 s)](' + player.reopen + ')');
  assert.deepEqual(it.rows, [
    ['Where', 'Preview PR #29 (commit abc1234)'],
    ['Drill', 'Angel drill (built in)'],
    ['On screen', 'Player: step 2 of 4 (Cut | and throw), 2.8 s of 9.5 s'],
    ['Field', 'Full field, 100 × 37 m, wide (attack to the right)']
  ]);
});

test('in the editor it says the step, the tool and the tab', () => {
  const c = {...player, screen: 'editor', source: 'being drawn', step: 0, time: 0, tool: 'Throw', tab: 'Step', unsaved: true};
  assert.equal(issueTitle(c), 'Feedback: Angel drill (editor, setup)');
  const it = playbookIssue(c);
  assert.equal(it.rows[2][1], 'Editor: setup, tool Throw, Step tab, unsaved changes');
  assert.match(it.sections[0].text, /^\[Open this drill at the start \(0\.0 s\)\]/);
});

test('the kit fills in the title, the label and the body', () => {
  const {url, shortened} = kit(playbookIssue(player));
  assert.ok(url.startsWith('https://github.com/bremondr/ultimate-playbook/issues/new?'));
  assert.equal(shortened, false);
  const q = params(url);
  assert.equal(q.get('title'), 'Feedback: Angel drill (step 2)');
  assert.equal(q.get('labels'), 'feedback');
  const body = q.get('body');
  assert.match(body, /^## What’s wrong, and what should happen\n\n\n\n## Picture\n/);
  assert.ok(body.includes('## Reopen\n\n[Open this drill at step 2 (2.8 s)]('));
  assert.ok(body.includes('| On screen | Player: step 2 of 4 (Cut \\| and throw), 2.8 s of 9.5 s |'), 'a | in a cell is escaped');
  assert.ok(body.endsWith('<sub>Sent from the app.</sub>'));
});

test('a section that would make the address too long gives way to its fallback', () => {
  const reopen = 'https://example.org/#d=z' + 'x'.repeat(9000);
  const {url, shortened} = kit(playbookIssue({...player, reopen}));
  assert.ok(url.length <= 8000);
  assert.equal(shortened, true);
  assert.match(params(url).get('body'), /too long to pack into a link here \(9024 characters\)/);
});

test('without a reopen link the body says there is none', () => {
  const {url, shortened} = kit(playbookIssue({...player, reopen: null}));
  assert.equal(shortened, false);
  assert.match(params(url).get('body'), /No link: this drill can’t be packed into one/);
});

test('the kit leaves out empty parts', () => {
  assert.equal(issueBody({}), '## What’s wrong, and what should happen\n\n\n\n## Picture\n\n<!-- The picture was copied: paste it here, or attach the saved picture. -->\n\n');
  assert.equal(params(issueUrl({repo: 'o/r', title: 'T', labels: []}).url).get('labels'), null);
});

test('a link carries a playback time, and reading it back gives the drill and the time', () => {
  assert.equal(withTime('https://x/#angel', 2.8456), 'https://x/#angel&t=2.85');
  assert.deepEqual(splitTime('angel&t=2.85'), {id: 'angel', t: 2.85});
  assert.deepEqual(splitTime('d=zAbC-_9&t=0'), {id: 'd=zAbC-_9', t: 0});
  assert.deepEqual(splitTime('angel'), {id: 'angel', t: null});
  assert.deepEqual(splitTime('angel&t=oops'), {id: 'angel', t: null});
  assert.deepEqual(splitTime(''), {id: '', t: null});
});
