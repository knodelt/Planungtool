(()=>{
  const API='/api/monitoring/umwaelzer';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  const SOCKETS=['S 1.1','S 1.2','S 2.1','S 2.2','S 3.1','S 3.2','S 4.1','S 4.2'];
  let enhancing=false;

  const clean=(v='')=>String(v??'').trim();
  const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>`hood_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

  function injectStyle(){
    if(document.getElementById('umwaelzerHoodV2Style'))return;
    const s=document.createElement('style');
    s.id='umwaelzerHoodV2Style';
    s.textContent=`
      .hood-v2-row{cursor:pointer;transition:background .15s ease}.hood-v2-row:hover{background:#f6fbfe!important}
      .hood-v2-photo-count{display:inline-flex;margin-left:8px;padding:3px 7px;border-radius:999px;background:#edf5fb;color:#0b629f;font-size:10px;font-weight:800}
      .hood-v2-status{display:flex;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #e8eef3;background:#f8fbfd}.hood-v2-status strong{display:block}.hood-v2-status span{font-size:12px;color:#6d7f8f}
      .hood-v2-list{padding:8px 18px 18px}.hood-v2-card{display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:16px;padding:16px 0;border-bottom:1px solid #e8eef3}.hood-v2-card:last-child{border-bottom:0}.hood-v2-card p{margin:0 0 10px;color:#52697c}
      .hood-v2-photos{display:flex;flex-wrap:wrap;gap:8px}.hood-v2-thumb{border:1px solid #d9e3eb;background:#fff;border-radius:10px;padding:0;overflow:hidden;width:82px;height:64px;cursor:pointer}.hood-v2-thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .hood-v2-existing{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:9px}.hood-v2-existing label{position:relative;width:94px;height:74px;border:1px solid #d6e1e9;border-radius:10px;overflow:hidden}.hood-v2-existing img{width:100%;height:100%;object-fit:cover}.hood-v2-existing input{position:absolute;right:5px;top:5px;width:18px;height:18px;accent-color:#c73e36}
      .hood-v2-hint{font-size:11px;color:#718392}.hood-v2-preview{position:fixed;inset:0;z-index:300;display:grid;place-items:center;padding:24px;background:rgba(8,19,29,.86)}.hood-v2-preview img{max-width:94vw;max-height:90vh;border-radius:12px}.hood-v2-preview button{position:fixed;top:22px;right:22px;width:44px;height:44px;border:0;border-radius:12px;background:#fff;font-size:24px;cursor:pointer}
      @media(max-width:760px){.hood-v2-card{grid-template-columns:1fr}.hood-v2-status{flex-direction:column}}
    `;
    document.head.appendChild(s);
  }

  async function fetchRecord(){
    const r=await fetch(API,{cache:'no-store'});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d?.ok)throw new Error(d?.error||d?.detail||'Umwälzer-Daten konnten nicht geladen werden.');
    return d.current||null;
  }

  async function saveRecord(record,payload){
    const r=await fetch(API,{method:'PUT',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:Number(record?.revision||0),payload,clientId:localStorage.getItem(CLIENT_KEY)||''})});
    const d=await r.json().catch(()=>null);
    if(r.status===409||d?.conflict)throw new Error('Die Anlagenüberwachung wurde inzwischen an einem anderen PC geändert. Bitte erneut öffnen und wiederholen.');
    if(!r.ok||!d?.ok)throw new Error(d?.error||d?.detail||`Speichern fehlgeschlagen (${r.status}).`);
    return d.current;
  }

  function toIsoDate(value){
    const v=clean(value);if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    let m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);if(m){let y=m[3];if(y.length===2)y=(Number(y)<70?'20':'19')+y;return `${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
    m=v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return '';
  }
  function displayDate(v){const iso=toIsoDate(v);if(!iso)return clean(v)||'–';const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);return `${m[3]}.${m[2]}.${m[1]}`;}
  const repairsOf=hood=>Array.isArray(hood?.repairs)?hood.repairs:[];
  const photoCount=hood=>repairsOf(hood).reduce((n,r)=>n+(Array.isArray(r.photos)?r.photos.length:0),0);

  function showOverlay(html){
    document.getElementById('monitoringOverlay')?.remove();
    const el=document.createElement('div');el.className='monitoring-overlay';el.id='monitoringOverlay';el.innerHTML=`<div class="monitoring-dialog">${html}</div>`;document.body.appendChild(el);
  }

  async function enhanceRows(){
    if(enhancing||!document.querySelector('[data-umwaelzer-tab="hoods"].active'))return;
    const table=document.querySelector('#umwaelzerTabBody .monitoring-table');if(!table)return;
    const rows=[...table.querySelectorAll('.monitoring-table-row:not(.head)')];if(!rows.length)return;
    enhancing=true;
    try{
      const record=await fetchRecord();
      rows.forEach(row=>{
        const socketId=SOCKETS.find(s=>clean(row.textContent).startsWith(s));if(!socketId)return;
        row.classList.add('hood-v2-row');row.dataset.hoodV2Socket=socketId;row.title='Schutzhaube öffnen';
        row.querySelector('.hood-v2-photo-count')?.remove();
        const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);const count=photoCount(socket?.hood);
        if(count){const badge=document.createElement('span');badge.className='hood-v2-photo-count';badge.textContent=`Fotos ${count}`;(row.lastElementChild||row).appendChild(badge);}
      });
    }catch(e){console.warn(e);}finally{enhancing=false;}
  }

  function repairCard(repair){
    const photos=Array.isArray(repair.photos)?repair.photos:[];
    return `<article class="hood-v2-card"><div><strong>${esc(displayDate(repair.date))}</strong><div class="hood-v2-hint">Schweißung</div></div><div>${repair.note?`<p>${esc(repair.note)}</p>`:'<p>Keine Bemerkung hinterlegt.</p>'}${photos.length?`<div class="hood-v2-photos">${photos.map(p=>`<button type="button" class="hood-v2-thumb" data-hood-v2-photo="${esc(p.id)}" data-hood-v2-repair="${esc(repair.id)}"><img src="${esc(p.dataUrl)}" alt="Schutzhauben-Foto"></button>`).join('')}</div>`:''}</div><button type="button" class="button secondary" data-hood-v2-edit="${esc(repair.id)}">Bearbeiten</button></article>`;
  }

  async function openHood(socketId,recordOverride=null){
    try{
      const record=recordOverride||await fetchRecord();const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);if(!socket)throw new Error('Sockel wurde nicht gefunden.');
      const hood=socket.hood||{};const repairs=[...repairsOf(hood)].sort((a,b)=>clean(b.date).localeCompare(clean(a.date)));const count=photoCount(hood);
      const legacy=hood.welded&&hood.date&&!repairs.some(r=>toIsoDate(r.date)===toIsoDate(hood.date));
      showOverlay(`<div class="dialog-head"><div><p class="eyebrow">Schutzhaube</p><h2>${esc(socketId)}</h2></div><button class="icon-button" data-monitoring-close>×</button></div><div class="dialog-actions"><button class="button primary" data-hood-v2-add="${esc(socketId)}">+ Schweißung eintragen</button></div><div class="hood-v2-status"><div><strong>${hood.welded?'Schutzhaube als geschweißt geführt':'Noch keine Schweißung hinterlegt'}</strong><span>${hood.date?`Letzter Stand: ${esc(displayDate(hood.date))}`:'Kein Datum vorhanden'}</span></div><span>${count} Foto${count===1?'':'s'}</span></div><div class="hood-v2-list">${legacy?`<article class="hood-v2-card"><div><strong>${esc(displayDate(hood.date))}</strong><div class="hood-v2-hint">Excel-Stand</div></div><div><p>Aus der ursprünglichen Schutzhauben-Liste übernommen.</p></div><button type="button" class="button secondary" data-hood-v2-add="${esc(socketId)}" data-prefill="${esc(toIsoDate(hood.date))}">Ergänzen</button></article>`:''}${repairs.length?repairs.map(repairCard).join(''):(!legacy?'<div class="monitoring-empty"><strong>Noch keine Schweißung dokumentiert.</strong><span>Datum, Bemerkung und Fotos können hier hinterlegt werden.</span></div>':'')}</div>`);
    }catch(e){alert(e.message);}
  }

  function openForm(socketId,repair=null,prefill=''){
    const photos=Array.isArray(repair?.photos)?repair.photos:[];const date=toIsoDate(repair?.date||prefill)||'';
    showOverlay(`<form id="hoodRepairFormV2" data-socket="${esc(socketId)}" data-repair="${esc(repair?.id||'')}"><div class="dialog-head"><div><p class="eyebrow">Schutzhaube · ${esc(socketId)}</p><h2>${repair?'Schweißung bearbeiten':'Schweißung eintragen'}</h2></div><button type="button" class="icon-button" data-monitoring-close>×</button></div><div class="monitoring-form-grid"><label><span>Datum der Schweißung</span><input name="date" type="date" required value="${esc(date)}"></label><label class="full"><span>Bemerkung</span><textarea name="note" rows="4" placeholder="z. B. Riss geschweißt, Halter nachgearbeitet …">${esc(repair?.note||'')}</textarea></label>${photos.length?`<div class="hood-v2-existing">${photos.map(p=>`<label title="Foto beim Speichern entfernen"><img src="${esc(p.dataUrl)}" alt="Foto"><input type="checkbox" name="removePhoto" value="${esc(p.id)}"></label>`).join('')}</div>`:''}<label class="full"><span>Fotos hinzufügen</span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><small class="hood-v2-hint">Maximal 5 Fotos. Bilder werden automatisch verkleinert.</small></label></div><div class="dialog-foot"><button type="button" class="button secondary" data-hood-v2-back="${esc(socketId)}">Abbrechen</button><button type="submit" class="button primary">Änderungen speichern</button></div></form>`);
  }

  async function imageFrom(file){const url=URL.createObjectURL(file);try{const img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=bad;img.src=url;});return img;}finally{URL.revokeObjectURL(url);}}
  async function compressPhoto(file){
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type))throw new Error(`„${file.name}“ ist kein unterstütztes Bild.`);
    const img=await imageFrom(file);const maxSide=1000;const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);
    let q=.68,data=canvas.toDataURL('image/jpeg',q);while(data.length>240000&&q>.36){q-=.08;data=canvas.toDataURL('image/jpeg',q);}if(data.length>300000)throw new Error(`Foto „${file.name}“ ist nach Komprimierung noch zu groß.`);
    return {id:uid(),name:file.name,type:'image/jpeg',dataUrl:data,createdAt:new Date().toISOString()};
  }

  async function saveForm(form){
    const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Speichert …';}
    try{
      const record=await fetchRecord();if(!record?.payload)throw new Error('Umwälzer-Daten konnten nicht geladen werden.');
      const socketId=clean(form.dataset.socket),repairId=clean(form.dataset.repair);const payload=structuredClone(record.payload);const socket=(payload.sockets||[]).find(s=>s.id===socketId);if(!socket)throw new Error('Sockel wurde nicht gefunden.');
      socket.hood=socket.hood||{};socket.hood.repairs=repairsOf(socket.hood).map(r=>structuredClone(r));
      const fd=new FormData(form),date=clean(fd.get('date')),note=clean(fd.get('note'));if(!date)throw new Error('Bitte ein Schweißdatum auswählen.');
      const existing=repairId?socket.hood.repairs.find(r=>r.id===repairId):null;const removed=new Set(fd.getAll('removePhoto').map(clean));let photos=(Array.isArray(existing?.photos)?existing.photos:[]).filter(p=>!removed.has(clean(p.id)));const files=[...(form.elements.photos?.files||[])];if(photos.length+files.length>5)throw new Error('Maximal 5 Fotos pro Schweißung.');for(const file of files)photos.push(await compressPhoto(file));
      const repair={...(existing||{}),id:existing?.id||uid(),date,note,photos,updatedAt:new Date().toISOString(),createdAt:existing?.createdAt||new Date().toISOString()};
      if(existing){const i=socket.hood.repairs.findIndex(r=>r.id===repair.id);socket.hood.repairs.splice(i,1,repair);}else socket.hood.repairs.push(repair);
      socket.hood.welded=true;const dates=[socket.hood.date,...socket.hood.repairs.map(r=>r.date)].map(toIsoDate).filter(Boolean).sort();socket.hood.date=dates.at(-1)||date;payload.updatedAt=new Date().toISOString();
      const saved=await saveRecord(record,payload);const savedSocket=(saved?.payload?.sockets||[]).find(s=>s.id===socketId);const savedRepair=repairsOf(savedSocket?.hood).find(r=>r.id===repair.id);if(!savedRepair||clean(savedRepair.date)!==date)throw new Error('Der Eintrag wurde vom Server nicht bestätigt. Bitte erneut versuchen.');
      updateRow(saved,socketId);await openHood(socketId,saved);
    }catch(e){alert(e.message);if(btn){btn.disabled=false;btn.textContent='Änderungen speichern';}}
  }

  function updateRow(record,socketId){
    const row=document.querySelector(`.monitoring-table-row[data-hood-v2-socket="${CSS.escape(socketId)}"]`);if(!row)return;const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId),hood=socket?.hood||{};const last=row.lastElementChild;if(last){last.innerHTML=`<span class="hood-state ${hood.welded?'done':''}">${hood.welded?`geschweißt · ${esc(displayDate(hood.date))}`:'nicht hinterlegt'}</span>${photoCount(hood)?`<span class="hood-v2-photo-count">Fotos ${photoCount(hood)}</span>`:''}`;}
  }

  async function openPhoto(socketId,repairId,photoId){const record=await fetchRecord();const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);const repair=repairsOf(socket?.hood).find(r=>r.id===repairId);const photo=(repair?.photos||[]).find(p=>p.id===photoId);if(!photo)return;const p=document.createElement('div');p.className='hood-v2-preview';p.innerHTML=`<button type="button">×</button><img src="${esc(photo.dataUrl)}" alt="Schutzhauben-Foto">`;document.body.appendChild(p);p.addEventListener('click',e=>{if(e.target===p||e.target.closest('button'))p.remove();});}

  injectStyle();
  new MutationObserver(()=>requestAnimationFrame(enhanceRows)).observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',async event=>{
    const row=event.target.closest('.monitoring-table-row[data-hood-v2-socket]');if(row){event.preventDefault();event.stopImmediatePropagation();openHood(row.dataset.hoodV2Socket);return;}
    const add=event.target.closest('[data-hood-v2-add]');if(add){event.preventDefault();event.stopImmediatePropagation();openForm(add.dataset.hoodV2Add,null,add.dataset.prefill||'');return;}
    const edit=event.target.closest('[data-hood-v2-edit]');if(edit){event.preventDefault();event.stopImmediatePropagation();const socketId=clean(document.querySelector('#monitoringOverlay .dialog-head h2')?.textContent);const record=await fetchRecord();const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);const repair=repairsOf(socket?.hood).find(r=>r.id===edit.dataset.hoodV2Edit);if(repair)openForm(socketId,repair);return;}
    const back=event.target.closest('[data-hood-v2-back]');if(back){event.preventDefault();event.stopImmediatePropagation();openHood(back.dataset.hoodV2Back);return;}
    const photo=event.target.closest('[data-hood-v2-photo]');if(photo){event.preventDefault();event.stopImmediatePropagation();const socketId=clean(document.querySelector('#monitoringOverlay .dialog-head h2')?.textContent);openPhoto(socketId,photo.dataset.hoodV2Repair,photo.dataset.hoodV2Photo);return;}
  },true);

  document.addEventListener('submit',event=>{if(event.target?.id!=='hoodRepairFormV2')return;event.preventDefault();event.stopImmediatePropagation();saveForm(event.target);},true);
})();