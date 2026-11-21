/* ---------- send feedback: a filled-in GitHub issue plus a picture of the field to draw on ----------
   The panel, the drawing, the clipboard and the issue address are the feedback kit (js/feedback-kit/, which knows
   nothing about the playbook). This file gives it what is playbook-specific:
   - the picture: the field SVG, with the display font embedded;
   - the description: where (live app or preview, commit), what was on screen (drill, step and time; in the editor
     the step, tool and tab), the field, and a link that reopens this drill at this moment (feedback-issue.js);
   - the entry points: the options popover, the editor's Drill tab, and the preview tab of a pull request preview
     (tools/preview-runtime.js asks with a cancelable `playbook:feedback` event).
   The picture shows only the field: a page can't take a screenshot of itself on iPad Safari. */
import { embedFonts, svgPicture } from '../feedback-kit/picture.js';
import { createFeedback } from '../feedback-kit/kit.js';
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
import { playbookIssue } from './feedback-issue.js';

const SOURCES = {builtin: 'built in', team: 'saved', preview: 'preview of a drill being drawn', shared: 'opened from a shared link'};
// the colour tokens the field uses (css/tokens.css), defined again inside the picture in case a value is still a var()
const TOKENS = ['--bg', '--ink', '--muted', '--turf', '--turf2', '--endzone', '--chalk', '--label', '--off', '--off-ink',
  '--def', '--over', '--cone', '--disc', '--shadow'];

/* what is on screen, at the moment of the tap */
function context(){
  const pv = window.PLAYBOOK_PREVIEW;
  const c = {
    where: pv ? `Preview ${pv.label}` : location.hostname.endsWith('github.io') ? 'Live app' : storeMode === 'db' ? 'Claude artifact' : `Local copy (${location.host || location.protocol})`,
    commit: pv && pv.sha || '',
    field: `${F === FIELDS.small ? 'Small' : 'Full'} field, ${F.label}`, orient
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

function fileName(c){
  const slug = String(c.drill).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'drill';
  return `feedback-${slug}-${c.step ? 'step-' + c.step : 'setup'}.png`;
}

// the field's font, from the same Google Fonts stylesheet the page uses (the service worker keeps it offline)
function fieldFonts(){
  const link = document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]');
  const family = getComputedStyle(document.documentElement).getPropertyValue('--display').split(',')[0].replace(/["']/g, '').trim();
  return link && family ? embedFonts({stylesheet: link.href, family}) : null;
}

const feedback = createFeedback({
  repo: 'bremondr/ultimate-playbook',
  labels: ['feedback'],
  footer: 'Sent with Send feedback in the app.',
  picture: () => svgPicture(svg, {fonts: fieldFonts(), vars: TOKENS}),
  describe(){
    const c = context();
    return {
      subtitle: c.screen === 'editor' ? `${c.drill}, ${c.step ? 'step ' + c.step : 'setup'} in the editor` : `${c.drill}, step ${c.step} of ${c.steps}`,
      fileName: fileName(c),
      issue: reopenLink(c).then(reopen => playbookIssue({...c, reopen}))
    };
  }
});

export function openFeedback(){
  if (!model && !draft) return;
  if (playing) setPlaying(false);
  closePops();
  feedback.open();
}

/* entry points: the options popover, the editor's Drill tab, and the preview tab (which falls back to a plain new
   issue when the event isn't cancelled, for example on a preview of a version without this feature) */
$('#opts-feedback').addEventListener('click', openFeedback);
$('#e-feedback').addEventListener('click', openFeedback);
document.addEventListener('playbook:feedback', e => { e.preventDefault(); openFeedback(); });
