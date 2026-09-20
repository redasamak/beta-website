// Builds ONE self-contained HTML file (dist/preview.html) for quick private previews (e.g. a claude.ai artifact).
// The real site is the multi-file folder; this is only a convenience. Usage: npm run build:preview
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (f) => readFileSync(new URL(f, root), 'utf8');

const js = await build({ entryPoints: [new URL('js/main.js', root).pathname], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020' });
const embed = { 'data/config.json': read('data/config.json'), 'data/courses.json': read('data/courses.json') };
for (const f of readdirSync(new URL('data/lessons/', root))) embed[`data/lessons/${f}`] = read(`data/lessons/${f}`);

let html = read('index.html')
  .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/, '')          // the host page sets its own policy
  .replace(/<link rel="modulepreload"[^>]*>\n?/g, '')
  .replace(/<link rel="(manifest|apple-touch-icon|icon)"[^>]*>\n?/g, '')
  .replace('<link rel="stylesheet" href="css/app.css">', () => `<style>${read('css/app.css')}</style>`)
  .replace('<script type="module" src="js/main.js"></script>', () => '');
const safeJson = (s) => s.replace(/</g, '\\u003c');           // JSON: escape every '<'
const safeJs = (s) => s.replace(/<\/script/gi, '<\\/script'); // JS code: only the closing-tag sequence is dangerous
html = html.replace('</body>', () => `<script>window.__BASATA_EMBED__=${safeJson(JSON.stringify(embed))};</script>\n<script>${safeJs(js.outputFiles[0].text)}</script>\n</body>`);
mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/preview.html', root), html);
console.log('dist/preview.html', (html.length / 1024).toFixed(1) + ' KB');
