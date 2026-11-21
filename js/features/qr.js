/* ---------- QR codes for share links ----------
   A small QR Code encoder (ISO/IEC 18004), written for this app because there is no build step and no
   library download. It covers what share links need and nothing more:
   - byte mode only (links are plain ASCII; any text is sent as UTF-8),
   - error correction level L or M (whichever gives the smaller symbol; M on a tie),
   - versions 1 to 40 (up to 2,953 bytes at level L, so even long #d= links fit),
   - Reed–Solomon error correction over GF(256), block interleaving,
   - all eight masks, choosing the one with the lowest penalty score.
   The second half of the file wires the code into the share popover and the "show larger" view. */

/* ===== Encoder ===== */

// Error correction codewords per block, and the number of blocks, by level and version (index 0 unused).
const ECC_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
};
const NUM_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
};
// The two bits that name the level inside the format information (L = 01, M = 00).
const ECL_BITS = { L: 1, M: 0 };

// Modules left for data and error correction once the function patterns are drawn.
function rawDataModules(ver){
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2){ const a = Math.floor(ver / 7) + 2; n -= (25 * a - 10) * a - 55; if (ver >= 7) n -= 36; }
  return n;
}
const dataCodewords = (ver, ecl) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
// Bits a byte-mode segment needs: 4-bit mode, character count (8 bits up to version 9, then 16), the data.
const segmentBits = (ver, len) => 4 + (ver <= 9 ? 8 : 16) + 8 * len;

/* GF(256) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D). */
function gfMul(x, y){
  let z = 0;
  for (let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z;
}
// Generator polynomial of the given degree: product of (x - 2^i), i = 0 … degree-1. Leading 1 is implied.
function rsDivisor(degree){
  const r = new Array(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++){
    for (let j = 0; j < r.length; j++){ r[j] = gfMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = gfMul(root, 0x02);
  }
  return r;
}
// Remainder of data(x) · x^degree divided by the generator: the error correction codewords.
function rsRemainder(data, divisor){
  const r = divisor.map(() => 0);
  for (const b of data){
    const f = b ^ r.shift(); r.push(0);
    divisor.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

// Split the data into blocks, add error correction to each, then interleave the blocks column by column.
function addEccAndInterleave(data, ver, ecl){
  const nBlocks = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver], raw = Math.floor(rawDataModules(ver) / 8);
  const nShort = nBlocks - raw % nBlocks, shortLen = Math.floor(raw / nBlocks);
  const div = rsDivisor(eccLen), blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++){
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);          // placeholder so all blocks line up; skipped below
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(b[i]); });
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => x * y % 2 + x * y % 3 === 0,
  (x, y) => (x * y % 2 + x * y % 3) % 2 === 0,
  (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
];

function alignmentPositions(ver, size){
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
  return r;
}

// A symbol under construction: modules[y][x] true = dark; fn[y][x] true = function pattern (not data).
class QrSymbol {
  constructor(ver, ecl){
    this.ver = ver; this.ecl = ecl; this.size = ver * 4 + 17;
    this.m = Array.from({length: this.size}, () => new Array(this.size).fill(false));
    this.fn = Array.from({length: this.size}, () => new Array(this.size).fill(false));
  }
  setFn(x, y, dark){ this.m[y][x] = dark; this.fn[y][x] = true; }
  drawFunctionPatterns(){
    const s = this.size;
    for (let i = 0; i < s; i++){ this.setFn(6, i, i % 2 === 0); this.setFn(i, 6, i % 2 === 0); }   // timing
    [[3, 3], [s - 4, 3], [3, s - 4]].forEach(([cx, cy]) => {                                        // finders + separators
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < s && y >= 0 && y < s) this.setFn(x, y, d !== 2 && d !== 4);
      }
    });
    const al = alignmentPositions(this.ver, s), last = al.length - 1;
    al.forEach((ax, i) => al.forEach((ay, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;   // under a finder
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    this.drawFormat(0);        // reserve the format areas; redrawn with the real mask later
    this.drawVersion();
  }
  // 15-bit format information: level and mask, BCH(15,5) protected, XOR 0x5412, drawn twice.
  drawFormat(mask){
    const data = ECL_BITS[this.ecl] << 3 | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (data << 10 | rem) ^ 0x5412, bit = i => ((bits >>> i) & 1) !== 0, s = this.size;
    for (let i = 0; i <= 5; i++) this.setFn(8, i, bit(i));
    this.setFn(8, 7, bit(6)); this.setFn(8, 8, bit(7)); this.setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.setFn(s - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.setFn(8, s - 15 + i, bit(i));
    this.setFn(8, s - 8, true);   // the dark module
  }
  // 18-bit version information (versions 7+): BCH(18,6), drawn in two 6×3 blocks.
  drawVersion(){
    if (this.ver < 7) return;
    let rem = this.ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = this.ver << 12 | rem;
    for (let i = 0; i < 18; i++){
      const dark = ((bits >>> i) & 1) !== 0, a = this.size - 11 + i % 3, b = Math.floor(i / 3);
      this.setFn(a, b, dark); this.setFn(b, a, dark);
    }
  }
  // Data bits go in two-module-wide columns, right to left, snaking up and down, skipping the timing column.
  drawCodewords(cw){
    let i = 0;
    const s = this.size;
    for (let right = s - 1; right >= 1; right -= 2){
      if (right === 6) right = 5;
      for (let v = 0; v < s; v++) for (let j = 0; j < 2; j++){
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? s - 1 - v : v;
        if (!this.fn[y][x] && i < cw.length * 8){ this.m[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
      }
    }
  }
  applyMask(k){
    const f = MASKS[k];
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) if (!this.fn[y][x] && f(x, y)) this.m[y][x] = !this.m[y][x];
  }
  // Penalty rules N1–N4 from the standard; lower is easier to scan.
  penalty(){
    const s = this.size, m = this.m;
    let p = 0, dark = 0;
    const line = get => {
      // N1: runs of 5+ same-colour modules; N3: 1:1:3:1:1 finder-like patterns with 4 light modules on a side
      let run = 0, prev = null;
      const cells = [];
      for (let i = 0; i < s; i++){
        const c = get(i); cells.push(c ? 1 : 0);
        if (c === prev){ run++; if (run === 5) p += 3; else if (run > 5) p += 1; } else { prev = c; run = 1; }
      }
      const padded = [0, 0, 0, 0, ...cells, 0, 0, 0, 0].join('');
      for (const pat of ['00001011101', '10111010000']){ let at = padded.indexOf(pat); while (at !== -1){ p += 40; at = padded.indexOf(pat, at + 1); } }
    };
    for (let y = 0; y < s; y++) line(x => m[y][x]);
    for (let x = 0; x < s; x++) line(y => m[y][x]);
    for (let y = 0; y < s - 1; y++) for (let x = 0; x < s - 1; x++){   // N2: 2×2 blocks of one colour
      const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) if (m[y][x]) dark++;
    const total = s * s;                                               // N4: balance of dark and light
    p += Math.ceil(Math.abs(dark * 20 - total * 10) / total - 1) * 10;
    return p;
  }
}

/**
 * Encode text as a QR code.
 * @param {string} text  any text; sent as UTF-8 bytes in byte mode
 * @param {{ecl?: 'L'|'M'|'auto', mask?: number}} [opt]  'auto' (default) picks the level giving the smaller symbol, M on a tie
 * @returns {{version:number, ecl:'L'|'M', mask:number, size:number, modules:boolean[][]}}  modules[y][x], true = dark
 */
export function encodeQR(text, opt = {}){
  const bytes = Array.from(new TextEncoder().encode(text));
  const fits = ecl => { for (let v = 1; v <= 40; v++) if (segmentBits(v, bytes.length) <= dataCodewords(v, ecl) * 8) return v; return 0; };
  let ecl = opt.ecl === 'L' || opt.ecl === 'M' ? opt.ecl : null;
  if (!ecl){ const vm = fits('M'), vl = fits('L'); ecl = vm && vm <= vl ? 'M' : 'L'; }
  const ver = fits(ecl);
  if (!ver) throw new RangeError('Text too long for a QR code');

  // Bit stream: mode 0100, count, bytes, terminator, pad to a byte, then alternate 0xEC 0x11.
  const capBits = dataCodewords(ver, ecl) * 8, bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(b => put(b, 8));
  put(0, Math.min(4, capBits - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));

  const sym = new QrSymbol(ver, ecl);
  sym.drawFunctionPatterns();
  sym.drawCodewords(addEccAndInterleave(data, ver, ecl));
  let mask = Number.isInteger(opt.mask) && opt.mask >= 0 && opt.mask < 8 ? opt.mask : -1;
  if (mask < 0){
    let best = Infinity;
    for (let k = 0; k < 8; k++){
      sym.applyMask(k); sym.drawFormat(k);
      const pen = sym.penalty(); if (pen < best){ best = pen; mask = k; }
      sym.applyMask(k);   // XOR again to undo
    }
  }
  sym.applyMask(mask); sym.drawFormat(mask);
  return {version: ver, ecl, mask, size: sym.size, modules: sym.m};
}

/** SVG markup for a QR code: dark modules on white with a 4-module quiet zone, one path, crisp edges. */
export function qrSvg(qr, {label = 'QR code', quiet = 4} = {}){
  const n = qr.size + quiet * 2;
  let d = '';
  qr.modules.forEach((row, y) => {
    for (let x = 0; x < qr.size; x++){
      if (!row[x]) continue;
      let w = 1; while (x + w < qr.size && row[x + w]) w++;
      d += `M${x + quiet} ${y + quiet}h${w}v1h-${w}z`; x += w - 1;
    }
  });
  const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${esc(label)}">`
    + `<rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/* ===== Share popover and large view ===== */
// share.js announces each new link with a 'playbook:share-link' event (detail.url, or null when there is none).

if (typeof document !== 'undefined' && document.getElementById('share-qr')){
  const box = document.getElementById('share-qr'), big = document.getElementById('qr-big'), bigCode = document.getElementById('qr-big-code');
  const moreBtn = document.getElementById('share-qr-big');
  const note = document.getElementById('share-qr-note');
  let svgText = '';
  const show = url => {
    svgText = ''; let tooLong = false;
    if (url && /^https?:/.test(url)){
      try { svgText = qrSvg(encodeQR(url), {label: 'QR code of the link to this drill'}); } catch (e){ tooLong = e instanceof RangeError; }
    }
    box.innerHTML = svgText;
    box.hidden = moreBtn.hidden = !svgText;
    note.hidden = !tooLong;
  };
  const openBig = on => {
    big.hidden = !on;
    if (on){
      bigCode.innerHTML = svgText;
      document.getElementById('qr-big-name').textContent = document.getElementById('pname').textContent;
      document.getElementById('qr-big-close').focus();
    } else if (!moreBtn.hidden && moreBtn.offsetParent) moreBtn.focus();
  };
  document.addEventListener('playbook:share-link', e => show(e.detail && e.detail.url));
  moreBtn.addEventListener('click', () => openBig(true));
  box.addEventListener('click', () => openBig(true));
  document.getElementById('qr-big-close').addEventListener('click', () => openBig(false));
  big.addEventListener('click', e => { if (e.target === big) openBig(false); });
  // taps in the large view must not reach the page's "tap outside closes the popover" handler
  big.addEventListener('pointerdown', e => e.stopPropagation());
  // capture phase, so Escape closes only this view and not the popover underneath
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !big.hidden){ e.stopPropagation(); openBig(false); } }, true);
}
