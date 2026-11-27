/* ---------- practice plans: what a plan is (no DOM, so the unit tests run it in plain Node) ----------
   A plan is an ordered list of items, each with its minutes:
     {name, note, items: [item…], createdAt, updatedAt}
     item: {kind: 'drill', drill: <library entry id>, name: <the drill's name when added>, minutes, note}
         | {kind: 'block', title, minutes, note}            a warm-up, water break, scrimmage, talk…
   A drill item refers to a drill in the library by its entry id (a built-in's id, a saved drill's id, or a team
   drill's 'team:<repo>:<id>'); it doesn't copy it, so later edits show up. `name` is only shown when the drill is
   gone. Plans from other people (stored rows, files, links) go through readPlan, field by field. */
export const MAX_ITEMS = 40, MAX_MINUTES = 240, DEFAULT_MINUTES = 10;
export const BLOCK_TITLES = ['Warm-up', 'Water break', 'Scrimmage', 'Team talk', 'Cool-down'];

const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const minutesOf = v => typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(MAX_MINUTES, Math.round(v))) : DEFAULT_MINUTES;
const ID = /^[\w.:/-]{1,120}$/;

export function readItem(o){
  if (!o || typeof o !== 'object') return null;
  if (o.kind === 'drill' && typeof o.drill === 'string' && ID.test(o.drill))
    return {kind: 'drill', drill: o.drill, name: str(o.name, 80), minutes: minutesOf(o.minutes), note: str(o.note, 200)};
  if (o.kind === 'block'){ const title = str(o.title, 60).trim(); if (title) return {kind: 'block', title, minutes: minutesOf(o.minutes), note: str(o.note, 200)}; }
  return null;
}
// a plan as stored or received: every field checked, unknown ones dropped; null if it isn't a plan
export function readPlan(o){
  if (!o || typeof o !== 'object' || !Array.isArray(o.items)) return null;
  const num = v => typeof v === 'number' && isFinite(v) ? v : 0;
  return {name: str(o.name, 80).trim() || 'Untitled plan', note: str(o.note, 400),
    items: o.items.slice(0, MAX_ITEMS).map(readItem).filter(Boolean), createdAt: num(o.createdAt), updatedAt: num(o.updatedAt)};
}
// what is stored: the same shape, without anything else a draft may carry
export function serializePlan(p){
  const r = readPlan(p);
  return {name: r.name, note: r.note, items: r.items};
}

export const totalMinutes = p => p.items.reduce((a, it) => a + it.minutes, 0);
// when each item starts, in minutes from the start of practice
export function startTimes(p){ let t = 0; return p.items.map(it => { const s = t; t += it.minutes; return s; }); }
export const clock = min => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
export const minutesText = min => min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`;

/* Each item with what it points at now: {item, entry} for a drill found in the library, {item, missing: true} for one
   that's gone, {item} for a block. `entries` is the library (library.js libEntries). */
export function resolveItems(p, entries){
  const byId = new Map(entries.map(e => [e.id, e]));
  return p.items.map(item => item.kind !== 'drill' ? {item} : byId.has(item.drill) ? {item, entry: byId.get(item.drill)} : {item, missing: true});
}
export const itemTitle = (item, entry) => item.kind === 'block' ? item.title : entry ? entry.play.name : (item.name || 'Drill');

export function newPlan(name = 'New practice plan'){ return {name, note: '', items: []}; }
export function drillItem(entry, minutes = DEFAULT_MINUTES){ return {kind: 'drill', drill: entry.id, name: entry.play.name, minutes, note: ''}; }
export function blockItem(title, minutes = DEFAULT_MINUTES){ return {kind: 'block', title, minutes, note: ''}; }
// move an item from one place to another (used by drag and by Move up / Move down)
export function moveItem(p, from, to){
  if (from === to || from < 0 || to < 0 || from >= p.items.length || to >= p.items.length) return p;
  const items = p.items.slice(); const [it] = items.splice(from, 1); items.splice(to, 0, it);
  return {...p, items};
}
