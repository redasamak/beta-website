import { JSDOM } from 'jsdom';
export function setupDom() {
  const dom = new JSDOM('<!doctype html><html lang="ar" dir="rtl"><body><main id="main"></main></body></html>', { url: 'http://localhost/' });
  globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.Node = dom.window.Node;
  return dom;
}
export class MemStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
export class BlockedStorage { getItem() { throw new Error('blocked'); } setItem() { throw new Error('blocked'); } removeItem() { throw new Error('blocked'); } }
