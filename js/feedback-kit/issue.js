/* feedback-kit: the address of a new GitHub issue, filled in. No DOM, so it runs in plain Node too.

   issueUrl({repo, title, labels, sections, rows, footer}) → {url, shortened}
     repo      'owner/name'
     labels    ['feedback'], put on the issue when the person may label (the repository's owner can)
     sections  [{heading, text, fallback}] after "What's wrong" and "Picture": app-specific blocks, such as a link
               that reopens what was on screen. A section with a `fallback` gives way to it when the address would
               be too long; GitHub refuses addresses over about 8 KB.
     rows      [[name, value]] for the table at the end (the kit adds the device's own rows)
     footer    a small line at the very end */

export const URL_LIMIT = 8000;

// one line of plain text in a Markdown table cell
export const cell = v => String(v ?? '').replace(/\s+/g, ' ').trim().replace(/\\/g, '\\\\').replace(/\|/g, '\\|') || '–';

export function issueBody({sections = [], rows = [], footer = ''}){
  return [
    '## What’s wrong, and what should happen', '', '', '',
    '## Picture', '', '<!-- The picture was copied: paste it here, or attach the saved picture. -->', '', '',
    ...sections.flatMap(s => [`## ${s.heading}`, '', s.text, '']),
    ...(rows.length ? ['## On screen', '', '| | |', '|---|---|', ...rows.map(([k, v]) => `| ${cell(k)} | ${cell(v)} |`), ''] : []),
    ...(footer ? [`<sub>${footer}</sub>`] : [])
  ].join('\n');
}

export function issueUrl(issue, limit = URL_LIMIT){
  const address = it => `https://github.com/${issue.repo}/issues/new?title=${encodeURIComponent(it.title || '')}`
    + ((it.labels || []).length ? `&labels=${encodeURIComponent(it.labels.join(','))}` : '')
    + `&body=${encodeURIComponent(issueBody(it))}`;
  let it = {...issue, sections: [...(issue.sections || [])]}, url = address(it), shortened = false;
  // give way section by section, last first
  for (let k = it.sections.length - 1; k >= 0 && url.length > limit; k--){
    const s = it.sections[k];
    if (s.fallback === undefined) continue;
    it.sections[k] = {...s, text: s.fallback}; shortened = true; url = address(it);
  }
  return {url, shortened};
}
