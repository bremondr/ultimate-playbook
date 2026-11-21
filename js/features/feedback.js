/* ---------- send feedback: a filled-in GitHub issue plus a picture of the field ----------
   "Send feedback" (in the options popover, in the editor's Drill tab, and in the preview tab of a pull request
   preview) opens a panel that
   1. draws the field as it is at that moment into a PNG: the field is one SVG, so a copy of it with every computed
      style written inline (colours from the CSS variables, fonts embedded) is drawn onto a canvas;
   2. copies the picture to the clipboard, and offers to share or save it, to paste or attach to the issue: a page
      without a server or a token can't attach a file to an issue itself;
   3. links to a new GitHub issue with the title, the feedback label and the body filled in (feedback-issue.js): where
      (live app or preview, commit), what was on screen, the device, and a link that reopens this drill at this step.
   The preview tab (tools/preview-runtime.js) asks for the panel with a cancelable `playbook:feedback` event. The
   picture shows only the field: a page can't take a screenshot of itself on iPad Safari. */
import { edModel } from '../editor/canvas.js';
import { dirty, draft, es, tool } from '../editor/session.js';
import { FIELDS } from '../data/fields.js';
import { stepAt } from '../model/motion.js';
import { closePops, shareLink } from '../nav.js';
import { current, model, playhead, playing, setPlaying } from '../player.js';
import { svg } from '../render/svg.js';
import { F, mode, orient } from '../render/view.js';
import { drillLink, withTime } from '../share.js';
import { storeMode } from '../storage.js';
import { $ } from '../util.js';
import { issueUrl } from './feedback-issue.js';

/* ---------- what is on screen ---------- */
const SOURCES = {builtin: 'built in', team: 'saved', preview: 'preview of a drill being drawn', shared: 'opened from a shared link'};

function context(){
  const pv = window.PLAYBOOK_PREVIEW;
  const c = {
    where: pv ? `Preview ${pv.label}` : location.hostname.endsWith('github.io') ? 'Live app' : storeMode === 'db' ? 'Claude artifact' : `Local copy (${location.host || location.protocol})`,
    commit: pv && pv.sha || '',
    page: location.origin + location.pathname,
    field: `${F === FIELDS.small ? 'Small' : 'Full'} field, ${F.label}`, orient,
    width: innerWidth, height: innerHeight, dpr: Math.round((devicePixelRatio || 1) * 100) / 100,
    orientation: innerWidth >= innerHeight ? 'landscape' : 'portrait',
    theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    userAgent: navigator.userAgent
  };
  if (mode === 'edit' && draft){
    const tab = document.querySelector('.tabs button[aria-selected="true"]');
    const toolBtn = document.querySelector(`#trail .tool[data-tool="${tool}"] span`);
    return {...c, screen: 'editor', drill: draft.name || 'Untitled drill', source: 'being drawn',
      step: es + 1, steps: draft.steps.length, time: edModel && es >= 0 ? edModel.starts[es] : 0,
      tool: toolBtn ? toolBtn.textContent : tool, tab: tab ? tab.textContent.trim() : '', unsaved: dirty};
  }
  const t = playhead(), i = stepAt(model, t);
  const source = current ? (current.source === 'team' && storeMode === 'db' ? 'team drill' : SOURCES[current.source]) : '';
  return {...c, screen: 'player', drill: model.play.name, source, step: i + 1, steps: model.play.steps.length,
    stepTitle: model.play.steps[i].title, time: t, total: model.total, presenting: document.body.classList.contains('presenting')};
}

// the link that opens this drill at this moment, or null when there is none
async function reopenLink(c){
  try {
    const link = c.screen === 'editor' ? await drillLink(draft) : await shareLink();
    return link ? withTime(link, c.time) : null;
  } catch (e){ return null; }
}

/* ---------- the picture ---------- */
const NS = 'http://www.w3.org/2000/svg';
// the computed styles that change how the field looks; written inline so the copy needs no stylesheet
const PROPS = ['display', 'visibility', 'opacity', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity',
  'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'paint-order',
  'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline'];
const SKIP = {display: 'inline', visibility: 'visible', opacity: '1', 'fill-opacity': '1', 'stroke-opacity': '1',
  'stroke-dashoffset': '0px', 'font-style': 'normal', 'paint-order': 'normal'};
// the colour tokens the field uses (css/tokens.css), defined again inside the copy in case a value is still a var()
const TOKENS = ['--bg', '--ink', '--muted', '--turf', '--turf2', '--endzone', '--chalk', '--label', '--off', '--off-ink',
  '--def', '--over', '--cone', '--disc', '--shadow'];

// a self-contained copy of the field as it is now (synchronous, so it is the moment of the tap)
function snapshot(){
  const r = svg.getBoundingClientRect(), root = getComputedStyle(document.documentElement);
  const copy = svg.cloneNode(true), from = [svg, ...svg.querySelectorAll('*')], to = [copy, ...copy.querySelectorAll('*')];
  from.forEach((e, k) => {
    const cs = getComputedStyle(e);
    to[k].setAttribute('style', PROPS.map(p => [p, cs.getPropertyValue(p)]).filter(([p, v]) => v && SKIP[p] !== v).map(([p, v]) => `${p}:${v}`).join(';'));
  });
  copy.removeAttribute('id'); copy.removeAttribute('class');
  copy.setAttribute('xmlns', NS);
  copy.setAttribute('width', Math.round(r.width)); copy.setAttribute('height', Math.round(r.height));
  const vars = TOKENS.map(t => `${t}:${root.getPropertyValue(t).trim()}`).join(';');
  const style = document.createElementNS(NS, 'style');
  style.textContent = `svg{${vars}}`;
  copy.insertBefore(style, copy.firstChild);
  return {copy, style, w: r.width, h: r.height, bg: getComputedStyle(document.body).backgroundColor};
}

const dataUrl = blob => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(blob); });

/* The field's font as @font-face rules with the files inlined: an SVG drawn as an image may not load anything.
   Read from the same Google Fonts stylesheet the page uses (the service worker keeps it offline), the Latin files
   of the display family only. Without them (no connection, blocked) the picture falls back to a system font. */
let fonts = null;
function embeddedFonts(){
  if (fonts) return fonts;
  fonts = (async () => {
    const link = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
    if (!link) return '';
    const family = getComputedStyle(document.documentElement).getPropertyValue('--display').split(',')[0].replace(/["']/g, '').trim();
    const css = await (await fetch(link.href, {mode: 'cors', cache: 'no-cache'})).text();
    const faces = (css.match(/@font-face\s*{[^}]*}/g) || []).filter(f => f.includes(family) && /U\+0000-00FF/i.test(f));
    const out = await Promise.all(faces.map(async f => {
      const m = /url\(\s*['"]?(https:[^'")]+)['"]?\s*\)/.exec(f);
      if (!m) return '';
      const res = await fetch(m[1]);
      if (!res.ok) throw new Error('font');
      return f.replace(m[0], `url(${await dataUrl(await res.blob())})`);
    }));
    return out.join('\n');
  })().catch(() => '');
  fonts.then(css => { if (!css) fonts = null; });   // try again next time
  return fonts;
}

// the PNG of the field at the moment of the call
async function fieldPicture(){
  const {copy, style, w, h, bg} = snapshot();
  style.textContent += '\n' + await embeddedFonts();
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
  await img.decode();
  const scale = Math.min(3, Math.max(1, 2400 / Math.max(w, h)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  const draw = () => { ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
  draw();
  // Safari can draw an SVG image before its embedded fonts are ready: draw it again a moment later
  await new Promise(ok => setTimeout(ok, 80));
  draw();
  return new Promise((ok, no) => canvas.toBlob(b => b ? ok(b) : no(new Error('no picture')), 'image/png'));
}

/* Copy the picture. Called in the tap itself: Safari only allows clipboard.write during the tap, so it gets the
   picture as a promise. Browsers that don't take a promise get a second try once the picture is ready. */
function copyPicture(picture){
  if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem !== 'function') return Promise.reject(new Error('no clipboard'));
  try {
    return navigator.clipboard.write([new ClipboardItem({'image/png': picture})])
      .catch(async () => navigator.clipboard.write([new ClipboardItem({'image/png': await picture})]));
  } catch (e){ return picture.then(b => navigator.clipboard.write([new ClipboardItem({'image/png': b})])); }
}

/* ---------- the panel ---------- */
const panel = $('#fb'), status = $('#fb-status'), openLink = $('#fb-open'), saveLink = $('#fb-save'), shareBtn = $('#fb-share'), img = $('#fb-img');
let file = null, objectUrl = null, opened = 0;

function fileName(c){
  const slug = String(c.drill).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'drill';
  return `feedback-${slug}-${c.step ? 'step-' + c.step : 'setup'}.png`;
}
const say = (text, warn) => { status.textContent = text; status.classList.toggle('warn', !!warn); };

export function openFeedback(){
  if (!model && !draft) return;
  if (playing) setPlaying(false);
  closePops();
  const run = ++opened, c = context(), picture = fieldPicture();
  const copied = copyPicture(picture);   // still inside the tap
  file = null; img.removeAttribute('src'); img.hidden = true;
  openLink.removeAttribute('href'); openLink.setAttribute('aria-disabled', 'true');
  saveLink.removeAttribute('href'); saveLink.setAttribute('aria-disabled', 'true'); shareBtn.hidden = true;
  $('#fb-what').textContent = c.screen === 'editor' ? `${c.drill}, ${c.step ? 'step ' + c.step : 'setup'} in the editor` : `${c.drill}, step ${c.step} of ${c.steps}`;
  $('#fb-long').hidden = true;
  say('Making the picture of the field…');
  panel.hidden = false;
  openLink.focus({preventScroll: true});

  picture.then(blob => {
    if (run !== opened) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    img.src = objectUrl; img.hidden = false;
    saveLink.href = objectUrl; saveLink.download = fileName(c); saveLink.removeAttribute('aria-disabled');
    file = new File([blob], fileName(c), {type: 'image/png'});
    shareBtn.hidden = !(navigator.canShare && navigator.canShare({files: [file]}) && window.top === window);
    return copied.then(
      () => { if (run === opened) say('The picture is copied. Open the issue, paste the picture into it, and say what’s wrong.'); },
      () => { if (run === opened) say('Couldn’t copy the picture here. Save or share it, then attach it to the issue.', true); });
  }, () => { if (run === opened) say('Couldn’t make a picture of the field in this browser. The issue still says what was on screen.', true); });

  reopenLink(c).then(reopen => {
    if (run !== opened) return;
    const {url, reopenLeftOut} = issueUrl({...c, reopen});
    openLink.href = url; openLink.removeAttribute('aria-disabled');
    $('#fb-long').hidden = !reopenLeftOut;
  });
}

function closeFeedback(){
  if (panel.hidden) return;
  panel.hidden = true; opened++;
  if (objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }
  img.removeAttribute('src'); file = null;
}

openLink.addEventListener('click', e => { if (!openLink.href) e.preventDefault(); });
saveLink.addEventListener('click', e => { if (!saveLink.href) e.preventDefault(); });
shareBtn.addEventListener('click', () => { if (file) navigator.share({files: [file], title: 'Ultimate Playbook feedback'}).catch(() => {}); });
$('#fb-close').addEventListener('click', closeFeedback);
panel.addEventListener('click', e => { if (e.target === panel) closeFeedback(); });
// Escape closes the panel before the page's own Escape handling (the player's popovers, the editor)
document.addEventListener('keydown', e => {
  if (panel.hidden || e.key !== 'Escape') return;
  e.preventDefault(); e.stopPropagation(); closeFeedback();
}, true);

/* entry points: the options popover, the editor's Drill tab, and the preview tab (which falls back to a plain new
   issue when the event isn't cancelled, for example on a preview of a version without this feature) */
$('#opts-feedback').addEventListener('click', openFeedback);
$('#e-feedback').addEventListener('click', openFeedback);
document.addEventListener('playbook:feedback', e => { e.preventDefault(); openFeedback(); });
