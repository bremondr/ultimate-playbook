/* ---------- viewer ---------- */
import { fieldOf } from './data/fields.js';
import { emit } from './events.js';
import { builtins, libEntries, saveEntry, team } from './library.js';
import { compile } from './model/compile.js';
import { copyOfBuiltin, copyOfEntry, draftOfSaved, draftOfTeam } from './model/drafts.js';
import { bez, discAt, facingDef, hand, pos, sparesAt, stepAt } from './model/motion.js';
import { throwText } from './model/throws.js';
import { timeDraft } from './model/timing.js';
import { drawFake, drawThrow, faceAngle, makeCone, makePlayer, placeDisc, placeSpares } from './render/pieces.js';
import { drawPitch } from './render/pitch.js';
import { dPath, el, M, svg } from './render/svg.js';
import { mode, orient, setField, setOrient } from './render/view.js';
import { readShared, splitTime } from './share.js';
import { canWrite, entryFrom, errText, saveDrill, serialize, storeMode } from './storage.js';
import { $, f2, newDocId, screenOrient } from './util.js';

/* Player state. Other modules read these; only this module changes them. */
export let current = null;     // what is on screen: {source:'builtin'|'team'|'repo'|'preview'|'shared', id}
export let model;              // the compiled drill on screen
export let playing = false;
export let sharedRaw = null;   // a drill opened from a #d= link, until it is saved
let pendingId = null;          // a saved or team drill the link asked for before it had loaded
let t = 0, speed = 1, lastStep = -1, playerEls = {}, endHold = 0, stepEls = [];
// last drawn facing of each defender, so a defender standing still keeps looking the same way
const angles = {};

function buildPieces(){
  const gc = $('#g-cones'), gp = $('#g-players'); gc.replaceChildren(); gp.replaceChildren(); $('#g-handles').replaceChildren(); playerEls = {};
  model.play.players.forEach(p => {
    if (p.team === 'cone'){ makeCone(p, p.at, gc); return; }
    playerEls[p.id] = makePlayer(p, gp);
  });
  lastStep = -1;
}
function drawArrows(i){
  const g = $('#g-paths'); g.replaceChildren();
  if (!$('#t-arrows').checked) return;
  // a step can hide its runs (a return to the line, say); its throw and fake are still drawn
  const runs = model.play.steps[i].arrows !== false;
  if (runs) Object.values(model.P).forEach(p => p.segs.forEach(s => {
    if (s.step !== i) return;
    const pts = s.pts.slice();
    const a = pts[pts.length-2], b = pts[pts.length-1], dl = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, cut = Math.min(1.5, dl*.4);
    pts[pts.length-1] = [b[0]-(b[0]-a[0])/dl*cut, b[1]-(b[1]-a[1])/dl*cut];
    const isD = p.def.team === 'D';
    el('path',{d:dPath(pts),fill:'none',stroke:isD?'var(--def)':'var(--off)','stroke-width':.3,'stroke-dasharray':'.9 .55','stroke-linejoin':'round','marker-end':isD?'url(#ah-d)':'url(#ah-o)',opacity:.95,class:isD?'dteam':undefined},g);
  }));
  model.throws.filter(th => th.step === i).forEach(th => drawThrow(g, bez(hand(model, th.from, th.t0), hand(model, th.to, th.t1), th.curve||0), th.type, {}, th.grip));
  model.fakes.filter(f => f.step === i).forEach(f => drawFake(g, model, f));
}
function render(){
  if (mode === 'edit') return;
  const i = stepAt(model, t);
  if (i !== lastStep){ drawArrows(i); lastStep = i; updateStepClasses(i); svg.setAttribute('aria-label', `${model.play.name}, step ${i+1}: ${model.play.steps[i].title}`); }
  const d = discAt(model, t);
  const dpt = d ? [d.x, d.y] : null;
  for (const id in playerEls){
    const fp = pos(model, id, t), p = M(...fp), def = model.P[id].def;
    let rot = '';
    if (def.team === 'D'){ angles[id] = faceAngle(fp, facingDef(model, def, t), oid => pos(model, oid, t), dpt, angles[id]); rot = ` rotate(${f2(angles[id])})`; }
    playerEls[id].setAttribute('transform', `translate(${f2(p[0])} ${f2(p[1])})${rot}`);
    const ring = playerEls[id].querySelector('.ring'); if (ring) ring.setAttribute('opacity', d && d.holder === id ? 1 : 0);
  }
  placeDisc(d); placeSpares(sparesAt(model, t));
  $('#scrub').value = t;
  $('#time').textContent = `${t.toFixed(1)} / ${model.total.toFixed(1)} s`;
  const st = model.starts[i], dur = model.play.steps[i].dur, frac = Math.min(1, (t-st)/dur);
  stepEls.forEach((li, k) => li.querySelector('.bar').style.width = (k < i ? 100 : k === i ? frac*100 : 0) + '%');
}
function updateStepClasses(i){
  stepEls.forEach((li,k) => { li.classList.toggle('now', k===i); li.classList.toggle('done', k<i); li.setAttribute('aria-current', k===i ? 'step' : 'false'); });
  fillCaption(i);
}
function fillCaption(i){
  const s = model.play.steps[i];
  $('#cap-n').textContent = `Step ${i+1} of ${model.play.steps.length}`;
  $('#cap-title').textContent = s.title;
  $('#cap-note').textContent = s.note || '';
  const fresh = model.newDiscs && model.newDiscs[i] ? `New disc: ${labelIn(model.play, model.newDiscs[i])}` : '';
  const thr = s.throw ? `Throw ${labelIn(model.play, s.throw.from)} → ${labelIn(model.play, s.throw.to)}: ${throwText(s.throw)}` : '';
  $('#cap-meta').textContent = [fresh, thr].filter(Boolean).join(' · ');
}
/* The caption is as tall as this drill's longest step caption needs, at the current width and text size: the field
   keeps one size from step to step, and short captions (a drawn drill without notes) leave no empty band under it.
   Measured again when the drill changes, the window resizes and presentation mode starts or ends. */
export function fitCaption(){
  const cap = $('.cap');
  if (!model || !cap.offsetParent) return;
  const parts = ['#cap-n', '#cap-title', '#cap-note', '#cap-meta'].map(s => $(s)), shown = parts.map(e => e.textContent);
  cap.style.height = 'auto';
  let h = 0;
  model.play.steps.forEach((s, k) => { fillCaption(k); h = Math.max(h, cap.scrollHeight); });
  parts.forEach((e, k) => { e.textContent = shown[k]; });
  cap.style.height = Math.ceil(h) + 'px';
}

// hash: the part of the address after #, a drill id or a packed drill, optionally with a time (share.js, splitTime)
export function select(hash){
  const {id, t: at} = splitTime(hash);
  if (id && id.startsWith('d=')){ openShared(id.slice(2), at); return; }
  const entries = libEntries();
  let e = entries.find(x => x.id === id);
  const found = !!e;
  if (!e){ if (id && (storeMode === 'pending' || id.startsWith('team:'))) pendingId = id; e = entries[0]; }
  showPlay(e.play, {source:e.source, id:e.id, team:e.label});
  if (found && at !== null) seek(at);
}
// where playback is: the time on screen, in seconds (Send feedback reads it)
export const playhead = () => t;
function seek(at){ t = Math.min(model.total, at); endHold = 0; render(); }
export function showPlay(play, meta){
  if (playing) setPlaying(false);
  stopAt = null; current = meta;
  setField(fieldOf(play.field)); setOrient(screenOrient());
  svg.classList.toggle('no-def', !$('#t-def').checked);
  model = compile(play); t = 0; endHold = 0;
  emit('showing');
  $('#pkind').textContent = meta.label ? meta.label
    : meta.source === 'preview' ? 'Preview · not saved yet' : meta.source === 'shared' ? play.kind + ' · shared with you'
    : play.kind + (meta.source === 'team' ? (storeMode === 'db' ? ' · team' : ' · saved here') : meta.source === 'repo' ? ' · ' + meta.team : '');
  $('#pname').textContent = play.name; $('#psum').textContent = play.summary;
  const chips = $('#pchips'); chips.replaceChildren();
  (play.chips || []).forEach(([k,v]) => { const c = document.createElement('span'); c.className = 'chip'; c.append(k + ' '); const s = document.createElement('strong'); s.textContent = v; c.appendChild(s); chips.appendChild(c); });
  const hasDef = play.players.some(p => p.team === 'D');
  $('#l-def').classList.toggle('off', !hasDef); $('#t-def').disabled = !hasDef; $('#lg-def').hidden = !hasDef;
  $('#scrub').max = model.total;
  // one button per step, sized by how long the step lasts, filling as it plays
  const ol = $('#steps'); ol.replaceChildren();
  stepEls = play.steps.map((s, k) => {
    const li = document.createElement('li'), b = document.createElement('button');
    li.style.flex = String(s.dur);
    b.type = 'button'; b.title = `Step ${k+1}: ${s.title}`; b.setAttribute('aria-label', `Step ${k+1}: ${s.title}`);
    b.innerHTML = '<i class="bar"></i><span></span>';
    b.querySelector('span').textContent = `${k+1} · ${s.title}`;
    b.addEventListener('click', () => { t = model.starts[k]; endHold = 0; render(); });
    li.appendChild(b); ol.appendChild(li); return b;
  });
  updateAct();
  drawPitch(play.view); buildPieces(); render(); fitCaption();
}
function labelIn(play, id){ const p = play.players.find(q => q.id === id); return p ? (p.label || p.id) : id; }
export function updateAct(){
  const b = $('#act');
  if (!current){ b.hidden = true; return; }
  const pencil = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>';
  if (current.source === 'preview'){ b.hidden = false; b.innerHTML = pencil + 'Back to editing'; return; }
  if (current.source === 'shared'){ b.hidden = false; b.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10z"/></svg>Save to my drills'; return; }
  if (canWrite === false){ b.hidden = true; return; }
  b.hidden = false;
  b.innerHTML = pencil + (current.source === 'team' || (current.source === 'repo' && teamEdit(current.id)) ? 'Edit' : 'Edit a copy');
}
// a team drill opens in the editor as the viewer's own drill with the same id (when they have it, or may publish it)
function teamEdit(id){
  const e = libEntries().find(x => x.id === id); if (!e || e.source !== 'repo') return null;
  const mine = team.find(x => x.id === e.itemId);
  return mine ? draftOfSaved(mine) : e.canWrite ? draftOfTeam(e) : null;
}
$('#act').addEventListener('click', () => {
  if (!current) return;
  if (current.source === 'preview'){ emit('back-to-editor'); return; }
  if (current.source === 'shared'){ saveShared(); return; }
  const e = libEntries().find(x => x.id === current.id); if (!e) return;
  emit('edit', e.source === 'team' ? draftOfSaved(e) : e.source === 'repo' ? (teamEdit(e.id) || copyOfEntry(e)) : copyOfBuiltin(e.play));
});
// the editor takes the field: stop playing and forget what was on screen
export function leavePlayback(){ setPlaying(false); current = null; }

// a drill packed into a #d= link
async function openShared(packed, at){
  try {
    sharedRaw = await readShared(packed);
    showPlay({...timeDraft({...sharedRaw, id:'shared'}), id:'shared'}, {source:'shared', id:'shared'});
    if (at !== null) seek(at);
  } catch (err){
    const first = builtins()[0];
    showPlay(first, {source:'builtin', id:first.id});
    $('#pkind').textContent = 'That shared link is damaged or incomplete';
  }
}

/* A drill opened read-only from elsewhere (an old version from a team drill's history), shown like a shared link:
   it can be watched and saved to the viewer's drills. `label` replaces the line above the name. */
export function showReadOnly(raw, label){
  sharedRaw = raw;
  showPlay({...timeDraft({...raw, id:'shared'}), id:'shared'}, {source:'shared', id:'shared', label});
}

async function saveShared(){
  if (!sharedRaw) return;
  const id = newDocId(), now = Date.now(), body = serialize(sharedRaw); body.createdAt = now; body.updatedAt = now;
  try {
    await saveDrill(id, body);
    saveEntry(entryFrom(id, body)); emit('drills-changed'); sharedRaw = null; location.hash = id;
  } catch (err){ $('#pkind').textContent = errText(err); }
}
export function setPlaying(v){
  playing = v; if (!v && stopAt !== null && t < stopAt - 1e-3) stopAt = null;
  $('#play').setAttribute('aria-label', v ? 'Pause' : 'Play');
  $('#play-ico').innerHTML = v ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4v16l13-8z"/>';
  if (v){ if (t >= model.total - 1e-3) t = 0; last = performance.now(); requestAnimationFrame(tick); }
}
let last = 0;
function tick(now){
  if (!playing || mode === 'edit') return;
  const dt = Math.min(.1, (now - last)/1000); last = now;
  if (stopAt !== null && t + dt*speed >= stopAt){ t = stopAt; stopAt = null; render(); setPlaying(false); return; }
  if (t >= model.total - 1e-6){
    endHold += dt;
    if ($('#t-loop').checked && endHold > 1.2){ t = 0; endHold = 0; }
    else if (!$('#t-loop').checked){ setPlaying(false); render(); return; }
  } else {
    const nt = t + dt*speed;
    if ($('#t-pause').checked){
      const nb = model.starts.find(s => s > t + 1e-4);
      if (nb !== undefined && nt >= nb){ t = nb; render(); setPlaying(false); return; }
    }
    t = Math.min(model.total, nt);
  }
  render(); requestAnimationFrame(tick);
}
// tap the field: the next step plays and stops at its end; a tap while it plays skips to that end
let stopAt = null;
function playOneStep(){
  if (!model) return;
  if (playing && stopAt !== null){ t = stopAt; stopAt = null; setPlaying(false); render(); return; }
  if (t >= model.total - 1e-3) t = 0;
  stopAt = model.starts.find(s => s > t + 1e-4) ?? model.total;
  endHold = 0; setPlaying(true);
}
svg.addEventListener('click', () => { if (mode !== 'edit') playOneStep(); });
export function stepNav(dir){
  const i = stepAt(model, t);
  if (dir < 0) t = (t - model.starts[i] > .2) ? model.starts[i] : model.starts[Math.max(0, i-1)];
  else t = i+1 < model.starts.length ? model.starts[i+1] : model.total;
  endHold = 0; render();
}

/* ---------- viewer controls ---------- */
$('#play').addEventListener('click', () => setPlaying(!playing));
$('#prev').addEventListener('click', () => stepNav(-1));
$('#next').addEventListener('click', () => stepNav(1));
$('#scrub').addEventListener('input', e => { t = +e.target.value; endHold = 0; render(); });
$('#speed').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
  speed = +b.dataset.s; document.querySelectorAll('#speed button').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); save(); });
$('#t-arrows').addEventListener('change', () => { lastStep = -1; render(); save(); });
$('#t-def').addEventListener('change', e => { svg.classList.toggle('no-def', !e.target.checked); save(); });
['#t-pause','#t-loop'].forEach(s => $(s).addEventListener('change', save));
let fitQueued = false;
addEventListener('resize', () => {
  if (mode === 'edit') return;   // the editor handles its own resizing
  if (!fitQueued){ fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitCaption(); }); }
  if (screenOrient() === orient) return;
  setOrient(screenOrient()); drawPitch(model.play.view); buildPieces(); lastStep = -1; render();
});
// the display font changes the caption's height once it has loaded
if (document.fonts) document.fonts.ready.then(() => fitCaption());

/* ---------- after the saved drills (re)load ----------
   Show the saved drill a link asked for, or refresh the saved drill on screen if it changed or was deleted. */
export function followStore(){
  const entries = libEntries();
  if (pendingId && entries.some(x => x.id === pendingId) && mode !== 'edit' && splitTime(location.hash.slice(1)).id === pendingId){ const id = pendingId; pendingId = null; select(location.hash.slice(1)); return; }
  if (!pendingId || !pendingId.startsWith('team:')) pendingId = null;   // team drills can arrive later than saved ones
  if (mode === 'view' && current && (current.source === 'team' || current.source === 'repo')){
    const e = entries.find(x => x.id === current.id && x.source === current.source);
    if (!e) select(builtins()[0].id);
    else if (JSON.stringify(e.play) !== JSON.stringify(model.play)){ const was = playing; select(e.id); if (was) setPlaying(true); }
  }
}

/* ---------- playback preferences ---------- */

function save(){ try { localStorage.setItem('ub-prefs', JSON.stringify({speed, pause:$('#t-pause').checked, loop:$('#t-loop').checked, arrows:$('#t-arrows').checked, def:$('#t-def').checked})); } catch(e){} }
export function load(){ try { const p = JSON.parse(localStorage.getItem('ub-prefs') || 'null'); if (!p) return;
  speed = [0.5,1,2].includes(p.speed) ? p.speed : 1; document.querySelectorAll('#speed button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.s === speed ? 'true' : 'false'));
  $('#t-pause').checked = !!p.pause; $('#t-loop').checked = p.loop !== false; $('#t-arrows').checked = p.arrows !== false; $('#t-def').checked = p.def !== false;
  svg.classList.toggle('no-def', p.def === false);
} catch(e){} }
