// Tiny hash router. Works at any GitHub Pages sub-path because it only touches location.hash.
export function parseHash(hash) {
  const raw = (hash || '').replace(/^#/, '');
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const query = {};
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    try { query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch { /* ignore bad escapes */ }
  }
  return { parts, query };
}

export function matchRoute(routes, hash) {
  const { parts, query } = parseHash(hash);
  for (const r of routes) {
    const pat = r.path.split('/').filter(Boolean);
    if (pat.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < pat.length; i++) {
      if (pat[i].startsWith(':')) params[pat[i].slice(1)] = parts[i];
      else if (pat[i] !== parts[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params, query };
  }
  return { route: null, params: {}, query };
}

export function createRouter(routes, handler) {
  const run = () => handler(matchRoute(routes, location.hash));
  window.addEventListener('hashchange', run);
  return { run, go: (p) => { location.hash = p; } };
}
