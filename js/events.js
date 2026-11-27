/* ---------- events: how a lower module tells a higher one that something happened ----------
   Imports only point down the layers: data → model → render → services (library, storage, share) → UI (player, nav,
   editor) → main. When a lower module needs a higher one to react, it emits an event here instead of importing it.
   Only the two composition roots subscribe: main.js for the app and editor/studio.js inside the editor, so every
   reaction is listed in one place and runs in the order written there.
   The names are fixed below, so a typo fails loudly instead of being silently ignored. */
const EVENTS = {
  // app: main.js listens
  'store-loaded':   'storage: the saved drills were (re)loaded from the store',
  'drills-changed': 'player or backup: drills were added (a shared drill saved, a backup restored), so the drill list needs rebuilding',
  'access-changed': 'storage: we learned whether this viewer may save drills',
  'plan-link':      'player: a #plan= link was opened, so the plans feature shows that plan',
  'plans-changed':  'storage, features/plans: practice plans were loaded, saved or removed, so the drill list and open plan screens catch up',
  'team-loaded':    'features/team: the drills from team repos changed (loaded, published, removed), so the list and the drill on screen catch up',
  'showing':        'player: another drill is on screen',
  'edit':           'player, nav: open the editor on this draft',
  'back-to-editor': 'player, nav: return to the drill being drawn, with an optional warning for the hint line',
  // editor: editor/studio.js listens
  'editor-drawn':   'editor/canvas: the field was redrawn, so the panels around it catch up',
  'draft-replaced': 'editor/history: undo or redo swapped the whole draft',
  'tray-changed':   'editor/tools/group: the tool options changed shape',
  'field-turned':   'editor/viewport: the field turned between wide and upright',
  'show-step':      'editor/tools/throw: a throw was drawn in another step (maybe a new one), so show that step'
};
const handlers = {};
function known(name){ if (!(name in EVENTS)) throw new Error(`Unknown event: ${name}`); }
export function on(name, fn){ known(name); (handlers[name] ||= []).push(fn); }
export function emit(name, ...args){ known(name); (handlers[name] || []).forEach(fn => fn(...args)); }
