import { h } from '../ui.js';
export function renderNotFound() {
  return { title: 'الصفحة مش موجودة', node: h('div', { class: 'view' },
    h('section', { class: 'sheet empty' }, h('h1', null, 'الصفحة دي مش موجودة'),
      h('p', null, 'يمكن الرابط قديم أو فيه غلطة. ارجع للرئيسية وكمّل.'), h('a', { class: 'btn primary', href: '#/' }, 'ارجع للرئيسية'))) };
}
