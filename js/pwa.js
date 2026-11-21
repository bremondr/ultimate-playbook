/* ---------- install on the home screen and work offline ----------
   Registers the service worker (sw.js), which stores the app for offline use. Only on http(s), only where
   service workers exist, and not inside claude.ai, where the app runs as an artifact in a sandboxed frame
   that can't use them. */
const inClaude = () => typeof window.claude === 'object' && window.claude !== null
  || /(^|\.)(claude\.ai|claudeusercontent\.com|claude\.site)$/.test(location.hostname);

export function registerServiceWorker(){
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || inClaude()) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {});   // without it the app still works online
}
if (document.readyState === 'complete') registerServiceWorker();
else addEventListener('load', registerServiceWorker, {once: true});
