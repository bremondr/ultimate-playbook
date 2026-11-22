/* Team repos: the playbook's side of git-store-kit (js/features/team-format.js), run against the kit's GitHub in
   memory (js/vendor/git-store-kit/fake-github.js). Plain Node: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitMessage, FILE_TYPE, linkName, readTeamDrill, shortName, teamLabel, teamStoreOptions, writeTeamDrill } from '../js/features/team-format.js';
import { createGitStore, GitStoreConflict } from '../js/vendor/git-store-kit/store.js';
import { createFakeGitHub } from '../js/vendor/git-store-kit/fake-github.js';
import { memoryCache } from '../js/vendor/git-store-kit/cache.js';

// backup.js looks up its drawer buttons when it loads; there are none in Node
globalThis.document ??= {querySelector: () => null};
const { drillsIn, planImport } = await import('../js/features/backup.js');

const REPO = 'bremondr/ultimate-playbook-sunset';
const TOKEN = 'github_pat_' + 'a'.repeat(40);
const drill = (id, name = 'Hex cuts') => ({
  id, name, kind: 'Drill', summary: 'Two lines', field: 'full', format: 7, force: 'right', disc: 'p1',
  players: [{id: 'p1', team: 'O', label: '1', at: [40, 18]}, {id: 'p2', team: 'O', label: '2', at: [50, 10]}],
  steps: [{title: 'Cut', note: 'Go deep', dur: null, moves: {p2: {path: [[60, 12]]}}, throw: {from: 'p1', to: 'p2', type: 'backhand', curve: 0}}],
  createdAt: 1700000000000, updatedAt: 1700000500000
});
// a local storage in memory, as the browser's
const memoryStorage = () => { const m = new Map(); return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k)}; };

async function setup({files = {}, token = 'write'} = {}){
  const fake = createFakeGitHub();
  await fake.addRepo(REPO, {files});
  if (token) fake.addToken(TOKEN, REPO, token);
  const make = () => createGitStore(teamStoreOptions({fetch: fake.fetch, cache: memoryCache(), storage: memoryStorage()}));
  return {fake, make};
}

test('a drill is written in the app’s own shape and read back the same', () => {
  const json = writeTeamDrill(drill('c1'));
  assert.equal(json.type, FILE_TYPE);
  assert.equal(json.format, 7, 'the drill’s own format (7 v 7) stays');
  assert.equal(json.version, 1);
  assert.equal(json.id, 'c1');
  assert.equal(json.createdAt, 1700000000000);
  assert.equal(json.updatedAt, 1700000500000);
  assert.deepEqual(Object.keys(json).slice(0, 3), ['type', 'version', 'id']);
  const back = readTeamDrill(JSON.parse(JSON.stringify(json)));
  assert.equal(back.id, 'c1');
  assert.equal(back.name, 'Hex cuts');
  assert.equal(back.steps[0].throw.to, 'p2');
  assert.deepEqual(back.steps[0].moves.p2.path, [[60, 12]]);
  assert.deepEqual(writeTeamDrill(back), json);
});

test('reading refuses files that aren’t drills, and checks every field', () => {
  const good = writeTeamDrill(drill('c1'));
  assert.equal(readTeamDrill(null), null);
  assert.equal(readTeamDrill({...good, type: 'something-else'}), null);
  assert.equal(readTeamDrill({...good, type: undefined}), null);
  assert.equal(readTeamDrill({...good, version: 2}), null, 'a newer format is left out');
  assert.equal(readTeamDrill({...good, steps: []}), null);
  const odd = readTeamDrill({...good, id: '../x', name: 'x'.repeat(500), createdAt: 'yesterday', players: [...good.players, {id: '<b>', team: 'O'}]});
  assert.equal(odd.id, null, 'a bad id is dropped (the file name gives the id)');
  assert.equal(odd.name.length, 80);
  assert.equal(odd.createdAt, 0);
  assert.equal(odd.players.length, 2);
});

test('commit messages: the note, or what happened', () => {
  assert.equal(commitMessage({op: 'add', name: 'Hex cuts', note: ''}), 'Publish Hex cuts');
  assert.equal(commitMessage({op: 'update', name: 'Hex cuts', note: ''}), 'Update Hex cuts');
  assert.equal(commitMessage({op: 'remove', name: 'Hex cuts', note: ''}), 'Remove Hex cuts');
  assert.equal(commitMessage({op: 'copy', name: 'Hex cuts', note: ''}), 'Publish a copy of Hex cuts');
  assert.equal(commitMessage({op: 'restore', name: 'Hex cuts', note: ''}), 'Restore Hex cuts');
  assert.equal(commitMessage({op: 'update', name: 'Hex cuts', note: 'Tighter cuts'}), 'Tighter cuts');
});

test('team names: links and labels', () => {
  assert.equal(shortName('sunset'), REPO);
  assert.equal(linkName(REPO), 'sunset');
  assert.equal(linkName('Bremondr/Ultimate-Playbook-Sunset'), 'Sunset');
  assert.equal(linkName('club/drills'), 'club/drills');
  assert.equal(teamLabel(REPO), 'Sunset');
  assert.equal(teamLabel('bremondr/ultimate-playbook-tuesday-night'), 'Tuesday Night');
  assert.equal(teamLabel('club/drills'), 'Drills');
});

test('#team=sunset follows the Sunset repo and loads its drills, read-only without a token', async () => {
  const {make} = await setup({files: {'drills/c1.json': writeTeamDrill(drill('c1')), 'drills/README.md': 'Drills', 'drills/bad.json': {type: FILE_TYPE, version: 1, steps: []}}, token: null});
  const store = make();
  assert.equal(store.followFromHash('#team=sunset'), REPO);
  const [s] = await store.load();
  assert.equal(s.repo, REPO);
  assert.equal(s.error, null);
  assert.equal(s.canWrite, false);
  assert.equal(s.dropped, 1, 'the file that isn’t a drill is left out');
  assert.deepEqual(s.items.map(i => [i.id, i.name]), [['c1', 'Hex cuts']]);
  assert.equal(s.items[0].item.steps.length, 1);
});

test('the last good copy shows when GitHub can’t be reached', async () => {
  const fake = createFakeGitHub();
  await fake.addRepo(REPO, {files: {'drills/c1.json': writeTeamDrill(drill('c1'))}});
  const cache = memoryCache(), storage = memoryStorage();
  const first = createGitStore(teamStoreOptions({fetch: fake.fetch, cache, storage}));
  first.follow('sunset');
  await first.load();
  fake.offline = true;
  const later = createGitStore(teamStoreOptions({fetch: fake.fetch, cache, storage}));
  const [s] = await later.load();
  assert.equal(s.error.code, 'offline');
  assert.equal(s.stale, true);
  assert.deepEqual(s.items.map(i => i.name), ['Hex cuts']);
});

test('publishing adds a file, one commit with the note; publishing again replaces it by id', async () => {
  const {fake, make} = await setup();
  const store = make();
  store.follow('sunset');
  store.setToken(REPO, TOKEN);
  await store.load();
  assert.equal(store.source(REPO).canWrite, true);
  await store.save(REPO, drill('c1'));
  assert.equal(fake.file(REPO, 'drills/c1.json').name, 'Hex cuts');
  assert.equal(fake.commits(REPO)[0].message, 'Publish Hex cuts');
  await store.save(REPO, drill('c1', 'Hex cuts, tighter'), {note: 'Tighter cuts'});
  assert.equal(fake.file(REPO, 'drills/c1.json').name, 'Hex cuts, tighter');
  assert.equal(fake.commits(REPO)[0].message, 'Tighter cuts');
  assert.deepEqual(store.source(REPO).items.map(i => i.name), ['Hex cuts, tighter']);
  // a second device sees it at its next load
  const other = createGitStore(teamStoreOptions({fetch: fake.fetch, cache: memoryCache(), storage: memoryStorage()}));
  other.follow('sunset');
  const [s] = await other.load();
  assert.deepEqual(s.items.map(i => i.name), ['Hex cuts, tighter']);
  // removing
  await store.remove(REPO, 'c1');
  assert.equal(fake.file(REPO, 'drills/c1.json'), null);
  assert.equal(fake.commits(REPO)[0].message, 'Remove Hex cuts, tighter');
});

test('a drill changed on GitHub since it was loaded is a conflict: overwrite, keep theirs, or a copy', async () => {
  const {fake, make} = await setup({files: {'drills/c1.json': writeTeamDrill(drill('c1'))}});
  const store = make();
  store.follow('sunset');
  store.setToken(REPO, TOKEN);
  await store.load();
  await fake.edit(REPO, 'drills/c1.json', writeTeamDrill(drill('c1', 'Changed on GitHub')));
  const conflict = await store.save(REPO, drill('c1', 'Mine')).catch(e => e);
  assert.ok(conflict instanceof GitStoreConflict);
  assert.equal(conflict.theirs.item.name, 'Changed on GitHub');
  const copy = await store.resolve(conflict, 'copy');
  assert.equal(copy.kept, 'copy');
  assert.notEqual(copy.id, 'c1');
  assert.equal(fake.file(REPO, `drills/${copy.id}.json`).id, copy.id, 'the copy’s file names its own id');
  assert.equal(fake.file(REPO, 'drills/c1.json').name, 'Changed on GitHub');
  const again = await store.save(REPO, drill('c1', 'Mine')).catch(e => e);
  assert.ok(!(again instanceof Error), 'after the conflict the store knows the newest version');
  assert.equal(fake.file(REPO, 'drills/c1.json').name, 'Mine');
});

test('a drill’s history: versions, an old one, restore', async () => {
  const {fake, make} = await setup();
  const store = make();
  store.follow('sunset');
  store.setToken(REPO, TOKEN);
  await store.load();
  await store.save(REPO, drill('c1', 'First'));
  await store.save(REPO, drill('c1', 'Second'), {note: 'Renamed'});
  const versions = await store.history(REPO, 'c1');
  assert.deepEqual(versions.map(v => v.message), ['Renamed', 'Publish First']);
  const old = await store.version(REPO, 'c1', versions[1].commit);
  assert.equal(old.item.name, 'First');
  await store.restore(REPO, 'c1', versions[1].commit);
  assert.equal(fake.file(REPO, 'drills/c1.json').name, 'First');
});

test('saving without a token is refused, and the token never goes in a URL', async () => {
  const {fake, make} = await setup();
  const store = make();
  store.follow('sunset');
  await assert.rejects(store.save(REPO, drill('c1')), e => e.code === 'no-token');
  store.setToken(REPO, TOKEN);
  await store.save(REPO, drill('c1'));
  assert.ok(fake.log.every(entry => !JSON.stringify(entry).includes(TOKEN)));
});

test('“Restore from a file” takes a team file as a single drill', () => {
  const file = writeTeamDrill(drill('c1'));
  const items = drillsIn(JSON.parse(JSON.stringify(file)));
  assert.equal(items.length, 1);
  const {add, bad} = planImport(items, []);
  assert.equal(bad, 0);
  assert.equal(add[0].id, 'c1');
  assert.equal(add[0].body.name, 'Hex cuts');
});
