/* ---------- send feedback: what the issue says about the playbook (no DOM, so the unit tests can run it in plain Node) ----------
   js/features/feedback.js gathers what is on screen into a `context` object; playbookIssue(context) turns it into the
   title, the rows and the Reopen section for the feedback kit (js/vendor/feedback-kit/), which adds the device's own rows
   and builds the address of the new issue. */

const secs = t => (Math.round(t * 10) / 10).toFixed(1) + ' s';

export function issueTitle(c){
  const where = c.screen === 'editor' ? (c.step ? `editor, step ${c.step}` : 'editor, setup') : `step ${c.step}`;
  return `Feedback: ${String(c.drill || 'Untitled drill').replace(/\s+/g, ' ').trim()} (${where})`;
}

// context.reopen: the link to this drill at this moment, or null when there is none
export function playbookIssue(c){
  const onScreen = c.screen === 'editor'
    ? `Editor: ${c.step ? `step ${c.step} of ${c.steps}` : 'setup'}, tool ${c.tool}, ${c.tab} tab${c.unsaved ? ', unsaved changes' : ''}`
    : `Player: step ${c.step} of ${c.steps}${c.stepTitle ? ` (${c.stepTitle})` : ''}, ${secs(c.time)} of ${secs(c.total)}${c.presenting ? ', presenting' : ''}`;
  const at = c.screen === 'editor' && !c.step ? 'the start' : `step ${c.step}`;
  return {
    title: issueTitle(c),
    sections: [{
      heading: 'Reopen',
      text: c.reopen ? `[Open this drill at ${at} (${secs(c.time)})](${c.reopen})` : '_No link: this drill can’t be packed into one._',
      fallback: c.reopen ? `_The drill is too long to pack into a link here (${c.reopen.length} characters). Ask for it to be shared another way._` : undefined
    }],
    rows: [
      ['Where', c.where + (c.commit ? ` (commit ${c.commit})` : '')],
      ['Drill', `${c.drill || 'Untitled drill'} (${c.source})`],
      ['On screen', onScreen],
      ['Field', `${c.field}, ${c.orient === 'v' ? 'upright (attack up)' : 'wide (attack to the right)'}`]
    ]
  };
}
