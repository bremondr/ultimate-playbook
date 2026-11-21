/* ---------- sharing by link: the whole drill travels in the link, no server needed ----------
   Built-in drills link by name (#angel). Drawn drills are packed: JSON, deflated, base64url, after #d=.
   Links always point at the public site, so they open anywhere. The share popover itself is in nav.js. */
import { readRaw, serialize } from './storage.js';

const SHARE_BASE = 'https://bremondr.github.io/ultimate-playbook/';
const shareBase = () => location.hostname.endsWith('github.io') ? location.origin + location.pathname : SHARE_BASE;
function b64uEncode(bytes){ let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uDecode(t){ const b = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function packDrill(body){
  const json = new TextEncoder().encode(JSON.stringify(body));
  if (typeof CompressionStream === 'function'){
    const out = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return 'z' + b64uEncode(new Uint8Array(out));
  }
  return 'j' + b64uEncode(json);
}
async function unpackDrill(t){
  let bytes = b64uDecode(t.slice(1));
  if (t[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}

export const builtinLink = id => shareBase() + '#' + id;
export async function drillLink(raw){
  const body = serialize({...raw, name: raw.name || 'Untitled drill'});
  return shareBase() + '#d=' + await packDrill(body);
}
// the drill in a #d= link, checked field by field like any stored drill; throws if the link is damaged
export async function readShared(packed){
  const raw = readRaw(await unpackDrill(packed));
  if (!raw) throw new Error('empty');
  return raw;
}
