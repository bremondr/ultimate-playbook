/* ---------- sharing by link: the whole drill travels in the link, no server needed ----------
   Built-in drills link by name (#angel). Drawn drills are packed: JSON, deflated, base64url, after #d=.
   Links always point at the public site, so they open anywhere. */
import { BUILTIN } from './data/builtins.js';
import { timeDraft } from './model/timing.js';
import { togglePop } from './nav.js';
import { showPlay } from './player.js';
import { current, draft, model, put, sharedRaw, team } from './state.js';
import { readRaw, serialize } from './storage.js';
import { $ } from './util.js';

const SHARE_BASE = 'https://bremondr.github.io/ultimate-playbook/';
const shareBase = () => location.hostname.endsWith('github.io') ? location.origin + location.pathname : SHARE_BASE;
function b64uEncode(bytes){ let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64uDecode(t){ const b = atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); }
export async function packDrill(body){
  const json = new TextEncoder().encode(JSON.stringify(body));
  if (typeof CompressionStream === 'function'){
    const out = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return 'z' + b64uEncode(new Uint8Array(out));
  }
  return 'j' + b64uEncode(json);
}
export async function unpackDrill(t){
  let bytes = b64uDecode(t.slice(1));
  if (t[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function shareLink(){
  if (!current) return null;
  if (current.source === 'builtin') return shareBase() + '#' + current.id;
  let raw = null;
  if (current.source === 'team'){ const e = team.find(x => x.id === current.id); raw = e && e.raw; }
  else if (current.source === 'preview') raw = draft;
  else if (current.source === 'shared') raw = sharedRaw;
  if (!raw) return null;
  const body = serialize({...raw, name: raw.name || 'Untitled drill'});
  return shareBase() + '#d=' + await packDrill(body);
}
async function openShare(){
  const pop = $('#share-pop');
  if (!pop.hidden){ togglePop('#share', '#share-pop'); return; }
  togglePop('#share', '#share-pop');
  $('#share-status').textContent = ''; $('#share-link').value = 'Making the link…';
  $('#share-what').textContent = current && current.source === 'builtin'
    ? 'Anyone with this link sees this drill on the Ultimate Playbook site.'
    : 'The whole drill is packed into the link itself, so it works without any account or server. Whoever opens it can watch it and save their own copy.';
  try {
    const url = await shareLink();
    $('#share-link').value = url || 'This drill can’t be shared.';
    $('#share-native').hidden = !(url && navigator.share && window.top === window);
  } catch (err){ $('#share-link').value = 'Couldn’t make a link in this browser.'; }
}
$('#share').addEventListener('click', openShare);
$('#share-copy').addEventListener('click', () => {
  const inp = $('#share-link'), url = inp.value;
  const done = () => { $('#share-status').textContent = 'Link copied.'; };
  const fallback = () => { inp.focus(); inp.select(); $('#share-status').textContent = 'Press Ctrl+C (or ⌘C) to copy the selected link.'; };
  try { navigator.clipboard.writeText(url).then(done, fallback); } catch (e){ fallback(); }
});
$('#share-native').addEventListener('click', () => {
  const url = $('#share-link').value;
  navigator.share({title: model ? model.play.name : 'Ultimate Playbook', url}).catch(() => {});
});
export async function openShared(packed){
  try {
    const raw = readRaw(await unpackDrill(packed));
    if (!raw) throw new Error('empty');
    put.sharedRaw(raw);
    showPlay({...timeDraft({...raw, id:'shared'}), id:'shared'}, {source:'shared', id:'shared'});
  } catch (err){
    showPlay(BUILTIN[0], {source:'builtin', id:BUILTIN[0].id});
    $('#pkind').textContent = 'That shared link is damaged or incomplete';
  }
}
