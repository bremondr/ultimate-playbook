/* ---------- keyboard in the editor ---------- */
import { renderEditor } from './canvas.js';
import { snapPt } from './drafts.js';
import { commit, redo, undo } from './history.js';
import { deleteSelection, setSel } from './selection.js';
import { setTool, TOOL_KEYS } from './tools.js';
import { draft, es, flyOpen, orient, put, selIds, tool } from '../state.js';
import { $, r2 } from '../util.js';

export function editorKeys(e){
  const typing = e.target.closest('input,textarea,select,[contenteditable]');
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z'){ if (typing) return; e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && k === 'y'){ if (typing) return; e.preventDefault(); redo(); return; }
  if (mod && k === 's'){ e.preventDefault(); $('#s-save').click(); return; }
  if (typing) return;
  if (mod && k === 'a'){ e.preventDefault(); setSel(draft.players.map(p => p.id)); renderEditor(); return; }
  if (k === 'delete' || k === 'backspace'){ if (selIds.size){ e.preventDefault(); deleteSelection(); } return; }
  if (k === 'escape'){ put.pendingThrow(null); put.selIds(new Set()); put.hintMsg(null); renderEditor(); return; }
  if (e.key.startsWith('Arrow') && selIds.size && es < 0){
    e.preventDefault();
    const st = e.shiftKey ? 2 : .5, d = {ArrowLeft:[-st,0], ArrowRight:[st,0], ArrowUp:[0,-st], ArrowDown:[0,st]}[e.key];
    // arrows follow the screen, so turn them back into field metres when the field is drawn upright
    const [dx, dy] = orient === 'h' ? d : [-d[1], d[0]];
    const before = JSON.stringify(draft), set = selIds;
    draft.players.filter(p => set.has(p.id) && !p.mark).forEach(p => {
      if (p.follow){ if (!set.has(p.follow)) p.offset = [r2(p.offset[0]+dx), r2(p.offset[1]+dy)]; }
      else p.at = snapPt([p.at[0]+dx, p.at[1]+dy]);
    });
    commit(before); renderEditor(); return;
  }
  if (!mod && !e.altKey && TOOL_KEYS[k]){ put.flyOpen(TOOL_KEYS[k] !== tool || !flyOpen); setTool(TOOL_KEYS[k]); }
}
