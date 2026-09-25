(()=>{
  const STORE_KEY='planungtool_demo_inst_planung_v2';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  const MONITORING_API='/api/monitoring/umwaelzer';
  const SOCKETS=['S 1.1','S 1.2','S 2.1','S 2.2','S 3.1','S 3.2','S 4.1','S 4.2'];
  let setupDone=false;
  let assetsCache=[];
  let currentAsset=null;
  let currentRecord=null;
  let activeTab='sockets';
  let xlsxPromise=null;

  const esc=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const clean=(value='')=>String(value??'').trim();
  const id=()=>`m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

  function localAssets(){
    try{
      const state=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
      return Array.isArray(state.assets)?state.assets:[];
    }catch{return[];}
  }

  async function backendAssets(){
    try{
      const response=await fetch('/api/state',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data?.ok)return localAssets();
      const fromState=Array.isArray(data.state?.assets)?data.state.assets:[];
      if(fromState.length)return fromState;
      const fromEntries=(data.sync?.entries||[])
        .filter(entry=>entry.type==='asset'&&!entry.deleted&&entry.payload)
        .map(entry=>entry.payload);
      return fromEntries.length?fromEntries:localAssets();
    }catch{return localAssets();}
  }

  function isThermalA(asset){
    const name=clean(asset?.name).toLowerCase().replace(/ue/g,'ü');
    return name.includes('wärmeanlage a');
  }

  function card(asset){
    const number=clean(asset.number);
    const location=clean(asset.location);
    const module=isThermalA(asset)?'<span class="monitoring-module-pill">Umwälzer</span>':'';
    return `<button type="button" class="monitoring-asset-card" data-monitoring-asset="${esc(asset.id||'')}">
      <div class="monitoring-card-top">
        <span class="monitoring-card-type">Anlage</span>
        <span class="monitoring-card-arrow">→</span>
      </div>
      <h2>${esc(asset.name||'Unbenannte Anlage')}</h2>
      <div class="monitoring-card-meta">
        ${number?`<span>${esc(number)}</span>`:''}
        ${location?`<span>${esc(location)}</span>`:''}
        ${!number&&!location?'<span>Bestandsanlage</span>':''}
      </div>${module}
    </button>`;
  }

  function monitoringSection(){return document.getElementById('view-asset-monitoring');}
  function setContent(html){const section=monitoringSection();if(section)section.innerHTML=html;}

  function baseHero({eyebrow='Anlagen · Überwachung',title='Anlagenüberwachung',sub='',right=''}){
    return `<div class="hero-row monitoring-hero"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${sub?`<p class="hero-sub">${esc(sub)}</p>`:''}</div>${right||''}</div>`;
  }

  function stableAssetOrder(base,fresh){
    const freshById=new Map(fresh.map(asset=>[String(asset.id||''),asset]));
    const result=[];
    const seen=new Set();
    for(const asset of base){
      const key=String(asset.id||'');
      const current=freshById.get(key)||asset;
      result.push(current);
      seen.add(key);
    }
    for(const asset of fresh){
      const key=String(asset.id||'');
      if(seen.has(key))continue;
      result.push(asset);
      seen.add(key);
    }
    return result;
  }

  async function renderAssets(){
    let assets=localAssets();
    if(!assets.length){
      assets=await backendAssets();
      assetsCache=[...assets].sort((a,b)=>clean(a.name).localeCompare(clean(b.name),'de',{numeric:true}));
      renderAssetsGrid(assetsCache);
      return;
    }

    assetsCache=[...assets].sort((a,b)=>clean(a.name).localeCompare(clean(b.name),'de',{numeric:true}));
    renderAssetsGrid(assetsCache);

    backendAssets().then(fresh=>{
      if(!fresh.length)return;
      assetsCache=stableAssetOrder(assetsCache,fresh);
      renderAssetsGrid(assetsCache);
    });
  }

  function renderAssetsGrid(assets){
    setContent(`${baseHero({sub:'Zentraler Einstieg für die Überwachung und Verfolgung deiner Bestandsanlagen.',right:`<div class="monitoring-count">${assets.length} Bestandsanlage${assets.length===1?'':'n'}</div>`})}
      <div class="monitoring-asset-grid">${assets.length?assets.map(card).join(''):'<div class="monitoring-empty"><strong>Keine Anlagen vorhanden.</strong><span>Lege zuerst unter „Anlagen“ eine Bestandsanlage an.</span></div>'}</div>`);
  }

  function renderAssetDetail(asset){
    currentAsset=asset;
    const modules=isThermalA(asset)?`<button class="monitoring-module-card" data-open-umwaelzer>
      <div><span class="monitoring-module-kicker">Überwachungsmodul</span><h2>Umwälzer + Schutzhaube</h2></div><span class="monitoring-module-arrow">→</span>
    </button>`:'<div class="monitoring-empty"><strong>Noch keine Überwachung eingerichtet.</strong><span>Für diese Anlage wird das passende Excel-Modul im nächsten Schritt ergänzt.</span></div>';
    setContent(`${baseHero({eyebrow:'Anlagenüberwachung',title:asset.name||'Anlage',sub:'Überwachungen und spezielle Verfolgungslisten dieser Anlage.',right:'<button class="button secondary" data-monitoring-back>← Alle Anlagen</button>'})}
      <div class="monitoring-module-grid">${modules}</div>`);
  }

  async function loadMonitoringRecord(){
    const response=await fetch(MONITORING_API,{cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||'Umwälzer-Daten konnten nicht geladen werden.');
    currentRecord=data.current||null;
    return currentRecord;
  }

  async function saveMonitoringPayload(payload){
    const response=await fetch(MONITORING_API,{
      method:'PUT',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expectedRevision:Number(currentRecord?.revision||0),payload,clientId:localStorage.getItem(CLIENT_KEY)||''})
    });
    const data=await response.json().catch(()=>null);
    if(response.status===409||data?.conflict){
      currentRecord=data?.current||null;
      throw new Error('Die Anlagenüberwachung wurde inzwischen an einem anderen PC geändert. Bitte erneut öffnen und die Änderung wiederholen.');
    }
    if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||'Änderung konnte nicht gespeichert werden.');
    currentRecord=data.current;
    return currentRecord;
  }

  function ensureXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    if(xlsxPromise)return xlsxPromise;
    xlsxPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Excel-Bibliothek wurde nicht geladen.'));
      script.onerror=()=>reject(new Error('Excel-Bibliothek konnte nicht geladen werden.'));
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }

  function sheetRows(XLSX,workbook,name){
    const ws=workbook.Sheets[name];
    if(!ws)throw new Error(`Excel-Blatt „${name}“ fehlt.`);
    return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
  }

  function valueAt(rows,row,col){return clean(rows?.[row]?.[col]);}
  function afterColon(value){const i=value.indexOf(':');return i>=0?clean(value.slice(i+1)):clean(value);}
  function normalizeDate(value){
    const v=clean(value);
    if(!v)return '';
    if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    const de=v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if(de)return `${de[3]}-${de[2].padStart(2,'0')}-${de[1].padStart(2,'0')}`;
    return v;
  }
  function displayDate(value){
    const v=clean(value);
    const iso=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return iso?`${iso[3]}.${iso[2]}.${iso[1]}`:v||'–';
  }

  async function parseExcel(file){
    const XLSX=await ensureXlsx();
    const buffer=await file.arrayBuffer();
    const workbook=XLSX.read(buffer,{type:'array'});
    const required=['Übersicht',...SOCKETS,'Schutzhauben'];
    required.forEach(name=>{if(!workbook.Sheets[name])throw new Error(`Die Datei passt nicht zur Umwälzer-Liste: Blatt „${name}“ fehlt.`);});
    const overview=sheetRows(XLSX,workbook,'Übersicht');
    const hoods=sheetRows(XLSX,workbook,'Schutzhauben');
    const hoodMap={};
    for(let r=2;r<hoods.length;r++){
      const raw=valueAt(hoods,r,0);const m=raw.match(/(\d\.\d)/);if(m)hoodMap[`S ${m[1]}`]=normalizeDate(valueAt(hoods,r,1));
    }
    const sockets=SOCKETS.map(socket=>{
      const rows=sheetRows(XLSX,workbook,socket);
      const history=[];
      for(let r=5;r<=13;r++){
        const outDate=normalizeDate(valueAt(rows,r,1));
        const motor=valueAt(rows,r,3);
        const fan=valueAt(rows,r,4);
        const inDate=normalizeDate(valueAt(rows,r,5));
        const note=valueAt(rows,r,7);
        if(outDate||motor||fan||inDate||note){
          history.push({id:`excel-${socket.replace(/\s+/g,'-')}-${r+1}`,socket,outDate,motor,fan,inDate,note,source:'excel',sourceRow:r+1});
        }
      }
      return {id:socket,history,hood:{welded:Boolean(hoodMap[socket]),date:hoodMap[socket]||''}};
    });
    const defectiveFans=[];
    for(let r=22;r<=40;r++){
      const number=valueAt(overview,r,1);const note=valueAt(overview,r,2);
      if(number)defectiveFans.push({number,note});
    }
    return {
      schemaVersion:1,module:'umwaelzer',assetId:currentAsset?.id||'',assetName:currentAsset?.name||'Wärmeanlage A',
      sourceFile:file.name,importedAt:new Date().toISOString(),
      technical:{
        tlnr:afterColon(valueAt(overview,16,1)),
        bdnr:afterColon(valueAt(overview,17,1)),
        type:afterColon(valueAt(overview,18,1)),
        znPos:afterColon(valueAt(overview,19,1)),
        torque:valueAt(overview,17,5)
      },
      sockets,defectiveFans
    };
  }

  function historyRows(payload){return (payload?.sockets||[]).flatMap(s=>s.history||[]);}
  function currentFor(socket){
    const history=socket?.history||[];
    const installs=history.filter(h=>h.inDate&&(h.motor||h.fan));
    if(installs.length){
      const latest=installs[installs.length-1];
      const latestIndex=history.indexOf(latest);
      const removed=Boolean(latest.outDate)||history.slice(latestIndex+1).some(h=>h.outDate&&(
        (latest.motor&&h.motor===latest.motor)||(latest.fan&&h.fan===latest.fan)
      ));
      if(!removed)return latest;
      return null;
    }
    const fallback=[...history].reverse().find(h=>(h.motor||h.fan)&&!h.outDate);
    return fallback||null;
  }
  function countsBy(field){
    const map=new Map();
    for(const h of historyRows(currentRecord?.payload)){
      const value=clean(h[field]);if(!value)continue;map.set(value,(map.get(value)||0)+1);
    }
    return [...map.entries()].map(([number,count])=>({number,count})).sort((a,b)=>b.count-a.count||a.number.localeCompare(b.number,'de',{numeric:true}));
  }
  function defectiveSet(){return new Set((currentRecord?.payload?.defectiveFans||[]).map(x=>clean(x.number)));}

  function technicalCards(payload){
    const t=payload.technical||{};
    const items=[['TLNR',t.tlnr],['BDNR',t.bdnr],['Typ',t.type],['ZN / Pos',t.znPos],['Anzugsmoment',t.torque]];
    return `<div class="umwaelzer-tech-grid">${items.map(([label,value])=>`<div class="umwaelzer-tech"><span>${esc(label)}</span><strong>${esc(value||'–')}</strong></div>`).join('')}</div>`;
  }

  function socketCards(payload){
    return `<div class="umwaelzer-socket-grid">${(payload.sockets||[]).map(socket=>{
      const current=currentFor(socket);const hood=socket.hood||{};
      return `<button type="button" class="umwaelzer-socket-card ${current?'occupied':'empty-current'}" data-socket-open="${esc(socket.id)}">
        <div class="socket-head"><span>${esc(socket.id)}</span><span class="socket-state">${current?'aktuell':'nicht belegt'}</span></div>
        <dl><div><dt>Motor</dt><dd>${esc(current?.motor||'–')}</dd></div><div><dt>Lüfterrad</dt><dd>${esc(current?.fan||'–')}</dd></div><div><dt>Einbau</dt><dd>${esc(displayDate(current?.inDate))}</dd></div></dl>
        <div class="socket-foot"><span class="hood-state ${hood.welded?'done':''}">${hood.welded?`Schutzhaube ${displayDate(hood.date)}`:'Schutzhaube offen / kein Datum'}</span><span>Historie →</span></div>
      </button>`;
    }).join('')}</div>`;
  }

  function motorTable(){
    const rows=countsBy('motor');
    return rows.length?`<div class="monitoring-table"><div class="monitoring-table-row head"><span>Motor Nr.</span><span>Einsätze</span></div>${rows.map(r=>`<button class="monitoring-table-row" data-component-history="motor" data-component-number="${esc(r.number)}"><strong>${esc(r.number)}</strong><span>${r.count}</span></button>`).join('')}</div>`:'<div class="monitoring-empty"><strong>Keine Motoren vorhanden.</strong></div>';
  }
  function fanTable(){
    const defective=defectiveSet();
    const rows=countsBy('fan').filter(r=>!defective.has(r.number));
    return rows.length?`<div class="monitoring-table"><div class="monitoring-table-row head"><span>Lüfterrad Nr.</span><span>Einsätze</span></div>${rows.map(r=>`<button class="monitoring-table-row" data-component-history="fan" data-component-number="${esc(r.number)}"><strong>${esc(r.number)}</strong><span>${r.count}</span></button>`).join('')}</div>`:'<div class="monitoring-empty"><strong>Keine Lüfterräder vorhanden.</strong></div>';
  }
  function hoodTable(){
    const sockets=currentRecord?.payload?.sockets||[];
    return `<div class="monitoring-table"><div class="monitoring-table-row head"><span>Sockel</span><span>Schutzhaube</span></div>${sockets.map(s=>`<div class="monitoring-table-row"><strong>${esc(s.id)}</strong><span class="hood-state ${s.hood?.welded?'done':''}">${s.hood?.welded?`geschweißt · ${esc(displayDate(s.hood.date))}`:'nicht hinterlegt'}</span></div>`).join('')}</div>`;
  }

  function renderTab(){
    const body=document.getElementById('umwaelzerTabBody');if(!body)return;
    document.querySelectorAll('[data-umwaelzer-tab]').forEach(b=>b.classList.toggle('active',b.dataset.umwaelzerTab===activeTab));
    if(activeTab==='sockets')body.innerHTML=socketCards(currentRecord.payload);
    if(activeTab==='motors')body.innerHTML=motorTable();
    if(activeTab==='fans')body.innerHTML=fanTable();
    if(activeTab==='hoods')body.innerHTML=hoodTable();
  }

  function importView(error=''){
    setContent(`${baseHero({eyebrow:`${currentAsset?.name||'Wärmeanlage A'} · Anlagenüberwachung`,title:'Umwälzer',sub:'Motoren, Lüfterräder und Schutzhauben der acht Sockel.',right:'<button class="button secondary" data-monitoring-asset-back>← Zur Anlage</button>'})}
      <section class="monitoring-panel import-panel"><div><p class="eyebrow">Einmaliger Start</p><h2>Umwälzer_V1.xlsx importieren</h2><p>Die Excel wird nur im Browser gelesen. Der übernommene Datenbestand wird anschließend verschlüsselt zentral gespeichert.</p>${error?`<div class="monitoring-error">${esc(error.message||error)}</div>`:''}</div><div><button class="button primary" data-umwaelzer-import>Datei auswählen</button><input type="file" id="umwaelzerImportInput" accept=".xlsx,.xlsm,.xls" hidden></div></section>`);
  }

  function renderUmwaelzer(){
    if(!currentRecord?.payload){importView();return;}
    const p=currentRecord.payload;
    const total=historyRows(p).length;
    const currentCount=(p.sockets||[]).filter(currentFor).length;
    setContent(`${baseHero({eyebrow:`${currentAsset?.name||p.assetName||'Wärmeanlage A'} · Anlagenüberwachung`,title:'Umwälzer',sub:'Motoren, Lüfterräder und Schutzhauben der acht Sockel.',right:'<div class="monitoring-hero-actions"><button class="button secondary" data-monitoring-asset-back>← Zur Anlage</button><button class="button secondary" data-umwaelzer-reimport>Excel neu importieren</button><button class="button primary" data-add-exchange>+ Wechsel eintragen</button></div>'})}
      <div class="monitoring-kpi-strip"><div><span>Sockel</span><strong>8</strong></div><div><span>Aktuell belegt</span><strong>${currentCount}</strong></div><div><span>Historieneinträge</span><strong>${total}</strong></div><div><span>Excel-Stand</span><strong>${esc(new Date(p.importedAt||Date.now()).toLocaleDateString('de-DE'))}</strong></div></div>
      ${technicalCards(p)}
      <div class="monitoring-tabs"><button data-umwaelzer-tab="sockets" class="active">Sockel</button><button data-umwaelzer-tab="motors">Motoren</button><button data-umwaelzer-tab="fans">Lüfterräder</button><button data-umwaelzer-tab="hoods">Schutzhauben</button></div>
      <div id="umwaelzerTabBody"></div>`);
    renderTab();
  }

  async function openUmwaelzer(){
    setContent(`${baseHero({eyebrow:`${currentAsset?.name||'Wärmeanlage A'} · Anlagenüberwachung`,title:'Umwälzer',sub:'Daten werden geladen …',right:'<button class="button secondary" data-monitoring-asset-back>← Zur Anlage</button>'})}<div class="monitoring-empty">Lädt …</div>`);
    try{await loadMonitoringRecord();renderUmwaelzer();}catch(error){importView(error.message);}
  }

  function showOverlay(html){
    closeOverlay();
    const el=document.createElement('div');el.className='monitoring-overlay';el.id='monitoringOverlay';el.innerHTML=`<div class="monitoring-dialog">${html}</div>`;document.body.appendChild(el);
  }
  function closeOverlay(){document.getElementById('monitoringOverlay')?.remove();}

  function openSocket(socketId){
    const socket=(currentRecord?.payload?.sockets||[]).find(s=>s.id===socketId);if(!socket)return;
    const history=[...(socket.history||[])].reverse();
    showOverlay(`<div class="dialog-head"><div><p class="eyebrow">Umwälzer</p><h2>${esc(socket.id)} · Historie</h2></div><button class="icon-button" data-monitoring-close>×</button></div>
      <div class="dialog-actions"><button class="button primary" data-add-exchange="${esc(socket.id)}">+ Eintrag hinzufügen</button></div>
      <div class="history-list">${history.length?history.map(h=>`<article><div class="history-date"><strong>${esc(displayDate(h.inDate||h.outDate))}</strong><span>${h.inDate?'Einbau':''}${h.inDate&&h.outDate?' / ':''}${h.outDate?'Ausbau':''}</span></div><div><strong>Motor ${esc(h.motor||'–')}</strong><span>Lüfterrad ${esc(h.fan||'–')}</span>${h.inDate?`<small>Einbau: ${esc(displayDate(h.inDate))}</small>`:''}${h.outDate?`<small>Ausbau: ${esc(displayDate(h.outDate))}</small>`:''}${h.note?`<p>${esc(h.note)}</p>`:''}</div></article>`).join(''):'<div class="monitoring-empty">Noch keine Historie.</div>'}</div>`);
  }

  function openComponentHistory(field,number){
    const label=field==='motor'?'Motor':'Lüfterrad';
    const hits=(currentRecord?.payload?.sockets||[]).flatMap(s=>(s.history||[]).filter(h=>clean(h[field])===number).map(h=>({...h,socket:s.id}))).reverse();
    showOverlay(`<div class="dialog-head"><div><p class="eyebrow">${esc(label)}</p><h2>${esc(number)}</h2></div><button class="icon-button" data-monitoring-close>×</button></div><div class="history-list">${hits.map(h=>`<article><div class="history-date"><strong>${esc(h.socket)}</strong><span>${esc(displayDate(h.inDate||h.outDate))}</span></div><div><strong>${esc(h.inDate?`Einbau ${displayDate(h.inDate)}`:'Eintrag')}</strong>${h.outDate?`<span>Ausbau ${esc(displayDate(h.outDate))}</span>`:''}${h.note?`<p>${esc(h.note)}</p>`:''}</div></article>`).join('')}</div>`);
  }

  function exchangeForm(socketId=''){
    const options=SOCKETS.map(s=>`<option value="${esc(s)}" ${s===socketId?'selected':''}>${esc(s)}</option>`).join('');
    showOverlay(`<form id="exchangeForm"><div class="dialog-head"><div><p class="eyebrow">Umwälzer</p><h2>Wechsel / Eintrag erfassen</h2></div><button type="button" class="icon-button" data-monitoring-close>×</button></div><div class="monitoring-form-grid"><label><span>Sockel</span><select name="socket" required>${options}</select></label><label><span>Einbau-Datum</span><input name="inDate" type="date"></label><label><span>Motor Nr.</span><input name="motor" type="text"></label><label><span>Lüfterrad Nr.</span><input name="fan" type="text"></label><label><span>Ausbau-Datum</span><input name="outDate" type="date"></label><label class="full"><span>Bemerkung / Eingebaut</span><textarea name="note" rows="4"></textarea></label></div><div class="dialog-foot"><button type="button" class="button secondary" data-monitoring-close>Abbrechen</button><button type="submit" class="button primary">Speichern</button></div></form>`);
  }

  async function saveExchange(form){
    const fd=new FormData(form);const socketId=clean(fd.get('socket'));const socket=currentRecord?.payload?.sockets?.find(s=>s.id===socketId);if(!socket)return;
    const event={id:id(),socket:socketId,inDate:clean(fd.get('inDate')),outDate:clean(fd.get('outDate')),motor:clean(fd.get('motor')),fan:clean(fd.get('fan')),note:clean(fd.get('note')),source:'app',createdAt:new Date().toISOString()};
    if(!event.inDate&&!event.outDate&&!event.motor&&!event.fan&&!event.note){alert('Bitte mindestens eine Angabe eintragen.');return;}
    const payload=structuredClone(currentRecord.payload);const target=payload.sockets.find(s=>s.id===socketId);target.history.push(event);payload.updatedAt=new Date().toISOString();
    const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Speichert …';}
    try{await saveMonitoringPayload(payload);closeOverlay();renderUmwaelzer();openSocket(socketId);}catch(error){alert(error.message);if(submit){submit.disabled=false;submit.textContent='Speichern';}}
  }

  async function importFile(file){
    try{
      const parsed=await parseExcel(file);
      if(currentRecord?.payload&&!confirm('Der vorhandene Umwälzer-Datenbestand wird durch den Excel-Stand ersetzt. Fortfahren?'))return;
      await saveMonitoringPayload(parsed);
      renderUmwaelzer();
    }catch(error){importView(error.message);}
  }

  function setSubmenu(open){
    const group=document.querySelector('[data-assets-nav-group]');
    if(group)group.classList.toggle('open',Boolean(open));
    const parent=group?.querySelector('[data-view="assets"]');
    parent?.setAttribute('aria-expanded',open?'true':'false');
  }

  function openMonitoring(){
    document.querySelectorAll('.view').forEach(view=>view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item=>item.classList.remove('active'));
    monitoringSection()?.classList.add('active');
    document.querySelector('[data-asset-monitoring-link]')?.classList.add('active');
    setSubmenu(true);
    const context=document.getElementById('topContext');if(context)context.textContent='Anlagenüberwachung';
    document.getElementById('sidebar')?.classList.remove('open');document.getElementById('mobileBackdrop')?.classList.remove('open');
    window.scrollTo({top:0,behavior:'instant'});renderAssets();
  }

  function setup(){
    if(setupDone)return;
    const nav=document.querySelector('.main-nav');const assetsButton=nav?.querySelector('[data-view="assets"]');const content=document.querySelector('main.content');
    if(!nav||!assetsButton||!content)return;setupDone=true;
    const group=document.createElement('div');group.className='assets-nav-group';group.dataset.assetsNavGroup='true';assetsButton.parentNode.insertBefore(group,assetsButton);group.appendChild(assetsButton);
    assetsButton.classList.add('assets-nav-parent');assetsButton.setAttribute('aria-expanded','false');assetsButton.insertAdjacentHTML('beforeend','<span class="assets-nav-chevron" aria-hidden="true">⌄</span>');
    const submenu=document.createElement('div');submenu.className='assets-nav-submenu';submenu.innerHTML='<button type="button" class="nav-item assets-subnav-item" data-asset-monitoring-link><span class="nav-icon">06.1</span><span>Anlagenüberwachung</span></button>';group.appendChild(submenu);
    const section=document.createElement('section');section.className='view';section.id='view-asset-monitoring';content.appendChild(section);
    submenu.querySelector('[data-asset-monitoring-link]').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openMonitoring();});
    document.addEventListener('click',event=>{
      const assetBtn=event.target.closest('[data-monitoring-asset]');if(assetBtn){const asset=assetsCache.find(a=>String(a.id)===String(assetBtn.dataset.monitoringAsset));if(asset)renderAssetDetail(asset);return;}
      if(event.target.closest('[data-monitoring-back]')){renderAssets();return;}
      if(event.target.closest('[data-monitoring-asset-back]')){renderAssetDetail(currentAsset);return;}
      if(event.target.closest('[data-open-umwaelzer]')){openUmwaelzer();return;}
      if(event.target.closest('[data-umwaelzer-import]')){document.getElementById('umwaelzerImportInput')?.click();return;}
      if(event.target.closest('[data-umwaelzer-reimport]')){const input=document.createElement('input');input.type='file';input.accept='.xlsx,.xlsm,.xls';input.addEventListener('change',()=>input.files?.[0]&&importFile(input.files[0]),{once:true});input.click();return;}
      const tab=event.target.closest('[data-umwaelzer-tab]');if(tab){activeTab=tab.dataset.umwaelzerTab;renderTab();return;}
      const socket=event.target.closest('[data-socket-open]');if(socket){openSocket(socket.dataset.socketOpen);return;}
      const comp=event.target.closest('[data-component-history]');if(comp){openComponentHistory(comp.dataset.componentHistory,comp.dataset.componentNumber);return;}
      const add=event.target.closest('[data-add-exchange]');if(add){exchangeForm(add.dataset.addExchange||'');return;}
      if(event.target.closest('[data-monitoring-close]')){closeOverlay();return;}
      if(event.target.closest('[data-view="assets"]')){requestAnimationFrame(()=>setSubmenu(true));return;}
      if(event.target.closest('[data-asset-monitoring-link]'))return;
      if(event.target.closest('.nav-item'))requestAnimationFrame(()=>setSubmenu(false));
    },true);
    document.addEventListener('change',event=>{if(event.target.id==='umwaelzerImportInput'&&event.target.files?.[0])importFile(event.target.files[0]);});
    document.addEventListener('submit',event=>{if(event.target.id==='exchangeForm'){event.preventDefault();saveExchange(event.target);}},true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
