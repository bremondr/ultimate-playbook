/* Practice plans (js/model/plans.js, issue #51), and plans in backups (js/features/backup.js). Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockItem, clock, drillItem, minutesText, moveItem, newPlan, readPlan, resolveItems, serializePlan, startTimes, totalMinutes } from '../js/model/plans.js';
import { libEntries } from '../js/library.js';

const plan = () => ({...newPlan('Tuesday'), note: 'Break throws',
  items: [blockItem('Warm-up', 15), {kind: 'drill', drill: 'angel', name: 'Angel drill', minutes: 20, note: 'Bend it'}, blockItem('Water break', 3), {kind: 'drill', drill: 'gone', name: 'Old drill', minutes: 10, note: ''}]});

test('total time and when each item starts', () => {
  const p = plan();
  assert.equal(totalMinutes(p), 48);
  assert.deepEqual(startTimes(p), [0, 15, 35, 38]);
  assert.equal(clock(95), '1:35');
  assert.equal(minutesText(48), '48 min');
  assert.equal(minutesText(90), '1 h 30 min');
  assert.equal(minutesText(120), '2 h');
});

test('drill items refer to the library; a drill that is gone shows as missing', () => {
  const r = resolveItems(plan(), libEntries());
  assert.equal(r[0].entry, undefined); assert.equal(r[0].missing, undefined);   // a block
  assert.equal(r[1].entry.play.name, 'Angel drill');
  assert.equal(r[3].missing, true);
});

test('a stored plan is read field by field; nonsense is dropped', () => {
  const p = readPlan({name: '', note: 5, items: [
    {kind: 'drill', drill: 'angel', minutes: 999},
    {kind: 'drill', drill: 'bad id with spaces', minutes: 5},
    {kind: 'block', title: '   ', minutes: 5},
    {kind: 'block', title: 'Scrimmage', minutes: -4, note: 'Hard cap'},
    {kind: 'other'}, null, 'x'], evil: true});
  assert.equal(p.name, 'Untitled plan');
  assert.equal(p.note, '');
  assert.deepEqual(p.items, [
    {kind: 'drill', drill: 'angel', name: '', minutes: 240, note: ''},
    {kind: 'block', title: 'Scrimmage', minutes: 0, note: 'Hard cap'}]);
  assert.equal('evil' in p, false);
  assert.equal(readPlan({name: 'x'}), null);
  assert.equal(readPlan(null), null);
  assert.deepEqual(Object.keys(serializePlan(plan())), ['name', 'note', 'items']);
});

test('team drill ids (team:owner/repo:id) are allowed as references', () => {
  const p = readPlan({items: [{kind: 'drill', drill: 'team:bremondr/ultimate-playbook-sunset:sunset-angel', minutes: 10}]});
  assert.equal(p.items.length, 1);
});

test('moving an item, and making items', () => {
  const p = moveItem(plan(), 0, 2);
  assert.deepEqual(p.items.map(i => i.title || i.drill), ['angel', 'Water break', 'Warm-up', 'gone']);
  assert.equal(moveItem(plan(), 0, 9).items[0].title, 'Warm-up', 'out of range: unchanged');
  const entry = libEntries().find(e => e.id === 'angel-cutback');
  assert.deepEqual(drillItem(entry), {kind: 'drill', drill: 'angel-cutback', name: 'Angel drill: fake & cut back', minutes: 10, note: ''});
});

// backup.js looks up its drawer buttons when it loads; there are none in Node
globalThis.document ??= {querySelector: () => null};
const { planImport, plansImport } = await import('../js/features/backup.js');
const { blankDraft } = await import('../js/model/drafts.js');

test('restoring: a plan already here is skipped, a taken id gets a new one', () => {
  const here = [{id: 'p1', plan: readPlan(plan())}];
  const r = plansImport([{id: 'p1', ...serializePlan(plan())}, {id: 'p1', ...serializePlan({...plan(), name: 'Other'})}, {junk: 1}], here);
  assert.equal(r.same, 1);
  assert.equal(r.add.length, 1);
  assert.notEqual(r.add[0].id, 'p1');
  assert.equal(r.add[0].plan.name, 'Other');
});

test('restoring: plan references follow drills that got another id here', () => {
  const d = {...blankDraft(), name: 'Mine'}, other = {...blankDraft(), name: 'Clash'};
  // "c1" is taken here by a different drill, so the file's c1 comes in under a new id; the plan must follow it
  const drills = planImport([{...d, id: 'c1'}], [{id: 'c1', raw: other}]);
  const newId = drills.add[0].id;
  assert.notEqual(newId, 'c1');
  assert.equal(drills.renamed.c1, newId);
  const p = {...newPlan('Uses c1'), items: [{kind: 'drill', drill: 'c1', name: 'Mine', minutes: 10, note: ''}]};
  const planned = plansImport([{id: 'pl', ...serializePlan(p)}], [], drills.renamed);
  assert.equal(planned.add[0].plan.items[0].drill, newId);
  // the same drill already here under another id: the plan points at that one
  const same = planImport([{...d, id: 'c9'}], [{id: 'c5', raw: d}]);
  assert.equal(same.same, 1);
  assert.equal(same.renamed.c9, 'c5');
});

const { planBody, readPlanBody } = await import('../js/share.js');
const { readRaw, serialize } = await import('../js/storage.js');

test('a plan link packs drawn drills as copies and keeps built-ins by name', () => {
  const mine = {...blankDraft(), name: 'My cuts'};
  const entries = [...libEntries(), {id: 'c7', source: 'team', raw: mine, play: {name: 'My cuts'}}];
  const p = {...newPlan('Thursday'), items: [
    {kind: 'drill', drill: 'angel', name: 'Angel drill', minutes: 15, note: ''},
    {kind: 'drill', drill: 'c7', name: 'My cuts', minutes: 10, note: 'Hard'},
    blockItem('Water break', 3),
    {kind: 'drill', drill: 'c7', name: 'My cuts', minutes: 5, note: 'Again'},
    {kind: 'drill', drill: 'gone', name: 'Old', minutes: 5, note: ''}]};
  const body = planBody(p, entries);
  assert.deepEqual(body.plan.items.map(i => i.drill || i.title), ['angel', 'd1', 'Water break', 'd1', 'gone']);
  assert.deepEqual(Object.keys(body.drills), ['d1'], 'one copy for a drill used twice');
  assert.equal(body.drills.d1.name, 'My cuts');
  // and back: checked like any plan and drill; only d-keys, only readable drills
  const back = readPlanBody(JSON.parse(JSON.stringify({...body, drills: {...body.drills, evil: body.drills.d1, d2: {nope: 1}}})));
  assert.equal(back.plan.name, 'Thursday');
  assert.deepEqual(Object.keys(back.drills), ['d1']);
  assert.deepEqual(serialize(back.drills.d1), serialize(readRaw(body.drills.d1)));
  assert.throws(() => readPlanBody({plan: {name: 'no items'}}));
});
