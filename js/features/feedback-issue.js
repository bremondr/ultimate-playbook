/* ---------- send feedback: the GitHub issue, filled in (no DOM, so the unit tests can run it in plain Node) ----------
   js/features/feedback.js gathers what is on screen into a `context` object and calls issueUrl(context) for the
   address of a new issue with the title, the body and the feedback label already filled in. */

export const NEW_ISSUE = 'https://github.com/bremondr/ultimate-playbook/issues/new';
export const LABEL = 'feedback';
// GitHub refuses longer addresses for a new issue (about 8 KB), so stay under that with room to spare
export const URL_LIMIT = 8000;

// one line of plain text in a Markdown table cell
const cell = v => String(v ?? '').replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/\|/g, '\\|') || '–';
const secs = t => (Math.round(t * 10) / 10).toFixed(1) + ' s';

export function issueTitle(c){
  const where = c.screen === 'editor' ? (c.step ? `editor, step ${c.step}` : 'editor, setup') : `step ${c.step}`;
  return `Feedback: ${String(c.drill || 'Untitled drill').replace(/\s+/g, ' ').trim()} (${where})`;
}

// reopen: the link to this drill at this moment, or null to leave it out (then `linkNote` says why)
export function issueBody(c, reopen, linkNote){
  const rows = [
    ['Where', c.where + (c.commit ? ` (commit ${c.commit})` : '')],
    ['Drill', `${c.drill || 'Untitled drill'} (${c.source})`],
    c.screen === 'editor'
      ? ['On screen', `Editor: ${c.step ? `step ${c.step} of ${c.steps}` : 'setup'}, tool ${c.tool}, ${c.tab} tab${c.unsaved ? ', unsaved changes' : ''}`]
      : ['On screen', `Player: step ${c.step} of ${c.steps}${c.stepTitle ? ` (${c.stepTitle})` : ''}, ${secs(c.time)} of ${secs(c.total)}${c.presenting ? ', presenting' : ''}`],
    ['Field', `${c.field}, ${c.orient === 'v' ? 'upright (attack up)' : 'wide (attack to the right)'}`],
    ['Screen', `${c.width} × ${c.height} px, ${c.orientation}, pixel ratio ${c.dpr}, ${c.theme} mode${c.standalone ? ', home screen app' : ''}`],
    ['Browser', c.userAgent],
    ['Page', c.page]
  ];
  return [
    '## What’s wrong, and what should happen',
    '',
    '',
    '',
    '## Picture of the field',
    '',
    '<!-- The app copied the picture: paste it here, or attach the saved picture. -->',
    '',
    '',
    '## Reopen',
    '',
    reopen ? `[Open this drill at ${c.screen === 'editor' && !c.step ? 'the start' : `step ${c.step}`} (${secs(c.time)})](${reopen})` : linkNote,
    '',
    '## On screen',
    '',
    '| | |',
    '|---|---|',
    ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`),
    '',
    '<sub>Sent with Send feedback in the app.</sub>'
  ].join('\n');
}

const addressOf = (c, reopen, note) =>
  `${NEW_ISSUE}?title=${encodeURIComponent(issueTitle(c))}&labels=${LABEL}&body=${encodeURIComponent(issueBody(c, reopen, note))}`;

/* The address of the new issue. The reopen link is left out (and the body says so) when it would make the
   address too long: {url, reopenLeftOut}. */
export function issueUrl(c, limit = URL_LIMIT){
  if (c.reopen){
    const url = addressOf(c, c.reopen);
    if (url.length <= limit) return {url, reopenLeftOut: false};
  }
  const note = c.reopen
    ? `_The drill is too long to pack into a link here (${c.reopen.length} characters). Ask for it to be shared another way._`
    : '_No link: this drill can’t be packed into one._';
  return {url: addressOf(c, null, note), reopenLeftOut: !!c.reopen};
}

