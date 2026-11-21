# Ultimate Playbook

Animated ultimate frisbee plays and drills for training sessions, with a drill editor made for the iPad.

Use the GitHub Pages site for this repository, or serve this folder locally (`python3 -m http.server`) and open it in a browser. Opening `index.html` straight from the disk doesn't work, because browsers don't load JavaScript modules from `file://`.

## Watching a play or drill

- **Drills** opens the list of plays and drills.
- Tap the field to play the next step and stop at its end. The play button runs the whole thing.
- The caption under the field shows the current step's coaching note and throw.
- ⓘ shows the summary. The options button sets speed, pausing after each step, looping, arrows and defense.
- The share button gives a link to the drill. Built-in drills link by name; drills you drew are packed into the link itself, so it works without any server or account. Whoever opens it can watch it and tap **Save to my drills**. The share panel also shows the link as a QR code for players to scan at practice; tap it, or **Show QR code larger**, to fill the screen with it. Very long drawn drills can be too long for a QR code; then send the link instead.
- The field always runs along the longer side of the screen. The offense attacks toward the pink end zone ("Score here").

Built in: vertical stack, horizontal stack, dump & swing, go-to drill, box drill, angel drill, and the angel drill with a fake and cut back.

## Drawing a drill

**Draw a new drill** opens the full-screen editor, starting from a blank field or from a copy of any built-in or saved drill. **Edit a copy** on a drill does the same for the one you're watching, and the Drill tab can also copy another drill in.

- **Tools** (left rail): Select, Offense, Defense, Group, Cone, Throw, Erase, and Multi for multi-select. Tools with options open them beside the tool.
- **Setup** is where everyone starts. Each **step** holds runs and at most one throw. Timing is automatic: the receiver and the disc reach the catch point together.
- **Throws**: type (backhand, forehand, hammer, scoober, thumber, blade, push pass), flight (straight or bent), and an optional pump fake.
- **Defense**: a defender can be free, follow an attacker, or mark: each player in a row, only the handler spot, or whoever has the disc. Each mark has a force (left, straight up, right). Facing can follow their player, watch the disc, or be fixed with the rotate handle.
- **Drill tab**: 7 v 7 or 5 v 5, full field (100 × 37 m) or small field (75 × 25 m), formations (vertical stack, vertical stack with dump, horizontal stack, side stack) and person defense with a force.
- Keyboard: V O D G C T E switch tools, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+S save, arrows nudge.

Drills you draw are saved in this browser (local storage). To move one to another device, share its link and save it there.

## Project structure

Plain HTML, CSS and JavaScript modules: no build step and no dependencies. Because the scripts are ES modules, open the page through a web server (GitHub Pages, or `python3 -m http.server` in this folder), not straight from the file system.

- `index.html`: markup only. It loads the stylesheets and `js/main.js`.
- `css/`: `tokens.css` (colours, fonts, dark mode), `base.css`, `player.css` (playback screen and drill list), `shared.css` (buttons and form bits), `studio.css` (the editor).
- `js/main.js`: boot. Loads the other modules, keyboard and window events, then shows the drill named in the link.
- `js/state.js`: the shared state (current field and orientation, the drill on screen, saved drills, the editor's draft and selection). Other modules read it directly and change it with `put`, for example `put.draft(d)`.
- `js/util.js`: small helpers (rounding, ids, `$`).
- `js/data/`: plain data. `fields.js` (field sizes), `builtins.js` (the built-in plays and drills), `angel.js` (the two angel drills), `formations.js` (the formations offered in the editor).
- `js/model/`: the logic, no drawing. `compile.js` turns a play into timed runs and throws, `motion.js` gives where every player and the disc are at a moment (including marks), `timing.js` times a drawn drill automatically, `throws.js` (throw types and grips), `formation.js` (formations and person defense), `facing.js` (where a defender looks).
- `js/render/`: SVG drawing. `svg.js` (field-to-screen mapping), `pitch.js` (the field), `pieces.js` (players, cones, throws, fakes, the disc), `thumb.js` (formation previews).
- `js/player.js` (playback), `js/nav.js` (drill list, popovers, new-drill chooser), `js/library.js` (built-in plus saved drills), `js/storage.js` (saving in this browser, or the shared team store when the page runs as a Claude artifact), `js/share.js` (links with the drill packed in).
- `js/editor/`: the drill editor. `studio.js` (open, close, save, zoom), `canvas.js` (drawing the draft, step strip, hints), `pointer.js` (taps and drags on the field), `tools.js` (tool rail, tabs, tool options), `selection.js` (Selected tab), `step-tab.js` (Step tab and throws), `drill-tab.js` (Drill tab and formations), `pieces.js` (adding and removing players, the Group tool), `history.js` (undo and redo), `text-fields.js`, `keys.js`, `drafts.js` (blank drafts and copies).

## To do

- Make it installable on the iPad home screen and usable offline (web app manifest and service worker).
- Saving drills to a shared place for the whole team (for now each browser keeps its own).
