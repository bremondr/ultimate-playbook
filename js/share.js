/* ---------- sharing by link: the whole drill travels in the link, no server needed ----------
   Built-in drills link by name (#angel). Drawn drills are packed: JSON, deflated, base64url, after #d=.
   Links always point at the public site, so they open anywhere. The share popover itself is in nav.js. */
import { readPlan, serializePlan } from './model/plans.js';
import { readRaw, serialize } from './storage.js';

const SHARE_BASE = 'https://bremondr.github.io/ultimate-playbook/';
const shareBase = () => location.hostname.endsWith('github.io') ? location.origin + location.pathname : SHARE_BASE;
function b64uEncode(bytes){ let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uDecode(t){ const b = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function packDrill(body){
  const json = new TextEncoder().encode(JSON.stringify(body));
  if (typeof CompressionStream === 'function'){
    const out = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return 'z' + b64uEncode(new Uint8Array(out));
  }
  return 'j' + b64uEncode(json);
}
async function unpackDrill(t){
  let bytes = b64uDecode(t.slice(1));
  if (t[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const appLink = hash => shareBase() + '#' + hash;
export const builtinLink = id => appLink(id);
export async function drillLink(raw){
  const body = serialize({...raw, name: raw.name || 'Untitled drill'});
  return shareBase() + '#d=' + await packDrill(body);
}
// the drill in a #d= link, checked field by field like any stored drill; throws if the link is damaged
export async function readShared(packed){
  const raw = readRaw(await unpackDrill(packed));
  if (!raw) throw new Error('empty');
  return raw;
}

/* A whole practice plan in one link (#plan=…): the plan, with copies of its drawn drills (saved here or from a team),
   so the link works on its own. Built-in drills stay as their names. In the link, a drawn drill's item points at
   "d1", "d2"… in `drills`. `entries` is the library (library.js libEntries). A drill that is gone stays as it is
   and shows as missing on the other side. */
export function planBody(plan, entries){
  const byId = new Map(entries.map(e => [e.id, e])), drills = {}, keys = new Map();
  const items = serializePlan(plan).items.map(it => {
    const e = it.kind === 'drill' && byId.get(it.drill);
    if (!e || e.source === 'builtin' || !e.raw) return it;
    if (!keys.has(e.id)){ const k = 'd' + (keys.size + 1); keys.set(e.id, k); drills[k] = serialize({...e.raw, name: e.raw.name || 'Untitled drill'}); }
    return {...it, drill: keys.get(e.id)};
  });
  return {plan: {...serializePlan(plan), items}, drills};
}
export async function planLink(plan, entries){ return shareBase() + '#plan=' + await packDrill(planBody(plan, entries)); }
// the plan in a #plan= link: {plan, drills: {d1: raw, …}}, each checked like any stored plan or drill; throws if damaged
export function readPlanBody(data){
  const plan = readPlan(data && data.plan);
  if (!plan) throw new Error('empty');
  const drills = {};
  for (const [k, v] of Object.entries((data && data.drills) || {})) if (/^d\d{1,3}$/.test(k)){ const raw = readRaw(v); if (raw) drills[k] = raw; }
  return {plan, drills};
}
export async function readSharedPlan(packed){ return readPlanBody(await unpackDrill(packed)); }

/* A playback time carried after the drill in a link, so a link can open a drill at a given moment (Send feedback
   uses it): `#angel&t=2.8` or `#d=…&t=2.8`. splitTime reads it back from the part after #. */
export const withTime = (link, t) => `${link}&t=${Math.round(t * 100) / 100}`;
export function splitTime(hash){
  const [id, ...opts] = String(hash || '').split('&');
  const m = opts.map(o => /^t=(\d+(?:\.\d+)?)$/.exec(o)).find(Boolean);
  return {id, t: m ? +m[1] : null};
}
