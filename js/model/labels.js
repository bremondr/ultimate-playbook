/* ---------- attacker labels: the text in the yellow circle ---------- */

/** Longest label: four characters still fit in the circle at a smaller size (see labelSize). */
export const MAX_LABEL = 4;

/** Font size (in metres, like the field) that fits the label in the circle. */
export const labelSize = label => label.length > 3 ? .95 : label.length > 1 ? 1.2 : 1.45;

/** A label cut to the longest allowed. */
export const fitLabel = text => String(text).trim().slice(0, MAX_LABEL);

/**
 * The next free label, given the labels already used: `start` plus the lowest free number from there on,
 * counting 9, 10, 11 … A start that ends in digits says where to count from: 'H' gives H1, H2 …; 'A1' gives
 * A1, A2 … A9, A10; 'A4' gives A4 if free, else A5 …; '7' gives 7, 8 … (So the label of a player
 * works as a start: a copy of A4 is the next free A number after it.) Returns null when no label of at most
 * MAX_LABEL characters is left on that start.
 */
export function nextFreeLabel(used, start = ''){
  const [, base, digits] = /^(.*?)(\d*)$/.exec(String(start).trim());
  for (let n = Math.max(1, digits ? +digits : 1); (base + n).length <= MAX_LABEL; n++){
    if (!used.has(base + n)) return base + n;
  }
  return null;
}
