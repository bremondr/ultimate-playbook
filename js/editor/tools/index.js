/* ---------- the editor's tools ----------
   One module per tool, each with its pointer handling, its hint text and its options:
     id       the tool's name on the rail (data-tool) and in session.tool
     key      the keyboard shortcut
     hint(setup)            the hint line when nothing else is being said; setup is true in Setup
     tray     {title, sections(), fill()}: the options shown beside the tool, if it has any
     down(ctx)              a tap on the field; may return a drag, which then goes to move(drag, raw, pt) and up(drag)
   pointer.js passes the events on; rail.js shows the tray and the hint. */
import cone from './cone.js';
import defense from './defense.js';
import erase from './erase.js';
import group from './group.js';
import offense from './offense.js';
import select from './select.js';
import throwTool from './throw.js';

export const TOOLS = Object.fromEntries([select, offense, defense, group, cone, throwTool, erase].map(t => [t.id, t]));
export const TOOL_KEYS = Object.fromEntries(Object.values(TOOLS).map(t => [t.key, t.id]));
