'use strict';
const $ = s => document.querySelector(s), view = $('#view');
const LS = {get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))};
let INDEX = null, tab = 'docs', textCache = {};
const esc = s => String(s??'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = t => t ? new Date(typeof t === 'number' ? t*1000 : t).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
if (LS.get('dark', matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
document.documentElement.style.setProperty('--fs', LS.get('fs',17)+'px');
$('#theme').onclick = () => LS.set('dark', document.documentElement.classList.toggle('dark'));
$('#back').onclick = () => history.back();
document.querySelectorAll('nav.tabs button').forEach(b => b.onclick = () => { location.hash = b.dataset.tab; });

async function loadIndex(){
  const r = await fetch('data/index.json', {cache:'no-cache'}); INDEX = await r.json(); return INDEX;
}
async function loadText(id){
  if (textCache[id]) return textCache[id];
  const r = await fetch('data/docs/'+id+'.json'); const j = await r.json(); return textCache[id] = j.text;
}
const favs = () => LS.get('favs', []);
function toggleFav(id){ const f = favs(); const i = f.indexOf(id); i<0 ? f.push(id) : f.splice(i,1); LS.set('favs', f); }
function badges(d){
  let b = '';
  if (d.error) b += '<span class="badge red">нет текста</span>';
  if (d.repealed) b += '<span class="badge red">утратил силу</span>';
  if (d.valid_until) b += `<span class="badge warn">${esc(d.valid_until)}</span>`;
  if (d.lag) b += '<span class="badge warn">редакция на портале отстаёт</span>';
  const seen = LS.get('seenAt', null); if (seen && d.updated > seen) b += '<span class="badge">обновлён</span>';
  return b;
}
function docCard(d){
  const on = favs().includes(d.id);
  return `<div class="card" data-id="${d.id}"><button class="star" data-fav="${d.id}">${on?'★':'☆'}</button>
  <div class="t">${esc(d.short)}</div><div class="s">${badges(d)}${esc(d.date?('от '+d.date+' № '+d.number):'')} ${esc(d.edition||'')}</div></div>`;
}
function bindCards(){
  view.querySelectorAll('[data-fav]').forEach(b => b.onclick = e => { e.stopPropagation(); toggleFav(b.dataset.fav); route(); });
  view.querySelectorAll('.card[data-id]').forEach(c => c.onclick = () => location.hash = 'doc/'+c.dataset.id);
}
function updatesBanner(){
  const seen = LS.get('seenAt', null);
  if (!seen) { LS.set('seenAt', INDEX.generated_at); return ''; }
  const n = INDEX.changes.filter(c => c.at > seen).length;
  return n ? `<div class="banner">Появились обновления: ${n}. <a href="#updates">Посмотреть</a></div>` : '';
}
function renderDocs(list, title){
  $('#title').textContent = title;
  const q = LS.get('filter','');
  view.innerHTML = updatesBanner() + `<input type="search" id="flt" placeholder="Фильтр по названию…" value="${esc(q)}">
   <div id="list"></div><p class="muted">Проверено: ${fmt(INDEX.checked_at)} · документов: ${INDEX.docs.length}</p>`;
  const draw = () => { const v = $('#flt').value.toLowerCase(); LS.set('filter', $('#flt').value);
    $('#list').innerHTML = list.filter(d => (d.short+' '+d.title).toLowerCase().includes(v)).map(docCard).join('') || '<p class="muted">Ничего не найдено</p>'; bindCards(); };
  $('#flt').oninput = draw; draw();
}
function headingRe(){ return /^(Раздел [IVXLC\d]+|Глава [\dIVXLC]+|[IVXLC]{1,6}\. .{3,}|Статья \d+[\d.-]*\.?.*|Приложение( N| №)? ?\d*)$/; }
async function renderDoc(id, hl){
  const d = INDEX.docs.find(x => x.id === id); if (!d) return route('docs');
  $('#title').textContent = d.short; $('#back').classList.remove('hidden');
  if (d.error) { view.innerHTML = `<h2>${esc(d.short)}</h2><p>${esc(d.error)}</p><p><a href="${esc(d.source_url)}" target="_blank">Открыть источник</a></p>`; return; }
  view.innerHTML = '<p class="muted">Загрузка…</p>';
  let text; try { text = await loadText(id); } catch { view.innerHTML = '<p>Нет сети, и документ ещё не сохранён офлайн.</p>'; return; }
  const lines = text.split('\n'), re = headingRe(), toc = [];
  const html = lines.map((l, i) => { const t = l.trim(); if (t.length < 160 && re.test(t)) { toc.push([i, t]); return `<h3 id="h${i}">${esc(t)}</h3>`; } return esc(l); }).join('\n');
  LS.set('last', id);
  view.innerHTML = `<div class="toolbar"><input type="search" id="find" placeholder="Поиск в документе"><span class="muted" id="cnt"></span>
   <button id="prev">↑</button><button id="next">↓</button><button id="tocBtn">☰</button><button id="fsm">A−</button><button id="fsp">A+</button></div>
   <div class="muted">${badges(d)}${esc(d.edition||'')} · источник: <a href="${esc(d.source_url)}" target="_blank">${esc(d.source)}</a> · обновлён в базе ${fmt(d.updated)}${d.lag?'<br>⚠ '+esc(d.lag):''}</div>
   <div id="docText">${html}</div>`;
  $('#tocBody').innerHTML = toc.length ? toc.map(([i,t]) => `<a href="#" data-h="${i}">${esc(t)}</a>`).join('') : '<p class="muted">Оглавление не найдено</p>';
  $('#tocBody').querySelectorAll('a').forEach(a => a.onclick = e => { e.preventDefault(); tocDlg.close(); document.getElementById('h'+a.dataset.h).scrollIntoView(); scrollBy(0,-110); });
  $('#tocBtn').onclick = () => tocDlg.showModal();
  const setFs = v => { v = Math.max(12, Math.min(28, v)); LS.set('fs', v); document.documentElement.style.setProperty('--fs', v+'px'); };
  $('#fsm').onclick = () => setFs(LS.get('fs',17)-1); $('#fsp').onclick = () => setFs(LS.get('fs',17)+1);
  const box = $('#docText'), orig = box.innerHTML; let marks = [], cur = 0;
  const go = k => { if (!marks.length) return; marks[cur]?.classList.remove('cur'); cur = (k+marks.length)%marks.length; marks[cur].classList.add('cur'); marks[cur].scrollIntoView({block:'center'}); $('#cnt').textContent = (cur+1)+'/'+marks.length; };
  const find = () => { const q = $('#find').value.trim(); box.innerHTML = orig; marks = []; $('#cnt').textContent = '';
    if (q.length < 2) return; const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    const walk = n => { if (n.nodeType === 3) { if (!rx.test(n.data)) return; rx.lastIndex = 0; const f = document.createDocumentFragment(); let last = 0;
        n.data.replace(rx, (m, off) => { f.append(n.data.slice(last, off)); const mk = document.createElement('mark'); mk.textContent = m; f.append(mk); last = off+m.length; });
        f.append(n.data.slice(last)); n.replaceWith(f); } else [...n.childNodes].forEach(walk); };
    walk(box); marks = [...box.querySelectorAll('mark')]; $('#cnt').textContent = marks.length ? '' : '0'; go(0); };
  let t; $('#find').oninput = () => { clearTimeout(t); t = setTimeout(find, 250); };
  $('#next').onclick = () => go(cur+1); $('#prev').onclick = () => go(cur-1);
  if (hl) { $('#find').value = hl; find(); }
}
async function renderSearch(){
  $('#title').textContent = 'Поиск по всем документам';
  view.innerHTML = `<input type="search" id="gq" placeholder="Например: минимум погоды, ПВП, эшелон перехода"><p class="muted" id="gs"></p><div id="gr"></div>`;
  const docs = INDEX.docs.filter(d => !d.error);
  let t; $('#gq').oninput = () => { clearTimeout(t); t = setTimeout(run, 350); };
  async function run(){
    const q = $('#gq').value.trim(); if (q.length < 3) { $('#gr').innerHTML = ''; return; }
    $('#gs').textContent = 'Ищу…'; const ql = q.toLowerCase(), out = [];
    for (const d of docs) { let tx; try { tx = await loadText(d.id); } catch { continue; }
      const low = tx.toLowerCase(); let i = low.indexOf(ql), n = 0, snips = [];
      while (i >= 0) { n++; if (snips.length < 2) snips.push(tx.slice(Math.max(0,i-90), i) + '<b>' + tx.slice(i, i+q.length) + '</b>' + tx.slice(i+q.length, i+q.length+90)); i = low.indexOf(ql, i+ql.length); }
      if (n) out.push({d, n, snips}); }
    out.sort((a,b) => b.n - a.n);
    $('#gs').textContent = out.length ? `Найдено в ${out.length} док.` : 'Ничего не найдено';
    $('#gr').innerHTML = out.map(o => `<div class="card" data-go="${o.d.id}"><div class="t">${esc(o.d.short)} <span class="badge">${o.n}</span></div>${o.snips.map(s => `<div class="snip">…${esc(s).replace(/&lt;b&gt;/g,'<b>').replace(/&lt;\/b&gt;/g,'</b>')}…</div>`).join('')}</div>`).join('');
    $('#gr').querySelectorAll('[data-go]').forEach(c => c.onclick = () => location.hash = 'doc/'+c.dataset.go+'/'+encodeURIComponent(q));
  }
}
function renderUpdates(){
  $('#title').textContent = 'Обновления';
  const seen = LS.get('seenAt', null), T = {added:'Добавлен', updated:'Обновлён текст', removed:'Убран из реестра'};
  view.innerHTML = `<p class="muted">База проверяется автоматически раз в сутки. Последняя проверка: ${fmt(INDEX.checked_at)}.</p>` +
    (INDEX.changes.length ? INDEX.changes.map(c => `<div class="card" ${c.type!=='removed'?`data-id="${c.id}"`:''}><div class="t">${c.at>seen?'🆕 ':''}${esc(c.short)}</div><div class="s">${T[c.type]||c.type} · ${fmt(c.at)} ${esc(c.edition||'')}</div></div>`).join('') : '<p>Пока изменений не было.</p>');
  bindCards(); LS.set('seenAt', INDEX.generated_at);
}
function renderAbout(){
  $('#title').textContent = 'О базе';
  view.innerHTML = `<div class="card" style="cursor:default"><p><b>Откуда тексты.</b> Список действующих ФАП берётся из реестра Росавиации (favt.gov.ru). Тексты документов берутся из PDF-редакций Росавиации или из ИПС «Законодательство России» на pravo.gov.ru. Воздушный кодекс тоже берётся с pravo.gov.ru.</p>
  <p><b>Как обновляется.</b> Раз в сутки GitHub Actions запускает сборщик. Он сверяет тексты с прошлой версией, сохраняет изменения и публикует их. Приложение подхватывает новую базу при следующем открытии.</p>
  <p><b>Офлайн.</b> Документы, которые ты открывал, остаются на телефоне. Кнопка ниже сохраняет всю базу целиком.</p>
  <p><button id="dlAll">Скачать всё для офлайна</button> <span class="muted" id="dlS"></span></p>
  <p class="muted">Это неофициальное приложение, оно не заменяет официальное опубликование. Перед полётом и экзаменом сверяйся с первоисточником.</p></div>`;
  $('#dlAll').onclick = async () => { const ds = INDEX.docs.filter(d => !d.error); let k = 0;
    for (const d of ds) { try { await loadText(d.id); } catch {} $('#dlS').textContent = `${++k}/${ds.length}`; } $('#dlS').textContent = 'Готово ✓'; };
}
async function route(){
  if (!INDEX) { try { await loadIndex(); } catch { view.innerHTML = '<p>Не удалось загрузить базу. Проверь интернет.</p>'; return; } }
  const h = decodeURIComponent(location.hash.slice(1)) || 'docs'; const [p, a, b] = h.split('/');
  $('#back').classList.add('hidden'); scrollTo(0,0);
  document.querySelectorAll('nav.tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === p));
  if (p === 'doc') return renderDoc(a, b);
  if (p === 'fav') return renderDocs(INDEX.docs.filter(d => favs().includes(d.id)), 'Избранное');
  if (p === 'search') return renderSearch();
  if (p === 'updates') return renderUpdates();
  if (p === 'about') return renderAbout();
  renderDocs(INDEX.docs, 'Воздушное законодательство');
}
addEventListener('hashchange', route); route();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
