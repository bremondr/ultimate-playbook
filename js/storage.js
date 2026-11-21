/* ---------- storage: shared team store, or this browser ---------- */
import { fieldOf } from './data/fields.js';
import { emit } from './events.js';
import { setTeam, team } from './library.js';
import { FACES } from './model/facing.js';
import { FORCES } from './model/formation.js';
import { curveOf, GRIPS, THROW_TYPES, typeOf } from './model/throws.js';
import { timeDraft } from './model/timing.js';
import { $, clamp, r2 } from './util.js';

/* Store state. Other modules read these; only this module changes them. */
export let storeMode = 'pending';   // 'pending' until we know, then 'db' (the team store of a Claude artifact) or 'local'
export let canWrite = null;         // null = unknown, keep the controls
let dbApi = null;
export function serialize(d){
  return {
    name: d.name.slice(0,80), kind: d.kind, summary: (d.summary||'').slice(0,400), disc: d.disc || null,
    field: d.field === 'small' ? 'small' : 'full', format: d.format === 5 ? 5 : 7, force: FORCES[d.force] ? d.force : 'right',
    players: d.players.map(p => { const r = {id:p.id, team:p.team};
      if (p.label) r.label = p.label; if (p.at) r.at = [r2(p.at[0]), r2(p.at[1])];
      if (p.follow){ r.follow = p.follow; r.offset = [r2(p.offset[0]), r2(p.offset[1])]; r.lag = p.lag ?? .35; }
      if (p.team === 'D' && p.face && p.face !== 'auto') r.face = p.face;
      if (p.team === 'D' && p.face === 'angle') r.angle = Math.round(p.angle || 0);
      if (p.team === 'D' && p.mark) r.mark = {mode:p.mark.mode, order:(p.mark.order || []).slice(0, 20), force:p.mark.force || 'right'};
      return r; }),
    steps: d.steps.map(st => ({title:(st.title||'').slice(0,60), note:(st.note||'').slice(0,400), dur: typeof st.dur === 'number' ? st.dur : null,
      moves: Object.fromEntries(Object.entries(st.moves).map(([id, m]) => [id, {path: m.path.flat().map(r2)}])),
      throw: st.throw ? Object.assign({from:st.throw.from, to:st.throw.to, type:typeOf(st.throw), curve:curveOf(st.throw)}, st.throw.fake ? {fake:st.throw.fake} : {}, GRIPS[st.throw.grip] ? {grip:st.throw.grip} : {}) : null}))
  };
}
// Rows are written by other viewers: rebuild them field by field, never trust the shape.
export function readRaw(o){
  if (!o || typeof o !== 'object') return null;
  const num = v => typeof v === 'number' && isFinite(v);
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  const Fr = fieldOf(o.field === 'small' ? 'small' : 'full');
  const pt = a => Array.isArray(a) && num(a[0]) && num(a[1]) ? [clamp(a[0],0,Fr.L), clamp(a[1],0,Fr.W)] : null;
  const players = (Array.isArray(o.players) ? o.players : []).slice(0, 80).map(p => {
    if (!p || typeof p.id !== 'string' || !/^[\w.-]{1,24}$/.test(p.id) || !['O','D','cone'].includes(p.team)) return null;
    const r = {id:p.id, team:p.team, at:pt(p.at)};
    if (p.team === 'O') r.label = str(p.label, 3) || '?';
    if (p.team === 'D' && typeof p.follow === 'string' && Array.isArray(p.offset) && num(p.offset[0]) && num(p.offset[1])){
      r.follow = p.follow; r.offset = [clamp(p.offset[0],-20,20), clamp(p.offset[1],-20,20)]; r.lag = num(p.lag) ? clamp(p.lag,0,2) : .35; }
    if (p.team === 'D' && FACES.includes(p.face) && p.face !== 'auto') r.face = p.face;
    if (r.face === 'angle') r.angle = num(p.angle) ? ((Math.round(p.angle) % 360) + 360) % 360 : 180;
    if (p.team === 'D' && p.mark && typeof p.mark === 'object' && !r.follow){
      const mode = ['disc','handler'].includes(p.mark.mode) ? p.mark.mode : 'row', order = Array.isArray(p.mark.order) ? p.mark.order.filter(x => typeof x === 'string' && /^[\w.-]{1,24}$/.test(x)).slice(0, 20) : [];
      r.mark = {mode, order, force: FORCES[p.mark.force] ? p.mark.force : 'right'};
    }
    return r;
  }).filter(Boolean);
  const ids = new Set(players.map(p => p.id)), oIds = new Set(players.filter(p => p.team === 'O').map(p => p.id));
  players.forEach(p => {
    if (p.follow && !(oIds.has(p.follow) && players.find(q => q.id === p.follow).at)){ delete p.follow; delete p.offset; delete p.lag; }
    if (p.mark){ p.mark.order = p.mark.order.filter(x => oIds.has(x)); if (p.mark.mode !== 'disc' && !p.mark.order.length) delete p.mark; }
    if (!p.at && !p.follow && !p.mark) p.at = [Fr.L/2, Fr.W/2];
  });
  const steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, 30).map(st => {
    if (!st || typeof st !== 'object') return null;
    const moves = {};
    if (st.moves && typeof st.moves === 'object') for (const [id, m] of Object.entries(st.moves)){
      if (!ids.has(id) || !m || !Array.isArray(m.path)) continue;
      const flat = m.path, path = [];
      if (Array.isArray(flat[0])) flat.forEach(q => { const v = pt(q); if (v) path.push(v); });
      else for (let k = 0; k + 1 < flat.length; k += 2){ const v = pt([flat[k], flat[k+1]]); if (v) path.push(v); }
      if (path.length) moves[id] = {path: path.slice(0, 12)};
    }
    let th = null;
    if (st.throw && oIds.has(st.throw.from) && oIds.has(st.throw.to) && st.throw.from !== st.throw.to) { th = {from:st.throw.from, to:st.throw.to, curve: num(st.throw.curve) ? clamp(st.throw.curve,-.4,.4) : 0};
      if (THROW_TYPES.includes(st.throw.type)) th.type = st.throw.type;
      if (st.throw.fake === 'up' || st.throw.fake === 'mirror') th.fake = st.throw.fake;
      if (typeof st.throw.grip === 'string' && GRIPS[st.throw.grip]) th.grip = st.throw.grip;
      else if (th.type === 'over') th.grip = 'hammer'; }
    return {title:str(st.title,60), note:str(st.note,400), dur: num(st.dur) && st.dur >= 1 ? Math.min(20, st.dur) : null, moves, throw:th};
  }).filter(Boolean);
  if (!steps.length) return null;
  return {name: str(o.name,80) || 'Untitled drill', kind: o.kind === 'Play' ? 'Play' : 'Drill', summary: str(o.summary,400),
    field: o.field === 'small' ? 'small' : 'full', format: o.format === 5 ? 5 : 7, force: FORCES[o.force] ? o.force : 'right',
    disc: oIds.has(o.disc) ? o.disc : null, players, steps, createdAt: num(o.createdAt) ? o.createdAt : 0};
}
// a library entry from a stored drill
export function entryFrom(id, data){
  const raw = readRaw(data); if (!raw) return null;
  return {id, raw, play: {...timeDraft({...raw, id}), id}};
}
const LOCAL_KEY = 'ub-team-drills';
function localRead(){ try { const o = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch(e){ return {}; } }
function localWrite(o){ try { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); return true; } catch(e){ return false; } }
export async function saveDrill(id, body){
  if (storeMode === 'db') return dbApi.collection('drills').doc(id).set(body);
  const all = localRead(); all[id] = body; if (!localWrite(all)) throw {code:'local'};
}
export async function removeDrill(id){
  if (storeMode === 'db') return dbApi.collection('drills').doc(id).delete();
  const all = localRead(); delete all[id]; localWrite(all);
}
// the status line under the drill list belongs to the store
function setSync(t){ $('#sync').textContent = t; }
function localMode(){
  storeMode = 'local';
  const all = localRead();
  setTeam(Object.entries(all).map(([id, b]) => entryFrom(id, b)).filter(Boolean).sort((a, b) => a.raw.createdAt - b.raw.createdAt));
  setSync('Drills you draw are saved in this browser only.');
  emit('store-loaded');
}
export async function initStore(){
  const c = window.claude;
  if (!c || typeof c.use !== 'function'){ localMode(); return; }
  setSync('Loading team drills…');
  let db = null, user = null;
  try { [db, user] = await Promise.all([c.use('db'), c.use('user')]); } catch(e){}
  if (user){ try { const v = await user.can('data.write'); if (v === false) canWrite = false; else if (v === true) canWrite = true; } catch(e){} }
  if (!db){ localMode(); emit('access-changed'); return; }
  dbApi = db; storeMode = 'db'; emit('access-changed');
  let timer = setTimeout(() => setSync('Can’t reach the saved team drills yet.'), 10000);
  db.collection('drills').orderBy('createdAt').onSnapshot(snap => {
    if (!snap.metadata.fromCache && timer){ clearTimeout(timer); timer = null; }
    setTeam(snap.docs.map(d => entryFrom(d.id, d.data())).filter(Boolean));
    setSync(team.length ? `${team.length} team drill${team.length > 1 ? 's' : ''}, shared with everyone who opens this page.`
      : canWrite === false ? 'No team drills yet.' : 'No team drills yet. Draw one and it’s shared with everyone who opens this page.');
    emit('store-loaded');
  }, () => { if (timer){ clearTimeout(timer); timer = null; } setSync('Saved team drills are unavailable right now.'); });
}

export function errText(err){
  const c = err && err.code;
  if (c === 'invalid_argument'){ canWrite = false; emit('access-changed'); return 'You can view drills here but not save them. Ask the owner for Contributor access.'; }
  if (c === 'quota_exceeded') return 'The drill store is full. Delete a few old drills and try again.';
  if (c === 'resource_exhausted') return 'Too many saves at once. Wait a moment and try again.';
  return 'Couldn’t save right now. Check your connection and try again.';
}
