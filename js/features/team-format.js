/* ---------- team repos: what git-store-kit is told about drills (no DOM) ----------
   Each team's drills are files drills/<id>.json in the team's GitHub repo (bremondr/ultimate-playbook-<team>), one
   drill per file, written by git-store-kit (js/vendor/git-store-kit/). This file is the playbook's side of it:
   - the file format: {type: 'ultimate-playbook-drill', version: 1, id, …serialize(drill), createdAt, updatedAt}.
     The marker is `type`, not `format`, because `format` is already a drill field (7 v 7 or 5 v 5);
   - reading a file: the type check, then readRaw, the same check shared links and backups get;
   - the commit messages, the team names in links (#team=sunset), and the team's label in the drill list.
   The DOM side (the list, the buttons, the panel) is js/features/team.js. Plain Node can test this file. */
import { readRaw, serialize } from '../storage.js';

export const FILE_TYPE = 'ultimate-playbook-drill';
export const OWNER = 'bremondr';
export const PREFIX = 'ultimate-playbook-';
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const time = v => typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0;

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
