// Safe DOM builders. Data never goes through HTML-string APIs: text is always a text node.
const SVG_NS = 'http://www.w3.org/2000/svg';
const ATTR_OK = /^(class|id|role|tabindex|type|href|target|rel|title|lang|dir|for|name|value|placeholder|disabled|open|hidden|autocomplete|inputmode|accept|download|loading|allow|allowfullscreen|aria-[a-z]+|data-[a-z-]+|viewBox|d|cx|cy|r|x|y|width|height|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-dasharray|stroke-dashoffset|transform|points|rx|ry|x1|x2|y1|y2|focusable|preserveAspectRatio)$/;

/** Allow only in-app hash links or https URLs. Anything else returns null. */
export function safeHref(v) {
  if (typeof v !== 'string') return null;
  if (v.startsWith('#')) return v;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}

function apply(el, props) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'href') {
      const safe = safeHref(v);
      if (safe) el.setAttribute('href', safe);
    } else if (ATTR_OK.test(k)) {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (el.getAttribute && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  apply(el, props); append(el, kids); return el;
}
export function s(tag, props, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props); append(el, kids); return el;
}
export const clear = (el) => el.replaceChildren();

/** Banner (errors, info). Returns the element. */
export function banner(host, kind, title, lines = [], actions = []) {
  const el = h('div', { class: 'banner ' + kind, role: kind === 'error' ? 'alert' : 'status' },
    h('strong', null, title),
    ...lines.map((l) => h('p', null, l)),
    actions.length ? h('div', { class: 'row' }, ...actions) : null,
    h('button', { class: 'x', type: 'button', 'aria-label': 'إغلاق', onclick: () => el.remove() }, '×'));
  host.appendChild(el);
  return el;
}

/** Progress ring (SVG). ratio 0..1 */
export function ring(ratio, label) {
  const C = 2 * Math.PI * 18;
  const r = Math.max(0, Math.min(1, ratio || 0));
  return h('span', { class: 'ring', role: 'img', 'aria-label': label },
    s('svg', { viewBox: '0 0 44 44', width: 44, height: 44, focusable: 'false' },
      s('circle', { cx: 22, cy: 22, r: 18, fill: 'none', 'stroke-width': 5, class: 'ring-bg' }),
      s('circle', { cx: 22, cy: 22, r: 18, fill: 'none', 'stroke-width': 5, class: 'ring-fg',
        'stroke-linecap': 'round', 'stroke-dasharray': C.toFixed(2), 'stroke-dashoffset': (C * (1 - r)).toFixed(2),
        transform: 'rotate(-90 22 22)' })));
}

export const stamp = (text = 'تم ✓') => h('span', { class: 'stamp', 'aria-hidden': 'false' }, text);
