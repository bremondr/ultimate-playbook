/* ---------- library (built-in + team drills) ---------- */
import { BUILTIN } from './data/builtins.js';
import { team } from './state.js';

export function libEntries(){
  return [...BUILTIN.map(p => ({id:p.id, source:'builtin', play:p})), ...team.map(e => ({id:e.id, source:'team', play:e.play, raw:e.raw}))];
}
