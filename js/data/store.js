// Progress store. Public API = BasataStore. Storage is swappable via a backend object:
//   { get(key) -> string|null, set(key, str), remove(key), persistent: boolean }
// Default backend = localStorage with automatic in-memory fallback (private mode / blocked storage).
const KEY = 'basata:v1:progress';
const THEME_KEY = 'basata:v1:theme';
const DAY = 86400000;
const BOXES = [1, 2, 4, 8, 16]; // days until next review for Leitner box 1..5

export class LocalBackend {
  constructor(storage) {
    this.mem = new Map();
    this.persistent = false;
    try {
      const st = storage ?? globalThis.localStorage;
      const probe = '__basata_probe__';
      st.setItem(probe, '1'); st.removeItem(probe);
      this.st = st; this.persistent = true;
    } catch { this.st = null; }
  }
  get(k) { try { if (this.st) return this.st.getItem(k); } catch { /* fall through */ } return this.mem.get(k) ?? null; }
  set(k, v) { try { if (this.st) { this.st.setItem(k, v); return; } } catch { /* fall through */ } this.mem.set(k, v); }
  remove(k) { try { if (this.st) this.st.removeItem(k); } catch { /* ignore */ } this.mem.delete(k); }
}

const blank = () => ({ schemaVersion: 1, completed: {}, last: null, quiz: {}, best: {} });

function sanitize(raw) {
  const out = blank();
  if (!raw || typeof raw !== 'object' || raw.schemaVersion !== 1) return null;
  const idOk = (k) => typeof k === 'string' && k.length <= 80 && k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
  if (raw.completed && typeof raw.completed === 'object')
    for (const [k, v] of Object.entries(raw.completed)) if (idOk(k) && typeof v === 'number') out.completed[k] = v;
  if (raw.last && idOk(raw.last.id) && typeof raw.last.at === 'number') out.last = { id: raw.last.id, at: raw.last.at };
  if (raw.quiz && typeof raw.quiz === 'object')
    for (const [k, v] of Object.entries(raw.quiz)) {
      if (idOk(k) && v && Number.isInteger(v.box) && v.box >= 1 && v.box <= 5 && typeof v.due === 'number')
        out.quiz[k] = { box: v.box, due: v.due, n: Number.isInteger(v.n) ? v.n : 0 };
    }
  if (raw.best && typeof raw.best === 'object')
    for (const [k, v] of Object.entries(raw.best)) if (idOk(k) && Number.isFinite(v) && v >= 0 && v <= 100) out.best[k] = v;
  return out;
}

export class BasataStore {
  constructor(backend = new LocalBackend()) { this.b = backend; this.p = this._load(); }
  get persistent() { return !!this.b.persistent; }
  _load() {
    try { const s = sanitize(JSON.parse(this.b.get(KEY) || 'null')); if (s) return s; } catch { /* corrupted: start fresh */ }
    return blank();
  }
  _save() { try { this.b.set(KEY, JSON.stringify(this.p)); } catch { /* memory only */ } }

  isComplete(id) { return !!this.p.completed[id]; }
  completedCount(ids) { return ids.filter((i) => this.p.completed[i]).length; }
  setComplete(id, on = true) { if (on) this.p.completed[id] = Date.now(); else delete this.p.completed[id]; this._save(); }
  setLast(id) { this.p.last = { id, at: Date.now() }; this._save(); }
  get last() { return this.p.last; }

  bestScore(lessonId) { return this.p.best[lessonId] ?? null; }
  setBest(lessonId, pct) { if (pct > (this.p.best[lessonId] ?? -1)) { this.p.best[lessonId] = pct; this._save(); } }

  /** Leitner: wrong -> box 1 (due tomorrow); right -> next box. */
  recordAnswer(qid, correct, now = Date.now()) {
    const cur = this.p.quiz[qid] || { box: 1, due: now, n: 0 };
    const box = correct ? Math.min(5, cur.box + 1) : 1;
    this.p.quiz[qid] = { box, due: now + BOXES[box - 1] * DAY, n: cur.n + 1 };
    this._save();
  }
  dueQuestions(now = Date.now()) {
    return Object.entries(this.p.quiz).filter(([, v]) => v.due <= now && v.box < 5).map(([k]) => k);
  }
  hasQuestionHistory(qid) { return !!this.p.quiz[qid]; }

  exportJSON() { return JSON.stringify(this.p, null, 2); }
  importJSON(text) {
    let raw; try { raw = JSON.parse(text); } catch { return { ok: false, reason: 'الملف مش JSON سليم' }; }
    const s = sanitize(raw);
    if (!s) return { ok: false, reason: 'الملف مش ملف تقدّم تابع للمنصة' };
    for (const [k, v] of Object.entries(s.completed)) this.p.completed[k] = Math.max(v, this.p.completed[k] || 0);
    for (const [k, v] of Object.entries(s.best)) this.p.best[k] = Math.max(v, this.p.best[k] ?? 0);
    for (const [k, v] of Object.entries(s.quiz)) if (!this.p.quiz[k] || v.n >= this.p.quiz[k].n) this.p.quiz[k] = v;
    if (s.last && (!this.p.last || s.last.at > this.p.last.at)) this.p.last = s.last;
    this._save();
    return { ok: true, lessons: Object.keys(s.completed).length };
  }
  reset() { this.p = blank(); this.b.remove(KEY); }

  get theme() { const t = this.b.get(THEME_KEY); return t === 'light' || t === 'dark' ? t : 'auto'; }
  setTheme(t) { if (t === 'auto') this.b.remove(THEME_KEY); else this.b.set(THEME_KEY, t); }
}
