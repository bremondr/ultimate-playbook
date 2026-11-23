/* ---------- drafts: the raw, untimed form of a drill that the editor works on ---------- */
import { fitLabel } from './labels.js';
import { curveOf, GRIPS, typeOf } from './throws.js';
import { clone } from '../util.js';

export function copyOfBuiltin(p){
  return {
    id:null, docId:null, name:p.name + ' (copy)', kind:p.kind, summary:p.summary, disc:p.disc, field:p.field || 'full', format:p.format || 7,
    players: p.players.map(q => { const r = {id:q.id, team:q.team, at:q.at ? q.at.slice() : null};
      if (q.team === 'O') r.label = fitLabel(q.label || q.id);
      if (q.follow){ r.follow = q.follow; r.offset = q.offset.slice(); r.lag = q.lag ?? .35; }
      if (q.face) r.face = q.face;
      if (q.mark) r.mark = clone(q.mark);
      return r; }),
    steps: p.steps.map(s => ({title:s.title, note:s.note, dur:null,
      moves: Object.fromEntries(Object.entries(s.moves || {}).map(([id, m]) => [id, {path: clone(m.path)}])),
      throw: s.throw ? Object.assign({from:s.throw.from, to:s.throw.to, type:typeOf(s.throw), curve:curveOf(s.throw)}, s.throw.fake ? {fake:s.throw.fake} : {}, GRIPS[s.throw.grip] ? {grip:s.throw.grip} : {}) : null,
      ...(s.arrows === false ? {arrows:false} : {}),
      ...(s.newDisc ? {newDisc: clone(s.newDisc)} : {})}))
  };
}
export function blankDraft(){
  return {id:null, docId:null, name:'New drill', kind:'Drill', summary:'', disc:'p1', field:'full', format:7, force:'right',
    players:[{id:'p1', team:'O', label:'1', at:[40, 18.5]}],
    steps:[{title:'', note:'', dur:null, moves:{}, throw:null}]};
}

// new drills: blank, or a copy of any built-in or saved drill (a library entry)
export function copyOfEntry(e){
  if (e.raw) return {...clone(e.raw), id:null, docId:null, createdAt:undefined, name:(e.raw.name || 'Untitled drill') + ' (copy)'};
  return copyOfBuiltin(e.play);
}
// a saved drill, to edit in place
export const draftOfSaved = e => ({...clone(e.raw), id:e.id, docId:e.id});
// a team drill, for its editor: saved in this browser under the team drill's id, so publishing it again replaces it
export const draftOfTeam = e => ({...clone(e.raw), id:null, docId:null, saveAs:e.itemId, createdAt:e.raw.createdAt || undefined});
