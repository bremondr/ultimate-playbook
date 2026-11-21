/* ---------- the hint line under the field ----------
   hint() shows a message (a warning, or what just happened) until the next action clears it. When there is no
   message the line explains the tool in hand: rail.js renders that, since it knows the tools. */
import { $ } from '../util.js';

export let hintMsg = null;   // {text, warn}
export function hint(text, warn){ hintMsg = {text, warn}; paintHint(text, warn); }
export function clearHint(){ hintMsg = null; }
export function paintHint(text, warn){ const h = $('#hint'); h.classList.toggle('warn', !!warn); h.textContent = text; }

// long hints are cut off on small screens: keep the whole text in the tooltip
new MutationObserver(() => { const h = $('#hint'); h.title = h.textContent; h.scrollTop = 0; }).observe($('#hint'), {childList:true, characterData:true, subtree:true});
