/* ---------- the field: turf, lines, end zones, distance marks ---------- */
import { el, lineM, M, rectM, svg } from './svg.js';
import { F, orient } from '../state.js';
import { $, f2 } from '../util.js';

export function drawPitch(view){
  const [v0, v1] = view;
  if (orient === 'h') svg.setAttribute('viewBox', `${v0-1} -1 ${v1-v0+2} ${F.W+5}`);
  else svg.setAttribute('viewBox', `-1 ${-(v1+1)} ${F.W+8} ${v1-v0+2}`);
  $('#dir').textContent = orient === 'h' ? 'Offense attacks →' : 'Offense attacks ↑';
  const g = $('#g-pitch'); g.replaceChildren();
  rectM(0,0,F.L,F.W,{fill:'var(--turf)'},g);
  for (let x = 0; x < F.L; x += 10) rectM(x,0,x+5,F.W,{fill:'var(--turf2)'},g);
  rectM(0,0,F.ez,F.W,{fill:'var(--endzone)',opacity:.7},g);
  rectM(F.L-F.ez,0,F.L,F.W,{fill:'var(--endzone)',opacity:.7},g);
  const line = {stroke:'var(--chalk)','stroke-width':.25,fill:'none'};
  rectM(0,0,F.L,F.W,line,g);
  lineM(F.ez,0,F.ez,F.W,line,g);
  lineM(F.L-F.ez,0,F.L-F.ez,F.W,line,g);
  if (F.brick) [F.ez+F.brick, F.L-F.ez-F.brick].forEach(bx => { const c = F.W/2;
    lineM(bx-.6,c-.6,bx+.6,c+.6,line,g); lineM(bx-.6,c+.6,bx+.6,c-.6,line,g); });
  /* Whose end zone is whose: the offense (yellow) starts from its own end zone and attacks the
     defense's (pink) end zone at x = L. Each zone gets a wash and a back-line band in its team colour. */
  const zones = [
    {x0:0, x1:F.ez, color:'var(--off)', main:'OFFENSE', sub:'OWN END ZONE'},
    {x0:F.L-F.ez, x1:F.L, color:'var(--def)', main:'SCORE HERE', sub:'DEFENSE’S END ZONE'}
  ];
  zones.forEach((z, i) => {
    rectM(z.x0, 0, z.x1, F.W, {fill:z.color, opacity:.13}, g);
    const bx = i ? F.L - 1 : 0; rectM(bx, 0, bx + 1, F.W, {fill:z.color, opacity:.75}, g);
    const cx = (z.x0 + z.x1)/2, p = M(cx, F.W/2), rot = orient === 'h' ? `rotate(-90 ${f2(p[0])} ${f2(p[1])})` : undefined;
    const big = F.W < 30 ? 1.9 : 2.4;
    const t1 = el('text',{x:f2(p[0]),y:f2(p[1]-big*.55),'text-anchor':'middle','dominant-baseline':'central','font-size':big,'font-weight':700,'letter-spacing':.5,fill:'var(--chalk)',opacity:.6,transform:rot},g);
    t1.textContent = z.main;
    const t2 = el('text',{x:f2(p[0]),y:f2(p[1]+big*.6),'text-anchor':'middle','dominant-baseline':'central','font-size':big*.52,'font-weight':600,'letter-spacing':.35,fill:'var(--chalk)',opacity:.5,transform:rot},g);
    t2.textContent = z.sub;
  });
  // chevrons on the attacked goal line point the way the offense is going
  [F.W*.15, F.W*.85].forEach(y => [0, 1.6].forEach(k => {
    const x = F.L - F.ez - 3.2 + k, a = M(x, y-1.1), b = M(x+1.1, y), c = M(x, y+1.1);
    el('path',{d:`M${f2(a[0])} ${f2(a[1])} L${f2(b[0])} ${f2(b[1])} L${f2(c[0])} ${f2(c[1])}`,fill:'none',stroke:'var(--off)','stroke-width':.34,'stroke-linecap':'round','stroke-linejoin':'round',opacity:.6},g);
  }));
  const gl = F.L - F.ez;
  for (let dd = 0; dd <= F.L - F.ez; dd += 10){
    const x = gl - dd; if (x < Math.max(1.5, v0 + 1.5) || x > Math.min(F.L - F.ez, v1 - 1.5)) continue;
    lineM(x, F.W, x, F.W+.8, {stroke:'var(--label)','stroke-width':.15}, g);
    const p = M(x, F.W+1.9);
    const tx = el('text',{x:f2(p[0]),y:f2(p[1]),'font-size':1.35,'font-weight':600,fill:'var(--label)','dominant-baseline':'central','text-anchor':orient==='h'?'middle':'start'},g);
    tx.textContent = dd === 0 ? 'GOAL' : dd + ' m';
  }
}
