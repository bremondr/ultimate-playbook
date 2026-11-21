/* ---------- Field model (metres): x along the length, y across. The offense attacks toward x = L.
   full: WFDF grass 100 × 37 m, 18 m end zones, brick 18 m out.
   small: WFDF beach 75 × 25 m, 15 m end zones (5 v 5); no brick drawn. ---------- */
export const FIELDS = {
  full:  { L:100, W:37, ez:18, brick:18, label:'100 × 37 m' },
  small: { L:75,  W:25, ez:15, brick:0,  label:'75 × 25 m' }
};
export const fieldOf = k => FIELDS[k] || FIELDS.full;
