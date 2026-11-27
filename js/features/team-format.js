/* ---------- team repos: what git-store-kit is told about drills (no DOM) ----------
   Each team's drills are files drills/<id>.json in the team's GitHub repo (bremondr/ultimate-playbook-<team>), one
   drill per file, written by git-store-kit (js/vendor/git-store-kit/). This file is the playbook's side of it:
   - the file format: {type: 'ultimate-playbook-drill', version: 1, id, …serialize(drill), createdAt, updatedAt}.
     The marker is `type`, not `format`, because `format` is already a drill field (7 v 7 or 5 v 5);
   - reading a file: the type check, then readRaw, the same check shared links and backups get;
   - the commit messages, the team names in links (#team=sunset), and the team's label in the drill list.
   The DOM side (the list, the buttons, the panel) is js/features/team.js. Plain Node can test this file. */
import { readPlan, serializePlan } from '../model/plans.js';
import { readRaw, serialize } from '../storage.js';

export const FILE_TYPE = 'ultimate-playbook-drill';
export const OWNER = 'bremondr';
export const PREFIX = 'ultimate-playbook-';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const time = v => typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0;

/** The public demo team (demo drills and a demo plan), followed by default so a first visit has team drills to see.
    Its label is Demo. Removing it in Teams and tokens is remembered (git-store-kit's `defaults`). */
export const DEMO_REPO = `${OWNER}/${PREFIX}demo`;

/** #team=sunset → bremondr/ultimate-playbook-sunset. (#team=owner/repo names any other repo.) */
export const shortName = name => `${OWNER}/${PREFIX}${name}`;

/** The short name for a repo when there is one (bremondr/ultimate-playbook-sunset → sunset), else owner/repo. */
export function linkName(repo){
  const r = String(repo);
  return r.toLowerCase().startsWith(`${OWNER}/${PREFIX}`) ? r.slice(OWNER.length + 1 + PREFIX.length) : r;
}

/** The team's name in the drill list: Sunset for bremondr/ultimate-playbook-sunset, else the repo's own name. */
export function teamLabel(repo){
  const short = linkName(repo), name = short.includes('/') ? short.split('/')[1] : short;
  return name.split(/[-_]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ') || String(repo);
}

/** A team file's JSON → the drill ({…raw, id, createdAt, updatedAt}), or null when it isn't a drill file.
    The file was written by someone else, so every field goes through readRaw. */
export function readTeamDrill(json){
  if (!json || typeof json !== 'object' || json.type !== FILE_TYPE) return null;
  if (typeof json.version !== 'number' || json.version > 1) return null;   // a newer format than this app knows
  const raw = readRaw(json);
  if (!raw) return null;
  return {...raw, id: typeof json.id === 'string' && ID.test(json.id) ? json.id : null, createdAt: time(json.createdAt), updatedAt: time(json.updatedAt)};
}

/** A drill → the team file's JSON. git-store-kit writes it as indented JSON, so GitHub's history shows each change. */
export function writeTeamDrill(drill){
  return {type: FILE_TYPE, version: 1, id: drill.id, ...serialize({...drill, name: drill.name || 'Untitled drill'}),
    createdAt: time(drill.createdAt), updatedAt: time(drill.updatedAt)};
}

/** The commit message: the note typed when publishing, or a sentence saying what happened. */
export function commitMessage({op, name, note}){
  if (note) return note;
  const what = {add: 'Publish', update: 'Update', remove: 'Remove', copy: 'Publish a copy of', restore: 'Restore'}[op] || 'Update';
  return `${what} ${name || 'a drill'}`;
}

/** The options for createGitStore that say what a team repo holds. */
export function teamStoreOptions(extra = {}){
  return {
    app: 'ultimate-playbook', folder: 'drills', param: 'team', shortName,
    read: readTeamDrill, write: writeTeamDrill,
    id: d => d && d.id, name: d => d && d.name, setId: (d, id) => ({...d, id}),
    commitMessage, ...extra
  };
}

/* ---------- practice plans in a team repo (#53): plans/<id>.json, next to the drills ----------
   {type: 'ultimate-playbook-plan', version: 1, id, …serializePlan(plan), createdAt, updatedAt}. In the file, a plan's
   drills from the same team are "here:<drill id>" (the file doesn't depend on the repo's name); built-in drills are
   their names. Plans may only use the team's own drills and built-ins, so the team sees every drill a plan uses. */
export const PLAN_TYPE = 'ultimate-playbook-plan';

export function readTeamPlan(json){
  if (!json || typeof json !== 'object' || json.type !== PLAN_TYPE) return null;
  if (typeof json.version !== 'number' || json.version > 1) return null;
  const plan = readPlan(json);
  if (!plan) return null;
  return {...plan, id: typeof json.id === 'string' && ID.test(json.id) ? json.id : null, createdAt: time(json.createdAt), updatedAt: time(json.updatedAt)};
}
export function writeTeamPlan(plan){
  return {type: PLAN_TYPE, version: 1, id: plan.id, ...serializePlan(plan), createdAt: time(plan.createdAt), updatedAt: time(plan.updatedAt)};
}
/** The options for the second store, on the same repos, tokens and followed teams as the drills (the same `app`). */
export function planStoreOptions(extra = {}){
  return {...teamStoreOptions(extra), folder: 'plans', read: readTeamPlan, write: writeTeamPlan,
    commitMessage: m => commitMessage({...m, name: m.name || 'a practice plan'})};
}

/** A team plan as read → its drill references as library ids: here:<id> → team:<repo>:<id>. */
export function planRefsIn(plan, repo){
  return {...plan, items: plan.items.map(it => it.kind === 'drill' && it.drill.startsWith('here:') ? {...it, drill: `team:${repo}:${it.drill.slice(5)}`} : it)};
}
/** A plan about to be written to `repo`: library ids of that team's drills → here:<id>. `isBuiltin(id)` says which
    names are built-in drills. Returns {plan, saved: [ids saved only on this device], other: [ids from other teams]}:
    the caller publishes `saved` too, and refuses while `other` isn't empty. Missing drills stay as they are. */
export function planRefsOut(plan, repo, {isBuiltin, isSaved}){
  const saved = [], other = [], own = `team:${repo}:`;
  const items = plan.items.map(it => {
    if (it.kind !== 'drill') return it;
    if (it.drill.startsWith(own)) return {...it, drill: 'here:' + it.drill.slice(own.length)};
    if (it.drill.startsWith('here:') || isBuiltin(it.drill)) return it;
    if (it.drill.startsWith('team:')){ other.push(it.drill); return it; }
    if (isSaved(it.drill)){ if (!saved.includes(it.drill)) saved.push(it.drill); return {...it, drill: 'here:' + it.drill}; }
    return it;
  });
  return {plan: {...plan, items}, saved, other};
}
