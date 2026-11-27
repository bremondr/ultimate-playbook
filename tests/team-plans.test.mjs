/* Practice plans in team repos (issue #53): the file format, drill references, and a second git-store-kit store on the
   same repos, run against the kit's GitHub in memory. Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_TYPE, planRefsIn, planRefsOut, planStoreOptions, readTeamPlan, teamStoreOptions, writeTeamDrill, writeTeamPlan } from '../js/features/team-format.js';
import { createGitStore } from '../js/vendor/git-store-kit/store.js';
import { createFakeGitHub } from '../js/vendor/git-store-kit/fake-github.js';
import { memoryCache } from '../js/vendor/git-store-kit/cache.js';

const REPO = 'bremondr/ultimate-playbook-sunset';
const TOKEN = 'github_pat_' + 'b'.repeat(40);
const plan = {id: 'tue', name: 'Tuesday', note: 'Breaks', createdAt: 5, updatedAt: 6, items: [
  {kind: 'block', title: 'Warm-up', minutes: 15, note: ''},
  {kind: 'drill', drill: 'here:sunset-angel', name: 'Angel, Sunset style', minutes: 20, note: 'Bend it'},
  {kind: 'drill', drill: 'box', name: 'Box drill', minutes: 10, note: ''}]};

test('a team plan file: written with its type, read back field by field', () => {
  const file = writeTeamPlan(plan);
  assert.equal(file.type, PLAN_TYPE);
  assert.equal(file.version, 1);
  const back = readTeamPlan(JSON.parse(JSON.stringify(file)));
  assert.deepEqual(back.items, plan.items);
  assert.equal(back.id, 'tue');
  assert.equal(readTeamPlan({...file, type: 'ultimate-playbook-drill'}), null, 'a drill file is not a plan');
  assert.equal(readTeamPlan({...file, version: 2}), null, 'a newer format is left alone');
});

test('references: here:<id> in the file, team:<repo>:<id> in the app', () => {
  const inApp = planRefsIn(plan, REPO);
  assert.equal(inApp.items[1].drill, `team:${REPO}:sunset-angel`);
  assert.equal(inApp.items[2].drill, 'box');
  const out = planRefsOut({...inApp, items: [...inApp.items,
    {kind: 'drill', drill: 'c123', name: 'Mine', minutes: 5, note: ''},
    {kind: 'drill', drill: 'team:bremondr/ultimate-playbook-tuesday:x', name: 'Theirs', minutes: 5, note: ''}]},
    REPO, {isBuiltin: id => id === 'box', isSaved: id => id === 'c123'});
  assert.deepEqual(out.plan.items.slice(0, 4).map(i => i.drill || i.title), ['Warm-up', 'here:sunset-angel', 'box', 'here:c123']);
  assert.deepEqual(out.saved, ['c123'], 'drills saved only here are published along');
  assert.deepEqual(out.other, ['team:bremondr/ultimate-playbook-tuesday:x'], 'another team’s drill stops it');
});

test('plans and drills: two stores, one team, one token; each reads its own folder', async () => {
  const fake = createFakeGitHub();
  await fake.addRepo(REPO, {files: {
    'drills/sunset-angel.json': writeTeamDrill({id: 'sunset-angel', name: 'Angel, Sunset style', kind: 'Drill', summary: '', field: 'full', format: 7, force: 'right', disc: 'p1',
      players: [{id: 'p1', team: 'O', label: '1', at: [40, 18]}], steps: [{title: 'Go', note: '', dur: null, moves: {}, throw: null}], createdAt: 1, updatedAt: 1}),
    'plans/tue.json': writeTeamPlan(plan)}});
  fake.addToken(TOKEN, REPO, 'write');
  const storage = new Map(), local = {getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k)};
  const extra = {fetch: fake.fetch, storage: local};
  const drills = createGitStore(teamStoreOptions({...extra, cache: memoryCache()}));
  const plans = createGitStore(planStoreOptions({...extra, cache: memoryCache()}));
  drills.followFromHash('#team=sunset');
  drills.setToken(REPO, TOKEN);
  await drills.load(); await plans.load();
  // the plans store follows the team and uses the token the drills store was given
  const ps = plans.sources().find(s => s.repo === REPO), ds = drills.sources().find(s => s.repo === REPO);
  assert.deepEqual(ds.items.map(i => i.id), ['sunset-angel']);
  assert.deepEqual(ps.items.map(i => i.id), ['tue']);
  assert.equal(ps.items[0].item.name, 'Tuesday');
  // publishing a plan writes plans/<id>.json
  await plans.save(REPO, {...plan, id: 'thu', name: 'Thursday'}, {note: 'Thursday session'});
  await plans.load();
  assert.deepEqual(plans.sources().find(s => s.repo === REPO).items.map(i => i.id).sort(), ['thu', 'tue']);
  assert.ok(fake.file(REPO, 'plans/thu.json'), 'written next to the drills');
});
