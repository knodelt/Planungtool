(()=>{
  const API='/api/monitoring/umwaelzer?asset=lineb';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  const SOCKETS=['10.1','10.2','11.1','11.2','12.1','12.2','13.1'];
  let currentAsset={id:'',name:'Wärmeanlage B'};
  let currentRecord=null;
  let activeTab='sockets';

  const clean=v=>String(v??'').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>`lineb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const isThermalBName=v=>clean(v).toLowerCase().replace(/ue/g,'ü').includes('wärmeanlage b');
  const section=()=>document.getElementById('view-asset-monitoring');
  const setContent=html=>{const el=section();if(el)el.innerHTML=html;};
  const displayDate=value=>{const v=clean(value);const m=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}.${m[2]}.${m[1]}`:v||'–';};

  function hero({title='Wärmeanlage B',sub='',right=''}){
    return `<div class="hero-row monitoring-hero"><div><p class="eyebrow">Anlagenüberwachung</p><h1>${esc(title)}</h1>${sub?`<p class="hero-sub">${esc(sub)}</p>`:''}</div>${right||''}</div>`;
  }

  function patchCards(){
    document.querySelectorAll('.monitoring-asset-card').forEach(card=>{
      if(!isThermalBName(card.querySelector('h2')?.textContent))return;
      if(!card.querySelector('.monitoring-module-pill'))card.insertAdjacentHTML('beforeend','<span class="monitoring-module-pill">Umwälzer</span>');
    });
  }

  function renderAssetDetail(){
    setContent(`${hero({title:currentAsset.name||'Wärmeanlage B',sub:'Überwachungen und spezielle Verfolgungslisten dieser Anlage.',right:'<button class="button secondary" data-lineb-all>← Alle Anlagen</button>'})}
      <div class="monitoring-module-grid"><button class="monitoring-module-card" data-lineb-open>
        <div><span class="monitoring-module-kicker">Überwachungsmodul</span><h2>Umwälzer + Schutzhaube</h2></div><span class="monitoring-module-arrow">→</span>
      </button></div>`);
  }

  function emptyPayload(){
    return {
      schemaVersion:1,
      module:'umwaelzer-lineb',
      assetId:currentAsset.id||'',
      assetName:currentAsset.name||'Wärmeanlage B',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      sockets:SOCKETS.map(id=>({id,history:[],hood:{welded:false,date:''}})),
      defectiveFans:[]
    };
  }

  async function load(){
    const r=await fetch(API,{cache:'no-store'});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d?.ok)throw new Error(d?.error||d?.detail||'Linie B-Überwachung konnte nicht geladen werden.');
    currentRecord=d.current||null;
    if(!currentRecord){
      await save(emptyPayload(),0);
    }
    return currentRecord;
  }

  async function save(payload,expected=Number(currentRecord?.revision||0)){
    const r=await fetch(API,{method:'PUT',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:expected,payload,clientId:localStorage.getItem(CLIENT_KEY)||''})});
    const d=await r.json().catch(()=>null);
    if(r.status===409||d?.conflict){currentRecord=d?.current||currentRecord;throw new Error('Die Linie B-Überwachung wurde inzwischen an einem anderen PC geändert. Bitte erneut öffnen.');}
    if(!r.ok||!d?.ok)throw new Error(d?.error||d?.detail||'Änderung konnte nicht gespeichert werden.');
    currentRecord=d.current;
    return currentRecord;
  }

  function historyRows(){return (currentRecord?.payload?.sockets||[]).flatMap(s=>s.history||[]);}
  function currentFor(socket){
    const history=socket?.history||[];
    const installs=history.filter(h=>h.inDate&&(h.motor||h.fan));
    if(installs.length){
      const latest=installs[installs.length-1];
      const idx=history.indexOf(latest);
      const removed=Boolean(latest.outDate)||history.slice(idx+1).some(h=>h.outDate&&((latest.motor&&h.motor===latest.motor)||(latest.fan&&h.fan===latest.fan)));
      if(!removed)return latest;
      return null;
    }
    return [...history].reverse().find(h=>(h.motor||h.fan)&&!h.outDate)||null;
  }

  function countsBy(field){
    const map=new Map();
    for(const h of historyRows()){const value=clean(h[field]);if(value)map.set(value,(map.get(value)||0)+1);}
    return [...map.entries()].map(([number,count])=>({number,count})).sort((a,b)=>b.count-a.count||a.number.localeCompare(b.number,'de',{numeric:true}));
  }

  function socketCards(){
    return `<div class="umwaelzer-socket-grid">${(currentRecord?.payload?.sockets||[]).map(socket=>{
      const current=currentFor(socket),hood=socket.hood||{};
      return `<button type="button" class="umwaelzer-socket-card ${current?'occupied':'empty-current'}" data-lineb-socket="${esc(socket.id)}">
        <div class="socket-head"><span>${esc(socket.id)}</span><span class="socket-state">${current?'aktuell':'nicht belegt'}</span></div>
        <dl><div><dt>Motor</dt><dd>${esc(current?.motor||'–')}</dd></div><div><dt>Lüfterrad</dt><dd>${esc(current?.fan||'–')}</dd></div><div><dt>Einbau</dt><dd>${esc(displayDate(current?.inDate))}</dd></div></dl>
        <div class="socket-foot"><span class="hood-state ${hood.welded?'done':''}">${hood.welded?`Schutzhaube ${esc(displayDate(hood.date))}`:'Schutzhaube offen / kein Datum'}</span><span>Historie →</span></div>
      </button>`;
    }).join('')}</div>`;
  }

  function componentTable(field){
    const label=field==='motor'?'Motor Nr.':'Lüfterrad Nr.';
    const rows=countsBy(field);
    return rows.length?`<div class="monitoring-table"><div class="monitoring-table-row head"><span>${label}</span><span>Einsätze</span></div>${rows.map(r=>`<button class="monitoring-table-row" data-lineb-component="${field}" data-lineb-number="${esc(r.number)}"><strong>${esc(r.number)}</strong><span>${r.count}</span></button>`).join('')}</div>`:`<div class="monitoring-empty"><strong>Keine ${field==='motor'?'Motoren':'Lüfterräder'} vorhanden.</strong><span>Die Nummern werden von dir manuell eingetragen.</span></div>`;
  }

  function hoodTable(){
    return `<div class="monitoring-table"><div class="monitoring-table-row head"><span>Sockel</span><span>Schutzhaube</span></div>${(currentRecord?.payload?.sockets||[]).map(s=>`<button class="monitoring-table-row" data-lineb-hood="${esc(s.id)}"><strong>${esc(s.id)}</strong><span class="hood-state ${s.hood?.welded?'done':''}">${s.hood?.welded?`geschweißt · ${esc(displayDate(s.hood.date))}`:'nicht hinterlegt'}</span></button>`).join('')}</div>`;
  }

  function renderTab(){
    const body=document.getElementById('linebTabBody');if(!body)return;
    document.querySelectorAll('[data-lineb-tab]').forEach(b=>b.classList.toggle('active',b.dataset.linebTab===activeTab));
    if(activeTab==='sockets')body.innerHTML=socketCards();
    if(activeTab==='motors')body.innerHTML=componentTable('motor');
    if(activeTab==='fans')body.innerHTML=componentTable('fan');
    if(activeTab==='hoods')body.innerHTML=hoodTable();
  }

  function renderMonitoring(){
    const p=currentRecord?.payload;if(!p)return;
    const total=historyRows().length;
    const currentCount=(p.sockets||[]).filter(currentFor).length;
    setContent(`${hero({title:'Umwälzer',sub:'Motoren, Lüfterräder und Schutzhauben der sieben Linie B-Sockel.',right:'<div class="monitoring-hero-actions"><button class="button secondary" data-lineb-back>← Zur Anlage</button><button class="button primary" data-lineb-add>+ Wechsel eintragen</button></div>'})}
      <div class="monitoring-kpi-strip"><div><span>Sockel</span><strong>7</strong></div><div><span>Aktuell belegt</span><strong>${currentCount}</strong></div><div><span>Historieneinträge</span><strong>${total}</strong></div><div><span>Datenquelle</span><strong>Manuell</strong></div></div>
      <div class="monitoring-tabs"><button data-lineb-tab="sockets" class="active">Sockel</button><button data-lineb-tab="motors">Motoren</button><button data-lineb-tab="fans">Lüfterräder</button><button data-lineb-tab="hoods">Schutzhauben</button></div>
      <div id="linebTabBody"></div>`);
    renderTab();
  }

  async function openMonitoring(){
    setContent(`${hero({title:'Umwälzer',sub:'Linie B-Daten werden geladen …',right:'<button class="button secondary" data-lineb-back>← Zur Anlage</button>'})}<div class="monitoring-empty">Lädt …</div>`);
    try{await load();renderMonitoring();}catch(error){setContent(`${hero({title:'Umwälzer',right:'<button class="button secondary" data-lineb-back>← Zur Anlage</button>'})}<div class="monitoring-empty"><strong>Laden fehlgeschlagen.</strong><span>${esc(error.message)}</span></div>`);}
  }

  function overlay(html){closeOverlay();const el=document.createElement('div');el.id='linebMonitoringOverlay';el.className='monitoring-overlay';el.innerHTML=`<div class="monitoring-dialog">${html}</div>`;document.body.appendChild(el);}
  function closeOverlay(){document.getElementById('linebMonitoringOverlay')?.remove();}

  function exchangeForm(socketId='',entry=null){
    const selected=socketId||entry?.socket||'';
    const options=SOCKETS.map(s=>`<option value="${esc(s)}" ${s===selected?'selected':''}>${esc(s)}</option>`).join('');
    overlay(`<form id="linebExchangeForm" data-entry-id="${esc(entry?.id||'')}"><div class="dialog-head"><div><p class="eyebrow">Wärmeanlage B · Umwälzer</p><h2>${entry?'Eintrag bearbeiten':'Wechsel / Eintrag erfassen'}</h2></div><button type="button" class="icon-button" data-lineb-close>×</button></div>
      <div class="monitoring-form-grid"><label><span>Sockel</span><select name="socket" required>${options}</select></label><label><span>Einbau-Datum</span><input name="inDate" type="date" value="${esc(entry?.inDate||'')}"></label><label><span>Motor Nr.</span><input name="motor" type="text" value="${esc(entry?.motor||'')}"></label><label><span>Lüfterrad Nr.</span><input name="fan" type="text" value="${esc(entry?.fan||'')}"></label><label><span>Ausbau-Datum</span><input name="outDate" type="date" value="${esc(entry?.outDate||'')}"></label><label class="full"><span>Bemerkung</span><textarea name="note" rows="4">${esc(entry?.note||'')}</textarea></label></div>
      <div class="dialog-foot">${entry?'<button type="button" class="button secondary" data-lineb-delete-entry>Löschen</button>':''}<button type="button" class="button secondary" data-lineb-close>Abbrechen</button><button type="submit" class="button primary">Speichern</button></div></form>`);
  }

  async function saveExchange(form){
    const fd=new FormData(form),socketId=clean(fd.get('socket')),entryId=clean(form.dataset.entryId);
    const event={id:entryId||uid(),socket:socketId,inDate:clean(fd.get('inDate')),outDate:clean(fd.get('outDate')),motor:clean(fd.get('motor')),fan:clean(fd.get('fan')),note:clean(fd.get('note')),source:'app',updatedAt:new Date().toISOString()};
    if(!event.inDate&&!event.outDate&&!event.motor&&!event.fan&&!event.note){alert('Bitte mindestens eine Angabe eintragen.');return;}
    const payload=structuredClone(currentRecord.payload);
    if(entryId){
      for(const s of payload.sockets)s.history=(s.history||[]).filter(h=>h.id!==entryId);
    }
    const target=payload.sockets.find(s=>s.id===socketId);if(!target)return;
    target.history=target.history||[];target.history.push(event);payload.updatedAt=new Date().toISOString();
    try{await save(payload);closeOverlay();renderMonitoring();openSocket(socketId);}catch(error){alert(error.message);}
  }

  async function deleteEntry(entryId){
    if(!entryId||!confirm('Diesen Historieneintrag wirklich löschen?'))return;
    const payload=structuredClone(currentRecord.payload);
    for(const s of payload.sockets)s.history=(s.history||[]).filter(h=>h.id!==entryId);
    payload.updatedAt=new Date().toISOString();
    try{await save(payload);closeOverlay();renderMonitoring();}catch(error){alert(error.message);}
  }

  function openSocket(socketId){
    const socket=(currentRecord?.payload?.sockets||[]).find(s=>s.id===socketId);if(!socket)return;
    const history=[...(socket.history||[])].reverse();
    overlay(`<div class="dialog-head"><div><p class="eyebrow">Wärmeanlage B · Umwälzer</p><h2>${esc(socket.id)} · Historie</h2></div><button class="icon-button" data-lineb-close>×</button></div><div class="dialog-actions"><button class="button primary" data-lineb-add="${esc(socket.id)}">+ Eintrag hinzufügen</button></div><div class="history-list">${history.length?history.map(h=>`<button type="button" class="monitoring-table-row" data-lineb-edit-entry="${esc(h.id)}" data-lineb-entry-socket="${esc(socket.id)}"><strong>${esc(displayDate(h.inDate||h.outDate))}</strong><span>Motor ${esc(h.motor||'–')} · Lüfterrad ${esc(h.fan||'–')}</span></button>`).join(''):'<div class="monitoring-empty">Noch keine Historie.</div>'}</div>`);
  }

  function openComponent(field,number){
    const hits=(currentRecord?.payload?.sockets||[]).flatMap(s=>(s.history||[]).filter(h=>clean(h[field])===number).map(h=>({...h,socket:s.id}))).reverse();
    overlay(`<div class="dialog-head"><div><p class="eyebrow">${field==='motor'?'Motor':'Lüfterrad'}</p><h2>${esc(number)}</h2></div><button class="icon-button" data-lineb-close>×</button></div><div class="history-list">${hits.map(h=>`<article><div class="history-date"><strong>${esc(h.socket)}</strong><span>${esc(displayDate(h.inDate||h.outDate))}</span></div><div>${h.inDate?`<strong>Einbau ${esc(displayDate(h.inDate))}</strong>`:'<strong>Eintrag</strong>'}${h.outDate?`<span>Ausbau ${esc(displayDate(h.outDate))}</span>`:''}${h.note?`<p>${esc(h.note)}</p>`:''}</div></article>`).join('')}</div>`);
  }

  function hoodForm(socketId){
    const socket=(currentRecord?.payload?.sockets||[]).find(s=>s.id===socketId);if(!socket)return;
    const hood=socket.hood||{};
    overlay(`<form id="linebHoodForm" data-socket="${esc(socketId)}"><div class="dialog-head"><div><p class="eyebrow">Wärmeanlage B · Schutzhaube</p><h2>${esc(socketId)}</h2></div><button type="button" class="icon-button" data-lineb-close>×</button></div><div class="monitoring-form-grid"><label class="full"><span>Status</span><select name="welded"><option value="no" ${!hood.welded?'selected':''}>Nicht hinterlegt</option><option value="yes" ${hood.welded?'selected':''}>Geschweißt</option></select></label><label class="full"><span>Datum</span><input type="date" name="date" value="${esc(hood.date||'')}"></label></div><div class="dialog-foot"><button type="button" class="button secondary" data-lineb-close>Abbrechen</button><button type="submit" class="button primary">Speichern</button></div></form>`);
  }

  async function saveHood(form){
    const socketId=clean(form.dataset.socket),fd=new FormData(form),payload=structuredClone(currentRecord.payload),socket=payload.sockets.find(s=>s.id===socketId);if(!socket)return;
    socket.hood={welded:fd.get('welded')==='yes',date:clean(fd.get('date'))};payload.updatedAt=new Date().toISOString();
    try{await save(payload);closeOverlay();renderMonitoring();activeTab='hoods';renderTab();}catch(error){alert(error.message);}
  }

  function findEntry(socketId,entryId){return (currentRecord?.payload?.sockets||[]).find(s=>s.id===socketId)?.history?.find(h=>h.id===entryId)||null;}

  function setup(){
    const observer=new MutationObserver(()=>patchCards());
    observer.observe(document.body,{childList:true,subtree:true});
    patchCards();
    document.addEventListener('click',event=>{
      const assetBtn=event.target.closest('.monitoring-asset-card');
      if(assetBtn&&isThermalBName(assetBtn.querySelector('h2')?.textContent)){
        currentAsset={id:assetBtn.dataset.monitoringAsset||'',name:clean(assetBtn.querySelector('h2')?.textContent)||'Wärmeanlage B'};
        setTimeout(renderAssetDetail,0);return;
      }
      if(event.target.closest('[data-lineb-all]')){document.querySelector('[data-asset-monitoring-link]')?.click();return;}
      if(event.target.closest('[data-lineb-back]')){renderAssetDetail();return;}
      if(event.target.closest('[data-lineb-open]')){openMonitoring();return;}
      const tab=event.target.closest('[data-lineb-tab]');if(tab){activeTab=tab.dataset.linebTab;renderTab();return;}
      const socket=event.target.closest('[data-lineb-socket]');if(socket){openSocket(socket.dataset.linebSocket);return;}
      const add=event.target.closest('[data-lineb-add]');if(add){exchangeForm(add.dataset.linebAdd||'');return;}
      const edit=event.target.closest('[data-lineb-edit-entry]');if(edit){const entry=findEntry(edit.dataset.linebEntrySocket,edit.dataset.linebEditEntry);if(entry)exchangeForm(edit.dataset.linebEntrySocket,entry);return;}
      if(event.target.closest('[data-lineb-delete-entry]')){const form=document.getElementById('linebExchangeForm');deleteEntry(form?.dataset.entryId||'');return;}
      const comp=event.target.closest('[data-lineb-component]');if(comp){openComponent(comp.dataset.linebComponent,comp.dataset.linebNumber);return;}
      const hood=event.target.closest('[data-lineb-hood]');if(hood){hoodForm(hood.dataset.linebHood);return;}
      if(event.target.closest('[data-lineb-close]')){closeOverlay();return;}
    },true);
    document.addEventListener('submit',event=>{
      if(event.target.id==='linebExchangeForm'){event.preventDefault();saveExchange(event.target);}
      if(event.target.id==='linebHoodForm'){event.preventDefault();saveHood(event.target);}
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
