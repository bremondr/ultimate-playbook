#!/usr/bin/env python3
"""Regression check for Ultimate Playbook.

Serves the folder with `python3 -m http.server`, opens it in headless Chrome (Python Playwright) and checks:
  1. no page errors and no console errors;
  2. the main player and editor flows (with drawing throws, tags, practice plans, arrows per step, new discs, and Send feedback), on an iPad-sized and a phone-sized screen;
  3. the saved-drills path through a mocked `window.claude` team store (as when the page runs as a Claude artifact),
     and team repos (js/features/team.js) against the GitHub in memory that ?fakegithub plugs in: following a team
     from its link, its drills in the list, a token, Publish to team, a conflict, history and Remove from team; the
     demo team followed by default, read from its index with no API requests, and removed for good;
  4. the model output (positions, disc, facing, marks, timing) of every built-in drill, against tests/baseline.json.

    python3 tests/regression.py                    # run every check
    python3 tests/regression.py --update-baseline  # rewrite tests/baseline.json (only after a deliberate change)

--root serves another copy of the app (for example an older version), --trace writes what each step of the flows
showed to a JSON file, and --shots saves screenshots, so two versions can be compared.
"""
import argparse, json, os, pathlib, socket, subprocess, sys, time, urllib.parse, urllib.request
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
    r.check(r.text('#pname') == 'Angel drill', 'first drill shown')
    r.check(p.locator('#steps li').count() == 6, 'six step buttons')
    r.check(r.text('#sync') == 'Drills you draw are saved in this browser only.', 'local store message')
    r.snap('boot')
    r.click('#next'); r.check(r.text('#cap-n') == 'Step 2 of 6', 'next button')
    p.keyboard.press('ArrowRight'); r.check(r.text('#cap-n') == 'Step 3 of 6', 'arrow right')
    p.keyboard.press('ArrowLeft'); p.keyboard.press('ArrowLeft'); r.check(r.text('#cap-n') == 'Step 1 of 6', 'arrow left')
    # a tap on the field plays one step and stops at its end
    r.tap_field(45, 30); r.wait("document.querySelector('#play').getAttribute('aria-label') === 'Pause'")
    r.wait("document.querySelector('#play').getAttribute('aria-label') === 'Play'")
    r.check(r.text('#cap-n') == 'Step 2 of 6' and r.text('#time') == '3.3 / 21.4 s', 'tap plays one step')
    r.snap('after-tap')
    p.eval_on_selector('#scrub', "e => { e.value = 5; e.dispatchEvent(new Event('input')); }")
    r.check(r.text('#time') == '5.0 / 21.4 s', 'scrub')
    r.snap('scrubbed')
    # options: speed, arrows, defense; saved as preferences
    r.click('#opts'); r.check(r.visible('#opts-pop'), 'options open')
    r.check(p.is_disabled('#t-def'), 'no defenders: the defense switch is off')
    r.click('#speed button[data-s="2"]'); r.click('#t-arrows')
    r.check(p.locator('#g-paths > *').count() == 0, 'arrows hidden')
    prefs = json.loads(p.evaluate("localStorage.getItem('ub-prefs')"))
    r.check(prefs == {'speed': 2, 'pause': False, 'loop': True, 'arrows': False, 'def': True}, f'prefs saved {prefs}')
    r.snap('options')
    r.click('#t-arrows'); r.click('#speed button[data-s="1"]')
    p.keyboard.press('Escape'); r.check(not r.visible('#opts-pop'), 'escape closes options')
    r.click('#info'); r.check(r.text('#psum').startswith('Two lines facing the end zone'), 'summary')
    r.snap('info')
    # the drill list
    r.click('#menu'); r.check(r.visible('#drawer'), 'drawer open')
    r.check(p.locator('#nav .item').count() == 2, 'two built-in drills')
    r.snap('drawer')
    # search (issue #55): every word, case and accents don't matter; Escape clears; Enter opens the only match
    total = p.locator('#nav .item').count()
    p.fill('#nav-search', 'ANGEL'); r.check(p.locator('#nav .item').count() == 2, f'search finds the two angel drills ({p.locator("#nav .item").count()})')
    p.fill('#nav-search', 'zzz'); r.check(r.text('#nav').startswith('No drills match'), 'no matches says so')
    p.press('#nav-search', 'Escape'); r.check(p.input_value('#nav-search') == '' and p.locator('#nav .item').count() == total and r.visible('#drawer'), 'Escape clears the search, the drawer stays')
    p.fill('#nav-search', 'fake'); p.press('#nav-search', 'Enter')
    r.wait("document.querySelector('#pname').textContent === 'Angel drill: fake & cut back'"); r.check(not r.visible('#drawer'), 'Enter opens the only match')
    p.eval_on_selector('#nav-search', "e => { e.value = ''; e.dispatchEvent(new Event('input')); e.blur(); }")
    p.keyboard.press('/'); r.check(r.visible('#drawer') and p.evaluate("document.activeElement.id") == 'nav-search', '"/" opens the drawer on the search box')
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    r.click('#menu')
    r.click('#nav .item[data-id="angel"]'); r.wait("document.querySelector('#pname').textContent === 'Angel drill'")
    r.check(p.evaluate('location.hash') == '#angel' and not r.visible('#drawer'), 'pick from list')
    r.snap('angel')
    r.click('#share'); r.wait("document.querySelector('#share-link').value.includes('#')")
    r.check(p.input_value('#share-link') == 'https://bremondr.github.io/ultimate-playbook/#angel', 'built-in link')
    r.snap('share-builtin')
    p.keyboard.press('Escape')
    # send feedback: a picture of the field and a filled-in issue with a link back to this moment
    r.click('#next'); r.click('#opts'); r.click('#opts-feedback'); r.check(r.visible('.fk'), 'feedback panel open')
    r.wait("document.querySelector('.fk-primary').getAttribute('href') && !document.querySelector('.fk-canvas').hidden")
    issue = urllib.parse.urlsplit(p.get_attribute('.fk-primary', 'href')); q = urllib.parse.parse_qs(issue.query)
    r.check(issue.path == '/bremondr/ultimate-playbook/issues/new' and q['labels'] == ['feedback']
            and q['title'] == ['Feedback: Angel drill (step 2)'], f'feedback issue {q.get("title")}')
    r.check('(https://bremondr.github.io/ultimate-playbook/#angel&t=3.3)' in q['body'][0]
            and '| On screen | Player: step 2 of 6 (Thrower cuts, horizontal pass)' in q['body'][0], 'feedback body')
    r.check(p.evaluate("document.querySelector('.fk-canvas').width") >= 390, 'feedback picture')
    # draw on the picture, undo it
    box = p.locator('.fk-canvas').bounding_box(); x, y = box['x'] + box['width'] * .3, box['y'] + box['height'] * .4
    r.check(p.is_disabled('.fk-tools .fk-btn >> nth=0'), 'nothing to undo yet')
    p.mouse.move(x, y); p.mouse.down(); p.mouse.move(x + 60, y + 20, steps=6); p.mouse.move(x + 90, y - 30, steps=6); p.mouse.up()
    red = "() => { const c = document.querySelector('.fk-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i+1] < 80 && d[i+2] > 60 && d[i+2] < 120) n++; return n; }"
    r.check(p.evaluate(red) > 100 and p.is_enabled('.fk-tools .fk-btn >> nth=0'), 'a stroke drawn on the picture')
    r.snap('feedback-drawn')
    p.keyboard.press('Control+z'); r.check(p.evaluate(red) == 0, 'undo the stroke')
    # the whole page first, and the field alone as a switch
    pressed = lambda label: p.get_by_role('button', name=label).get_attribute('aria-pressed')
    r.check(pressed('Whole page') == 'true' and pressed('Just the field') == 'false', 'feedback opens with the whole page')
    p.get_by_role('button', name='Just the field').click()
    r.wait("document.querySelector('.fk-canvas').width > 1000")   # the field is drawn larger than the page
    r.check(pressed('Just the field') == 'true', 'feedback switches to just the field')
    r.snap('feedback')
    p.keyboard.press('Escape'); r.check(not r.visible('.fk'), 'escape closes feedback')
    p.goto(base + '#angel&t=4'); r.wait("document.querySelector('#pname').textContent === 'Angel drill'")
    r.check(r.text('#cap-n') == 'Step 2 of 6' and r.text('#time') == '4.0 / 21.4 s', 'a link with a time opens at that moment')
    p.goto(base + '#d=zBroken'); r.wait("document.querySelector('#pkind').textContent.includes('damaged')")
    r.check(r.text('#pname') == 'Angel drill', 'damaged link falls back to the first drill')
    p.goto(base + '#angel-cutback'); r.wait("document.querySelector('#pname').textContent === 'Angel drill: fake & cut back'")
    p.evaluate('document.activeElement.blur()')   # Space on a focused button would press that button instead
    p.keyboard.press(' '); r.wait("document.querySelector('#play').getAttribute('aria-label') === 'Pause'")
    p.keyboard.press(' '); r.check(p.get_attribute('#play', 'aria-label') == 'Play', 'space pauses')


def editor_flow(r, base):
    p = r.page
    p.goto(base + '#angel'); r.wait("document.querySelector('#pname').textContent === 'Angel drill'")
    r.check(r.text('#act') == 'Edit a copy', 'edit a copy button')
    r.click('#act'); r.check(r.visible('#studio'), 'editor open')
    r.check(p.input_value('#s-name') == 'Angel drill (copy)', 'copy name')
    r.snap('copy-open')
    r.fold(); r.click('#zoom button[data-z="fit"]')   # the angel drill sits outside the default attacking-half view
    # step 1: drag a player to draw a run, then undo and redo it
    r.click('#strip .sbtn:nth-of-type(2)')
    r.fold()
    a = r.piece_xy('A2'); r.drag(a, (a[0] + 60, a[1] + 40))
    r.check(r.text('#s-state') == 'Unsaved changes' and p.is_enabled('#s-undo'), 'run drawn')
    r.snap('run-drawn')
    r.click('#s-undo'); r.click('#s-redo'); r.snap('undo-redo')
    # throw tool: its options wait to be asked for; thrower, then receiver redraws the step's throw
    p.keyboard.press('t'); r.check(not r.visible('#tray'), 'throw options stay closed')
    p.keyboard.press('t'); r.check(r.visible('#tray') and r.text('#tray-title') == 'Next throw', 'throw options on the second press')
    r.click('#tray-close')
    r.page.mouse.click(*r.piece_xy('B1')); r.page.mouse.click(*r.piece_xy('A2'))
    r.check(r.text('#tb-title') == 'Throw: B1 → A2', 'throw redrawn')
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
    r.check(r.text('#pname') == 'Angel drill (copy)' and r.text('#act') == 'Edit', 'saved drill shown')
    r.click('#menu'); r.check(p.locator('#nav .tag').all_text_contents() == ['Mine'], 'tagged as mine')
    r.snap('saved-list'); r.click('#drawer-close')
    # a link to a saved drill works from a fresh start, once the saved drills have loaded
    p.reload(); r.wait("document.querySelector('#pkind').textContent === 'Drill · saved here'")
    r.check(r.text('#pname') == 'Angel drill (copy)', 'saved drill from a link'); r.snap('reloaded')
    # share the drawn drill as a packed link, open it, save the copy
    r.click('#share'); r.wait("document.querySelector('#share-link').value.includes('#d=')")
    link = p.input_value('#share-link'); r.snap('share-drawn'); p.keyboard.press('Escape')
    p.goto(base + link[link.index('#'):]); r.wait("document.querySelector('#pkind').textContent.includes('shared')")
    r.check(r.text('#pkind') == 'Drill · shared with you' and r.text('#pname') == 'Angel drill (copy)', 'shared link opens')
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
    r.tab('drill')
    r.check(r.page.locator('#e-forms .fbtn').count() == 16, 'every formation offered')
    r.click('#e-forms .fbtn[data-form="ez-iso-r"]')
    r.check(r.page.locator('#g-players .oteam[data-kind="player"]').count() == 7, 'end zone iso: seven attackers')
    r.check(p.input_value('#e-sum').startswith('End zone iso right, 7 v 7. Just outside the end zone'), f'summary from the formation: {p.input_value("#e-sum")}')
    r.snap('formation-ez'); r.fold(); r.tab('drill')
    r.click('#e-forms .fbtn[data-form="vert"]')
    r.check(p.input_value('#e-sum').startswith('Vertical stack, 7 v 7.'), 'the summary follows the formation')
    p.fill('#e-sum', 'My own words'); p.keyboard.press('Tab')
    r.click('#e-forms .fbtn[data-form="ho"]')
    r.check(p.input_value('#e-sum') == 'My own words' and 'Your summary was kept.' in r.text('#hint'), f'own summary kept: {r.text("#hint")}')
    r.click('#e-field button[data-fd="small"]')
    # defense picker: every choice is offered; a zone, then person defense on the attackers on the field
    r.check(r.page.locator('#e-defs .fbtn').count() == 13, 'every defense offered')
    r.click('#e-defs .fbtn[data-def="cup"]')
    dteam = '#g-players .dteam[data-kind="player"]'
    r.check(r.page.locator(dteam).count() == 7, f'cup zone: seven defenders ({r.page.locator(dteam).count()})')
    r.check(r.text('#hint').startswith('Cup zone: 7 defenders'), f'cup zone hint: {r.text("#hint")}')
    r.snap('defense-cup'); r.fold(); r.tab('drill')
    r.click('#e-defs .fbtn[data-def="none"]'); r.check(r.page.locator(dteam).count() == 0, 'no defense')
    r.click('#e-defs .fbtn[data-def="left"]')
    r.check(r.page.get_attribute('#e-defs .fbtn[data-def="left"]', 'aria-pressed') == 'true', 'force left picked')
    r.check(r.page.locator(dteam).count() == 7 and r.text('#hint').startswith('Force left: 7 defenders'), f'force left: {r.text("#hint")}')
    # each picker folds to the one picked
    vis = lambda sel: r.page.locator(sel + ' .fbtn:visible').count()
    r.click('#e-forms-tb .foldh'); r.click('#e-defs-tb .foldh')
    r.check(vis('#e-forms') == 1 and r.text('#e-forms-tb .foldh b') == 'Horizontal stack', f'formations folded: {vis("#e-forms")} {r.text("#e-forms-tb .foldh b")}')
    r.check(vis('#e-defs') == 1 and r.text('#e-defs-tb .foldh b') == 'Force left', f'defenses folded: {vis("#e-defs")}')
    r.snap('pickers-folded')
    r.click('#e-forms-tb .foldh'); r.click('#e-defs-tb .foldh')
    r.check(vis('#e-forms') == 16 and vis('#e-defs') == 13, 'pickers open again')
    r.snap('formation'); r.fold()
    r.click('#zoom button[data-z="fit"]')
    # step 1: a run and a throw
    r.click('#strip .sbtn:nth-of-type(2)'); r.fold()
    a = r.piece_xy('c2'); r.drag(a, (a[0] + 50, a[1] - 30))
    p.keyboard.press('t')
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
    r.tab('drill')
    # send feedback from the editor: the issue says where in the editor
    r.click('#e-feedback'); r.wait("document.querySelector('.fk-primary').getAttribute('href')")
    q = urllib.parse.parse_qs(urllib.parse.urlsplit(p.get_attribute('.fk-primary', 'href')).query)
    r.check(q['title'][0].endswith('(editor, setup)') and '| On screen | Editor: setup, tool ' in q['body'][0], f'editor feedback {q["title"]}')
    r.click('.fk-x'); r.check(not r.visible('.fk') and r.visible('#studio'), 'feedback closed, still editing')
    r.click('#e-delete'); r.click('#e-delete')
    r.wait("document.querySelector('#pname').textContent === 'Angel drill'")
    r.check(p.evaluate('location.hash') == '#angel' and r.saved_here() == 1, 'drill deleted')
    r.snap('deleted')


def throw_flow(r, base):
    """Drawing throws as a first-time user would (issue #20): one tap on the receiver, continuing, dragging."""
    p = r.page
    p.goto(base); r.wait("document.querySelector('#pname').textContent !== '—'")
    r.click('#menu'); r.click('#new'); r.click('#new-blank'); r.fold()
    r.tool('off'); r.tap_field(60, 18); r.tap_field(70, 18)
    ids = p.evaluate("import('./js/editor/session.js').then(s => s.draft.players.filter(q => q.team === 'O').map(q => q.id))")
    throws = lambda: p.evaluate("import('./js/editor/session.js').then(s => s.draft.steps.map(x => x.throw ? s.labelOf(x.throw.from) + '>' + s.labelOf(x.throw.to) : '-'))")
    p.keyboard.press('t')
    r.check(not r.visible('#tray') and r.text('#hint').startswith('Tap the receiver for a throw from 1'), f'throw tool in setup: {r.text("#hint")}')
    # in Setup, one tap on the receiver draws the first throw and shows its step
    p.mouse.click(*r.piece_xy(ids[1]))
    r.check(throws() == ['1>2'] and r.text('#st-h') == 'Step 1 of 1' and r.text('#tb-title') == 'Throw: 1 → 2', f'one tap: {throws()}')
    # another tap continues in a new step
    p.mouse.click(*r.piece_xy(ids[2]))
    r.check(throws() == ['1>2', '2>3'] and r.text('#st-h') == 'Step 2 of 2', f'next throw: {throws()}')
    r.snap('throw-continue')
    # dragging from the thrower to the receiver
    r.fold(); r.drag(r.piece_xy(ids[2]), r.piece_xy(ids[0]))
    r.check(throws() == ['1>2', '2>3', '3>1'] and r.text('#st-h') == 'Step 3 of 3', f'drag: {throws()}')
    # a thrower without the disc is refused
    r.fold(); r.drag(r.piece_xy(ids[1]), r.piece_xy(ids[2]))
    r.check(throws() == ['1>2', '2>3', '3>1'] and r.text('#hint').startswith('2 doesn’t have the disc here'), f'wrong thrower: {r.text("#hint")}')
    p.keyboard.press('Control+z')
    r.check(throws() == ['1>2', '2>3'] and r.text('#st-h') == 'Step 2 of 2', f'undo: {throws()}')


def new_disc_flow(r, base):
    """A new disc at the front of a line instead of a throw back (issue #39), on a copy of the angel drill."""
    p = r.page
    model = "import('./js/editor/canvas.js').then(c => ({fresh: c.edModel.newDiscs, warn: document.querySelectorAll('#strip .dot').length}))"
    p.goto(base + '#angel'); r.wait("document.querySelector('#pname').textContent === 'Angel drill'")
    r.click('#act'); r.click('#strip .sbtn:nth-of-type(4)')   # step 3, "Return to the line": B1 throws back to A2
    r.tab('step'); r.click('#tb-remove')
    r.check(p.evaluate(model)['warn'] > 0, 'without the throw back, the next throw is from the wrong player')
    p.select_option('#e-newdisc', 'to:A2')
    st = p.evaluate(model)
    r.check(st['fresh'][2] == 'A2' and st['warn'] == 0, f'a new disc for A2 makes the next throw valid: {st}')
    r.check(r.text('#hint').startswith('A2 gets a new disc'), f'hint: {r.text("#hint")}')
    r.snap('new-disc-editor')
    # the same by spot: whoever stands where A2 stands now
    p.select_option('#e-newdisc', 'at:A2')
    st = p.evaluate(model)
    r.check(st['fresh'][2] == 'A2' and p.input_value('#e-newdisc') == 'at:keep', f'by spot: {st}')
    r.snap('new-disc-spot')
    r.fold(); r.click('#s-preview')
    p.locator('#steps li button').nth(2).click()
    r.check(r.text('#cap-meta').startswith('New disc: A2'), f'caption: {r.text("#cap-meta")}')
    r.check(p.locator('#g-spares > *').count() == 1, 'B1 still holds the old disc as the step starts')
    r.snap('new-disc-start')
    p.eval_on_selector('#scrub', "e => { const s = [...document.querySelectorAll('#steps li')]; e.value = +e.value + 1.5; e.dispatchEvent(new Event('input')); }")
    r.check(p.locator('#g-spares > *').count() == 0, 'the old disc is put away once B1 runs back')
    p.keyboard.press('Escape'); r.click('#act'); p.keyboard.press('Control+z')
    r.check(p.evaluate(model)['fresh'][2] == 'A2', 'undo goes back to the new disc by name')


def arrows_flow(r, base):
    """A step's run arrows turned off (issue #38): the editor draws its runs faintly, playback leaves them out."""
    p = r.page
    runs = "document.querySelectorAll('#g-paths path[marker-end=\"url(#ah-o)\"]').length"
    p.goto(base + '#angel'); r.wait("document.querySelector('#pname').textContent === 'Angel drill'")
    r.click('#act'); r.check(r.visible('#studio'), 'editor open on a copy')
    r.click('#strip .sbtn:nth-of-type(4)')   # step 3, "Return to the line": runs and a throw
    r.tab('step'); r.check(p.is_checked('#e-arrows'), 'arrows on by default')
    p.uncheck('#e-arrows')
    r.check(p.evaluate("[...document.querySelectorAll('#g-paths path[marker-end=\"url(#ah-o)\"]')].every(e => e.getAttribute('opacity') === '0.35')"), 'runs drawn faintly in the editor')
    r.snap('arrows-step-tab')
    r.fold(); r.click('#s-preview'); r.check(r.text('#pkind') == 'Preview · not saved yet', 'preview')
    p.locator('#steps li button').nth(2).click()
    r.check(p.evaluate(runs) == 0 and p.locator('#g-paths > *').count() > 0, f'step 3 plays without run arrows, throw still drawn ({p.evaluate(runs)})')
    r.snap('arrows-off')
    p.locator('#steps li button').nth(1).click()
    r.check(p.evaluate(runs) > 0, 'other steps keep their arrows')


def tags_flow(r, base):
    """Tags on drills (issue #54): a copy keeps the built-in's tags; add and remove one; filter the drill list by it."""
    p = r.page
    tags = "[...document.querySelectorAll('#e-tags .tagchip')].map(e => e.firstChild.textContent.trim())"
    p.goto(base + '#angel-cutback'); r.wait("document.querySelector('#pname').textContent === 'Angel drill: fake & cut back'")
    r.click('#act'); r.tab('drill')
    r.check(p.evaluate(tags) == ['throwing', 'cutting', 'two lines', 'fakes'], f'the copy keeps the built-in tags: {p.evaluate(tags)}')
    p.fill('#e-tag-new', 'Beginners'); p.press('#e-tag-new', 'Enter')
    p.click('#e-tags .tagchip:nth-child(3) .tagx')
    r.check(p.evaluate(tags) == ['throwing', 'cutting', 'fakes', 'beginners'], f'add and remove a tag: {p.evaluate(tags)}')
    r.snap('tags-editor')
    r.fold(); r.click('#s-save'); r.wait("document.querySelector('#s-state').textContent.startsWith('Saved')")
    r.click('#s-close'); r.wait("document.querySelector('#studio').hidden")
    r.click('#menu')
    r.check(p.locator('#nav-tags .tagchip').count() > 3, 'the tags in use are offered as filters')
    p.click('#nav-tags .tagchip:text-is("beginners")')
    names = p.locator('#nav .item b').all_text_contents()
    r.check(len(names) == 1 and names[0].startswith('Angel drill: fake & cut back (copy)'), f'filter by a tag: {names}')
    r.snap('tags-filter')
    p.reload(); r.wait("document.querySelector('#pname').textContent !== '—'"); r.click('#menu')
    r.check(p.locator('#nav .item').count() == 1, 'the tag filter is remembered')
    p.click('#nav-tags .link'); r.check(p.locator('#nav .item').count() > 1, 'Clear shows every drill again')


def plans_flow(r, base):
    """Practice plans (issue #51): make one, keep it, step through it into a drill and back, add from the player, print."""
    p = r.page
    p.goto(base); r.wait("document.querySelector('#pname').textContent !== '—'")
    r.click('#menu'); r.click('#plan-new'); r.check(r.visible('#plan-edit'), 'plan editor open')
    p.fill('#plan-name', 'Tuesday practice'); p.press('#plan-name', 'Tab')
    r.click('#plan-add-block'); p.click('#plan-block-quick button:text-is("Warm-up")')
    r.click('#plan-add-drill'); p.fill('#plan-pick-search', 'angel'); p.click('#plan-pick-list .item >> nth=0')
    p.click('.plan-row >> nth=1 >> .plan-mins-ed button >> nth=1')
    r.check(r.text('#plan-edit-total') == '2 items · 21 min', f'items and total: {r.text("#plan-edit-total")}')
    r.snap('plan-editor')
    r.click('#plan-save'); r.wait("document.querySelector('#plan-status').textContent.startsWith('Saved')")
    r.click('#plan-edit-close'); r.check(not r.visible('#plan-edit'), 'editor closed')
    p.reload(); r.wait("document.querySelector('#pname').textContent !== '—'")
    r.click('#menu'); r.check(p.locator('#nav .plans .item').count() == 1, 'the plan is kept in this browser')
    p.click('#nav .plans .item'); r.check(r.visible('#plan-run') and r.text('#plan-now h3') == 'Warm-up', 'stepping through starts at the first item')
    r.click('#plan-next'); r.check(r.text('#plan-now h3') == 'Angel drill' and r.text('#plan-now .k').startswith('2 of 2 · 0:10–0:21'), f'next item: {r.text("#plan-now .k")}')
    r.snap('plan-run')
    p.click('#plan-now .primary'); r.wait("document.querySelector('#pname').textContent === 'Angel drill'")
    r.check(r.visible('#plan-bar') and 'Tuesday practice · 2 of 2' in r.text('#plan-bar'), 'the drill opens with the plan bar')
    r.click('#plan-bar-back'); r.check(r.visible('#plan-run') and r.text('#plan-now h3') == 'Angel drill', 'back to the same item')
    p.evaluate("window.print = () => { window.__printed = document.querySelector('#plan-print').textContent; }")
    r.click('#plan-run-print'); r.check('0:10' in (p.evaluate('window.__printed') or '') and 'Angel drill' in p.evaluate('window.__printed'), 'print lists the items with times')
    p.keyboard.press('Escape'); r.check(not r.visible('#plan-run'), 'Escape closes the plan')
    p.goto(base + '#angel-cutback'); r.wait("document.querySelector('#pname').textContent === 'Angel drill: fake & cut back'")
    r.click('#opts'); r.click('#plan-add-open'); p.click('#plan-add-list .item >> nth=0')
    r.wait("document.querySelector('#pkind').textContent.startsWith('Added')")
    r.click('#menu'); r.check('3 items · 31 min' in r.text('#nav .plans .item'), f'added from the player: {r.text("#nav .plans .item")}')


def plan_link_flow(r, base):
    """A whole practice plan as one link (issue #52): share it, open it on a 'new device', step into its drawn drill, save it."""
    p = r.page
    p.goto(base); r.wait("document.querySelector('#pname').textContent !== '—'")
    # a saved drill, and a plan with it, a built-in and a block, as if made here
    p.evaluate("""async () => {
      const {blankDraft} = await import('./js/model/drafts.js'), {serialize} = await import('./js/storage.js');
      const d = {...blankDraft(), name: 'My cuts'}, body = {...serialize(d), createdAt: 1, updatedAt: 1};
      localStorage.setItem('ub-team-drills', JSON.stringify({c7: body}));
      localStorage.setItem('ub-plans', JSON.stringify({pl1: {name: 'Thursday', note: 'Break throws', createdAt: 2, updatedAt: 2, items: [
        {kind: 'drill', drill: 'angel', name: 'Angel drill', minutes: 15, note: ''},
        {kind: 'drill', drill: 'c7', name: 'My cuts', minutes: 10, note: 'Hard'},
        {kind: 'block', title: 'Water break', minutes: 3, note: ''}]}}));
    }""")
    p.reload(); r.wait("document.querySelector('#pname').textContent !== '—'")
    r.click('#menu'); p.click('#nav .plans .item'); r.click('#plan-run-share')
    r.wait("document.querySelector('#plan-share-link').value.includes('#plan=')")
    link = p.input_value('#plan-share-link')
    r.check(link.startswith('https://bremondr.github.io/ultimate-playbook/#plan=') and r.visible('#plan-share-qr'), 'a plan link with its QR code')
    r.snap('plan-share')
    # another device: nothing saved, open the link here
    p.evaluate('localStorage.clear()'); p.goto('about:blank'); p.goto(base + '#' + link.split('#', 1)[1])
    r.wait("!document.querySelector('#plan-run').hidden")
    r.check(r.text('#plan-run-name') == 'Thursday' and r.visible('#plan-run-save') and not r.visible('#plan-run-edit'), 'the shared plan opens, with Save to my plans')
    r.click('#plan-next'); r.check(r.text('#plan-now h3') == 'My cuts', f'its drawn drill came along: {r.text("#plan-now h3")}')
    p.click('#plan-now .primary'); r.wait("document.querySelector('#pname').textContent === 'My cuts'")
    r.check(r.visible('#plan-bar') and 'from a shared plan' in r.text('#pkind'), f'the drawn drill plays, with the plan bar: {r.text("#pkind")}')
    r.click('#plan-bar-back'); r.click('#plan-run-save')
    r.wait("document.querySelector('#plan-run-meta').textContent.includes('saved to your plans')")
    r.check(not r.visible('#plan-run-save') and r.visible('#plan-run-edit'), 'saved: now it can be edited')
    p.keyboard.press('Escape'); r.click('#menu')
    r.check(p.locator('#nav .plans .item').count() == 1 and 'My cuts' in r.text('#nav'), 'the plan and its drill are saved here')
    p.goto(base + '#plan=zBroken'); r.wait("document.querySelector('#pkind').textContent.includes('damaged')")
    r.check(r.text('#pkind') == 'That shared plan link is damaged or incomplete', 'a damaged plan link says so')


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


FAKE_TOKEN = 'github_pat_FAKE_' + 'x' * 30
SUNSET = 'bremondr/ultimate-playbook-sunset'
MY_DRILL = """repo => { const f = window.PLAYBOOK_FAKE_GITHUB.file(repo, 'drills/sunset-angel.json');
  localStorage.setItem('ub-team-drills', JSON.stringify({c1mine: {...f, name: 'Hex cuts', createdAt: 1}})); }"""
EDIT_ON_GITHUB = """async repo => { const fake = window.PLAYBOOK_FAKE_GITHUB, path = 'drills/c1mine.json';
  await fake.edit(repo, path, {...fake.file(repo, path), name: 'Hex cuts (coach B)'}); }"""


SUNSET_DRILLS = "[...document.querySelectorAll('#nav .group:not(.plans) .tag.team')].filter(t => t.textContent === 'Sunset').length"
DEMO = 'bremondr/ultimate-playbook-demo'
API_CALLS = "() => window.PLAYBOOK_FAKE_GITHUB.log.filter(e => e.url.startsWith('https://api.github.com/')).length"


def demo_flow(r, base):
    """The demo team (issue #68): followed on a first visit, read from its index with no API requests, removed for good."""
    p = r.page
    p.goto(base + '?fakegithub')
    r.wait("document.querySelector('#team-lines').textContent.includes('Demo: 2 drills')")
    r.check(p.locator('#nav .group:not(.plans) .tag.team:text-is("Demo")').count() == 2, 'the demo drills are in the list, tagged Demo')
    r.wait("[...document.querySelectorAll('#nav .plans .item')].some(i => i.textContent.includes('Demo practice'))")
    r.check(p.evaluate(API_CALLS) == 0, f'no API requests: the demo team is read from its index ({p.evaluate(API_CALLS)})')
    r.click('#menu'); r.snap('demo')
    # removed in Teams and tokens: gone from the drills and the plans, and still gone after a reload
    r.click('#teams-open')
    row = f'.gs-source[data-repo="{DEMO}"]'
    r.click(f'{row} button:text-is("Remove")'); r.click(f'{row} button:text-is("Yes, remove")')
    p.keyboard.press('Escape')
    r.wait("!document.querySelector('#nav .tag.team')")
    r.check(not p.locator('#nav .plans .item:has-text("Demo practice")').count(), 'the demo plan goes too')
    p.reload(); r.wait("document.querySelector('#team-lines').textContent.includes('No teams yet')")
    r.check(not p.locator('#nav .tag.team').count(), 'removing the demo team is remembered')
    # its link follows it again
    p.goto(base + '?fakegithub#team=demo')
    r.wait("document.querySelector('#team-lines').textContent.includes('Demo: 2 drills')")


def team_repo_flow(r, base):
    p = r.page
    p.goto(base + '?fakegithub#team=sunset')
    r.wait("document.querySelector('#team-lines').textContent.includes('Sunset: 2 drills')")
    r.check(p.evaluate('location.hash') == '', 'the team link is taken out of the address')
    r.check(r.visible('#drawer'), 'the list opens after following a team')
    r.check(p.locator('#nav .group:not(.plans) .tag.team:text-is("Sunset")').count() == 2, 'team drills tagged with the team')
    r.snap('followed')
    # a saved drill of my own, then a token for Sunset (both kept in this browser, so they survive the reload)
    p.evaluate(MY_DRILL, SUNSET)
    p.reload(); r.wait(SUNSET_DRILLS + ' === 2')
    r.click('#opts'); r.click('#opts-teams')
    row = f'.gs-source[data-repo="{SUNSET}"]'
    r.click(f'{row} [data-gs-token]'); p.fill(f'{row} .gs-input', FAKE_TOKEN); r.click(f'{row} .gs-primary')
    r.wait("document.querySelector('.gs-done') && document.querySelector('.gs-done').textContent.includes('you can edit')")
    p.keyboard.press('Escape')
    # publish my drill, then again after it changed on GitHub: the conflict question
    p.evaluate("location.hash = 'c1mine'"); r.wait("document.querySelector('#pname').textContent === 'Hex cuts'")
    r.click('#share'); r.check(r.visible('#team-publish-go'), 'Publish to team on a saved drill')
    p.fill('#team-note', 'First version'); r.click('#team-publish-go')
    r.wait("document.querySelector('#team-share-status').textContent === 'Published to Sunset.'")
    r.check(p.evaluate("repo => window.PLAYBOOK_FAKE_GITHUB.commits(repo)[0].message", SUNSET) == 'First version', 'the note is the commit message')
    r.check(p.locator('#nav .group:not(.plans) .tag.team:text-is("Sunset")').count() == 3, 'the published drill is in the list at once')
    p.evaluate(EDIT_ON_GITHUB, SUNSET)
    r.click('#team-publish-go'); p.wait_for_selector('.gs-choices', timeout=10000)
    r.snap('conflict')
    r.click('.gs-choices .gs-primary')
    r.wait("document.querySelector('#team-share-status').textContent === 'Published to Sunset.'")
    r.check(p.evaluate("repo => window.PLAYBOOK_FAKE_GITHUB.file(repo, 'drills/c1mine.json').name", SUNSET) == 'Hex cuts', 'overwrite with mine')
    # the team drill: read-only, its history, then removed
    r.click('#share'); r.click('#menu'); r.click('#nav .group:not(.plans) .item:has(.tag.team):has-text("Hex cuts")')
    r.wait("document.querySelector('#pkind').textContent === 'Drill · Sunset'")   # a team drill says its team
    r.click('#share'); r.click('#team-history'); p.wait_for_selector('.gs-version >> nth=2', timeout=10000)
    r.check(p.locator('.gs-version strong').count() == 3, 'three versions in the history')
    r.snap('history')
    p.keyboard.press('Escape')
    r.click('#share'); r.click('#team-remove'); r.click('#team-remove')
    r.wait(SUNSET_DRILLS + ' === 2')
    r.check(p.evaluate("repo => window.PLAYBOOK_FAKE_GITHUB.file(repo, 'drills/c1mine.json')", SUNSET) is None, 'removed from the team')


def team_plans_flow(r, base):
    """Practice plans in team repos (issue #53): a team's plan in the list, publishing a local plan with my own drill, editing it there."""
    p = r.page
    p.goto(base + '?fakegithub#team=sunset')
    r.wait("document.querySelector('#team-lines').textContent.includes('Sunset: 2 drills')")
    r.wait("[...document.querySelectorAll('#nav .plans .item')].some(i => i.textContent.includes('Sunset Tuesday'))")
    r.check(p.locator('#nav .plans .item:has-text("Sunset Tuesday") .tag.team').count() == 1, 'the team plan is tagged with the team')
    p.click('#nav .plans .item:has-text("Sunset Tuesday")')
    r.check(r.visible('#plan-run') and not r.visible('#plan-run-edit') and r.visible('#plan-run-history'), 'a team plan: no Edit without a token, History')
    r.click('#plan-next'); r.check(r.text('#plan-now h3') == 'Angel drill, Sunset style', f'the team drill is found: {r.text("#plan-now h3")}')
    p.click('#plan-now .primary'); r.wait("document.querySelector('#pkind').textContent.includes('Sunset')")
    r.click('#plan-bar-back'); p.keyboard.press('Escape')
    # my own saved drill, a local plan using it, and a token for Sunset
    p.evaluate(MY_DRILL, SUNSET)
    p.evaluate("""() => localStorage.setItem('ub-plans', JSON.stringify({pl1: {name: 'Hex day', note: '', createdAt: 2, updatedAt: 2, items: [
      {kind: 'block', title: 'Warm-up', minutes: 10, note: ''}, {kind: 'drill', drill: 'c1mine', name: 'Hex cuts', minutes: 20, note: ''}]}}))""")
    p.reload(); r.wait("['Sunset Tuesday', 'Hex day'].every(n => [...document.querySelectorAll('#nav .plans .item')].some(i => i.textContent.includes(n)))")
    r.click('#menu'); p.click('#nav .plans .item:has-text("Hex day")')
    r.check(r.visible('#plan-run-publish'), 'Publish to team on a local plan, also before there is a token')
    r.click('#plan-run-publish')
    r.check(not r.visible('#plan-publish-go') and 'needs a token' in r.text('#plan-publish-what'), f'no token yet: says how: {r.text("#plan-publish-what")}')
    r.snap('plan-publish-no-token')
    p.click('#plan-publish-token button')
    row = f'.gs-source[data-repo="{SUNSET}"]'
    p.fill(f'{row} .gs-input', FAKE_TOKEN); r.click(f'{row} .gs-primary')
    r.wait("document.querySelector('.gs-done') && document.querySelector('.gs-done').textContent.includes('you can edit')")
    p.keyboard.press('Escape')
    r.check(r.visible('#plan-publish') and not r.visible('.gs'), 'Escape closes the Teams panel, the publish dialog stays')
    r.wait("!document.querySelector('#plan-publish-go').hidden"); r.check('1 drill saved only on this device' in r.text('#plan-publish-what'), f'says my drill goes along: {r.text("#plan-publish-what")}')
    r.snap('plan-publish')
    p.fill('#plan-publish-note', 'Hex day plan'); r.click('#plan-publish-go')
    r.wait("document.querySelector('#plan-publish-status').textContent.startsWith('Published to Sunset')")
    plan_path = p.evaluate("repo => window.PLAYBOOK_FAKE_GITHUB.commits(repo).find(c => c.message === 'Hex day plan').paths[0]", SUNSET)
    files = p.evaluate("([repo, path]) => { const f = window.PLAYBOOK_FAKE_GITHUB; return [f.file(repo, 'drills/c1mine.json'), f.file(repo, path)]; }", [SUNSET, plan_path])
    r.check(bool(files[0]) and bool(files[1]), 'the drill and the plan are in the team repo')
    r.check(files[1] and files[1]['items'][1]['drill'] == 'here:c1mine', 'the plan points at the drill in the same repo')
    # edit the team plan, then its history
    p.keyboard.press('Escape'); p.keyboard.press('Escape')
    r.click('#menu'); r.wait("[...document.querySelectorAll('#nav .plans .item')].filter(i => i.textContent.includes('Hex day')).length === 2")
    p.click('#nav .plans .item:has(.tag.team):has-text("Hex day")')
    r.check(r.visible('#plan-run-edit') and not r.visible('#plan-run-publish'), 'a team plan with a token: Edit, no Publish')
    r.click('#plan-run-edit'); r.check(r.text('#plan-edit-h') == 'Sunset practice plan', f'editing on the team: {r.text("#plan-edit-h")}')
    p.fill('#plan-name', 'Hex day (team)'); p.press('#plan-name', 'Tab')
    r.click('#plan-save'); r.wait("document.querySelector('#plan-status').textContent === 'Published to Sunset.'")
    r.check(p.evaluate("([repo, path]) => window.PLAYBOOK_FAKE_GITHUB.file(repo, path).name", [SUNSET, plan_path]) == 'Hex day (team)', 'saved to the team repo')
    r.click('#plan-edit-close')
    r.click('#plan-run-history'); p.wait_for_selector('.gs-version >> nth=1', timeout=10000)
    r.check(p.locator('.gs-version strong').count() == 2, 'two versions in the history')
    r.snap('plan-history')


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
                ctx.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.fulfill(status=200, body='', headers={'Access-Control-Allow-Origin': '*'}))
                for s in (DETERMINISM, *scripts): ctx.add_init_script(s)
                page = ctx.new_page()
                page.on('pageerror', lambda e: failures.append(f'{name}: page error: {e}'))
                page.on('console', lambda m: m.type == 'error' and failures.append(f'{name}: console error: {m.text}'))
                return Run(page, name, trace, args.shots)

            for vp, size in VIEWPORTS.items():
                for flow in (player_flow, editor_flow, throw_flow, arrows_flow, new_disc_flow, tags_flow, plans_flow, plan_link_flow):
                    r = page_for(f'{flow.__name__[:-5]}-{vp}', size)
                    try: flow(r, base)
                    except Exception as e: r.failures.append(f'{r.name}: stopped: {e}')
                    failures += r.failures; r.page.context.close()
            for can in (True, False):
                r = page_for(f'team-{"write" if can else "read"}', VIEWPORTS['ipad'], MOCK_CLAUDE.replace('CAN_WRITE', json.dumps(can)))
                try: team_flow(r, base, can)
                except Exception as e: r.failures.append(f'{r.name}: stopped: {e}')
                failures += r.failures; r.page.context.close()

            r = page_for('demo', VIEWPORTS['ipad'])
            try: demo_flow(r, base)
            except Exception as e: r.failures.append(f'{r.name}: stopped: {e}')
            failures += r.failures; r.page.context.close()

            r = page_for('team-repos', VIEWPORTS['ipad'])
            try: team_repo_flow(r, base)
            except Exception as e: r.failures.append(f'{r.name}: stopped: {e}')
            failures += r.failures; r.page.context.close()

            r = page_for('team-plans', VIEWPORTS['ipad'])
            try: team_plans_flow(r, base)
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
