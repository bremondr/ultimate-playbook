/* ---------- drawing helpers ---------- */
import { orient } from './view.js';
import { $, f2 } from '../util.js';

const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] !== undefined) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
// field metres to SVG units for the current orientation
export const M = (x, y) => orient === 'h' ? [x, y] : [y, -x];
export function rectM(x0, y0, x1, y1, attrs, parent){
  const a = M(x0,y0), b = M(x1,y1);
  return el('rect', {x:f2(Math.min(a[0],b[0])), y:f2(Math.min(a[1],b[1])), width:f2(Math.abs(b[0]-a[0])), height:f2(Math.abs(b[1]-a[1])), ...attrs}, parent);
}
export const lineM = (x0,y0,x1,y1,attrs,parent) => { const a=M(x0,y0), b=M(x1,y1); return el('line',{x1:f2(a[0]),y1:f2(a[1]),x2:f2(b[0]),y2:f2(b[1]),...attrs},parent); };
export const dPath = pts => 'M' + pts.map(q => { const m = M(q[0], q[1]); return f2(m[0]) + ' ' + f2(m[1]); }).join(' L');

export const svg = $('#field');
