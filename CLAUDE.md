# Working on Ultimate Playbook

Animated ultimate frisbee plays and drills, with a drill editor. Made first for the iPad (Safari, landscape and portrait, touch), then phones and desktops. Live at https://bremondr.github.io/ultimate-playbook/.

Read `README.md` first: it describes the features, the module layers, where state lives, the events, and the checks. Keep it up to date when a feature or the structure changes.

## Ground rules

- Plain HTML, CSS and ES modules. No build step, no packages, no frameworks. Serve the folder (`python -m http.server`) to run it.
- Imports point down the layers (data → model → render → services → UI → `main.js`) and never form a cycle. `tools/check-imports.mjs` enforces it.
- New features that stand on their own go in `js/features/` and are wired in at a few commented points.
- `js/feedback-kit/` is meant for other projects too: keep it free of anything playbook-specific (that goes in `js/features/feedback.js`), and keep its `README.md` up to date.
- Everything written in the repository (code comments, README, issues, PRs, commit messages) is in English, in plain words. The owner often gives feedback in Czech.
- Don't bump `VERSION` or edit `APP_FILES` in `sw.js` by hand for releases: the site build fills both in. Add a new file to `APP_FILES` only to keep local offline testing complete.
- `tests/baseline.json` holds the model output of every built-in drill. Rewrite it (`python tests/regression.py --update-baseline`) only after a deliberate change to the model, and say so in the PR.

## Checks (run all three before opening a PR)

```sh
node tools/check-imports.mjs
node --test tools/*.test.mjs tests/*.test.mjs
python tests/regression.py
```

The regression check needs `pip install playwright` and a Chrome (on Windows and macOS: `python -m playwright install chromium`). Add unit tests in `tests/*.test.mjs` for logic that can run in plain Node (`js/model/` modules have no DOM).

## Workflow

- One branch and one pull request per issue, with `Fixes #N` in the description. Open work is in the GitHub issues; milestones with a due date come first.
- Every open pull request gets a preview at `https://bremondr.github.io/ultimate-playbook/preview/pr-N/` (a bot comments the link). The owner tries it on the iPad and then asks for the merge, so don't merge before that.
- Merged branches are deleted automatically.
- Feedback from the app arrives as issues with the `feedback` label ("fix the open feedback issues" means those). Each one has a **Reopen** link to the drill at the moment it was sent (`#…&t=SECONDS`); it points at the public site or the preview, so open the part after `#` on a local server in headless Chrome to see the same thing. The table under it says the screen size, orientation, theme and, in the editor, the tool and tab. The pasted picture shows only the field.
- To reproduce a bug, drive the app in headless Chrome (Playwright), as `tests/regression.py` does; its `Run` helpers (`tap_field`, `piece_xy`, `tool`, `tab`, `drag`) can be imported. Check visual changes with screenshots at iPad (1180 × 820 and 820 × 1180) and phone (390 × 844) sizes.
- To try a change on the iPad before pushing: `python -m http.server 8000 --bind 0.0.0.0`, then open `http://<this computer's IP>:8000` on the iPad (same Wi-Fi). Offline mode doesn't run there (it needs https).
