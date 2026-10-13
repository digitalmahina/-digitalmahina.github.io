'use strict';
// Поиск по смыслу: модель multilingual-e5-small (q8) работает прямо в браузере через transformers.js.
// Векторы фрагментов документов заранее считает сервер обновлений (data/sem/).
const SEM = (() => {
  const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
  let ext = null, meta = null, vecs = null, map = null, loading = null;
  // Сокращения и разговорные формулировки → термины из текстов ФАП
  const ABBR = {
    'квс': 'командир воздушного судна', 'вс': 'воздушное судно', 'пвп': 'правила визуальных полетов', 'ппп': 'правила полетов по приборам',
    'пму': 'простые метеорологические условия', 'сму': 'сложные метеорологические условия', 'овд': 'обслуживание воздушного движения',
    'ивп': 'использование воздушного пространства', 'рлэ': 'руководство по летной эксплуатации', 'рпп': 'руководство по производству полетов',
    'впп': 'взлетно-посадочная полоса', 'рд': 'рулежная дорожка', 'впр': 'высота принятия решения', 'мвс': 'минимальная высота снижения',
    'опп': 'основной пункт посадки', 'бпрм': 'ближний приводной радиомаркер', 'дпрм': 'дальний приводной радиомаркер',
    'анпп': 'аэронавигационный паспорт посадочной площадки', 'аип': 'сборник аэронавигационной информации', 'нотам': 'NOTAM извещение',
    'rvsm': 'сокращенный минимум вертикального эшелонирования RVSM', 'свмэ': 'сокращенный минимум вертикального эшелонирования',
    'fato': 'зона конечного этапа захода на посадку и взлета FATO', 'tlof': 'зона приземления и отрыва TLOF',
    'вфр': 'правила визуальных полетов', 'vfr': 'правила визуальных полетов', 'ifr': 'правила полетов по приборам',
    'атс': 'обслуживание воздушного движения', 'зц': 'зональный центр ЕС ОрВД', 'ес орвд': 'единая система организации воздушного движения',
    'пп': 'посадочная площадка', 'авр': 'авиационные работы', 'аон': 'авиация общего назначения', 'бвс': 'беспилотное воздушное судно',
    'вэк': 'врачебно-экспертная комиссия медицинское освидетельствование', 'ппл': 'свидетельство частного пилота', 'cpl': 'свидетельство коммерческого пилота',
    'отдых': 'время отдыха членов экипажа', 'налет': 'полетное время налет', 'тао': 'техническое обслуживание', 'гсм': 'горюче-смазочные материалы топливо',
    'подбор с воздуха': 'площадка подобранная с воздуха', 'подобранная с воздуха': 'площадка подобранная с воздуха',
    'колдун': 'ветроуказатель', 'вертушка': 'вертолет', 'вертолётка': 'посадочная площадка для вертолетов',
  };
  function expand(q) {
    const low = q.toLowerCase().replace(/ё/g, 'е'); const add = [];
    for (const [k, v] of Object.entries(ABBR)) if (new RegExp('(^|[^а-яa-z])' + k + '($|[^а-яa-z])').test(low)) add.push(v);
    return add.length ? q + ' (' + add.join('; ') + ')' : q;
  }
  const ready = () => !!(ext && vecs);
  const wasEnabled = () => localStorage.getItem('semReady') === '1';
  async function load(onProgress = () => {}) {
    if (ready()) return true;
    if (loading) return loading;
    loading = (async () => {
      onProgress('Загружаю индекс…');
      meta = await (await fetch('data/sem/index.json', { cache: 'no-cache' })).json();
      const ids = Object.keys(meta.docs); let total = 0; map = [];
      for (const id of ids) total += meta.docs[id].n;
      vecs = new Int8Array(total * meta.dim); let off = 0;
      for (const id of ids) {
        const r = await fetch('data/sem/' + id + '.i8?h=' + meta.docs[id].hash); if (!r.ok) throw new Error('нет индекса ' + id);
        const buf = new Int8Array(await r.arrayBuffer()); if (buf.length !== meta.docs[id].n * meta.dim) throw new Error('индекс устарел, обнови страницу');
        vecs.set(buf, off * meta.dim);
        meta.docs[id].chunks.forEach((c, j) => map.push([id, c[0], c[1]]));
        off += meta.docs[id].n;
      }
      onProgress('Загружаю модель…');
      const T = await import(LIB);
      T.env.allowLocalModels = false; T.env.useBrowserCache = true;
      const files = {};
      ext = await T.pipeline('feature-extraction', meta.model, {
        dtype: meta.dtype,
        progress_callback: p => { if (p.status === 'progress' && p.total) { files[p.file] = [p.loaded, p.total];
          const [l, t] = Object.values(files).reduce((a, x) => [a[0] + x[0], a[1] + x[1]], [0, 0]);
          onProgress(`Скачиваю модель: ${Math.round(l / 1048576)} из ${Math.round(t / 1048576)} МБ`); } }
      });
      localStorage.setItem('semReady', '1');
      return true;
    })().catch(e => { loading = null; ext = null; vecs = null; throw e; });
    return loading;
  }
  async function search(q, k = 40) {
    await load();
    const t = await ext(meta.prefix.query + expand(q), { pooling: 'mean', normalize: true });
    const qv = t.data, D = meta.dim, n = map.length, sc = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0, o = i * D; for (let j = 0; j < D; j++) s += qv[j] * vecs[o + j]; sc[i] = s / 127; }
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => sc[b] - sc[a]).slice(0, k);
    return idx.map(i => ({ id: map[i][0], s: map[i][1], e: map[i][2], score: sc[i] }));
  }
  return { load, search, ready, wasEnabled, expand };
})();
