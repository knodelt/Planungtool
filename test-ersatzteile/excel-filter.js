(()=>{
  const SPECS=[
    {index:1,key:'Material Nr.',label:'Material Nr.'},
    {index:2,key:'Bezeichnung',label:'Bezeichnung'},
    {index:3,key:'Typ, Ergänzung, Abmessung',label:'Typ, Ergänzung, Abmessung'},
    {index:4,key:'Anlage',label:'Anlage'},
    {index:5,key:'Aggregat',label:'Aggregat'},
    {index:6,key:'IST [Stck.]',label:'IST',numeric:true},
    {index:7,key:'SOLL [Stck.]',label:'SOLL',numeric:true},
    {index:8,key:'Lagerort',label:'Lagerort'},
    {index:9,key:'Lagerort Megalift (Fettgedruckt=Fachnummer)',label:'Lagerort Megalift'},
    {index:10,key:'Lieferant',label:'Lieferant'},
    {index:11,key:'Quelle Datei',label:'Quelle'}
  ];
  const specByKey=new Map(SPECS.map(s=>[s.key,s]));
  const baseFiltered=filtered;
  let columnFilters={};
  let sortState={column:'',direction:''};
  let openColumn='';

  const valueOf=(r,key)=>norm(r?.[key]);
  function asNumber(v){const s=norm(v).replace(/\s/g,'');if(!s)return null;const normalized=s.includes(',')?s.replace(/\./g,'').replace(',','.'):s;const n=Number(normalized);return Number.isFinite(n)?n:null}
  function compareRows(a,b,key){const av=valueOf(a,key),bv=valueOf(b,key);if(!av&&!bv)return 0;if(!av)return 1;if(!bv)return-1;const spec=specByKey.get(key);if(spec?.numeric){const an=asNumber(av),bn=asNumber(bv);if(an!==null&&bn!==null)return an-bn}return av.localeCompare(bv,'de',{numeric:true,sensitivity:'base'})}
  function matchesColumnFilters(r,ignore=''){for(const[key,set]of Object.entries(columnFilters)){if(key===ignore)continue;if(!set.has(valueOf(r,key)))return false}return true}
  function filteredRows(ignore=''){const list=baseFiltered().filter(r=>matchesColumnFilters(r,ignore));if(!ignore&&sortState.column&&sortState.direction){const mult=sortState.direction==='desc'?-1:1;list.sort((a,b)=>compareRows(a,b,sortState.column)*mult)}return list}
  function uniqueValues(key){const set=new Set(filteredRows(key).map(r=>valueOf(r,key)));columnFilters[key]?.forEach(v=>set.add(v));const spec=specByKey.get(key);return[...set].sort((a,b)=>{if(!a&&!b)return 0;if(!a)return 1;if(!b)return-1;if(spec?.numeric){const an=asNumber(a),bn=asNumber(b);if(an!==null&&bn!==null)return an-bn}return a.localeCompare(b,'de',{numeric:true,sensitivity:'base'})})}

  function ensureMenu(){let menu=document.getElementById('columnFilterMenu');if(!menu){menu=document.createElement('div');menu.id='columnFilterMenu';menu.className='filterMenu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Spaltenfilter');document.body.appendChild(menu)}return menu}
  function closeMenu(){const menu=ensureMenu();menu.classList.remove('open');menu.innerHTML='';openColumn=''}
  function updateHeaderState(){document.querySelectorAll('.filterBtn[data-column]').forEach(btn=>{const key=btn.dataset.column;const active=Object.prototype.hasOwnProperty.call(columnFilters,key);const sorted=sortState.column===key;btn.classList.toggle('active',active);btn.classList.toggle('sorted',sorted);btn.textContent=sorted?(sortState.direction==='asc'?'↑':'↓'):'▼';btn.title=[active?'Filter aktiv':'Filtern',sorted?(sortState.direction==='asc'?'aufsteigend sortiert':'absteigend sortiert'):''].filter(Boolean).join(' · ')})}
  function positionMenu(btn){const menu=ensureMenu(),r=btn.getBoundingClientRect(),w=300,gap=6;const h=Math.min(menu.scrollHeight||440,560);let left=Math.min(Math.max(8,r.right-w),window.innerWidth-w-8),top=r.bottom+gap;if(top+h>window.innerHeight-8)top=Math.max(8,r.top-h-gap);menu.style.left=`${left}px`;menu.style.top=`${top}px`}

  function openMenu(btn){const key=btn.dataset.column;if(openColumn===key){closeMenu();return}const spec=specByKey.get(key);if(!spec)return;const menu=ensureMenu(),values=uniqueValues(key),active=columnFilters[key],selected=active?new Set(active):new Set(values);const encode=v=>encodeURIComponent(v);
    menu.innerHTML=`<div class="filterMenuHead"><strong>${esc(spec.label)}</strong><div class="small">Filtern und sortieren wie in Excel</div></div>
      <div class="filterSort">
        <button type="button" data-sort-dir="asc" class="${sortState.column===key&&sortState.direction==='asc'?'active':''}">↑ ${spec.numeric?'Klein nach Groß':'A nach Z'}</button>
        <button type="button" data-sort-dir="desc" class="${sortState.column===key&&sortState.direction==='desc'?'active':''}">↓ ${spec.numeric?'Groß nach Klein':'Z nach A'}</button>
        <button type="button" data-sort-clear ${sortState.column?'':'disabled'}>↺ Sortierung aufheben</button>
      </div>
      <div class="filterSearch"><input id="columnValueSearch" autocomplete="off" placeholder="Suchen ..."></div>
      <div class="filterChoices"><label class="filterChoice filterAll"><input type="checkbox" id="columnSelectAll"><span>(Alle auswählen)</span></label><div id="columnValueList">${values.length?values.map(v=>`<label class="filterChoice" data-choice-text="${esc(low(v||'(leere)'))}"><input type="checkbox" value="${esc(encode(v))}" ${selected.has(v)?'checked':''}><span>${esc(v||'(Leere)')}</span></label>`).join(''):'<div class="filterEmpty">Keine Werte vorhanden.</div>'}</div></div>
      <div class="filterMenuFoot"><button type="button" class="filterSmallBtn" data-filter-clear>Filter löschen</button><div><button type="button" class="filterSmallBtn" data-filter-cancel>Abbrechen</button> <button type="button" class="filterSmallBtn primary" data-filter-ok>OK</button></div></div>`;
    menu.classList.add('open');openColumn=key;positionMenu(btn);
    const checks=()=>[...menu.querySelectorAll('#columnValueList input[type="checkbox"]')],all=menu.querySelector('#columnSelectAll');
    const visibleChecks=()=>checks().filter(x=>x.closest('.filterChoice').style.display!=='none');
    function syncAll(){const current=visibleChecks();all.checked=current.length>0&&current.every(x=>x.checked);all.indeterminate=current.some(x=>x.checked)&&!all.checked}
    checks().forEach(x=>x.addEventListener('change',syncAll));
    all.onchange=()=>visibleChecks().forEach(x=>x.checked=all.checked);
    menu.querySelector('#columnValueSearch').oninput=e=>{const q=low(e.target.value);menu.querySelectorAll('#columnValueList .filterChoice').forEach(x=>x.style.display=!q||x.dataset.choiceText.includes(q)?'flex':'none');syncAll()};
    menu.querySelectorAll('[data-sort-dir]').forEach(b=>b.onclick=()=>{const direction=b.dataset.sortDir;if(sortState.column===key&&sortState.direction===direction)sortState={column:'',direction:''};else sortState={column:key,direction};closeMenu();renderTable()});
    menu.querySelector('[data-sort-clear]').onclick=()=>{sortState={column:'',direction:''};closeMenu();renderTable()};
    menu.querySelector('[data-filter-clear]').onclick=()=>{delete columnFilters[key];closeMenu();renderTable()};
    menu.querySelector('[data-filter-cancel]').onclick=closeMenu;
    menu.querySelector('[data-filter-ok]').onclick=()=>{const chosen=new Set(checks().filter(x=>x.checked).map(x=>decodeURIComponent(x.value)));if(chosen.size===values.length&&values.every(v=>chosen.has(v)))delete columnFilters[key];else columnFilters[key]=chosen;closeMenu();renderTable()};
    syncAll();setTimeout(()=>menu.querySelector('#columnValueSearch')?.focus(),0);
  }

  function installHeaders(){const row=document.querySelector('.tableWrap thead tr');if(row&&!row.querySelector('th[data-extra-column="type-addon"]')){const th=document.createElement('th');th.dataset.extraColumn='type-addon';th.textContent='Typ, Ergänzung, Abmessung';row.insertBefore(th,row.children[3]||null)}if(row&&!row.querySelector('th[data-extra-column="megalift-addon"]')){const th=document.createElement('th');th.dataset.extraColumn='megalift-addon';th.textContent='Lagerort Megalift';row.insertBefore(th,row.children[9]||null)}const ths=document.querySelectorAll('.tableWrap thead th');SPECS.forEach(spec=>{const th=ths[spec.index];if(!th)return;th.innerHTML=`<div class="thFilter"><span>${esc(spec.label)}</span><button class="filterBtn" type="button" data-column="${esc(spec.key)}" aria-label="${esc(spec.label)} filtern" title="Filtern und sortieren">▼</button></div>`});document.querySelectorAll('.filterBtn[data-column]').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();openMenu(btn)}));updateHeaderState()}

  renderTable=function(){const list=filteredRows();const activeCount=Object.keys(columnFilters).length;$('#resultText').textContent=`${list.length} von ${rows.length} Treffern${activeCount?` · ${activeCount} Spaltenfilter`:''}`;$('#tbody').innerHTML=list.length?list.map(r=>`<tr><td><button class="btn rowEdit" data-edit="${encodeURIComponent(r.__sourceKey||'')}|${r.__excelRowIndex}" ${editMode?'':'disabled'}>Bearbeiten</button></td><td class="mono">${esc(r['Material Nr.'])}</td><td>${esc(r.Bezeichnung)}</td><td>${esc(r['Typ, Ergänzung, Abmessung'])}</td><td>${esc(r.Anlage)}</td><td>${esc(r.Aggregat)}</td><td class="${critical(r)?'bad':''}">${esc(r['IST [Stck.]'])}${critical(r)?' <span class="badge critical">kritisch</span>':''}</td><td>${esc(r['SOLL [Stck.]'])}</td><td>${esc(r.Lagerort)}</td><td>${esc(r['Lagerort Megalift (Fettgedruckt=Fachnummer)'])}</td><td>${esc(r.Lieferant)}</td><td>${esc(r['Quelle Datei'])}</td></tr>`).join(''):'<tr><td colspan="12"><div class="empty">Keine Ersatzteile gefunden.</div></td></tr>';$('#tbody').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{if(!editMode)return;const[k,ri]=b.dataset.edit.split('|');const rec=rows.find(r=>(r.__sourceKey||'')===decodeURIComponent(k)&&String(r.__excelRowIndex)===ri);if(rec)openEditor(rec)});updateHeaderState()};

  const reset=$('#resetFilters'),oldReset=reset.onclick;reset.onclick=e=>{oldReset?.call(reset,e);columnFilters={};sortState={column:'',direction:''};closeMenu();renderTable()};
  ['search','fileFilter','anlageFilter','statusFilter'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',()=>{closeMenu();renderTable()}));
  document.addEventListener('click',e=>{const menu=ensureMenu();if(menu.classList.contains('open')&&!menu.contains(e.target)&&!e.target.closest('.filterBtn'))closeMenu()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  window.addEventListener('resize',closeMenu);
  document.querySelector('.tableWrap')?.addEventListener('scroll',closeMenu,{passive:true});
  installHeaders();
  renderTable();
})();
