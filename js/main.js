/* ---------- boot: wire the page, load preferences, show the drill in the link, connect the store ---------- */
import { editorKeys } from './editor/keys.js';
import { buildNav, closePops, openDrawer } from './nav.js';
import { load, playing, select, setPlaying, stepNav } from './player.js';
import { dirty, mode } from './state.js';
import { initStore } from './storage.js';
import './share.js';
import './editor/studio.js';
import './editor/history.js';
import './editor/tools.js';
import './editor/canvas.js';
import './editor/selection.js';
import './editor/drill-tab.js';
import './editor/step-tab.js';
import './editor/pieces.js';
import './editor/pointer.js';
import './editor/text-fields.js';
/* features, each self-contained in its own file */
import './features/qr.js';
import './features/backup.js';

/* ---------- keys and window events ---------- */
document.addEventListener('keydown', e => {
  const typing = e.target.closest('input,textarea,select,[contenteditable]');
  if (mode === 'edit'){ editorKeys(e); return; }
  if (e.key === 'Escape'){ openDrawer(false); closePops(); return; }
  if (typing) return;
  if (e.key === ' ' && e.target.closest('button')) return;
  if (e.key === ' '){ e.preventDefault(); setPlaying(!playing); }
  else if (e.key === 'ArrowRight') stepNav(1);
  else if (e.key === 'ArrowLeft') stepNav(-1);
});
addEventListener('hashchange', () => { if (mode === 'edit') return; select(location.hash.slice(1)); });
addEventListener('beforeunload', e => { if (mode === 'edit' && dirty){ e.preventDefault(); e.returnValue = ''; } });

buildNav(); load(); select(location.hash.slice(1));
initStore();
