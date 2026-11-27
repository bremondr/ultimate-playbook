/* ---------- the library: built-in drills plus the team's saved drills ---------- */
import { angelDrill } from './data/angel.js';
import { BUILTIN_TAGS, PLAYS } from './data/builtins.js';
import { timeDraft } from './model/timing.js';
import { r2 } from './util.js';

/* Built in. Put together the first time something asks for them, not while the modules load. */
let builtinList = null;
export function builtins(){
  if (!builtinList){
    const plays = PLAYS.map(p => ({...p, field:'full', format:7, players: p.players.map(q => {
      const r = {...q}; if (q.team === 'O') r.label = q.id;
      // defenders are drawn with arms out, so give them a little more room than the bare offsets
      if (q.offset) r.offset = q.offset.map(v => r2(v*1.45));
      return r; })}));
    // the angel drills are written like drawn drills and timed the same way; their own chips replace the automatic ones
    const angels = ['basic', 'break'].map(v => { const raw = angelDrill(v), play = timeDraft(raw); delete play.autoDurs; play.chips = raw.chips; return play; });
    builtinList = [...plays, ...angels];
  }
  return builtinList;
}

/* Saved drills, [{id, raw, play}], as storage.js loads them. Other modules read `team`; only these functions change it. */
export let team = [];
export function setTeam(list){ team = list; }
export function saveEntry(entry){ const i = team.findIndex(x => x.id === entry.id); if (i >= 0) team[i] = entry; else team.push(entry); }
export function dropEntry(id){ team = team.filter(x => x.id !== id); }

/* Drills from team repos (js/features/team.js), [{id, raw, play, repo, itemId, label, canWrite}], read-only here.
   `id` is 'team:<owner/repo>:<itemId>', so it never clashes with a saved drill's id (a published drill keeps its id). */
export let repoDrills = [];
export function setRepoDrills(list){ repoDrills = list; }

/* Every drill in the library. `tags` is each entry's tags: a built-in's from BUILTIN_TAGS, a drawn drill's from its play. */
export function libEntries(){
  return [...builtins().map(p => ({id:p.id, source:'builtin', play:p, tags: BUILTIN_TAGS[p.id] || []})),
    ...team.map(e => ({id:e.id, source:'team', play:e.play, raw:e.raw, tags: e.play.tags || []})),
    ...repoDrills.map(e => ({...e, source:'repo', tags: e.play.tags || []}))];
}

/* Practice plans, [{id, plan}] (model/plans.js), as storage.js loads them. Other modules read `plans`; only these
   functions change it. */
export let plans = [];
export function setPlans(list){ plans = list; }
export function savePlanEntry(entry){ const i = plans.findIndex(x => x.id === entry.id); if (i >= 0) plans[i] = entry; else plans.push(entry); }
export function dropPlanEntry(id){ plans = plans.filter(x => x.id !== id); }
