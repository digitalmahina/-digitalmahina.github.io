// Индекс для поиска по смыслу: режет тексты на фрагменты и считает эмбеддинги
// той же моделью, что работает в браузере (transformers.js, multilingual-e5-small, q8).
// Пишет data/sem/index.json и data/sem/<id>.i8 (int8-векторы, по DIM байт на фрагмент).
// Пересчитывает только документы, у которых сменился hash.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { pipeline, env } from '@huggingface/transformers';

export const MODEL = 'Xenova/multilingual-e5-small', DTYPE = 'q8', DIM = 384, VER = 1;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'data'), SEM = path.join(DATA, 'sem');
const TARGET = 700, MAXC = 1100;

// Фрагменты: идём по строкам, начинаем новый фрагмент на заголовке или пункте, держим 300–1100 символов.
export function chunk(text) {
  const lines = text.split('\n'), out = []; let s = 0, buf = '', head = '';
  const isHead = t => t.length < 160 && /^(Раздел [IVXLC\d]+|Глава [\dIVXLC]+|[IVXLC]{1,6}\. .{3,}|Статья \d+[\d.-]*\.?.*|Приложение( N| №)? ?\d*)$/.test(t);
  const isPoint = t => /^\d+(\.\d+)*\.?\s/.test(t);
  const flush = e => { if (buf.trim().length > 40) out.push([s, e, head]); buf = ''; };
  lines.forEach((l, i) => {
    const t = l.trim();
    if (isHead(t)) { flush(i - 1); s = i; head = t.slice(0, 120); buf = t + '\n'; return; }
    if (!buf) s = i;
    if ((isPoint(t) && buf.length > 300) || buf.length + t.length > MAXC) { flush(i - 1); s = i; }
    buf += t + '\n';
    if (buf.length > TARGET && /[.;:]$/.test(t)) { flush(i); s = i + 1; }
  });
  flush(lines.length - 1);
  return out;
}

async function main() {
  fs.mkdirSync(SEM, { recursive: true });
  const idx = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json')));
  const ip = path.join(SEM, 'index.json');
  let old = fs.existsSync(ip) ? JSON.parse(fs.readFileSync(ip)) : {};
  if (old.model !== MODEL || old.ver !== VER) old = { docs: {} };
  env.cacheDir = path.join(ROOT, '.model-cache');
  const ext = await pipeline('feature-extraction', MODEL, { dtype: DTYPE });
  const out = { model: MODEL, dtype: DTYPE, dim: DIM, ver: VER, prefix: { query: 'query: ', passage: 'passage: ' }, docs: {} };
  let changed = 0;
  for (const d of idx.docs) {
    if (d.error || !d.hash) continue;
    const prev = old.docs?.[d.id], bin = path.join(SEM, d.id + '.i8');
    if (prev && prev.hash === d.hash && fs.existsSync(bin)) { out.docs[d.id] = prev; continue; }
    const text = JSON.parse(fs.readFileSync(path.join(DATA, 'docs', d.id + '.json'))).text;
    const ch = chunk(text), lines = text.split('\n');
    const vec = new Int8Array(ch.length * DIM);
    for (let b = 0; b < ch.length; b += 16) {
      const batch = ch.slice(b, b + 16).map(([s, e, h]) => 'passage: ' + (d.short + '. ' + (h ? h + '. ' : '') + lines.slice(s, e + 1).join(' ')).slice(0, 1500));
      const t = await ext(batch, { pooling: 'mean', normalize: true });
      const a = t.data;
      for (let k = 0; k < a.length; k++) vec[b * DIM + k] = Math.max(-127, Math.min(127, Math.round(a[k] * 127)));
    }
    fs.writeFileSync(bin, Buffer.from(vec.buffer));
    out.docs[d.id] = { hash: d.hash, n: ch.length, chunks: ch.map(([s, e]) => [s, e]) };
    changed++; console.error('emb', d.id, ch.length);
  }
  for (const f of fs.readdirSync(SEM)) if (f.endsWith('.i8') && !out.docs[f.slice(0, -3)]) fs.unlinkSync(path.join(SEM, f));
  out.total = Object.values(out.docs).reduce((a, x) => a + x.n, 0);
  fs.writeFileSync(ip, JSON.stringify(out));
  console.error('sem done; re-embedded', changed, 'chunks', out.total);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
