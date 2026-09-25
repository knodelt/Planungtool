(()=>{
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  const IMPORT_NOTE_PREFIX='Dienstplan-Import ';
  const MAP={ur:'vacation',tzug:'vacation',kr:'sick',s:'shift'};

  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLocaleLowerCase('de-DE');
  const id=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

  function parseDateLabel(value){
    const m=clean(value).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if(!m)return '';
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function addDays(key,n){
    const [y,m,d]=key.split('-').map(Number);
    const dt=new Date(y,m-1,d,12);
    dt.setDate(dt.getDate()+n);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  }

  function parseDienstplan(text){
    const lines=String(text||'').replace(/^\uFEFF/,'').split(/\r?\n/);
    const headerIndex=lines.findIndex(line=>line.split('\t')[0]?.trim()==='Nachname');
    if(headerIndex<0)throw new Error('Kopfzeile „Nachname“ wurde nicht gefunden.');
    const header=lines[headerIndex].split('\t');
    const dates=header.slice(3).map(parseDateLabel);
    if(!dates.some(Boolean))throw new Error('Keine Datums-Spalten im Dienstplan gefunden.');

    const year=(dates.find(Boolean)||'').slice(0,4);
    const people=[];
    for(const line of lines.slice(headerIndex+1)){
      if(!clean(line))continue;
      const cells=line.split('\t');
      const last=clean(cells[0]);
      const first=clean(cells[1]);
      if(!last||!first)continue;
      const fullName=`${first} ${last}`;
      const entries=[];
      for(let i=0;i<dates.length;i++){
        const date=dates[i];
        if(!date)continue;
        const raw=clean(cells[i+3]);
        const type=MAP[norm(raw)];
        if(type)entries.push({date,type,raw});
      }
      people.push({fullName,entries});
    }
    return {year,people};
  }

  function groupEntries(entries){
    const sorted=[...entries].sort((a,b)=>a.date.localeCompare(b.date));
    const groups=[];
    for(const item of sorted){
      const last=groups[groups.length-1];
      if(last&&last.type===item.type&&addDays(last.end,1)===item.date){last.end=item.date;continue;}
      groups.push({type:item.type,start:item.date,end:item.date});
    }
    return groups;
  }

  async function snapshot(){
    const r=await fetch('/api/state',{cache:'no-store'});
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data?.ok)throw new Error('Zentraler Datenbestand konnte nicht geladen werden.');
    return data;
  }

  async function mutate(type,recordId,action,payload,revision){
    const r=await fetch('/api/mutate',{
      method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type,id:recordId,action,payload:action==='upsert'?payload:undefined,expectedRevision:Number(revision||0),clientId:localStorage.getItem(CLIENT_KEY)||''})
    });
    const data=await r.json().catch(()=>null);
    if(!r.ok||data?.conflict||!data?.ok)throw new Error(`Speichern fehlgeschlagen (${type}).`);
    return data;
  }

  async function importPlan(file){
    const parsed=parseDienstplan(await file.text());
    const initial=await snapshot();
    const entries=initial.sync?.entries||[];
    const revisionOf=(type,rid)=>Number(entries.find(e=>e.type===type&&String(e.id)===String(rid)&&!e.deleted)?.revision||0);
    const employees=[...(initial.state?.employees||[])];
    const absences=[...(initial.state?.absences||[])];

    const marker=`${IMPORT_NOTE_PREFIX}${parsed.year}`;
    const old=absences.filter(a=>clean(a.notes)===marker);
    for(const a of old){await mutate('absence',a.id,'delete',null,revisionOf('absence',a.id));}

    let createdEmployees=0;
    let createdAbsences=0;
    for(const person of parsed.people){
      if(!person.entries.length)continue;
      let emp=employees.find(e=>norm(e.name)===norm(person.fullName));
      if(!emp){
        emp={id:id('emp'),name:person.fullName,dept:'Schlosser',notes:''};
        await mutate('employee',emp.id,'upsert',emp,0);
        employees.push(emp);
        createdEmployees++;
      }
      for(const range of groupEntries(person.entries)){
        const absence={id:id('abs'),employeeId:emp.id,type:range.type,start:range.start,end:range.end,notes:marker};
        await mutate('absence',absence.id,'upsert',absence,0);
        createdAbsences++;
      }
    }
    return {year:parsed.year,createdEmployees,createdAbsences,people:parsed.people.filter(p=>p.entries.length).length};
  }

  function ensureStyle(){
    if(document.getElementById('absenceFilterStyle'))return;
    const style=document.createElement('style');
    style.id='absenceFilterStyle';
    style.textContent=`
      .absence-filterbar{display:grid;grid-template-columns:minmax(190px,1.4fr) minmax(170px,1fr) auto;gap:10px;align-items:end;margin:0 0 14px;padding:14px;border:1px solid #dbe6ef;border-radius:14px;background:#f8fbfd}
      .absence-filterbar label{display:grid;gap:6px}.absence-filterbar label span{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#607286}
      .absence-filterbar select{width:100%;height:42px;border:1px solid #cbd9e5;border-radius:10px;background:#fff;padding:0 10px;font:inherit;color:#10283d}
      .absence-filter-count{height:42px;display:flex;align-items:center;justify-content:center;padding:0 12px;border-radius:10px;background:#edf4fa;color:#315b7a;font-size:12px;font-weight:800;white-space:nowrap}
      #absenceList.absence-scroll-list{max-height:min(62vh,640px);overflow-y:auto;overscroll-behavior:contain;padding-right:8px;scrollbar-gutter:stable}
      #absenceList.absence-scroll-list::-webkit-scrollbar{width:10px}#absenceList.absence-scroll-list::-webkit-scrollbar-track{background:#eef3f7;border-radius:999px}#absenceList.absence-scroll-list::-webkit-scrollbar-thumb{background:#b8c8d6;border-radius:999px;border:2px solid #eef3f7}
      #absenceList .entity-card.absence-filter-hidden{display:none!important}
      @media(max-width:720px){.absence-filterbar{grid-template-columns:1fr}.absence-filter-count{justify-content:flex-start}#absenceList.absence-scroll-list{max-height:58vh;padding-right:4px}}
    `;
    document.head.appendChild(style);
  }

  function absenceCards(){return [...document.querySelectorAll('#absenceList .entity-card')];}

  function cardData(card){
    const title=clean(card.querySelector('h3')?.textContent);
    const parts=title.split('·').map(clean);
    const name=parts[0]||'';
    const kind=norm(parts.slice(1).join(' '));
    return {name,kind};
  }

  function categoryMatches(kind,category){
    if(category==='all')return true;
    if(category==='vacation')return kind.includes('urlaub');
    if(category==='shift')return kind.includes('spätschicht')||kind.includes('nachtschicht')||kind==='schicht';
    if(category==='sick')return kind.includes('krank');
    return true;
  }

  function applyAbsenceFilters(){
    const nameFilter=document.getElementById('absenceNameFilter')?.value||'all';
    const typeFilter=document.getElementById('absenceTypeFilter')?.value||'all';
    const cards=absenceCards();
    let visible=0;
    for(const card of cards){
      const data=cardData(card);
      const show=(nameFilter==='all'||data.name===nameFilter)&&categoryMatches(data.kind,typeFilter);
      card.classList.toggle('absence-filter-hidden',!show);
      if(show)visible++;
    }
    const count=document.getElementById('absenceFilterCount');
    if(count)count.textContent=`${visible} von ${cards.length}`;
  }

  function refreshNameOptions(){
    const select=document.getElementById('absenceNameFilter');
    if(!select)return;
    const previous=select.value||'all';
    const names=[...new Set(absenceCards().map(card=>cardData(card).name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
    select.innerHTML=`<option value="all">Alle Mitarbeiter</option>${names.map(name=>`<option value="${name.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('')}`;
    if(names.includes(previous))select.value=previous;
  }

  function ensureAbsenceTools(){
    ensureStyle();
    const list=document.getElementById('absenceList');
    if(!list)return;
    list.classList.add('absence-scroll-list');

    let bar=document.getElementById('absenceFilterBar');
    if(!bar){
      bar=document.createElement('div');
      bar.id='absenceFilterBar';
      bar.className='absence-filterbar';
      bar.innerHTML=`
        <label><span>Mitarbeiter</span><select id="absenceNameFilter"><option value="all">Alle Mitarbeiter</option></select></label>
        <label><span>Art</span><select id="absenceTypeFilter"><option value="all">Alle</option><option value="shift">Schicht</option><option value="vacation">Urlaub</option><option value="sick">Krank</option></select></label>
        <div class="absence-filter-count" id="absenceFilterCount">0 Einträge</div>`;
      list.parentElement?.insertBefore(bar,list);
      bar.querySelector('#absenceNameFilter')?.addEventListener('change',applyAbsenceFilters);
      bar.querySelector('#absenceTypeFilter')?.addEventListener('change',applyAbsenceFilters);
    }
    refreshNameOptions();
    applyAbsenceFilters();
  }

  function ensureUi(){
    const actions=document.querySelector('#view-team .hero-actions');
    if(!actions||document.getElementById('dienstplanImportButton'))return;
    const input=document.createElement('input');
    input.type='file';input.accept='.txt,text/plain';input.hidden=true;input.id='dienstplanImportFile';
    const btn=document.createElement('button');
    btn.type='button';btn.className='button secondary';btn.id='dienstplanImportButton';btn.textContent='Dienstplan importieren';
    actions.prepend(btn);actions.appendChild(input);
    btn.addEventListener('click',()=>input.click());
    input.addEventListener('change',async()=>{
      const file=input.files?.[0];if(!file)return;
      btn.disabled=true;const old=btn.textContent;btn.textContent='Import läuft …';
      try{
        const result=await importPlan(file);
        alert(`Dienstplan ${result.year} übernommen.\n${result.people} Mitarbeiter berücksichtigt.\n${result.createdAbsences} Zeiträume angelegt.${result.createdEmployees?`\n${result.createdEmployees} Mitarbeiter neu angelegt.`:''}\n\nImportiert wurden nur Urlaub (Ur/TZug), Krank (Kr) und Spätschicht (S).`);
        location.reload();
      }catch(error){
        console.error(error);alert(`Dienstplan konnte nicht importiert werden:\n${error.message}`);
      }finally{btn.disabled=false;btn.textContent=old;input.value='';}
    });
  }

  function scheduleEnhancements(){
    setTimeout(()=>{ensureUi();ensureAbsenceTools();},0);
    setTimeout(ensureAbsenceTools,100);
  }

  function setup(){
    ensureUi();
    ensureAbsenceTools();
    document.addEventListener('click',scheduleEnhancements,true);
    document.addEventListener('submit',scheduleEnhancements,true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
