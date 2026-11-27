# Ultimate Playbook

Animated ultimate frisbee plays and drills for training sessions, with a drill editor made for the iPad.

Use the GitHub Pages site for this repository, or serve this folder locally (`python3 -m http.server`) and open it in a browser. Opening `index.html` straight from the disk doesn't work, because browsers don't load JavaScript modules from `file://`.

## Watching a play or drill

- **Drills** opens the list of plays and drills. The search box at its top filters the list as you type: it looks at names, summaries, step titles and tags, and case and accents don't matter. **/** opens it from anywhere, Escape clears it, and Enter opens the only match. Under it, the **tags** in use (cutting, handlers, zone…) filter the list: tap one or more to show only drills with all of them, and the choice is remembered in this browser.
- Tap the field to play the next step and stop at its end. The play button runs the whole thing.
- The caption under the field shows the current step's coaching note and throw.
- ⓘ shows the summary. The options button sets speed, pausing after each step, looping, arrows and defense.
- The share button gives a link to the drill. Built-in drills link by name; drills you drew are packed into the link itself, so it works without any server or account. Whoever opens it can watch it and tap **Save to my drills**. The share panel also shows the link as a QR code for players to scan at practice; tap it, or **Show QR code larger**, to fill the screen with it. Very long drawn drills can be too long for a QR code; then send the link instead.
- The present button (a screen with a play mark, in the top bar on the iPad and wider screens) shows the key, the field and a large step caption, full screen where the browser allows it, and keeps the screen awake. Tap the field for the next step, **Step back** (or ←) to go back, and **Exit** (or Escape) to leave. iPad Safari doesn't always allow full screen; the app then uses the same layout inside the page. Added to the home screen, the app already fills the screen.
- The field always runs along the longer side of the screen. The offense attacks toward the pink end zone ("Score here").
- **Send feedback** (at the bottom of the options popover, in the editor's Drill tab, and in the tab of a pull request preview) reports a problem or an idea as a GitHub issue. A large panel shows a picture of the whole screen as it is at that moment, or, with **Just the field**, the field alone; draw on it with a finger or the Pencil to point at the problem (Undo, Clear, four colours). The picture is kept on the clipboard (with the drawing), and can also be saved or shared. **Write the issue on GitHub** opens a new issue already filled in: live app or preview and its commit, the drill, the step and time (in the editor: the step, tool and tab), the field, the screen and the browser, and a link that reopens the drill at that moment. Sign in to GitHub, paste or attach the picture, say what's wrong, and tap Submit. The issue gets the `feedback` label. The whole-screen picture is redrawn from the page, so it is close to the screen but not an exact screenshot: a page can't take one of itself on iPad Safari. For an exact one, take an iPad screenshot (top button + volume up) and use **Use my screenshot…** in the panel, or paste it there; on a desktop browser, **Take a real screenshot** asks to capture the tab. Links can carry a time after the drill, like `#angel&t=4`, to open at that moment.

Built in: vertical stack, horizontal stack, dump & swing, go-to drill, box drill, angel drill, and the angel drill with a fake and cut back.

## Drawing a drill

**Draw a new drill** opens the full-screen editor, starting from a blank field or from a copy of any built-in or saved drill. **Edit a copy** on a drill does the same for the one you're watching, and the Drill tab can also copy another drill in.

- **Tools** (left rail): Select, Offense, Defense, Group, Cone, Throw, Erase, and Multi for multi-select. Tools with options open them beside the tool.
- **Attacker labels** count 1, 2, 3 … 9, 10. The Offense and Group options take a start: `H` gives H1, H2 …, and `A10` starts at A10. Duplicate continues the copied player's numbering (a copy of A4 is A5). A label can be up to 4 characters.
- **Setup** is where everyone starts. Each **step** holds runs and at most one throw. A step can play without its run arrows (Step tab, **Show run arrows when playing**), for a step like a return to the line; its throw still shows, and the editor draws those runs faintly. For drills where each line has discs, a step can start with **a new disc** (Step tab, **Disc at the start**): with a player, or with whoever stands at a spot (marked on the field), with no throw back. The old disc stays with its player until they start running, then it's put away. Timing is automatic: the receiver and the disc reach the catch point together.
- **Drawing throws** (Throw tool): tap the receiver, and the throw goes from whoever has the disc. Tap another player for the next throw; it goes in the next step, added if needed. You can also drag from the thrower to the receiver. In Setup the throw goes in the step after the last throw, and the editor shows that step. To redraw a step's throw, tap its thrower first, then the new receiver. Who starts with the disc is set in Setup (or by the first tap when nobody has it yet).
- **Throws**: type (backhand, forehand, hammer, scoober, thumber, blade, push pass), flight (straight or bent), and an optional pump fake. Set them in the Step tab after drawing, or ahead of time in the Throw tool's options (tap Throw again).
- **Defense**: a defender can be free, follow an attacker, or mark: each player in a row, only the handler spot, or whoever has the disc. Each mark has a force (left, straight up, right). Facing can follow their player, watch the disc, or be fixed with the rotate handle.
- **Drill tab**: 7 v 7 or 5 v 5, full field (100 × 37 m) or small field (75 × 25 m), formations and defenses.
- **Tags** (Drill tab, under the summary): a few words for finding the drill later, such as *cutting*, *handlers* or *beginners*, up to 8. Type one and press Enter, or pick one already used; × removes it. Built-in drills come with theirs, and a copy keeps them.
- **Formations** (Drill tab, **Start from a formation**): vertical stack, vertical stack with dump, horizontal stack, side stack, spread, iso, split stack 3-2, dump and swing, end zone iso, end zone vertical stack and zone offense (poppers). Side stack, iso, split stack, dump and swing and end zone iso come in a left and a right version, mirror images of each other. Each is built for the chosen team size and field in `js/model/formation.js` (5 v 5 versions have fewer handlers or cutters), and H1 starts with the disc. Placing one writes the drill's summary (its name, the team size, what the setup is for and the defense picked); a new formation or defense replaces that text but leaves a summary you wrote yourself, and the hint says it was kept. The setups follow the tactics overview the formations were drawn from; where it was thin, standard coaching practice.
- **Defenses** (Drill tab, **Defense**): pictures of each defense on the attackers on the field now. Tapping one puts it on them (replacing any defenders), and a formation is placed with the defense picked. **No defense** removes them. Built in `js/model/defense.js`, relative to the disc, the thrower and the field:
  - person defense: force left, force right, straight up, force middle (the mark takes away the near sideline, everyone downfield shades to the middle) and trap left or right (the mark forces to that sideline; the defender whose player is nearest the line lane leaves them to help there). Each defender follows their player through every step, so the defense moves with the offense; the drill's force follows the choice.
  - zones: cup (cup of three, two wings, two deep), 3-3-1, 2-3-2, wall (1-3-3) and clam left or right. Zone defenders are free and watch the disc; the cup point and the wall's rabbit mark whoever has the disc. In the clam the mark and the handlers' defenders play person with the force and the rest cover the under lanes, the middle and deep. 5 v 5 (fewer than six attackers) uses smaller shapes: cup 3-2, 3-3-1 as 3-1-1, 2-3-2 as 2-2-1, wall 1-2-2.
  - The drill remembers the formation and defense picked (`formation` and `defense` in the saved drill, only when there is one): the pickers show them pressed, and the Defense chip names the defense.
  - Each picker folds (tap its header) to just the button picked, with its name in the header, so it takes less room. Folded or open is remembered in this browser.
- Keyboard: V O D G C T E switch tools, Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+S save, arrows nudge.
- **Pieces on top of each other**: with Select, the first tap picks the one on top and each further tap on the same spot picks the next one underneath. The hint says how many are there.

Drills you draw are saved in this browser (local storage). To move them all to another device or browser, open **Drills** and use **Back up to a file** at the bottom of the list, then **Restore from a file** on the other device. Restoring adds the drills in the file: drills you already have are skipped, and a different drill with the same id is added as a copy, so nothing is overwritten. To send a single drill, share its link.

## Team playbooks (team repos)

Each team keeps its drills in its own GitHub repo, one file per drill (`drills/<id>.json`), so git keeps every drill's history. The team's editor publishes drills from the app; everyone else sees them read-only, on any device, also offline. The first team is Sunset: `bremondr/ultimate-playbook-sunset`. The app reads and writes the repos with [git-store-kit](js/vendor/git-store-kit/README.md); there is no server.

- **Following a team.** Open the app with `#team=sunset` at the end of its address (`#team=owner/repo` names any other repo). The app remembers the teams it has opened, so a player in two teams sees both. The share popover gives each team's link and its QR code, for handing out at practice.
- **Reading.** At start the app loads every followed team; only changed files are downloaded. Team drills show in the drill list with the team's name as a tag (**Sunset**), next to the built-in drills and your own. They are read-only: **Edit a copy** makes your own copy. The **Teams** part under the list says when each team was last checked, or why it couldn't be loaded. The last good copy of each team stays on the device (IndexedDB), so its drills still show offline.
- **Publishing** (with a token for the team, below). Open one of your saved drills, tap Share, and **Publish to team** (with a team picker when you have tokens for several teams, and an optional note that becomes the commit message). It adds the drill, or replaces the team's copy of it by id. Drills you don't publish stay in your browser only. On a team drill, Share has **History** (its versions: open an old one, or restore it) and **Remove from team**. To change a team drill, tap **Edit** on it: it is saved as your own drill under the same id, and publishing it again replaces the team's copy. You see the change at once; other devices see it at their next load.
- **Conflicts.** If the team's copy changed since it was loaded (on another device, or on GitHub), the app asks: overwrite it with yours, keep theirs, or publish yours as a copy. Nothing is lost either way: GitHub keeps every version.
- **Teams and tokens…** (under the list, and in the options popover) opens the panel: the followed teams with their state, a token for each, reload, remove, and a field to follow another repo.
- **Restore from a file** also takes a single team drill file, for restoring one by hand.

**The file** is one drill in the app's own shape, written as indented JSON so GitHub's history shows each change: `{"type": "ultimate-playbook-drill", "version": 1, "id": …, …the drill…, "createdAt": …, "updatedAt": …}`. (The marker is `type`, because `format` is already the drill's 7 v 7 or 5 v 5.) Reading checks the type and then every field, as for shared links and backups (`js/features/team-format.js`).

**Adding a team.** Make a new repo `ultimate-playbook-<team>` (owned by `bremondr`; public, or private if the drills shouldn't be public) with a `drills/` folder, for example a `drills/README.md`. It doesn't need GitHub Pages. Nothing in the app changes: share `#team=<team>`.

**A token for publishing**, once per device and team (the same steps are in the panel under "How do I make a token?"):

1. On GitHub: Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token (https://github.com/settings/personal-access-tokens/new).
2. **Resource owner**: bremondr. **Expiration**: a date, for example in a year.
3. **Repository access**: Only select repositories → the team's repo only.
4. **Repository permissions** → Contents: **Read and write**. Nothing else (GitHub adds Metadata: Read-only itself).
5. Generate it and copy it (it starts with `github_pat_`; GitHub shows it only once).
6. In the app: Teams and tokens… → the team's **Add a token…** → paste → Save token. The panel then says "you can edit".

For readers of a private team repo, the same steps with Contents: **Read-only** give a token that can only read.

**Keep in mind.**

- A public repo is public: anyone with its name can read every drill and its history. Use a private repo when that matters.
- A token is kept in that browser's local storage and sent only to `api.github.com`, in the `Authorization` header. It never goes into share links, backups or Send feedback issues. Every app and preview on `bremondr.github.io` can read that storage, so give each token one repo, *Contents* only, and an expiry date.
- Previews have their own local storage (see Previews), so a token pasted on the live app isn't seen there. A token pasted in a preview does write to the real team repo; the app says so in a preview.
- When the page runs as a Claude artifact, it keeps its own team store and team repos are off.
- The service worker handles only the app's own files and Google Fonts, never `api.github.com` or `raw.githubusercontent.com`. If the page ever gets a Content-Security-Policy, its `connect-src` must allow those two hosts.
- Fine-grained tokens only reach repos owned by the account they are made for. Several editors means moving the team repos into a GitHub organisation (see #32 for other ways).

**Trying it without GitHub.** On a local server or in a pull request preview, add `?fakegithub` to the address (for example `http://localhost:8000/?fakegithub#team=sunset`). The teams then come from a GitHub in memory (git-store-kit's `fake-github.js`) with two teams, `sunset` and `tuesday`; the drawer shows a token to paste for publishing. It is kept apart from the real teams and starts again on every reload.

## On the iPad home screen, and offline

In Safari, tap Share, then **Add to Home Screen**. The app then opens full screen like an app, and it works without a connection once it has been opened online one time: a service worker (`sw.js`) stores all its files. Drills you draw stay in that browser's storage, so back them up to a file now and then (see above).

The service worker runs only on http(s) (GitHub Pages, or a local server), not when the app runs as a claude.ai artifact.

### Releasing a new version

Nothing to do by hand. `sw.js` serves the stored files first, so people get a change only when the service worker itself changes; the site build (`tools/build-site.mjs`) therefore writes `VERSION` (a hash of every published file) and `APP_FILES` (the list of them) into the published `sw.js`. Any change to an app file gives a new version: the new service worker stores the new files and deletes the old cache, and the next visit shows the new version. (`index.html` is fetched from the network first anyway.) The values in the repository's `sw.js` are only used when the folder is served as it is, for local testing.

## Project structure

Plain HTML, CSS and JavaScript modules: no build step and no dependencies. Because the scripts are ES modules, open the page through a web server (GitHub Pages, or `python3 -m http.server` in this folder), not straight from the file system.

- `CLAUDE.md`: how to work on this repository with Claude Code (ground rules, checks, workflow).
- `index.html`: markup only. It loads the stylesheets and `js/main.js`.
- `manifest.webmanifest`, `icons/`, `sw.js`, `js/pwa.js`: installing on the home screen and working offline. `js/pwa.js` registers the service worker.
- `css/`: `tokens.css` (colours, fonts, dark mode), `base.css`, `player.css` (playback screen and drill list), `shared.css` (buttons and form bits), `studio.css` (the editor).

The scripts are in layers. Every import points down the layers (or sideways within one), and imports never go round in a circle:

data → model → render → services (library, storage, share) → UI (player, nav, editor, features) → `main.js`

- `js/util.js`: small helpers (rounding, ids, `$`, which way the screen is turned). `js/events.js`: the event names and `on`/`emit`; see below.
- `js/data/`: plain data. `fields.js` (field sizes), `builtins.js` (the hand-timed built-in plays), `angel.js` (the two angel drills, written like drawn drills), `formations.js` (the formations and defenses offered in the editor).
- `js/model/`: the logic, no drawing. `compile.js` turns a play into timed runs and throws, `motion.js` gives where every player and the disc are at a moment (including marks), `timing.js` times a drawn drill automatically, `drafts.js` (blank drafts and copies for the editor), `throws.js` (throw types and grips), `formation.js` (formations and person defense), `defense.js` (the defenses offered on a formation), `facing.js` (where a defender looks), `search.js` (finding drills by words and tags), `tags.js` (what a tag may be).
- `js/render/`: SVG drawing. `view.js` (which field is drawn, which way it is turned, and whether the player or the editor has it), `svg.js` (field-to-screen mapping), `pitch.js` (the field), `pieces.js` (players, cones, throws, fakes, the disc), `thumb.js` (formation and defense previews).
- Services: `js/library.js` (built-in, saved and team drills; the built-in list is put together the first time it is needed), `js/storage.js` (saving in this browser, or the shared team store when the page runs as a Claude artifact), `js/share.js` (links with the drill packed in).
- `js/player.js` (playback), `js/nav.js` (drill list, popovers including Share, new-drill chooser).
- `js/features/`: self-contained features (UI layer), each wired in at a few commented points. `qr.js` (QR code encoder and the QR code in the share panel), `backup.js` (back up and restore drills as a `.json` file), `present.js` (presentation mode), `feedback.js` (Send feedback: what the playbook gives the feedback kit) with `feedback-issue.js` (what the issue says, no DOM), `team.js` (team repos: the team drills in the list, Publish to team, History, the panel) with `team-format.js` (the drill file, the commit messages and the team names, no DOM). Their styles are in `css/features.css`.
- `js/vendor/`: modules copied from [web-kit](https://github.com/bremondr/web-kit), the owner's reusable modules, each at a released version listed in `vendor.json`. `feedback-kit/`: the Send feedback panel, the picture and the drawing on it, and the issue address. `git-store-kit/`: items kept as JSON files in GitHub repos, with the offline copy, conflicts, history, tokens and the panel (team repos). Each one's `README.md` describes it. Don't edit these copies: change the module in web-kit, release it, and update (see Development).
- `js/editor/`: the drill editor.
  - `studio.js` opens, closes, previews, saves and deletes, and wires the editor's events.
  - `session.js` (the drill being drawn, the step on screen, the tool in hand, the selection), `history.js` (undo and redo), `canvas.js` (drawing the draft and asking where things are), `hint.js` (the hint line), `tabs.js` (the property tabs and the bottom sheet), `viewport.js` (zoom and turning the field).
  - `tools/`: one module per tool (`select`, `offense`, `defense`, `group`, `cone`, `throw`, `erase`) with its pointer handling, hint text and options; `index.js` lists them. `pointer.js` passes taps and drags on the field to the tool in hand; `rail.js` is the tool rail, the options tray beside it and the tool's hint.
  - `selection.js` (Selected tab), `step-tab.js` (step strip and Step tab), `drill-tab.js` (Drill tab and formations), `pieces.js` (adding and removing players and cones), `text-fields.js`, `keys.js`.

**State** lives in a few small stores, each owned by the module that changes it: the view (`render/view.js`), the player (`player.js`: the drill on screen, playing or not), the library and the store (`library.js`: saved drills and team drills; `storage.js`: where they are saved and whether you may save), and the editing session (`editor/session.js`; the editor's smaller bits of state stay with the module that uses them, such as the undo stacks in `history.js` or the zoom in `viewport.js`). Other modules read their exported values directly (ES modules give them a live, read-only view) and change them only through the functions the owner exports, for example `setField(f)` or `setSelIds(ids)`.

**Events.** When a lower module needs a higher one to react, it calls `emit('name')` instead of importing it: for example the player asks for the editor with `emit('edit', draft)`, and the editor's canvas announces `emit('editor-drawn')` so the panels around the field catch up. The event names are listed in `js/events.js`, and only `main.js` (for the app) and `editor/studio.js` (inside the editor) subscribe, so every reaction is listed in one place.

## Development

There is nothing to build. Three checks:

- `node tools/check-imports.mjs` checks that the modules have no import cycles, that every import points down the layers, and that each module in `js/vendor/` imports only from itself. Plain Node, no packages.
- `node --test tests/*.test.mjs` runs the unit tests: attacker labels (`tests/labels.test.mjs`), the feedback issue, from the playbook and from the kit, and times in links (`tests/feedback.test.mjs`), and team repo drill files, commit messages, publishing, conflicts and history against git-store-kit's GitHub in memory (`tests/team.test.mjs`). Plain Node. (The site build's own tests live in web-kit, with the build.)
- `python3 tests/regression.py` serves the folder with `python3 -m http.server`, opens it in headless Chrome with Python Playwright, and checks that there are no page or console errors, the main player and editor flows on an iPad-sized and a phone-sized screen, saving to a mocked team store (as when the page runs as a Claude artifact), team repos against the GitHub in memory (`?fakegithub`), and the model output of every built-in drill against `tests/baseline.json`. It needs Python Playwright (`pip install playwright`) and a Chrome: `CHROME_PATH` if set, else `/usr/bin/google-chrome` (as in CI), else Playwright's own Chromium (`python -m playwright install chromium`, the easy way on Windows and macOS). After a deliberate change to the model, rewrite the baseline with `--update-baseline`. `--trace FILE` and `--shots DIR` record what each step showed, to compare two versions (`--root DIR` serves another copy of the app).

### Modules from web-kit

`js/vendor/` holds plain copies of modules released in [web-kit](https://github.com/bremondr/web-kit); `vendor.json` says which version of each. `tools/update-vendor.mjs` (a copy of web-kit's `consumer/update-vendor.mjs`) updates them, run from this folder:

```sh
node tools/update-vendor.mjs --check     # is there a newer release?
node tools/update-vendor.mjs             # take the newest release with the same major version
node tools/update-vendor.mjs --verify    # are the copies exactly their releases?
```

`.github/workflows/update-vendor.yml` runs it every day, by hand (Actions, Update vendored modules, Run workflow), and when web-kit announces a release. When there is something new, it opens a pull request from the branch `vendor-update` with the changelog, and the pull request gets its checks and preview like any other. For that, the repository needs a `VENDOR_PR_TOKEN` secret; the top of the workflow says which token. Without it, the pull request is opened with the workflow's own token: then "Allow GitHub Actions to create and approve pull requests" must be on (Settings, Actions, General), and checks and the preview start only after the pull request is closed and reopened.

## Previews of pull requests

Every open pull request from this repository gets its own copy of the app on the GitHub Pages site, so a change can be tried on the iPad before it is merged:

| Version | Address |
|---|---|
| Live app | https://bremondr.github.io/ultimate-playbook/ (built from `main`) |
| Preview | https://bremondr.github.io/ultimate-playbook/preview/pr-NUMBER/ |
| List of previews | https://bremondr.github.io/ultimate-playbook/preview/ |

Opening or pushing to a pull request updates its preview, and a comment on the pull request links to it. Closing or merging the pull request removes it. Pull requests from forks don't get one.

A preview differs from the live app in three ways, all added when the site is built (the app's own files never contain them):

- **Its own saved drills.** Every version shares one browser origin, so `tools/preview-runtime.js` gives each preview its own storage keys (`preview:pr-NUMBER:`, also on IndexedDB and Cache Storage names): a preview never sees or changes the live app's drills, or another preview's. The app sees the preview's description (label, commit) as `window.PLAYBOOK_PREVIEW`.
- **A small tab** in the bottom-right corner (Preview PR #NUMBER). Tap it for the commit and links to the pull request, the same page in the live app and the other previews; × hides it. Its **Feedback** link opens the app's Send feedback panel (it fires a cancelable `playbook:feedback` event), and the tab itself is left out of the picture; on a preview of a version without that panel it opens a new issue with only the preview filled in.
- **No offline mode.** Its service worker is replaced with one that does nothing, because the caches are shared by every version too. It also isn't listed by search engines.

Share links made in a preview open in that preview.

**Where the files come from.** `.github/workflows/pages.yml`, `tools/build-site.mjs` and `tools/preview-runtime.js` are copies of `consumer/pages.yml`, `consumer/build-site.mjs` and `consumer/preview-runtime.js` in [web-kit](https://github.com/bremondr/web-kit), shared by every project that has previews. Don't edit them here: change them in web-kit, and copy them again when web-kit's [`consumer/CHANGELOG.md`](https://github.com/bremondr/web-kit/blob/main/consumer/CHANGELOG.md) says so ("Adding previews to a project", step 1, in web-kit's `docs/setup-project.md`). What is the playbook's own is in `site.json`: what is published, the service worker, the checks that must pass on `main`, the Feedback link and its event, the `PLAYBOOK_PREVIEW` name, and the bot comment. The options are described at the top of `tools/build-site.mjs`.

**How it works.** `.github/workflows/pages.yml` runs on every push to `main`, on pull request events and by hand (Actions, Deploy site, Run workflow). It checks `main` (the `checks` in `site.json`), fetches the open pull requests, and builds the whole site with `tools/build-site.mjs`, reading each version straight from git; then a second job deploys it and comments. A pull request closed by a merge gets no build of its own: the push to `main` publishes the site without its preview. If a deploy fails, use "Re-run failed jobs" or run the workflow by hand, not "Re-run all jobs". It uses `pull_request_target`, so the workflow, the build script and `site.json` that run are always the ones on `main`, and a pull request's code is never run in CI. A change to how the site is built therefore only shows in previews after it is merged. At most 20 previews are published. `.github/workflows/test.yml` runs the checks (below) on every pull request.

To build the same folder locally from any branches:

```sh
node tools/build-site.mjs --run-checks
echo '[{"number": 16, "ref": "my-branch"}]' > previews.json
node tools/build-site.mjs --out _site --main main --previews previews.json --repo bremondr/ultimate-playbook
python3 -m http.server -d _site
```

(`--repo` gives the badge its pull request and Feedback links.)

**Setting it up (once).** In the repository, Settings, Pages, Build and deployment, set Source to **GitHub Actions** (or `gh api -X PUT repos/bremondr/ultimate-playbook/pages -f build_type=workflow`), then run the workflow once. To go back, set the source to "Deploy from a branch", `main`; the site then has only the live app.

## To do

Planned features are tracked as [GitHub issues](https://github.com/bremondr/ultimate-playbook/issues).
