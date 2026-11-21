# Ultimate Playbook

Animated ultimate frisbee plays and drills for training sessions, with a drill editor made for the iPad.

Use the GitHub Pages site for this repository, or serve this folder locally (`python3 -m http.server`) and open it in a browser. Opening `index.html` straight from the disk doesn't work, because browsers don't load JavaScript modules from `file://`.

## Watching a play or drill

- **Drills** opens the list of plays and drills.
- Tap the field to play the next step and stop at its end. The play button runs the whole thing.
- The caption under the field shows the current step's coaching note and throw.
- ⓘ shows the summary. The options button sets speed, pausing after each step, looping, arrows and defense.
- The share button gives a link to the drill. Built-in drills link by name; drills you drew are packed into the link itself, so it works without any server or account. Whoever opens it can watch it and tap **Save to my drills**. The share panel also shows the link as a QR code for players to scan at practice; tap it, or **Show QR code larger**, to fill the screen with it. Very long drawn drills can be too long for a QR code; then send the link instead.
- The present button (a screen with a play mark, in the top bar on the iPad and wider screens) shows the key, the field and a large step caption, full screen where the browser allows it, and keeps the screen awake. Tap the field for the next step, **Step back** (or ←) to go back, and **Exit** (or Escape) to leave. iPad Safari doesn't always allow full screen; the app then uses the same layout inside the page. Added to the home screen, the app already fills the screen.
- The field always runs along the longer side of the screen. The offense attacks toward the pink end zone ("Score here").

Built in: vertical stack, horizontal stack, dump & swing, go-to drill, box drill, angel drill, and the angel drill with a fake and cut back.

## Drawing a drill

**Draw a new drill** opens the full-screen editor, starting from a blank field or from a copy of any built-in or saved drill. **Edit a copy** on a drill does the same for the one you're watching, and the Drill tab can also copy another drill in.

- **Tools** (left rail): Select, Offense, Defense, Group, Cone, Throw, Erase, and Multi for multi-select. Tools with options open them beside the tool.
- **Attacker labels** count 1, 2, 3 … 9, 10. The Offense and Group options take a start: `H` gives H1, H2 …, and `A10` starts at A10. Duplicate continues the copied player's numbering (a copy of A4 is A5). A label can be up to 4 characters.
- **Setup** is where everyone starts. Each **step** holds runs and at most one throw. Timing is automatic: the receiver and the disc reach the catch point together.
- **Throws**: type (backhand, forehand, hammer, scoober, thumber, blade, push pass), flight (straight or bent), and an optional pump fake.
- **Defense**: a defender can be free, follow an attacker, or mark: each player in a row, only the handler spot, or whoever has the disc. Each mark has a force (left, straight up, right). Facing can follow their player, watch the disc, or be fixed with the rotate handle.
- **Drill tab**: 7 v 7 or 5 v 5, full field (100 × 37 m) or small field (75 × 25 m), formations (vertical stack, vertical stack with dump, horizontal stack, side stack) and person defense with a force.
- Keyboard: V O D G C T E switch tools, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+S save, arrows nudge.
- **Pieces on top of each other**: with Select, the first tap picks the one on top and each further tap on the same spot picks the next one underneath. The hint says how many are there.

Drills you draw are saved in this browser (local storage). To move them all to another device or browser, open **Drills** and use **Back up to a file** at the bottom of the list, then **Restore from a file** on the other device. Restoring adds the drills in the file: drills you already have are skipped, and a different drill with the same id is added as a copy, so nothing is overwritten. To send a single drill, share its link.

## On the iPad home screen, and offline

In Safari, tap Share, then **Add to Home Screen**. The app then opens full screen like an app, and it works without a connection once it has been opened online one time: a service worker (`sw.js`) stores all its files. Drills you draw stay in that browser's storage, so back them up to a file now and then (see above).

The service worker runs only on http(s) (GitHub Pages, or a local server), not when the app runs as a claude.ai artifact.

### Releasing a new version

Nothing to do by hand. `sw.js` serves the stored files first, so people get a change only when the service worker itself changes; the site build (`tools/build-site.mjs`) therefore writes `VERSION` (a hash of every published file) and `APP_FILES` (the list of them) into the published `sw.js`. Any change to an app file gives a new version: the new service worker stores the new files and deletes the old cache, and the next visit shows the new version. (`index.html` is fetched from the network first anyway.) The values in the repository's `sw.js` are only used when the folder is served as it is, for local testing.

## Project structure

Plain HTML, CSS and JavaScript modules: no build step and no dependencies. Because the scripts are ES modules, open the page through a web server (GitHub Pages, or `python3 -m http.server` in this folder), not straight from the file system.

- `index.html`: markup only. It loads the stylesheets and `js/main.js`.
- `manifest.webmanifest`, `icons/`, `sw.js`, `js/pwa.js`: installing on the home screen and working offline. `js/pwa.js` registers the service worker.
- `css/`: `tokens.css` (colours, fonts, dark mode), `base.css`, `player.css` (playback screen and drill list), `shared.css` (buttons and form bits), `studio.css` (the editor).

The scripts are in layers. Every import points down the layers (or sideways within one), and imports never go round in a circle:

data → model → render → services (library, storage, share) → UI (player, nav, editor, features) → `main.js`

- `js/util.js`: small helpers (rounding, ids, `$`, which way the screen is turned). `js/events.js`: the event names and `on`/`emit`; see below.
- `js/data/`: plain data. `fields.js` (field sizes), `builtins.js` (the hand-timed built-in plays), `angel.js` (the two angel drills, written like drawn drills), `formations.js` (the formations offered in the editor).
- `js/model/`: the logic, no drawing. `compile.js` turns a play into timed runs and throws, `motion.js` gives where every player and the disc are at a moment (including marks), `timing.js` times a drawn drill automatically, `drafts.js` (blank drafts and copies for the editor), `throws.js` (throw types and grips), `formation.js` (formations and person defense), `facing.js` (where a defender looks).
- `js/render/`: SVG drawing. `view.js` (which field is drawn, which way it is turned, and whether the player or the editor has it), `svg.js` (field-to-screen mapping), `pitch.js` (the field), `pieces.js` (players, cones, throws, fakes, the disc), `thumb.js` (formation previews).
- Services: `js/library.js` (built-in plus saved drills; the built-in list is put together the first time it is needed), `js/storage.js` (saving in this browser, or the shared team store when the page runs as a Claude artifact), `js/share.js` (links with the drill packed in).
- `js/player.js` (playback), `js/nav.js` (drill list, popovers including Share, new-drill chooser).
- `js/features/`: self-contained features (UI layer), each wired in at a few commented points. `qr.js` (QR code encoder and the QR code in the share panel), `backup.js` (back up and restore drills as a `.json` file), `present.js` (presentation mode). Their styles are in `css/features.css`.
- `js/editor/`: the drill editor.
  - `studio.js` opens, closes, previews, saves and deletes, and wires the editor's events.
  - `session.js` (the drill being drawn, the step on screen, the tool in hand, the selection), `history.js` (undo and redo), `canvas.js` (drawing the draft and asking where things are), `hint.js` (the hint line), `tabs.js` (the property tabs and the bottom sheet), `viewport.js` (zoom and turning the field).
  - `tools/`: one module per tool (`select`, `offense`, `defense`, `group`, `cone`, `throw`, `erase`) with its pointer handling, hint text and options; `index.js` lists them. `pointer.js` passes taps and drags on the field to the tool in hand; `rail.js` is the tool rail, the options tray beside it and the tool's hint.
  - `selection.js` (Selected tab), `step-tab.js` (step strip and Step tab), `drill-tab.js` (Drill tab and formations), `pieces.js` (adding and removing players and cones), `text-fields.js`, `keys.js`.

**State** lives in a few small stores, each owned by the module that changes it: the view (`render/view.js`), the player (`player.js`: the drill on screen, playing or not), the library and the store (`library.js`: saved drills; `storage.js`: where they are saved and whether you may save), and the editing session (`editor/session.js`; the editor's smaller bits of state stay with the module that uses them, such as the undo stacks in `history.js` or the zoom in `viewport.js`). Other modules read their exported values directly (ES modules give them a live, read-only view) and change them only through the functions the owner exports, for example `setField(f)` or `setSelIds(ids)`.

**Events.** When a lower module needs a higher one to react, it calls `emit('name')` instead of importing it: for example the player asks for the editor with `emit('edit', draft)`, and the editor's canvas announces `emit('editor-drawn')` so the panels around the field catch up. The event names are listed in `js/events.js`, and only `main.js` (for the app) and `editor/studio.js` (inside the editor) subscribe, so every reaction is listed in one place.

## Development

There is nothing to build. Three checks:

- `node tools/check-imports.mjs` checks that the modules have no import cycles and that every import points down the layers. Plain Node, no packages.
- `node --test tools/*.test.mjs tests/*.test.mjs` runs the unit tests: attacker labels (`tests/labels.test.mjs`) and the site build for previews (`tools/build-site.test.mjs`). Plain Node.
- `python3 tests/regression.py` serves the folder with `python3 -m http.server`, opens it in headless Chrome with Python Playwright, and checks that there are no page or console errors, the main player and editor flows on an iPad-sized and a phone-sized screen, saving to a mocked team store (as when the page runs as a Claude artifact), and the model output of every built-in drill against `tests/baseline.json`. It needs Python Playwright and Chrome at `/usr/bin/google-chrome`. After a deliberate change to the model, rewrite the baseline with `--update-baseline`. `--trace FILE` and `--shots DIR` record what each step showed, to compare two versions (`--root DIR` serves another copy of the app).

## Previews of pull requests

Every open pull request from this repository gets its own copy of the app on the GitHub Pages site, so a change can be tried on the iPad before it is merged:

| Version | Address |
|---|---|
| Live app | https://bremondr.github.io/ultimate-playbook/ (built from `main`) |
| Preview | https://bremondr.github.io/ultimate-playbook/preview/pr-NUMBER/ |
| List of previews | https://bremondr.github.io/ultimate-playbook/preview/ |

Opening or pushing to a pull request updates its preview, and a comment on the pull request links to it. Closing or merging the pull request removes it. Pull requests from forks don't get one.

A preview differs from the live app in three ways, all added when the site is built (the app's own files never contain them):

- **Its own saved drills.** Every version shares one browser origin, so `tools/preview-runtime.js` gives each preview its own storage keys (`preview:pr-NUMBER:`): a preview never sees or changes the live app's drills, or another preview's.
- **A small tab** in the bottom-right corner (Preview PR #NUMBER). Tap it for the commit and links to the pull request, the live app and the other previews; × hides it.
- **No offline mode.** Its service worker is replaced with one that does nothing, because the caches are shared by every version too. It also isn't listed by search engines.

Share links made in a preview open in that preview.

**How it works.** `.github/workflows/pages.yml` runs on every push to `main`, on pull request events and by hand (Actions, Deploy site, Run workflow). It checks `main`, fetches the open pull requests, and builds the whole site with `tools/build-site.mjs`, reading each version straight from git; then it deploys and comments. It uses `pull_request_target`, so the workflow and the build script that run are always the ones on `main`, and a pull request's code is never run in CI. A change to how the site is built therefore only shows in previews after it is merged. At most 20 previews are published. `.github/workflows/test.yml` runs the checks (below) on every pull request.

To build the same folder locally from any branches:

```sh
echo '[{"number": 16, "ref": "my-branch"}]' > previews.json
node tools/build-site.mjs --out _site --main main --previews previews.json
python3 -m http.server -d _site
```

**Setting it up (once).** In the repository, Settings, Pages, Build and deployment, set Source to **GitHub Actions** (or `gh api -X PUT repos/bremondr/ultimate-playbook/pages -f build_type=workflow`), then run the workflow once. To go back, set the source to "Deploy from a branch", `main`; the site then has only the live app.

## To do

Planned features are tracked as [GitHub issues](https://github.com/bremondr/ultimate-playbook/issues).
