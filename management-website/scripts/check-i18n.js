// Checks that English, Arabic and Hindi dictionaries have the same keys,
// and that every literal t('key') used in the front end exists.
import { readFileSync, readdirSync } from 'node:fs';
import { DICT } from '../public/js/i18n.js';

const base = Object.keys(DICT.en);
let problems = 0;
for (const lang of ['ar', 'hi']) {
  const keys = new Set(Object.keys(DICT[lang]));
  for (const k of base) if (!keys.has(k)) { console.log(`${lang}: missing ${k}`); problems++; }
  for (const k of keys) if (!(k in DICT.en)) { console.log(`${lang}: extra ${k}`); problems++; }
}
const dir = new URL('../public/js/', import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(new URL(file, dir), 'utf8');
  for (const [, key] of src.matchAll(/\bt\('([a-z_]+\.[a-z0-9_]+)'/g)) {
    if (!(key in DICT.en)) { console.log(`${file}: unknown key ${key}`); problems++; }
  }
}
console.log(problems ? `${problems} problem(s)` : `OK: ${base.length} keys in en/ar/hi`);
process.exit(problems ? 1 : 0);
