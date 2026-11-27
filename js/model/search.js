/* ---------- finding drills: search words and tags (no DOM, so the unit tests run it in plain Node) ----------
   The drill list (nav.js) and the practice plan's drill picker filter with these. */

// lower case and without accents, so "rozběh" finds "rozbeh" and "Hod" finds "hod"
export const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// what a search looks at: the name, the summary, the step titles and the tags
export function searchText(play){
  return fold([play.name, play.summary, ...(play.steps || []).map(s => s.title), ...(play.tags || [])].join(' \n '));
}

// every word of the query appears somewhere (in any order); an empty query matches everything
export function matchesQuery(play, query){
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = searchText(play);
  return words.every(w => text.includes(w));
}

// the drill has every tag picked (none picked: everything)
export function matchesTags(play, picked){
  if (!picked || !picked.length) return true;
  const have = new Set((play.tags || []).map(fold));
  return picked.every(t => have.has(fold(t)));
}
