/* ---------- tags on drills: what a tag may be (no DOM, so the unit tests run it in plain Node) ----------
   A tag is a short word or two, such as "cutting" or "zone defense": lower case, single spaces, at most 24 characters.
   A drill has at most 8, each once. Built-in drills get theirs from data/angel.js (BUILTIN_TAGS), not from their
   play data, so the model output of the built-ins (tests/baseline.json) stays the same. */
export const MAX_TAGS = 8, MAX_TAG = 24;

export const normTag = s => String(s ?? '').replace(/[,#]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_TAG).trim();

// clean, unique, at most MAX_TAGS, in the order given; anything that isn't a string is dropped
export function cleanTags(list){
  const out = [];
  for (const t of Array.isArray(list) ? list : []){
    if (typeof t !== 'string') continue;
    const n = normTag(t);
    if (n && !out.includes(n)) out.push(n);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

// every tag used by the given drills, the most used first, then alphabetically
export function tagsInUse(lists){
  const n = new Map();
  lists.forEach(l => (l || []).forEach(t => n.set(t, (n.get(t) || 0) + 1)));
  return [...n.keys()].sort((a, b) => n.get(b) - n.get(a) || a.localeCompare(b));
}
