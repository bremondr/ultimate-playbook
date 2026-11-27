/* ---------- team repos: each team's drills in its own GitHub repo, published from the app ----------
   git-store-kit (js/vendor/git-store-kit/, a copy of a release from bremondr/web-kit) keeps the drills as files
   drills/<id>.json, one commit per change, reads them through GitHub's API, keeps the last good copy on the device,
   and has the panel for tokens, conflicts and history. team-format.js says what a drill file is. This file:
   - follows a team from a link (#team=sunset, or #team=owner/repo) and loads every followed team at start;
   - puts team drills in the drill list, read-only, tagged with the team's name (library.js, repoDrills);
   - says under the list when each team was last checked, or why it couldn't be loaded, with "Add a token";
   - in the share popover: Publish to team (a saved drill), History and Remove from team (a team drill), team links;
   - opens the panel from the drawer and the options popover.
   Not when the page runs as a Claude artifact: that has its own team store (storage.js).
   Trying it without GitHub: on a local server or a preview, add ?fakegithub to the address. The teams then come from
   a GitHub in memory (fake-github.js) with two teams, sunset and tuesday, and a token shown in the drawer. */
import { emit } from '../events.js';
import { builtins, repoDrills, repoPlans, setRepoDrills, setRepoPlans, team } from '../library.js';
import { timeDraft } from '../model/timing.js';
import { closePops, openDrawer } from '../nav.js';
import { current, showReadOnly } from '../player.js';
import { appLink } from '../share.js';
import { $, clone } from '../util.js';
import { createPanel } from '../vendor/git-store-kit/panel.js';
import { createGitStore, tokenNeed } from '../vendor/git-store-kit/store.js';
import { indexedCache } from '../vendor/git-store-kit/cache.js';
import { hashValue, hashWithout } from '../vendor/git-store-kit/sources.js';
import { linkName, planRefsIn, planRefsOut, planStoreOptions, shortName, teamLabel, teamStoreOptions, writeTeamDrill, writeTeamPlan } from './team-format.js';

const artifact = !!(window.claude && typeof window.claude.use === 'function');
const preview = !!window.PLAYBOOK_PREVIEW;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const fakeMode = (local || preview) && new URLSearchParams(location.search).has('fakegithub');
const FAKE_TOKEN = 'github_pat_FAKE_' + 'x'.repeat(30);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

let store = null, panel = null, justFollowed = null;
// practice plans (#53): a second store on the same repos (plans/<id>.json), with the same followed teams and tokens
let planStore = null, planPanel = null;

/* ---------- start ---------- */
async function start(){
  let extra = {};
  if (fakeMode){
    // a separate app name, so the fake teams never mix with the real ones in this browser's storage and saved copies
    extra = {app: 'ultimate-playbook-fake', fetch: (await fakeGitHub()).fetch};
    const note = $('#teams-fake');
    note.hidden = false;
    note.textContent = `Fake GitHub, for trying: teams “sunset” and “tuesday”. To publish, paste this token for a team in Teams and tokens: ${FAKE_TOKEN}`;
  }
  store = createGitStore(teamStoreOptions(extra));
  panel = createPanel(store, {title: preview ? 'Teams (preview)' : 'Teams', noun: 'drill', sourceLabel: 'team'});
  store.subscribe(changed);
  // the plans' saved copies under their own keys, so the two stores never overwrite each other's cache of a repo
  const base = extra.cache || indexedCache(), plansCache = {get: k => base.get('plans|' + k), set: (k, v) => base.set('plans|' + k, v), delete: k => base.delete('plans|' + k)};
  planStore = createGitStore(planStoreOptions({...extra, cache: plansCache}));
  planPanel = createPanel(planStore, {title: 'Team plans', noun: 'plan', sourceLabel: 'team'});
  planStore.subscribe(plansChanged);
  followLink();
  addEventListener('hashchange', followLink);
  ['#teams', '#opts-teams', '#share-team'].forEach(s => { $(s).hidden = s === '#share-team'; });
  $('#teams-preview').hidden = $('#team-share-preview').hidden = !preview;
  changed(store.sources());
  store.load(); planStore.load();
  // look again when the device comes back online, or the app comes back after a while
  addEventListener('online', () => { store.load(); planStore.load(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && store.sources().some(s => Date.now() - s.loadedAt > 10 * 60e3)){ store.load(); planStore.load(); }
  });
}

// #team=sunset: follow that team, and take it out of the address so the drill part still works
function followLink(){
  const hash = location.hash;
  if (hashValue(hash, 'team') == null) return;
  const before = new Set(store.following().map(r => r.toLowerCase()));
  const repo = store.followFromHash(hash);
  const rest = hashWithout(hash, 'team');
  history.replaceState(null, '', location.pathname + location.search + (rest && rest !== '#' ? rest : ''));
  if (!repo) return;
  if (!before.has(repo.toLowerCase())) justFollowed = repo;
  store.load(repo); if (planStore) planStore.load(repo);
}

/* ---------- the team drills in the list ---------- */
const timed = new Map();   // 'repo:id:sha' → the timed play, so a reload doesn't time every drill again
function entriesOf(sources){
  const seen = new Set(), list = [];
  for (const s of sources) for (const i of s.items){
    const id = `team:${s.repo}:${i.id}`, key = `${id}:${i.sha}`;
    seen.add(key);
    if (!timed.has(key)) timed.set(key, {...timeDraft({...i.item, id}), id});
    list.push({id, itemId: i.id, sha: i.sha, repo: s.repo, label: teamLabel(s.repo), canWrite: s.canWrite, raw: i.item, play: timed.get(key)});
  }
  for (const k of timed.keys()) if (!seen.has(k)) timed.delete(k);
  return list.sort((a, b) => a.label.localeCompare(b.label) || (a.raw.createdAt - b.raw.createdAt) || a.play.name.localeCompare(b.play.name));
}

function changed(sources){
  const next = entriesOf(sources);
  const key = list => JSON.stringify(list.map(e => [e.id, e.sha, e.canWrite]));
  if (key(next) !== key(repoDrills)){ setRepoDrills(next); emit('team-loaded'); }
  renderLines(sources);
  if (!$('#share-pop').hidden) renderShare();
  if (justFollowed){
    const s = sources.find(x => x.repo === justFollowed);
    if (s && !s.loading && (s.loadedAt || s.error)){ justFollowed = null; openDrawer(true); $(`#team-lines [data-repo="${CSS.escape(s.repo)}"]`)?.scrollIntoView({block: 'nearest'}); }
  }
}

/* ---------- under the list: each team's state ---------- */
function ago(t){
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(t).toLocaleDateString();
}
function lineText(s){
  const name = teamLabel(s.repo);
  if (s.loading && !s.loadedAt) return `${name}: loading…`;
  const need = tokenNeed(s, {label: 'team'});
  if (s.error) return `${name}: ${need ? need.reason : s.error.message}${s.stale ? ` Showing the copy on this device, from ${ago(s.loadedAt)}.` : ''}`;
  return `${name}: ${plural(s.items.length, 'drill')}, checked ${ago(s.loadedAt)}${s.canWrite ? ' · you can publish' : ''}.`;
}
function renderLines(sources = store.sources()){
  const ul = $('#team-lines');
  ul.replaceChildren(...sources.map(s => {
    const li = document.createElement('li'), p = document.createElement('p');
    li.dataset.repo = s.repo;
    p.className = 'small' + (s.error ? ' warn' : '');
    p.textContent = lineText(s);
    li.append(p);
    const need = tokenNeed(s, {label: 'team'});
    if (need){
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'link';
      b.textContent = need.action === 'replace' ? 'Replace the token' : 'Add a token';
      b.addEventListener('click', () => panel.open({token: s.repo}));
      li.append(b);
    }
    return li;
  }));
  if (!sources.length){
    const li = document.createElement('li'), p = document.createElement('p');
    p.className = 'small'; p.textContent = 'No teams yet. Open a team’s link (it ends in #team=…) to see its drills here.';
    li.append(p); ul.append(li);
  }
}

/* ---------- in the share popover ---------- */
const say = t => { $('#team-share-status').textContent = t; };
const writable = () => store.sources().filter(s => s.canWrite);
let removeArmed = null;
function armRemove(on){
  clearTimeout(removeArmed); removeArmed = null;
  $('#team-remove').textContent = on ? 'Tap again to remove it for the team' : 'Remove from team';
  if (on) removeArmed = setTimeout(() => armRemove(false), 4000);
}

function renderShare(){
  const sources = store.sources(), box = $('#share-team');
  box.hidden = !sources.length || !current;
  if (box.hidden) return;
  // a saved drill: Publish to team
  const mine = current.source === 'team' && team.find(x => x.id === current.id), can = writable();
  $('#team-publish').hidden = !mine;
  if (mine){
    const published = can.filter(s => s.items.some(i => i.id === mine.id));
    $('#team-publish-what').textContent = !can.length
      ? 'To publish this drill for a team, add a token for the team in Teams and tokens.'
      : published.length ? `Published in ${published.map(s => teamLabel(s.repo)).join(', ')}. Publish again to replace the team’s copy.`
      : 'Publish this drill so everyone in the team sees it. It stays yours: change it here and publish again.';
    const pick = $('#team-pick'), was = pick.value;
    pick.replaceChildren(...can.map(s => new Option(teamLabel(s.repo), s.repo)));
    if (can.some(s => s.repo === was)) pick.value = was;
    pick.hidden = $('#team-pick-l').hidden = can.length < 2;
    $('#team-note').hidden = $('#team-publish-go').hidden = !can.length;
  }
  // a team drill: History, Remove from team
  const e = current.source === 'repo' && repoDrills.find(x => x.id === current.id);
  $('#team-drill').hidden = !e;
  if (e){
    $('#team-drill-what').textContent = `A ${teamLabel(e.repo)} drill, from ${e.repo}.` + (e.canWrite ? ' To change it, tap Edit, save, and publish it again.' : '');
    $('#team-remove').hidden = !e.canWrite;
  }
  // a link to each team, with its QR code
  $('#team-links').replaceChildren(...sources.map(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ghost';
    b.textContent = `Link to the ${teamLabel(s.repo)} team`;
    b.addEventListener('click', () => showTeamLink(s.repo));
    return b;
  }));
}
// the share popover's link (and its QR code, js/features/qr.js) becomes the team's link
function showTeamLink(repo){
  const url = appLink('team=' + linkName(repo));
  $('#share-link').value = url;
  $('#share-what').textContent = `Anyone who opens this link sees the ${teamLabel(repo)} team’s drills in their list, also offline.`;
  $('#share-status').textContent = '';
  document.dispatchEvent(new CustomEvent('playbook:share-link', {detail: {url}}));
}

async function publish(){
  const mine = current && current.source === 'team' && team.find(x => x.id === current.id);
  const repo = $('#team-pick').value || (writable()[0] || {}).repo;
  if (!mine || !repo) return;
  const now = Date.now();
  const drill = {...clone(mine.raw), id: mine.id, createdAt: mine.raw.createdAt || now, updatedAt: now};
  const btn = $('#team-publish-go'), name = teamLabel(repo);
  btn.disabled = true; say(`Publishing to ${name}…`);
  try {
    const r = await panel.save(repo, drill, {note: $('#team-note').value});
    if (!r) say('Not published.');
    else if (r.kept === 'theirs') say(`Kept the version that is on GitHub; yours wasn’t published.`);
    else { $('#team-note').value = ''; say(r.kept === 'copy' ? `Published to ${name} as a copy.` : `Published to ${name}.`); }
  } catch (err){ say(err && err.code ? err.message : `Couldn’t publish to ${name}.`); }
  finally { btn.disabled = false; renderShare(); }
}

async function removeFromTeam(){
  const e = current && current.source === 'repo' && repoDrills.find(x => x.id === current.id);
  if (!e) return;
  if (!removeArmed){ armRemove(true); return; }
  armRemove(false);
  say(`Removing from ${teamLabel(e.repo)}…`);
  try {
    const r = await panel.remove(e.repo, e.itemId);
    if (!r) say('Not removed.');
    else if (r.kept === 'theirs') say('Kept it: it was changed on GitHub meanwhile.');
    else { say(''); closePops(); }   // the list loses the drill, and the player moves on (followStore)
  } catch (err){ say(err && err.code ? err.message : 'Couldn’t remove it.'); }
}

function showHistory(){
  const e = current && current.source === 'repo' && repoDrills.find(x => x.id === current.id);
  if (!e) return;
  const label = teamLabel(e.repo);
  panel.showHistory(e.repo, e.itemId, {name: e.play.name, onOpen: ({item, date}) => {
    closePops();
    showReadOnly(item, `${label} · version of ${date ? new Date(date).toLocaleString() : 'an earlier day'}`);
  }});
}

/* ---------- practice plans in team repos (#53) ---------- */
function plansChanged(sources){
  const next = [];
  // a team whose repo has no plans folder yet just has no plans (the drills store reports the team's state)
  for (const s of sources) for (const i of s.items){
    next.push({id: `team:${s.repo}:${i.id}`, itemId: i.id, sha: i.sha, repo: s.repo, label: teamLabel(s.repo), canWrite: !!s.canWrite || !!(store && store.sources().find(x => x.repo === s.repo)?.canWrite), plan: planRefsIn(i.item, s.repo)});
  }
  next.sort((a, b) => a.label.localeCompare(b.label) || (a.plan.createdAt - b.plan.createdAt) || a.plan.name.localeCompare(b.plan.name));
  const key = list => JSON.stringify(list.map(e => [e.id, e.sha, e.canWrite]));
  if (key(next) !== key(repoPlans)){ setRepoPlans(next); emit('plans-changed'); }
}
/** The followed teams, [{repo, label, canWrite}]: canWrite when this device has a token that can publish (the drills
    store knows; the plans use the same token). */
export const teamsFollowed = () => store ? store.sources().map(s => ({repo: s.repo, label: teamLabel(s.repo), canWrite: !!s.canWrite})) : [];
export const teamsToPublish = () => teamsFollowed().filter(t => t.canWrite);
/** Teams and tokens, open at a team's token form. */
export function openTeamToken(repo){ if (panel) panel.open({token: repo}); }

/** Publish a practice plan to a team: its drills saved only on this device go along (as team drills), so the team
    sees every drill it uses. Drills from another team stop it. `id` keeps a plan's id (a team plan saved again).
    Resolves to {ok: true, kept} or {ok: false, message}. */
export async function publishPlan(repo, plan, {id, note = ''} = {}){
  if (!planStore) return {ok: false, message: 'Team repos aren’t available here.'};
  const builtinIds = new Set(builtins().map(b => b.id));
  const out = planRefsOut(plan, repo, {isBuiltin: x => builtinIds.has(x), isSaved: x => team.some(e => e.id === x)});
  if (out.other.length){
    const names = out.other.map(x => repoDrills.find(e => e.id === x)?.play.name || x);
    return {ok: false, message: `This plan uses drills from another team (${names.join(', ')}). A team plan can only use the team’s own drills and built-ins.`};
  }
  // the drills saved only here, published first (each keeps its id, so the plan's here:<id> finds it)
  for (const did of out.saved){
    const mine = team.find(e => e.id === did), now = Date.now();
    const r = await panel.save(repo, {...clone(mine.raw), id: did, createdAt: mine.raw.createdAt || now, updatedAt: now}, {note: `Publish ${mine.raw.name || 'a drill'} for a practice plan`});
    if (!r || r.kept === 'theirs') return {ok: false, message: `${mine.raw.name || 'A drill'} wasn’t published, so the plan wasn’t either.`};
  }
  const now = Date.now(), pid = id || ('p' + now.toString(36) + Math.random().toString(36).slice(2, 6));
  const r = await planPanel.save(repo, {...out.plan, id: pid, createdAt: plan.createdAt || now, updatedAt: now}, {note});
  if (!r) return {ok: false, message: 'Not published.'};
  if (r.kept === 'theirs') return {ok: false, message: 'Kept the version that is on GitHub; yours wasn’t published.'};
  return {ok: true, kept: r.kept, id: `team:${repo}:${pid}`, published: out.saved.length};
}
export async function removeTeamPlan(e){
  const r = await planPanel.remove(e.repo, e.itemId);
  return !!r && r.kept !== 'theirs';
}
export function teamPlanHistory(e, onOpen){
  planPanel.showHistory(e.repo, e.itemId, {name: e.plan.name, onOpen: ({item, date}) => onOpen(planRefsIn(item, e.repo), date)});
}
/* ---------- a GitHub in memory, to try the feature without a real team repo ---------- */
async function fakeGitHub(){
  const [{createFakeGitHub}, {angelDrill}] = await Promise.all([
    import('../vendor/git-store-kit/fake-github.js'), import('../data/angel.js')]);
  const fake = createFakeGitHub();
  const file = (id, d) => writeTeamDrill({...d, id, createdAt: Date.now() - 864e5, updatedAt: Date.now() - 864e5});
  await fake.addRepo(shortName('sunset'), {files: {
    'drills/sunset-angel.json': file('sunset-angel', {...angelDrill('basic'), name: 'Angel drill, Sunset style'}),
    'drills/sunset-break.json': file('sunset-break', {...angelDrill('break'), name: 'Angel with a fake'}),
    'drills/README.md': 'Sunset’s drills, one file per drill.',
    'plans/sunset-tuesday.json': writeTeamPlan({id: 'sunset-tuesday', name: 'Sunset Tuesday', note: 'Breaks and resets', createdAt: Date.now() - 864e5, updatedAt: Date.now() - 864e5,
      items: [{kind: 'block', title: 'Warm-up', minutes: 15, note: ''}, {kind: 'drill', drill: 'here:sunset-angel', name: 'Angel drill, Sunset style', minutes: 20, note: 'Bend it'},
        {kind: 'drill', drill: 'angel-cutback', name: 'Angel drill: fake & cut back', minutes: 15, note: ''}, {kind: 'block', title: 'Scrimmage', minutes: 30, note: ''}]})
  }});
  await fake.addRepo(shortName('tuesday'), {files: {'drills/tuesday-angel.json': file('tuesday-angel', {...angelDrill('basic'), name: 'Tuesday angel'})}});
  for (const team of ['sunset', 'tuesday']) fake.addToken(FAKE_TOKEN, shortName(team), 'write');
  window.PLAYBOOK_FAKE_GITHUB = fake;   // for the regression check and for trying conflicts by hand (fake.edit)
  return fake;
}

/* ---------- wiring ---------- */
if (!artifact){
  $('#teams-open').addEventListener('click', () => panel && panel.open());
  $('#opts-teams').addEventListener('click', () => { closePops(); if (panel) panel.open(); });
  $('#team-publish-go').addEventListener('click', publish);
  $('#team-remove').addEventListener('click', removeFromTeam);
  $('#team-history').addEventListener('click', showHistory);
  $('#share').addEventListener('click', () => { say(''); armRemove(false); if (store) renderShare(); });
  $('#menu').addEventListener('click', () => { if (store) renderLines(); });
  start().catch(err => { console.warn('Team repos are off:', err); });
}
