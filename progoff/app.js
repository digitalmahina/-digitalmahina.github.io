(function(){
  var $=function(s){return document.querySelector(s)};
  var screen=$('#screen'),sheet=$('#sheet'),veil=$('#veil');
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  var TODAY,TS,WIN;
  function refresh(){TODAY=GZ.noon(new Date());TS=GZ.slot(TODAY);
    var start=TS.out?GZ.dateOf(TS.year,0,1):GZ.add(TODAY,1-TS.n);WIN=[];for(var i=0;i<60;i++)WIN.push(GZ.add(start,i))}
  refresh();
  var KIND={day:'день',dream:'сон / образ'};

  function ringSVG(){
    var C=180,R=148,s='<svg class="ring" viewBox="0 0 360 360" role="img" aria-label="Круг 60 дней">';
    s+='<circle cx="'+C+'" cy="'+C+'" r="'+R+'" fill="none" stroke="#e3e0d8"/>';
    WIN.forEach(function(d,i){
      var n=i+1,a=2*Math.PI*i/60,sx=Math.sin(a),cy=-Math.cos(a),x=C+R*sx,y=C+R*cy,el=GZ.EL[GZ.elem(n)],k=GZ.key(d);
      var es=Store.byDate(k),j=0;
      es.slice(0,8).forEach(function(e){var rr=R-16-j*9;j++;
        s+=e.kind==='dream'?'<circle cx="'+(C+rr*sx).toFixed(1)+'" cy="'+(C+rr*cy).toFixed(1)+'" r="3.6" fill="none" stroke="'+el[1]+'" stroke-width="1.6"/>'
          :'<circle cx="'+(C+rr*sx).toFixed(1)+'" cy="'+(C+rr*cy).toFixed(1)+'" r="3.4" fill="'+el[1]+'"/>'});
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
    var h='<div><h1>'+head+'</h1><p class="sub">'+sub+'</p></div>'+ringSVG()+
      '<p class="legend">● запись дня &nbsp; ○ сон / образ &nbsp; · тап по точке — открыть день</p>';
    h+='<div class="card"><span class="label">60 дней назад на этой точке</span>'+
      (back.length?back.map(function(e){return '<p>«'+esc(e.text.slice(0,140))+(e.text.length>140?'…':'')+'»</p>'}).join(''):'<p class="sub">Пока пусто. Через 60 дней здесь появится то, что ты пишешь сегодня.</p>')+'</div>';
    h+='<button class="primary" id="write">Написать сегодня</button>';
    h+='<div class="row"><button class="link" id="exp">Скачать копию</button><button class="link" id="imp">Загрузить копию</button></div>';
    screen.innerHTML=h;
    $('#write').onclick=function(){editor(GZ.key(TODAY))};
    screen.querySelectorAll('[data-day]').forEach(function(c){c.onclick=function(){day(c.getAttribute('data-day'))}});
    $('#exp').onclick=function(){var b=new Blob([Store.exportJSON()],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='dnevnik-'+GZ.key(TODAY)+'.json';a.click()};
    $('#imp').onclick=function(){var i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=function(){var f=i.files[0];if(!f)return;f.text().then(function(t){try{if(confirm('Заменить записи на этом устройстве копией из файла?')){Store.importJSON(t);krug()}}catch(e){alert(e.message)}})};i.click()};
  }

  function open(h){sheet.innerHTML='<div class="grab"></div>'+h;sheet.hidden=false;veil.hidden=false}
  function close(){sheet.hidden=true;veil.hidden=true;sheet.innerHTML=''}
  veil.onclick=close;
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});

  function day(k){
    var d=GZ.parse(k),es=Store.byDate(k),future=d>TODAY,s=GZ.slot(d);
    var h='<div><h1>'+GZ.short(d)+'</h1><p class="sub">'+(s.out?'':'Круг '+GZ.ROM[s.k]+' · день '+s.n+' · ')+GZ.ELN[GZ.elem(s.n||1)]+'</p></div>';
    h+='<div>'+(es.length?es.map(function(e){return '<div class="entry"><span class="kind">'+KIND[e.kind]+(e.src==='ganzhi'?' · из Ганьчжи':'')+'</span><p>'+esc(e.text)+'</p>'+(e.src?'':'<button class="link" data-del="'+e.id+'">Удалить</button>')+'</div>'}).join(''):'<p class="empty">'+(future?'Этот день ещё впереди.':'В этот день записей нет.')+'</p>')+'</div>';
    if(!future)h+='<button class="primary" id="add">Записать в этот день</button>';
    open(h);
    var a=$('#add');if(a)a.onclick=function(){editor(k)};
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

  var SOON={life:['Жизнь','Годовые кольца, вехи (Stepping Stones), заметки к годам и развилки. Фаза 3.'],
    dialogs:['Диалоги','Диалоги с людьми, делами, телом, событиями и обществом. Фаза 4.'],
    quiet:['Тишина','Минута тишины и счётчик медитаций. Фаза 6.']};
  var tab='krug';
  function render(){if(tab==='krug')return krug();var s=SOON[tab];screen.innerHTML='<div><h1>'+s[0]+'</h1><p class="sub">Скоро</p></div><div class="card soft"><p>'+s[1]+'</p></div>'}
  document.querySelectorAll('#tabs button').forEach(function(b){b.onclick=function(){tab=b.getAttribute('data-tab');
    document.querySelectorAll('#tabs button').forEach(function(x){x.classList.toggle('on',x===b)});close();render()}});
  document.addEventListener('visibilitychange',function(){if(!document.hidden){var k=GZ.key(TODAY);refresh();if(GZ.key(TODAY)!==k)render()}});
  render();
})();
