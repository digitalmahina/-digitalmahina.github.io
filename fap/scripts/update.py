#!/usr/bin/env python3
"""Собирает актуальные тексты ФАП.
Источники:
  1) Реестр действующих ФАП Росавиации: https://favt.gov.ru/dokumenty-federalnye-pravila/
  2) Тексты: PDF-редакции Росавиации (favt.gov.ru) или ИПС pravo.gov.ru (официальный портал правовой информации)
  3) Воздушный кодекс РФ — ИПС pravo.gov.ru
Пишет data/index.json (список + журнал изменений) и data/docs/<id>.json (тексты).
"""
import hashlib, html, json, os, re, subprocess, sys, tempfile, time, urllib.parse
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data'); DOCS = os.path.join(DATA, 'docs')
UA = 'Mozilla/5.0 (FAP-reader updater)'
FAVT = 'https://favt.gov.ru/dokumenty-federalnye-pravila/'
IPS = 'http://pravo.gov.ru/proxy/ips/'
SHORT = {'20100311-138': 'ФП ИВП — Федеральные правила использования воздушного пространства'}
ND = {'20100311-138': '102136936'}  # известные номера документов в ИПS
PIN = {'20100311-138': 1, '20090731-128': 2, '20111125-293': 3, '20251125-414': 4}
EXTRA = [  # документы вне реестра Росавиации
    {'title': 'Воздушный кодекс Российской Федерации от 19.03.1997 № 60-ФЗ', 'url': IPS + '?docbody=&nd=102046246', 'short': 'Воздушный кодекс РФ', 'pin': 0},
]

def log(*a): print(*a, file=sys.stderr, flush=True)

def curl(url, binary=False, tries=3):
    for i in range(tries):
        r = subprocess.run(['curl', '-sL', '-m', '120', '-A', UA, url], capture_output=True)
        if r.returncode == 0 and r.stdout:
            return r.stdout if binary else r.stdout
        time.sleep(3 * (i + 1))
    raise RuntimeError('download failed: ' + url)

def text_of(b, enc='utf-8'):
    return b.decode(enc, 'replace')

def clean(t):
    t = t.replace('\r', '').replace('\xa0', ' ').replace('\f', '\n')
    t = re.sub(r'Complex\s*\n|Printfalsefalsefalse\w*', '', t)
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r' *\n *', '\n', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()

def pdf_text(url):
    b = curl(url, binary=True)
    with tempfile.NamedTemporaryFile(suffix='.pdf') as f:
        f.write(b); f.flush()
        r = subprocess.run(['pdftotext', f.name, '-'], capture_output=True)
    t = r.stdout.decode('utf-8', 'replace')
    # убираем колонтитулы КонсультантПлюс
    t = re.sub(r'(?m)^(Документ предоставлен КонсультантПлюс|www\.consultant\.ru|Страница \d+ из \d+|Дата сохранения:.*|Надежная правовая поддержка|КонсультантПлюс)\s*$', '', t)
    t = re.sub(r'(?m)^Приказ Минтранса России от .*\(ред\. от .*$', '', t)
    return clean(t)

def ips_doc(nd):
    body = text_of(curl(f'{IPS}?docbody=&nd={nd}'), 'cp1251')
    full = text_of(curl(f'{IPS}?doc_itself=&nd={nd}&fulltext=1'), 'cp1251')
    plain = re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', ' ', body)))
    eds = re.findall(r'(\d+)\s*-\s*от\s*([\d.]+)\s*(?:№\s*([^()]+?))?\s*\(([^)]*)\)(\(не готова\))?', plain)
    last = eds[-1] if eds else None
    lag = bool(last and last[4])
    ready = [e for e in eds if not e[4]]
    m = re.search(r'id="text_content"(.*)', full, re.S)
    t = m.group(1) if m else full
    t = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', t, flags=re.S)
    t = re.sub(r'<br\s*/?>|</p>|</div>|</tr>|</h\d>', '\n', t, flags=re.I)
    t = clean(html.unescape(re.sub('<[^>]+>', '', t)))
    t = re.sub(r'^>\s*', '', t)
    info = {}
    if ready: info['edition'] = f'ред. от {ready[-1][1]}' + (f' № {ready[-1][2].strip()}' if ready[-1][2] else '')
    if lag: info['lag'] = f'На портале ещё не подготовлена редакция от {last[1]}' + (f' № {last[2].strip()}' if last[2] else '')
    rep = re.search(r'Утратил[аио]? силу[^<\n]{0,200}', t[:3000])
    if rep: info['repealed'] = rep.group(0).strip()
    till = re.search(r'Действует до [^\n]{0,80}', t[:3000])
    if till: info['valid_until'] = till.group(0).strip()
    return t, info

def ips_search(q):
    h = text_of(curl(IPS + '?list_itself=&bpas=cd00000&intelsearch=' + urllib.parse.quote(q.encode('cp1251'))), 'cp1251')
    out, seen = [], set()
    for m in re.finditer(r'nd=(\d+)[^>]*class="bold"[^>]*>(.*?)</a>', h, re.S):
        if m.group(1) in seen: continue
        seen.add(m.group(1))
        out.append((m.group(1), re.sub(r'\s+', ' ', html.unescape(re.sub('<[^>]+>', '', m.group(2)))).strip()))
    return out

def parse_title(title):
    d = re.search(r'от\s*(\d{2}\.\d{2}\.\d{4})', title)
    n = re.search(r'№\s*([\w/-]+)', title)
    m = re.search(r'(?:авиационных правил|правил)\s*[«"]+(.+)$', title, re.I)
    short = m.group(1) if m else (re.findall(r'[«"]([^«»"]{6,})', title) or [title])[-1]
    short = re.split(r'[»"]+\s*(?:и об|$)', short.strip())[0].strip(' «»"')
    ed = re.search(r'\((ред\.[^)]*)\)', title)
    return (d.group(1) if d else ''), (n.group(1) if n else ''), short, (ed.group(1) if ed else '')

def norm(s): return re.sub(r'[^а-яё0-9]+', '', s.lower())

def resolve_doc(date, num, short):
    """Ищет документ в ИПС и проверяет, что текст совпадает по названию."""
    if not date or not num: return None
    key = norm(short)[:40]
    tried = set()
    for q in [f'{short[:120]}', f'приказ от {date} № {num}', f'{date} {num}']:
        for nd, lbl in ips_search(q):
            if nd in tried or date not in lbl or not re.search(r'№\s*' + re.escape(num) + r'(\b|$)', lbl): continue
            tried.add(nd)
            text, info = ips_doc(nd)
            if key and key in norm(text[:6000]): return nd, text, info
    return None

def registry():
    items, seen = [], set()
    for page in range(1, 8):
        h = text_of(curl(FAVT + f'?page={page}'))
        found = 0
        for m in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>\s*((?:Приказ|Постановление)[^<]{20,})</a>', h):
            url, title = html.unescape(m.group(1)), re.sub(r'\s+', ' ', html.unescape(m.group(2))).strip()
            if url.startswith('/'): url = 'https://favt.gov.ru' + url
            if title in seen: continue
            seen.add(title); found += 1
            items.append({'title': title, 'url': url})
        if not found: break
    return items

def slug(date, num, title):
    if date and num: return re.sub(r'[^0-9a-z]+', '-', f'{date[6:]}{date[3:5]}{date[:2]}-{num}'.lower()).strip('-')
    return hashlib.md5(title.encode()).hexdigest()[:10]

def main():
    os.makedirs(DOCS, exist_ok=True)
    idx_path = os.path.join(DATA, 'index.json')
    old = json.load(open(idx_path)) if os.path.exists(idx_path) else {'docs': [], 'changes': []}
    old_by_id = {d['id']: d for d in old.get('docs', [])}
    now = int(time.time())  # unix-время, сек
    reg = EXTRA + registry()
    log('registry:', len(reg))
    docs, changes = [], []
    for it in reg:
        date, num, short, ed = parse_title(it['title'])
        did = slug(date, num, it['title'])
        if it.get('short'): short = it['short']
        short = SHORT.get(did, short)
        if did in PIN: it['pin'] = PIN[did]
        rec = {'id': did, 'title': it['title'], 'short': short, 'date': date, 'number': num,
               'registry_url': it['url'], 'edition': ed}
        if 'pin' in it: rec['pin'] = it['pin']
        try:
            url = it['url']
            text = ''
            if url.lower().endswith('.pdf'):
                text = pdf_text(url); rec['source'] = 'favt.gov.ru (редакция Росавиации)'; rec['source_url'] = url
            if len(text) < 15000:  # нет PDF или это скан: берём текст из ИПС pravo.gov.ru
                m = re.search(r'nd=(\d+)', url) or (re.match(r'(\d+)', ND[did]) if did in ND else None)
                found = (m.group(1),) + ips_doc(m.group(1)) if m else resolve_doc(date, num, short)
                if found and len(found[1]) > len(text):
                    nd, text, info = found; rec.update(info)
                    rec['source'] = 'pravo.gov.ru (ИПС «Законодательство России»)'
                    rec['source_url'] = f'{IPS}?docbody=&nd={nd}'
            if not text: raise RuntimeError('text not found')
            if len(text) < 800: raise RuntimeError('text too short')
        except Exception as e:
            log('FAIL', did, e)
            prev = old_by_id.get(did)
            if prev:  # оставляем прошлую версию
                docs.append(prev); continue
            rec.update({'source_url': it['url'], 'error': 'Текст пока не получен, открой источник'})
            docs.append(rec); continue
        h = hashlib.sha256(text.encode()).hexdigest()[:16]
        rec['hash'] = h; rec['chars'] = len(text)
        prev = old_by_id.get(did)
        if not prev:
            rec['updated'] = now
            if old.get('docs'): changes.append({'at': now, 'id': did, 'type': 'added', 'short': short, 'title': it['title']})
        elif prev.get('hash') != h:
            rec['updated'] = now
            changes.append({'at': now, 'id': did, 'type': 'updated', 'short': short, 'title': it['title'], 'edition': rec.get('edition', '')})
        else:
            rec['updated'] = prev.get('updated', now)
        json.dump({'id': did, 'text': text}, open(os.path.join(DOCS, did + '.json'), 'w'), ensure_ascii=False)
        docs.append(rec); log('ok', did, short[:60], len(text))
        time.sleep(1)
    ids = {d['id'] for d in docs}
    for oid, od in old_by_id.items():
        if oid not in ids:
            changes.append({'at': now, 'id': oid, 'type': 'removed', 'short': od.get('short', ''), 'title': od.get('title', '')})
            p = os.path.join(DOCS, oid + '.json')
            if os.path.exists(p): os.remove(p)
    docs.sort(key=lambda d: (d.get('pin', 9), d.get('short', '')))
    hist = (changes + old.get('changes', []))[:200]
    changed = bool(changes) or not old.get('docs')
    out = {'generated_at': now if changed else old.get('generated_at', now), 'checked_at': now,
           'sources': [FAVT, 'http://pravo.gov.ru/'], 'docs': docs, 'changes': hist}
    json.dump(out, open(idx_path, 'w'), ensure_ascii=False, indent=1)
    log('done; changes:', len(changes))

if __name__ == '__main__':
    main()
