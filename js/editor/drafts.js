/* ---------- drafts: what the editor works on ---------- */
import { curveOf, GRIPS, typeOf } from '../model/throws.js';
import { draft, F } from '../state.js';
import { clamp, clone } from '../util.js';

export const snapPt = ([x, y]) => [clamp(Math.round(x*2)/2, 0, F.L), clamp(Math.round(y*2)/2, 0, F.W)];
export const byIdIn = () => Object.fromEntries(draft.players.map(p => [p.id, p]));

export function copyOfBuiltin(p){
  return {
    id:null, docId:null, name:p.name + ' (copy)', kind:p.kind, summary:p.summary, disc:p.disc, field:p.field || 'full', format:p.format || 7,
    players: p.players.map(q => { const r = {id:q.id, team:q.team, at:q.at ? q.at.slice() : null};
      if (q.team === 'O') r.label = (q.label || q.id).slice(0, 3);
      if (q.follow){ r.follow = q.follow; r.offset = q.offset.slice(); r.lag = q.lag ?? .35; }
      if (q.face) r.face = q.face;
      if (q.mark) r.mark = clone(q.mark);
      return r; }),
    steps: p.steps.map(s => ({title:s.title, note:s.note, dur:null,
      moves: Object.fromEntries(Object.entries(s.moves || {}).map(([id, m]) => [id, {path: clone(m.path)}])),
      throw: s.throw ? Object.assign({from:s.throw.from, to:s.throw.to, type:typeOf(s.throw), curve:curveOf(s.throw)}, s.throw.fake ? {fake:s.throw.fake} : {}, GRIPS[s.throw.grip] ? {grip:s.throw.grip} : {}) : null}))
  };
}
export function blankDraft(){
  return {id:null, docId:null, name:'New drill', kind:'Drill', summary:'', disc:'p1', field:'full', format:7, force:'right',
    players:[{id:'p1', team:'O', label:'1', at:[40, 18.5]}],
    steps:[{title:'', note:'', dur:null, moves:{}, throw:null}]};
}

// new drills: blank, or a copy of any built-in or saved drill
export function copyOfEntry(e){
  if (e.source === 'team') return {...clone(e.raw), id:null, docId:null, createdAt:undefined, name:(e.raw.name || 'Untitled drill') + ' (copy)'};
  return copyOfBuiltin(e.play);
}
