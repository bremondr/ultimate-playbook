/* ---------- presentation mode: only the field and a large step caption, for showing drills to the team ----------
   Tap the field to play one step (the player's own tap handler); "Step back" or ← goes back a step;
   "Exit" or Escape leaves. Uses the Fullscreen API when the browser allows it (iPad Safari only partly does,
   and an embedded page may be refused): then the in-page layout alone is used. Keeps the screen awake
   with a wake lock where there is one. The field keeps running along the longer side of the screen:
   the player redraws it when the screen turns. */
import { closePops, openDrawer } from '../nav.js';
import { playing, setPlaying, stepNav } from '../player.js';
import { mode } from '../state.js';
import { $ } from '../util.js';

let on = false, usedFullscreen = false, wakeLock = null;

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
async function requestFullscreen(){
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || !(document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true)) return false;
  try { await req.call(el, {navigationUI: 'hide'}); return true; } catch (e){ return false; }
}
function exitFullscreen(){
  if (!fsElement()) return;
  try { const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document); if (p && p.catch) p.catch(() => {}); } catch (e){}
}

async function keepAwake(){
  if (!on || !('wakeLock' in navigator) || (wakeLock && !wakeLock.released)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e){ wakeLock = null; }
}
function letSleep(){ if (wakeLock){ wakeLock.release().catch(() => {}); wakeLock = null; } }

export async function present(enter){
  if (enter === on || (enter && mode === 'edit')) return;
  on = enter;
  document.body.classList.toggle('presenting', on);
  $('#pres-ctl').hidden = !on;
  $('#present').setAttribute('aria-pressed', on ? 'true' : 'false');
  if (on){
    closePops(); openDrawer(false);
    $('#pres-back').focus({preventScroll: true});
    usedFullscreen = await requestFullscreen();
    if (!on){ if (usedFullscreen) exitFullscreen(); usedFullscreen = false; return; }   // left while it was opening
    keepAwake();
  } else {
    letSleep();
    if (usedFullscreen) exitFullscreen();
    usedFullscreen = false;
    $('#present').focus({preventScroll: true});
  }
}

function stepBack(){ if (playing) setPlaying(false); stepNav(-1); }

$('#present').addEventListener('click', () => present(true));
$('#pres-exit').addEventListener('click', () => present(false));
$('#pres-back').addEventListener('click', stepBack);
// Escape leaves (capture phase, before the page's own Escape handling). In browser full screen the browser
// takes Escape itself and leaves full screen; fullscreenchange below then ends presentation too.
document.addEventListener('keydown', e => {
  if (!on || e.key !== 'Escape') return;
  e.preventDefault(); e.stopPropagation(); present(false);
}, true);
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => { if (on && usedFullscreen && !fsElement()) present(false); }));
// the wake lock is dropped when the page is hidden; take it again on return
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
