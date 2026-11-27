/* ---------- boot: wire the page, load preferences, show the drill in the link, connect the store ---------- */
import { backToEditor, openEditor } from './editor/studio.js';
import { editorKeys } from './editor/keys.js';
import { dirty } from './editor/session.js';
import { on } from './events.js';
import { buildNav, closePops, focusSearch, markNav, openDrawer, showWriteAccess } from './nav.js';
import { followStore, load, playing, select, setPlaying, stepNav, updateAct } from './player.js';
import { mode, setOrient } from './render/view.js';
import { initStore } from './storage.js';
import { screenOrient } from './util.js';

/* ---------- app wiring: what the lower modules announce (events.js), and what happens then ---------- */
on('showing', () => { markNav(); planShowing(); });
on('drills-changed', buildNav);
on('store-loaded', () => { buildNav(); followStore(); });
on('team-loaded', () => { buildNav(); followStore(); plansChanged(); });
on('access-changed', () => { showWriteAccess(); showPlanWriteAccess(); if (mode !== 'edit') updateAct(); });
on('plans-changed', () => { buildNav(); plansChanged(); });
on('plan-link', openPlanLink);
on('edit', openEditor);
on('back-to-editor', backToEditor);
/* features, each self-contained in its own file */
import './features/qr.js';
import './features/backup.js';
import './features/present.js';
import './features/feedback.js';
import './features/team.js';
import { openPlanLink, planShowing, plansChanged, showPlanWriteAccess } from './features/plans.js';
import './pwa.js';

/* ---------- keys and window events ---------- */
document.addEventListener('keydown', e => {
  const typing = e.target.closest('input,textarea,select,[contenteditable]');
  if (mode === 'edit'){ editorKeys(e); return; }
  if (e.key === 'Escape'){ openDrawer(false); closePops(); return; }
  if (typing) return;
  if (e.key === ' ' && e.target.closest('button')) return;
  if (e.key === '/'){ e.preventDefault(); focusSearch(); return; }
  if (e.key === ' '){ e.preventDefault(); setPlaying(!playing); }
  else if (e.key === 'ArrowRight') stepNav(1);
  else if (e.key === 'ArrowLeft') stepNav(-1);
});
addEventListener('hashchange', () => { if (mode === 'edit') return; select(location.hash.slice(1)); });
addEventListener('beforeunload', e => { if (mode === 'edit' && dirty){ e.preventDefault(); e.returnValue = ''; } });

setOrient(screenOrient());
buildNav(); load(); select(location.hash.slice(1));
initStore();
