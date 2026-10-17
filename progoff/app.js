(function(){
  var $=function(s){return document.querySelector(s)};
  var screen=$('#screen'),sheet=$('#sheet'),veil=$('#veil');
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  var TODAY,TS,WIN;
  function refresh(){TODAY=GZ.noon(new Date());TS=GZ.slot(TODAY);
    var start=TS.out?GZ.dateOf(TS.year,0,1):GZ.add(TODAY,1-TS.n);WIN=[];for(var i=0;i<60;i++)WIN.push(GZ.add(start,i))}
  refresh();
  var KIND={day:'день',fast:'пост',dream:'сон / образ',period:'начало этапа',now:'сейчас',stone:'веха',yearnote:'заметка к году',fork:'развилка'};
  function ringId(sl){return sl.out?null:sl.year+'-'+sl.k}
  /* Periods: each lasts from its date until the next period starts (or today). */
  function periods(){var ps=Store.entries().filter(function(e){return e.kind==='period'}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:((a.created||'')<(b.created||'')?-1:1)});
    var tk=GZ.key(TODAY);ps=ps.filter(function(p){return p.date<=tk});
    return ps.map(function(p,i){var nx=ps[i+1],end=nx?GZ.key(GZ.add(GZ.parse(nx.date),-1)):tk;if(end<p.date)end=p.date;return {e:p,start:p.date,end:end,cur:!nx}})}
  function curPeriod(){var ps=periods();return ps.length?ps[ps.length-1]:null}
  function daysBetween(a,b){return Math.round((GZ.parse(b)-GZ.parse(a))/864e5)}
  function nowEntry(){var id=ringId(TS);if(!id)return null;return Store.entries().filter(function(e){return e.kind==='now'&&e.ring===id})[0]||null}

  var LAYER=(function(){try{return localStorage.getItem('progoff.layer')||'g'}catch(e){return 'g'}})();
  function setLayer(v){LAYER=v;try{localStorage.setItem('progoff.layer',v)}catch(e){}}
  function ringSVG(){
    var C=180,R=148,s='<svg class="ring" viewBox="0 0 360 360" role="img" aria-label="Круг 60 дней">';
    s+='<circle cx="'+C+'" cy="'+C+'" r="'+R+'" fill="none" stroke="#e3e0d8"/>';
    var w0=GZ.key(WIN[0]),w1=GZ.key(WIN[59]),RA=R+17,pi=0;
    function pt(i,r){var a=2*Math.PI*i/60;return [(C+r*Math.sin(a)).toFixed(1),(C-r*Math.cos(a)).toFixed(1)]}
    periods().forEach(function(p){if(p.end<w0||p.start>w1)return;
      var i0=Math.max(0,daysBetween(w0,p.start)),i1=Math.min(59,daysBetween(w0,p.end)),col=pi++%2?'#8a877f':'#2b2a27',sw=p.cur?2.4:1.4;
      var a=pt(i0,RA),b=pt(i1,RA),big=(i1-i0)>30?1:0;
      if(i1>i0)s+='<path d="M'+a[0]+' '+a[1]+' A'+RA+' '+RA+' 0 '+big+' 1 '+b[0]+' '+b[1]+'" fill="none" stroke="'+col+'" stroke-width="'+sw+'" stroke-linecap="round"/>';
      if(p.start>=w0){var t0=pt(i0,RA-5),t1=pt(i0,RA+5);s+='<line x1="'+t0[0]+'" y1="'+t0[1]+'" x2="'+t1[0]+'" y2="'+t1[1]+'" stroke="'+col+'" stroke-width="1.6"/>'}
      else if(i1===i0)s+='<circle cx="'+a[0]+'" cy="'+a[1]+'" r="1.6" fill="'+col+'"/>'});
    WIN.forEach(function(d,i){
      var n=i+1,a=2*Math.PI*i/60,sx=Math.sin(a),cy=-Math.cos(a),x=C+R*sx,y=C+R*cy,el=GZ.EL[GZ.elem(n)],k=GZ.key(d);
      var es=Store.byDate(k).filter(function(e){return e.kind!=='period'&&e.kind!=='fast'}),j=0;
      es.slice(0,8).forEach(function(e){var rr=R-16-j*9;j++;
        s+=e.kind==='dream'?'<circle cx="'+(C+rr*sx).toFixed(1)+'" cy="'+(C+rr*cy).toFixed(1)+'" r="3.6" fill="none" stroke="'+el[1]+'" stroke-width="1.6"/>'
          :'<circle cx="'+(C+rr*sx).toFixed(1)+'" cy="'+(C+rr*cy).toFixed(1)+'" r="3.4" fill="'+el[1]+'"/>'});
      if(LAYER!=='g'){var mr=R+8,mx=(C+mr*sx).toFixed(1),my=(C+mr*cy).toFixed(1);
        if(MOON.nm(k))s+='<circle cx="'+mx+'" cy="'+my+'" r="3" fill="#2b2a27"/>';
        else if(MOON.fm(k))s+='<circle cx="'+mx+'" cy="'+my+'" r="3" fill="#fbfaf8" stroke="#2b2a27" stroke-width="1.2"/>';
        if(LAYER==='e'&&MOON.ek(k)){var f=Store.byDate(k).some(function(e){return e.kind==='fast'}),q=4.2;
          s+='<path d="M'+mx+' '+(my-q)+' L'+(+mx+q)+' '+my+' L'+mx+' '+(+my+q)+' L'+(mx-q)+' '+my+' Z" fill="'+(f?'#2b2a27':'#fbfaf8')+'" stroke="#2b2a27" stroke-width="1.2"/>'}}
      var isT=k===GZ.key(TODAY);
      s+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="5.2" fill="'+el[0]+'" stroke="'+el[1]+'" stroke-width="1"/>';
      if(isT)s+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="10" fill="none" stroke="#2b2a27" stroke-width="1.6"/>';
      s+='<circle data-day="'+k+'" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="12" fill="transparent" style="cursor:pointer"/>';
    });
    s+='<circle cx="'+C+'" cy="'+C+'" r="3" fill="#2b2a27"/></svg>';return s}

  function krug(){
    var head=TS.out?'Между кругами':'Круг '+GZ.ROM[TS.k];
    var sub=TS.out?'Новый круг I начнётся '+GZ.short(WIN[0]):GZ.short(WIN[0])+' – '+GZ.short(WIN[59])+' · день '+TS.n+' из 60';
    var back=Store.byDate(GZ.key(GZ.add(TODAY,-60)));
    var cp=curPeriod(),nw=nowEntry();
    var h='<div><h1>'+head+'</h1><p class="sub">'+sub+'</p></div>';
    h+='<div class="card"><span class="label">Текущий этап</span>'+(cp?'<p class="ptitle">'+esc(cp.e.title||'Без названия')+'</p><p class="sub">с '+GZ.short(GZ.parse(cp.start))+' · '+(daysBetween(cp.start,GZ.key(TODAY))+1)+'-й день</p>'+(cp.e.text?'<p>'+esc(cp.e.text.slice(0,180))+(cp.e.text.length>180?'…':'')+'</p>':''):'<p class="sub">Этап — отрезок жизни со своим настроением. Назови тот, в котором ты сейчас.</p>')+
      '<button class="ghost" id="newp">Начался новый этап</button></div>';
    if(!TS.out)h+='<div class="card'+(nw?'':' soft')+'"><span class="label">Сейчас · начало круга '+GZ.ROM[TS.k]+'</span>'+(nw?'<p>'+esc(nw.text.slice(0,240))+(nw.text.length>240?'…':'')+'</p><p class="sub">записано '+GZ.short(GZ.parse(nw.date))+'</p>':'<p class="sub">Открытый момент: где ты стоишь на пороге этих 60 дней? Что уже есть, что только начинается?</p><button class="ghost" id="nowb">Записать «Сейчас»</button>')+'</div>';
    h+='<div class="row" id="lay">'+[['g','Ганьчжи'],['m','+ Луна'],['e','+ Экадаши']].map(function(x){return '<button class="'+(LAYER===x[0]?'primary':'ghost')+'" data-lay="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
    h+=ringSVG()+(LAYER!=='g'?'<p class="legend">● новолуние &nbsp; ○ полнолуние'+(LAYER==='e'?' &nbsp; ◇ экадаши (◆ пост отмечен)':'')+'</p>':'')+'<p class="legend">● запись дня &nbsp; ○ сон / образ &nbsp; — этап &nbsp; · тап по точке — открыть день</p>';
    h+='<div class="card"><span class="label">60 дней назад на этой точке</span>'+
      (back.length?back.map(function(e){return '<p>«'+esc(e.text.slice(0,140))+(e.text.length>140?'…':'')+'»</p>'}).join(''):'<p class="sub">Пока пусто. Через 60 дней здесь появится то, что ты пишешь сегодня.</p>')+'</div>';
    h+='<button class="primary" id="write">Написать сегодня</button>';
    h+='<div class="row"><button class="link" id="exp">Скачать копию</button><button class="link" id="imp">Загрузить копию</button></div>';
    screen.innerHTML=h;
    $('#write').onclick=function(){editor(GZ.key(TODAY))};
    $('#newp').onclick=periodEditor;
    screen.querySelectorAll('[data-lay]').forEach(function(b){b.onclick=function(){setLayer(b.getAttribute('data-lay'));krug()}});
    var nb=$('#nowb');if(nb)nb.onclick=nowEditor;
    screen.querySelectorAll('[data-day]').forEach(function(c){c.onclick=function(){day(c.getAttribute('data-day'))}});
    $('#exp').onclick=function(){var b=new Blob([Store.exportJSON()],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='dnevnik-'+GZ.key(TODAY)+'.json';a.click()};
    $('#imp').onclick=function(){var i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=function(){var f=i.files[0];if(!f)return;f.text().then(function(t){importAsk(t)})};i.click()};
  }

  function importAsk(t){
    open('<div><h1>Загрузить копию</h1><p class="sub">Записи на этом устройстве заменятся записями из файла.</p></div><p class="sub" id="ierr"></p><button class="primary" id="iok">Заменить</button><button class="link" id="ino">Отмена</button>');
    $('#ino').onclick=close;$('#iok').onclick=function(){try{Store.importJSON(t);close();render()}catch(e){$('#ierr').textContent=e.message}}}

  function periodEditor(){var tk=GZ.key(TODAY);
    open('<div><h1>Новый этап</h1><p class="sub">Прошлый этап закончится накануне.</p></div>'+
      '<input id="pt" class="field" maxlength="80" placeholder="Название этапа, например «Переезд»">'+
      '<label class="sub">Когда начался <input id="pd" class="field" type="date" max="'+tk+'" value="'+tk+'"></label>'+
      '<textarea id="px" placeholder="Какой он, этот этап? Что в нём главное, какое у него настроение?"></textarea>'+
      '<button class="primary" id="ps">Сохранить этап</button>');
    $('#pt').focus();
    $('#ps').onclick=function(){var t=$('#pt').value.trim(),d=$('#pd').value||tk;if(!t){$('#pt').focus();return}if(d>tk)d=tk;
      if(Store.add({kind:'period',date:d,title:t,text:$('#px').value.trim()})){close();render()}}}

  function nowEditor(){var id=ringId(TS);
    open('<div><h1>Сейчас</h1><p class="sub">Открытый момент · начало круга '+GZ.ROM[TS.k]+'</p></div>'+
      '<textarea id="nt" placeholder="Где я сейчас? Что во мне и вокруг меня в эти дни? Без оценок, как есть."></textarea>'+
      '<button class="primary" id="ns">Сохранить</button>');
    var ta=$('#nt');ta.focus();
    $('#ns').onclick=function(){var t=ta.value.trim();if(!t){ta.focus();return}
      if(Store.add({kind:'now',date:GZ.key(TODAY),ring:id,text:t})){close();render()}}}

  function open(h){sheet.innerHTML='<div class="grab"></div>'+h;sheet.hidden=false;veil.hidden=false}
  function close(){sheet.hidden=true;veil.hidden=true;sheet.innerHTML=''}
  veil.onclick=close;
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});

  function day(k){
    var d=GZ.parse(k),es=Store.byDate(k),future=d>TODAY,s=GZ.slot(d);
    var h='<div><h1>'+GZ.short(d)+'</h1><p class="sub">'+(s.out?'':'Круг '+GZ.ROM[s.k]+' · день '+s.n+' · ')+GZ.ELN[GZ.elem(s.n||1)]+'</p></div>';
    h+='<div>'+(es.length?es.map(function(e){return '<div class="entry"><span class="kind">'+KIND[e.kind]+(e.src==='ganzhi'?' · из Ганьчжи':'')+'</span>'+(e.kind==='period'?'<p class="ptitle">'+esc(e.title||'')+'</p>':'')+(e.text?'<p>'+esc(e.text)+'</p>':'')+(e.src?'':'<button class="link" data-del="'+e.id+'">Удалить</button>')+'</div>'}).join(''):'<p class="empty">'+(future?'Этот день ещё впереди.':'В этот день записей нет.')+'</p>')+'</div>';
    var ti=MOON.tithi(k);
    if(ti){h+='<p class="sub">Лунный день (титхи) '+ti+(MOON.nm(k)?' · новолуние':'')+(MOON.fm(k)?' · полнолуние':'')+(MOON.ek(k)?' · экадаши':'')+'</p>';
      if(MOON.ek(k)&&!future){var fd=es.filter(function(e){return e.kind==='fast'})[0];h+=fd?'<p>Пост отмечен. '+delBtn(fd.id)+'</p>':'<button class="ghost" id="fast">Отметить пост</button>'}}
    if(!future)h+='<button class="primary" id="add">Записать в этот день</button>';
    open(h);
    var a=$('#add');if(a)a.onclick=function(){editor(k)};
    var fb=$('#fast');if(fb)fb.onclick=function(){if(Store.add({kind:'fast',date:k,text:''})){render();day(k)}};
    sheet.querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){if(b.dataset.sure){Store.remove(b.getAttribute('data-del'));render();day(k)}else{b.dataset.sure='1';b.textContent='Точно удалить? Нажми ещё раз'}}});
  }

  function editor(k){
    var d=GZ.parse(k),kind='day';
    open('<div><h1>Запись</h1><p class="sub">'+GZ.short(d)+'</p></div>'+
      '<div class="seg" id="kinds"><button data-k="day" class="on">День</button><button data-k="dream">Сон / образ</button><button disabled title="Фаза 4">Диалог</button></div>'+
      '<textarea id="txt" placeholder="Что сегодня происходит внутри и вокруг?"></textarea>'+
      '<p class="sub">Видишь только ты. Записи хранятся на этом устройстве; «Скачать копию» сохраняет их в файл.</p>'+
      '<button class="primary" id="save">Сохранить</button>');
    var ta=$('#txt');ta.focus();
    sheet.querySelectorAll('#kinds [data-k]').forEach(function(b){b.onclick=function(){kind=b.getAttribute('data-k');
      sheet.querySelectorAll('#kinds [data-k]').forEach(function(x){x.classList.toggle('on',x===b)});
      ta.placeholder=kind==='dream'?'Сон или образ, как он пришёл. Без толкования.':'Что сегодня происходит внутри и вокруг?'}});
    $('#save').onclick=function(){var t=ta.value.trim();if(!t){ta.focus();return}
      if(Store.add({kind:kind,date:k,text:t})){close();render()}};
  }

  /* Life tab: year rings, stepping stones (<=12), year notes, forks. */
  var LY=null;
  function ents(kind){return Store.entries().filter(function(e){return e.kind===kind}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0})}
  function life(){
    if(LY===null)LY=TS.year;var y=LY,h='<div><h1>Жизнь</h1><p class="sub">Год '+y+' · шесть колец по 60 дней</p></div>';
    h+='<div class="seg"><button id="yp">‹ '+(y-1)+'</button><button id="yn">'+(y+1)+' ›</button></div><div class="stack">';
    for(var k=0;k<6;k++){var a=GZ.dateOf(y,k,1),b=GZ.dateOf(y,k,60),ka=GZ.key(a),kb=GZ.key(b),id=y+'-'+k;
      var n=Store.entries().filter(function(e){return e.date>=ka&&e.date<=kb&&e.kind!=='now'}).length;
      var nw=Store.entries().filter(function(e){return e.kind==='now'&&e.ring===id})[0];
      var cur=(!TS.out&&TS.year===y&&TS.k===k);
      h+='<div class="card'+(cur?'':' soft')+'"><div class="row"><b>Круг '+GZ.ROM[k]+(cur?' · сейчас':'')+'</b><span class="sub">'+GZ.short(a)+' – '+GZ.short(b)+'</span></div><p class="sub">Записей: '+n+'</p>'+(nw?'<p>«'+esc(nw.text.slice(0,140))+(nw.text.length>140?'…':'')+'»</p>':'')+'</div>'}
    h+='</div>';
    var ss=ents('stone'),ys=ents('yearnote').filter(function(e){return e.year===y}),fs=ents('fork');
    h+='<div class="row"><h2>Вехи</h2><span class="sub">'+ss.length+' из 12</span></div>';
    h+=ss.length?ss.map(function(e){return '<div class="entry"><span class="kind">'+GZ.short(GZ.parse(e.date))+' '+GZ.parse(e.date).getFullYear()+'</span><p class="ptitle">'+esc(e.title)+'</p>'+(e.text?'<p>'+esc(e.text)+'</p>':'')+delBtn(e.id)+'</div>'}).join(''):'<p class="empty">Вехи — события, на которые жизнь опиралась, как камни на переправе.</p>';
    h+='<button class="ghost" id="as"'+(ss.length>=12?' disabled':'')+'>Добавить веху</button>';
    h+='<div class="row"><h2>Заметки к '+y+' году</h2></div>';
    h+=ys.length?ys.map(function(e){return '<div class="entry"><p>'+esc(e.text)+'</p>'+delBtn(e.id)+'</div>'}).join(''):'<p class="empty">О чём был этот год?</p>';
    h+='<button class="ghost" id="ay">Записать о годе</button>';
    h+='<div class="row"><h2>Развилки</h2></div>';
    h+=fs.length?fs.map(function(e){return '<div class="entry"><span class="kind">'+GZ.short(GZ.parse(e.date))+' '+GZ.parse(e.date).getFullYear()+'</span><p class="ptitle">'+esc(e.title)+'</p><p>Выбрано: '+esc(e.chosen)+'</p><p>Не выбрано: '+esc(e.other)+'</p>'+delBtn(e.id)+'</div>'}).join(''):'<p class="empty">Места, где путь мог пойти иначе.</p>';
    h+='<button class="ghost" id="af">Добавить развилку</button>';
    screen.innerHTML=h;
    $('#yp').onclick=function(){LY=y-1;life()};$('#yn').onclick=function(){LY=y+1;life()};
    $('#as').onclick=stoneEditor;$('#ay').onclick=function(){yearEditor(y)};$('#af').onclick=forkEditor;
    screen.querySelectorAll('[data-del]').forEach(function(b){b.onclick=function(){if(b.dataset.sure){Store.remove(b.getAttribute('data-del'));life()}else{b.dataset.sure='1';b.textContent='Точно удалить? Нажми ещё раз'}}});
  }
  function delBtn(id){return '<button class="link" data-del="'+id+'">Удалить</button>'}
  function stoneEditor(){var tk=GZ.key(TODAY);
    open('<div><h1>Веха</h1><p class="sub">Событие, которое держит жизнь. Всего до 12.</p></div><input id="st" class="field" maxlength="80" placeholder="Название"><label class="sub">Когда <input id="sd" class="field" type="date" max="'+tk+'" value="'+tk+'"></label><textarea id="sx" placeholder="Что это было и что оно дало?"></textarea><button class="primary" id="ss">Сохранить</button>');
    $('#st').focus();$('#ss').onclick=function(){var t=$('#st').value.trim();if(!t){$('#st').focus();return}
      if(ents('stone').length>=12)return;if(Store.add({kind:'stone',date:$('#sd').value||tk,title:t,text:$('#sx').value.trim()})){close();life()}}}
  function yearEditor(y){open('<div><h1>Год '+y+'</h1></div><textarea id="yx" placeholder="Каким был этот год?"></textarea><button class="primary" id="ys">Сохранить</button>');
    $('#yx').focus();$('#ys').onclick=function(){var t=$('#yx').value.trim();if(!t){$('#yx').focus();return}
      if(Store.add({kind:'yearnote',date:y+'-12-31',year:y,text:t})){close();life()}}}
  function forkEditor(){var tk=GZ.key(TODAY);
    open('<div><h1>Развилка</h1></div><input id="ft" class="field" maxlength="80" placeholder="О чём был выбор"><label class="sub">Когда <input id="fd" class="field" type="date" max="'+tk+'" value="'+tk+'"></label><textarea id="fc" placeholder="Что выбрано"></textarea><textarea id="fo" placeholder="Что не выбрано"></textarea><button class="primary" id="fs">Сохранить</button>');
    $('#ft').focus();$('#fs').onclick=function(){var t=$('#ft').value.trim(),c=$('#fc').value.trim(),o=$('#fo').value.trim();if(!t||!c||!o){(!t?$('#ft'):!c?$('#fc'):$('#fo')).focus();return}
      if(Store.add({kind:'fork',date:$('#fd').value||tk,title:t,chosen:c,other:o})){close();life()}}}

  var SOON={dialogs:['Диалоги','Диалоги с людьми, делами, телом, событиями и обществом. Фаза 4.'],
    quiet:['Тишина','Минута тишины и счётчик медитаций. Фаза 6.']};
  var tab='krug';
  function render(){if(tab==='krug')return krug();if(tab==='life')return life();var s=SOON[tab];screen.innerHTML='<div><h1>'+s[0]+'</h1><p class="sub">Скоро</p></div><div class="card soft"><p>'+s[1]+'</p></div>'}
  document.querySelectorAll('#tabs button').forEach(function(b){b.onclick=function(){tab=b.getAttribute('data-tab');
    document.querySelectorAll('#tabs button').forEach(function(x){x.classList.toggle('on',x===b)});close();render()}});
  document.addEventListener('visibilitychange',function(){if(!document.hidden){var k=GZ.key(TODAY);refresh();if(GZ.key(TODAY)!==k)render()}});
  render();
})();
