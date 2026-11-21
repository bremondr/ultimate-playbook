/* where a defender faces: their player, the disc, or straight up/down the field */
/* Where a defender looks. Nobody watches the disc unless you choose "The disc":
   auto  = the player they follow or mark (a mark waiting on the handler spot looks at that spot);
           a free defender keeps looking upfield
   angle = a fixed direction set with the rotate handle in the editor (degrees, 0 = downfield) */
export const FACES = ['auto','disc','up','down','angle'];
export function faceTarget(selfPt, p, targetOf, discPt){
  const f = p.face || 'auto';
  if (f === 'up') return [selfPt[0]-5, selfPt[1]];
  if (f === 'down') return [selfPt[0]+5, selfPt[1]];
  if (f === 'angle'){ const r = (p.angle || 0) * Math.PI/180; return [selfPt[0] + Math.cos(r)*5, selfPt[1] + Math.sin(r)*5]; }
  if (f === 'disc' && discPt) return discPt;
  if (p.follow) return targetOf(p.follow);
  if (p.spotPt) return p.spotPt;
  return [selfPt[0]-5, selfPt[1]];
}
