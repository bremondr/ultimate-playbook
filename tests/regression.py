#!/usr/bin/env python3
"""Regression check for Ultimate Playbook.

Serves the folder with `python3 -m http.server`, opens it in headless Chrome (Python Playwright) and checks:
  1. no page errors and no console errors;
  2. the main player and editor flows, on an iPad-sized and a phone-sized screen;
  3. the saved-drills path through a mocked `window.claude` team store (as when the page runs as a Claude artifact);
  4. the model output (positions, disc, facing, marks, timing) of every built-in drill, against tests/baseline.json.

    python3 tests/regression.py                    # run every check
    python3 tests/regression.py --update-baseline  # rewrite tests/baseline.json (only after a deliberate change)

--root serves another copy of the app (for example an older version), --trace writes what each step of the flows
showed to a JSON file, and --shots saves screenshots, so two versions can be compared.
"""
import argparse, json, os, pathlib, socket, subprocess, sys, time, urllib.request
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
BASELINE = HERE / 'baseline.json'
# Chrome to test with: CHROME_PATH if set, else Chrome where Linux CI has it, else Playwright's own Chromium
# (python -m playwright install chromium), which is how it runs on Windows and macOS.
CHROME = os.environ.get('CHROME_PATH') or ('/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None)
VIEWPORTS = {'ipad': (1180, 820), 'phone': (390, 844)}

# Same random ids and clock on every run, so the traces of two versions can be compared line by line.
# Each page load in a tab starts from its own point, so ids made after a reload don't repeat earlier ones.
DETERMINISM = """(() => {
  let k = 1; try { k = +(sessionStorage.getItem('det-loads') || 0) + 1; sessionStorage.setItem('det-loads', k); } catch (e) {}
  let s = 7 * k; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let now = 1767225600000 + k * 1e8; Date.now = () => (now += 1000);
})();"""

# A stand-in for the Claude artifact runtime: an in-memory team store that answers like the real one.
MOCK_CLAUDE = """(() => {
  const docs = new Map(), subs = [];
  const snap = () => ({metadata:{fromCache:false}, docs:[...docs.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    .map(([id, d]) => ({id, data: () => JSON.parse(JSON.stringify(d))}))});
  const notify = () => setTimeout(() => subs.forEach(f => f(snap())));
  const db = {collection: () => ({
    orderBy: () => ({onSnapshot(cb){ subs.push(cb); setTimeout(() => cb(snap())); return () => {}; }}),
    doc: id => ({set: async d => { docs.set(id, d); notify(); }, delete: async () => { docs.delete(id); notify(); }})})};
  const user = {can: async () => CAN_WRITE};
  window.claude = {use: async kind => kind === 'db' ? db : kind === 'user' ? user : null};
})();"""

# Everything the model computes for the built-in drills, sampled every 0.2 s.
MODEL_DUMP = """async base => {
  const imp = p => import(base + p);
  const {builtins} = await imp('js/library.js');
  const {compile} = await imp('js/model/compile.js');
  const {discAt, facingDef, markTargetAt, pos, stepAt} = await imp('js/model/motion.js');
  const {faceTarget} = await imp('js/model/facing.js');
  const {timeDraft} = await imp('js/model/timing.js');
  const {copyOfBuiltin} = await imp('js/model/drafts.js');
  const {readRaw, serialize} = await imp('js/storage.js');
  const r = v => Math.round(v*1000)/1000, pt = q => q && [r(q[0]), r(q[1])];
  const out = {};
  for (const play of builtins()){
    const m = compile(play), frames = [];
    for (let k = 0; k/5 <= m.total + 1e-9; k++){
      const t = k/5, d = discAt(m, t), f = {t, step: stepAt(m, t), disc: d && [r(d.x), r(d.y), r(d.h), d.holder], pos: {}, face: {}, mark: {}};
      for (const id in m.P){
        const p = pos(m, id, t), def = m.P[id].def; f.pos[id] = pt(p);
        if (def.team === 'D'){ f.face[id] = pt(faceTarget(p, facingDef(m, def, t), o => pos(m, o, t), d && [d.x, d.y])); if (def.mark) f.mark[id] = markTargetAt(m, id, t); }
      }
      frames.push(f);
    }
    const copy = copyOfBuiltin(play);
    out[play.id] = {play, starts: m.starts, total: m.total, throws: m.throws, fakes: m.fakes, marks: m.marks,
      frames, copy: timeDraft(copy), saved: readRaw(serialize(copy))};
  }
  return JSON.parse(JSON.stringify(out));
}"""

STATE = """() => {
  const q = s => document.querySelector(s), t = s => q(s) && q(s).textContent, h = s => q(s) && q(s).outerHTML;
  const vals = {}; document.querySelectorAll('#studio input, #studio select, #studio textarea, #opts-pop input, #share-link')
    .forEach(e => vals[e.id] = e.type === 'checkbox' ? e.checked : e.value);
  return {hash: location.hash, pkind: t('#pkind'), pname: t('#pname'), cap: [t('#cap-n'), t('#cap-title'), t('#cap-note'), t('#cap-meta')],
    time: t('#time'), act: q('#act').hidden ? null : t('#act'), sync: t('#sync'), editing: !q('#studio').hidden,
    hint: t('#hint'), sstate: t('#s-state'), strip: t('#strip'), vals, field: h('#field'), nav: h('#nav'), steps: h('#steps'),
    panel: h('#sinsp'), tray: q('#tray').hidden ? null : h('#tray'), pops: ['#info-pop', '#opts-pop', '#share-pop', '#drawer'].filter(s => !q(s).hidden)};
}"""

# field metres to a point on the screen, the same way the app maps them
FIELD_XY = """([x, y]) => {
  const svg = document.querySelector('#field'), vb = svg.viewBox.baseVal, h = vb.y > -2;
  const p = svg.createSVGPoint(); [p.x, p.y] = h ? [x, y] : [y, -x];
  const s = p.matrixTransform(svg.getScreenCTM()); return [s.x, s.y];
}"""


class Run:
    def __init__(self, page, name, trace, shots):
        self.page, self.name, self.trace, self.shots, self.failures = page, name, trace, shots, []

    def check(self, ok, what):
        if not ok: self.failures.append(f'{self.name}: {what}')

    def snap(self, label):
        """Record what the page shows now (for --trace and --shots)."""
        if self.trace is not None: self.trace.append({'run': self.name, 'at': label, **self.page.evaluate(STATE)})
        if self.shots: self.page.screenshot(path=str(pathlib.Path(self.shots) / f'{self.name}-{label}.png'), animations='disabled', caret='initial')

    # small helpers
    def text(self, sel): return self.page.text_content(sel)
    def click(self, sel): self.page.click(sel)
    def visible(self, sel): return self.page.is_visible(sel)
    def wait(self, js, arg=None): self.page.wait_for_function(js, arg=arg, timeout=10000)
    def field_xy(self, x, y): return self.page.evaluate(FIELD_XY, [x, y])
    def tap_field(self, x, y): self.page.mouse.click(*self.field_xy(x, y))

    def piece_xy(self, pid):
        b = self.page.locator(f'#g-players [data-id="{pid}"], #g-cones [data-id="{pid}"]').first.bounding_box()
        return b['x'] + b['width']/2, b['y'] + b['height']/2

    def drag(self, a, b):
        m = self.page.mouse; m.move(*a); m.down()
        for k in range(1, 6): m.move(a[0] + (b[0]-a[0])*k/5, a[1] + (b[1]-a[1])*k/5)
        m.up()

    def tool(self, name):
        self.click(f'#trail .tool[data-tool="{name}"]')
        if self.visible('#tray'): self.click('#tray-close')

    def tab(self, name):
        self.click(f'#tab-{name}')

    def fold(self):
        # on a phone the properties open as a bottom sheet over the field: fold it away before tapping the field
        if self.page.evaluate("getComputedStyle(document.querySelector('#sheet-toggle')).display !== 'none' && !document.querySelector('.sgrid').classList.contains('folded')"):
            self.click('#sheet-toggle')

    def saved_here(self): return self.page.evaluate("Object.keys(JSON.parse(localStorage.getItem('ub-team-drills') || '{}')).length")


def player_flow(r, base):
    p = r.page
    p.goto(base); r.wait("document.querySelector('#pname').textContent !== '—'")
    r.check(r.text('#pname') == 'Vertical stack: under & deep', 'first drill shown')
    r.check(p.locator('#steps li').count() == 3, 'three step buttons')
    r.check(r.text('#sync') == 'Drills you draw are saved in this browser only.', 'local store message')
    r.snap('boot')
    r.click('#next'); r.check(r.text('#cap-n') == 'Step 2 of 3', 'next button')
    p.keyboard.press('ArrowRight'); r.check(r.text('#cap-n') == 'Step 3 of 3', 'arrow right')
    p.keyboard.press('ArrowLeft'); p.keyboard.press('ArrowLeft'); r.check(r.text('#cap-n') == 'Step 1 of 3', 'arrow left')
    # a tap on the field plays one step and stops at its end
    r.tap_field(60, 30); r.wait("document.querySelector('#play').getAttribute('aria-label') === 'Pause'")
    r.wait("document.querySelector('#play').getAttribute('aria-label') === 'Play'")
    r.check(r.text('#cap-n') == 'Step 2 of 3' and r.text('#time') == '2.8 / 8.0 s', 'tap plays one step')
    r.snap('after-tap')
    p.eval_on_selector('#scrub', "e => { e.value = 5; e.dispatchEvent(new Event('input')); }")
    r.check(r.text('#time') == '5.0 / 8.0 s', 'scrub')
    r.snap('scrubbed')
    # options: speed, arrows, defense; saved as preferences
    r.click('#opts'); r.check(r.visible('#opts-pop'), 'options open')
    r.click('#speed button[data-s="2"]'); r.click('#t-arrows'); r.click('#t-def')
    r.check(p.locator('#g-paths > *').count() == 0, 'arrows hidden')
    prefs = json.loads(p.evaluate("localStorage.getItem('ub-prefs')"))
    r.check(prefs == {'speed': 2, 'pause': False, 'loop': True, 'arrows': False, 'def': False}, f'prefs saved {prefs}')
    r.snap('options')
    r.click('#t-arrows'); r.click('#t-def'); r.click('#speed button[data-s="1"]')
    p.keyboard.press('Escape'); r.check(not r.visible('#opts-pop'), 'escape closes options')
    r.click('#info'); r.check(r.text('#psum').startswith('Front of the stack'), 'summary')
    r.snap('info')
    # the drill list
    r.click('#menu'); r.check(r.visible('#drawer'), 'drawer open')
    r.check(p.locator('#nav .item').count() == 7, 'seven built-in drills')
    r.snap('drawer')
    r.click('#nav .item[data-id="angel"]'); r.wait("document.querySelector('#pname').textContent === 'Angel drill'")
    r.check(p.evaluate('location.hash') == '#angel' and not r.visible('#drawer'), 'pick from list')
    r.snap('angel')
    r.click('#share'); r.wait("document.querySelector('#share-link').value.includes('#')")
    r.check(p.input_value('#share-link') == 'https://bremondr.github.io/ultimate-playbook/#angel', 'built-in link')
    r.snap('share-builtin')
    p.keyboard.press('Escape')
    p.goto(base + '#d=zBroken'); r.wait("document.querySelector('#pkind').textContent.includes('damaged')")
    r.check(r.text('#pname') == 'Vertical stack: under & deep', 'damaged link falls back to the first drill')
    p.goto(base + '#box'); r.wait("document.querySelector('#pname').textContent === 'Box drill'")
    p.evaluate('document.activeElement.blur()')   # Space on a focused button would press that button instead
    p.keyboard.press(' '); r.wait("document.querySelector('#play').getAttribute('aria-label') === 'Pause'")
    p.keyboard.press(' '); r.check(p.get_attribute('#play', 'aria-label') == 'Play', 'space pauses')


def editor_flow(r, base):
    p = r.page
    p.goto(base + '#go-to'); r.wait("document.querySelector('#pname').textContent === 'Go-to drill'")
    r.check(r.text('#act') == 'Edit a copy', 'edit a copy button')
    r.click('#act'); r.check(r.visible('#studio'), 'editor open')
    r.check(p.input_value('#s-name') == 'Go-to drill (copy)', 'copy name')
    r.snap('copy-open')
    r.fold(); r.click('#zoom button[data-z="fit"]')   # the go-to drill sits outside the default attacking-half view
    # step 1: drag a player to draw a run, then undo and redo it
    r.click('#strip .sbtn:nth-of-type(2)')
    r.fold()
    a = r.piece_xy('C2'); r.drag(a, (a[0] + 60, a[1] + 40))
    r.check(r.text('#s-state') == 'Unsaved changes' and p.is_enabled('#s-undo'), 'run drawn')
    r.snap('run-drawn')
    r.click('#s-undo'); r.click('#s-redo'); r.snap('undo-redo')
    # throw tool: thrower, then receiver
    p.keyboard.press('t'); r.check(r.visible('#tray') and r.text('#tray-title') == 'Next throw', 'throw options')
    r.click('#tray-close')
    r.page.mouse.click(*r.piece_xy('T1')); r.page.mouse.click(*r.piece_xy('C2'))
    r.check(r.text('#tb-title') == 'Throw: T1 → C2', 'throw redrawn')
    r.snap('throw')
    r.fold()
    # preview and back
    r.click('#s-preview'); r.check(r.text('#pkind') == 'Preview · not saved yet', 'preview')
    r.snap('preview')
    r.click('#act'); r.check(r.visible('#studio'), 'back to editing')
    # save, then back to playback shows the saved drill
    r.click('#s-save'); r.wait("document.querySelector('#s-state').textContent === 'Saved in this browser'")
    r.check(r.saved_here() == 1, 'saved in local storage')
    r.snap('saved')
    r.click('#s-close'); r.wait("document.querySelector('#pkind').textContent === 'Drill · saved here'")
    r.check(r.text('#pname') == 'Go-to drill (copy)' and r.text('#act') == 'Edit', 'saved drill shown')
    r.click('#menu'); r.check(p.locator('#nav .tag').all_text_contents() == ['Mine'], 'tagged as mine')
    r.snap('saved-list'); r.click('#drawer-close')
    # a link to a saved drill works from a fresh start, once the saved drills have loaded
    p.reload(); r.wait("document.querySelector('#pkind').textContent === 'Drill · saved here'")
    r.check(r.text('#pname') == 'Go-to drill (copy)', 'saved drill from a link'); r.snap('reloaded')
    # share the drawn drill as a packed link, open it, save the copy
    r.click('#share'); r.wait("document.querySelector('#share-link').value.includes('#d=')")
    link = p.input_value('#share-link'); r.snap('share-drawn'); p.keyboard.press('Escape')
    p.goto(base + link[link.index('#'):]); r.wait("document.querySelector('#pkind').textContent.includes('shared')")
    r.check(r.text('#pkind') == 'Drill · shared with you' and r.text('#pname') == 'Go-to drill (copy)', 'shared link opens')
    r.snap('shared')
    r.click('#act'); r.wait("document.querySelector('#pkind').textContent === 'Drill · saved here'")
    r.check(r.saved_here() == 2, 'shared drill saved')
    # a new drill from a blank field
    r.click('#menu'); r.click('#new'); r.click('#new-blank')
    r.check(r.visible('#studio') and p.input_value('#s-name') == 'New drill', 'blank drill')
    r.snap('blank'); r.fold()
    r.tool('off'); [r.tap_field(x, y) for x, y in ((50, 10), (50, 27), (60, 18.5))]
    r.tool('def'); r.tap_field(52, 11)
    r.tool('group'); r.tap_field(75, 8)
    r.tool('cone'); r.tap_field(85, 30)
    r.check(p.locator('#g-players [data-kind="player"]').count() == 9 and p.locator('#g-cones [data-kind="cone"]').count() == 1, 'pieces added')
    r.snap('pieces')
    r.tool('erase'); p.mouse.click(*r.piece_xy(p.get_attribute('#g-cones [data-kind="cone"]', 'data-id')))
    r.check(p.locator('#g-cones [data-kind="cone"]').count() == 0, 'cone erased')
    # select a defender and make them mark
    r.tool('select'); d = p.get_attribute('#g-players .dteam[data-kind="player"]', 'data-id'); p.mouse.click(*r.piece_xy(d))
    r.check(r.text('#sel-title') == '1 defender', 'defender selected')
    r.tab('sel'); r.click('#sel-role button[data-r="mark"]'); r.snap('mark'); r.fold()
    # box select in setup
    r.drag(r.field_xy(66, 4), r.field_xy(80, 14)); r.check(r.text('#hint').startswith('4 selected'), f'box select: {r.text("#hint")}')
    r.tab('sel'); r.click('#sel-arrange [data-ar="spread"]'); r.click('#sel-dup'); r.snap('box-dup'); r.fold()
    # drill tab: formation, small field, force, person defense
    r.tab('drill'); r.click('#e-forms .fbtn[data-form="ho"]')
    r.click('#e-field button[data-fd="small"]'); r.click('#e-force button[data-fc="left"]'); r.click('#e-person')
    r.snap('formation'); r.fold()
    r.click('#zoom button[data-z="fit"]')
    # step 1: a run and a throw
    r.click('#strip .sbtn:nth-of-type(2)'); r.fold()
    a = r.piece_xy('c2'); r.drag(a, (a[0] + 50, a[1] - 30))
    p.keyboard.press('t'); r.click('#tray-close')
    p.mouse.click(*r.piece_xy('h1')); p.mouse.click(*r.piece_xy('c2'))
    r.check(r.text('#tb-title') == 'Throw: H1 → 2', f'throw in step 1: {r.text("#tb-title")}')
    r.tab('step'); p.fill('#e-title', 'Under cut'); p.keyboard.press('Tab')
    r.snap('step1')
    r.click('#strip .sbtn.add'); r.check(r.text('#st-h') == 'Step 2 of 2', 'step added')
    p.keyboard.press('Control+z'); r.check(r.text('#st-h') == 'Step 1 of 1', 'undo add step')
    r.snap('undo-step')
    # leaving with unsaved changes asks first
    r.click('#s-close'); r.check(r.text('#s-close-t') == 'Discard changes and go back?', 'close armed')
    r.click('#s-close'); r.check(not r.visible('#studio'), 'closed')
    r.snap('discarded')
    # delete a saved drill
    r.click('#menu'); r.page.locator('#nav .item:has(.tag)').first.click(); r.click('#act')
    r.tab('drill'); r.click('#e-delete'); r.click('#e-delete')
    r.wait("document.querySelector('#pname').textContent === 'Vertical stack: under & deep'")
    r.check(p.evaluate('location.hash') == '#vert-stack' and r.saved_here() == 1, 'drill deleted')
    r.snap('deleted')


def team_flow(r, base, can_write):
    p = r.page
    p.goto(base); r.wait("document.querySelector('#sync').textContent.startsWith('No team drills')")
    if not can_write:
        r.check(r.text('#sync') == 'No team drills yet.' and not r.visible('#new') and not r.visible('#act'), 'read-only team store')
        r.snap('readonly'); return
    r.check(r.text('#sync') == 'No team drills yet. Draw one and it’s shared with everyone who opens this page.', 'team store message')
    r.click('#menu'); r.click('#new'); r.click('#new-blank'); r.fold()
    r.tool('off'); r.tap_field(55, 12)
    r.click('#s-save'); r.wait("document.querySelector('#s-state').textContent === 'Saved for the team'")
    r.wait("document.querySelector('#sync').textContent.startsWith('1 team drill')")
    r.check(r.text('#sync') == '1 team drill, shared with everyone who opens this page.', 'team drill saved')
    r.click('#s-close'); r.wait("document.querySelector('#pkind').textContent === 'Drill · team'")
    r.click('#menu'); r.check(p.locator('#nav .tag').all_text_contents() == ['Team'], 'tagged as team')
    r.snap('team-saved')


def model_dump(page, base):
    page.goto(base); page.wait_for_function("document.querySelector('#pname').textContent !== '—'")
    return page.evaluate(MODEL_DUMP, base)


def serve(root):
    with socket.socket() as s: s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
    proc = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(root)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f'http://127.0.0.1:{port}/'
    for _ in range(100):
        try: urllib.request.urlopen(base, timeout=1); return proc, base
        except OSError: time.sleep(.1)
    proc.kill(); raise SystemExit('the local server did not start')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--root', default=str(HERE.parent), help='folder to serve (default: this repository)')
    ap.add_argument('--update-baseline', action='store_true', help='write the model dump to tests/baseline.json')
    ap.add_argument('--trace', help='write what each flow step showed to this JSON file')
    ap.add_argument('--shots', help='save screenshots in this folder')
    args = ap.parse_args()
    if args.shots: pathlib.Path(args.shots).mkdir(parents=True, exist_ok=True)
    proc, base = serve(args.root)
    failures, trace = [], ([] if args.trace else None)
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])

            def page_for(name, size, *scripts):
                ctx = browser.new_context(viewport={'width': size[0], 'height': size[1]})
                ctx.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200, body=''))
                for s in (DETERMINISM, *scripts): ctx.add_init_script(s)
                page = ctx.new_page()
                page.on('pageerror', lambda e: failures.append(f'{name}: page error: {e}'))
                page.on('console', lambda m: m.type == 'error' and failures.append(f'{name}: console error: {m.text}'))
                return Run(page, name, trace, args.shots)

            for vp, size in VIEWPORTS.items():
                for flow in (player_flow, editor_flow):
                    r = page_for(f'{flow.__name__[:-5]}-{vp}', size)
                    try: flow(r, base)
                    except Exception as e: r.failures.append(f'{r.name}: stopped: {e}')
                    failures += r.failures; r.page.context.close()
            for can in (True, False):
                r = page_for(f'team-{"write" if can else "read"}', VIEWPORTS['ipad'], MOCK_CLAUDE.replace('CAN_WRITE', json.dumps(can)))
                try: team_flow(r, base, can)
                except Exception as e: r.failures.append(f'{r.name}: stopped: {e}')
                failures += r.failures; r.page.context.close()

            r = page_for('model', VIEWPORTS['ipad'])
            dump = json.dumps(model_dump(r.page, base), indent=1, sort_keys=True, ensure_ascii=False) + '\n'
            if args.update_baseline:
                BASELINE.write_text(dump, encoding='utf-8'); print(f'wrote {BASELINE}')
            elif dump != BASELINE.read_text(encoding='utf-8'):
                failures.append('model: output differs from tests/baseline.json')
            browser.close()
    finally:
        proc.terminate(); proc.wait()
    if args.trace: pathlib.Path(args.trace).write_text(json.dumps(trace, indent=1, ensure_ascii=False), encoding='utf-8')
    for f in failures: print('FAIL', f)
    print('regression check:', 'FAILED' if failures else 'passed')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
