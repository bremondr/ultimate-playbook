import { renderEditor } from './canvas.js';
import { commit, updateState } from './history.js';
import { draft, es, selPlayers, setDirty } from './session.js';
import { renderStrip } from './step-tab.js';
import { $ } from '../util.js';

/* text inputs: one undo entry per edit, not per keystroke */
let typingBefore = null;
function textField(sel_, apply, after){
  const inp = $(sel_);
  inp.addEventListener('focus', () => { typingBefore = JSON.stringify(draft); });
  inp.addEventListener('input', () => { if (!draft) return; apply(inp.value); setDirty(true); updateState(); if (after) after(); });
  inp.addEventListener('change', () => { if (typingBefore) commit(typingBefore); typingBefore = JSON.stringify(draft); });
}
textField('#s-name', v => { draft.name = v; });
textField('#e-sum', v => { draft.summary = v; });
textField('#e-title', v => { if (es >= 0) draft.steps[es].title = v; }, () => renderStrip());
textField('#e-note', v => { if (es >= 0) draft.steps[es].note = v; });
textField('#e-dur', v => { if (es >= 0){ const n = parseFloat(v); draft.steps[es].dur = isFinite(n) && n >= 1 ? Math.min(20, n) : null; } }, () => renderEditor());
textField('#sel-label', v => { const p = selPlayers()[0]; if (p && p.team === 'O') p.label = v.trim().slice(0,3) || '?'; }, () => renderEditor());
