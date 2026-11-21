/* Small helpers used everywhere: rounding, clamping, copies, ids, DOM lookup, screen shape. */
export const r2 = n => Math.round(n*100)/100;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const $ = s => document.querySelector(s);
// the field always runs along the longer side of the screen
export const screenOrient = () => (innerWidth >= innerHeight ? 'h' : 'v');
export const f2 = n => Math.round(n*100)/100;
export const clone = o => JSON.parse(JSON.stringify(o));
export const newPid = () => 'p' + Math.random().toString(36).slice(2, 8);
export const newDocId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
