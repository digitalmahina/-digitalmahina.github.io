# ФАП — воздушное законодательство (веб-приложение)

Адрес: https://digitalmahina.github.io/fap/

- Реестр: действующие ФАП с сайта Росавиации (favt.gov.ru) плюс Воздушный кодекс РФ
- Тексты: PDF-редакции Росавиации или ИПС pravo.gov.ru
- Обновление: workflow `.github/workflows/fap-update.yml` запускается каждый день в 06:00 МСК, выполняет `fap/scripts/update.py` и коммитит изменения в `fap/data/`. GitHub Pages публикует их сам.
- Обновить вручную: Actions → «Обновление базы ФАП» → Run workflow
- Добавить документ: допиши его в `EXTRA` в `scripts/update.py`
