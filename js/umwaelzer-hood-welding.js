(()=>{
  const API='/api/monitoring/umwaelzer';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  const SOCKETS=['S 1.1','S 1.2','S 2.1','S 2.2','S 3.1','S 3.2','S 4.1','S 4.2'];
  let enhancing=false;

  const clean=(value='')=>String(value??'').trim();
  const esc=(value='')=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>`hood_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function injectStyle(){
    if(document.getElementById('umwaelzerHoodStyle'))return;
    const style=document.createElement('style');
    style.id='umwaelzerHoodStyle';
    style.textContent=`
      .hood-clickable{cursor:pointer;transition:background .15s ease}
      .hood-clickable:hover{background:#f6fbfe!important}
      .hood-photo-count{display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:3px 7px;border-radius:999px;background:#edf5fb;color:#0b629f;font-size:10px;font-weight:800}
      .hood-detail-status{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border-bottom:1px solid #edf1f4;background:#f9fbfc}
      .hood-detail-status strong{font-size:14px;color:#15314a}.hood-detail-status span{font-size:12px;color:#6d7f8f}
      .hood-welding-list{display:grid;padding:8px 18px 18px}
      .hood-welding-card{display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:16px;padding:16px 0;border-bottom:1px solid #edf1f4;align-items:start}
      .hood-welding-card:last-child{border-bottom:0}.hood-welding-date strong{display:block;font-size:15px}.hood-welding-date span{display:block;margin-top:3px;color:#758797;font-size:11px}
      .hood-welding-main p{margin:0 0 10px;color:#52697c;font-size:12px;line-height:1.45}.hood-welding-main p:last-child{margin-bottom:0}
      .hood-photo-grid{display:flex;flex-wrap:wrap;gap:8px}.hood-photo-thumb{appearance:none;border:1px solid #d9e3eb;background:#fff;border-radius:10px;padding:0;overflow:hidden;width:78px;height:62px;cursor:pointer}.hood-photo-thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .hood-photo-editor{grid-column:1/-1;display:grid;gap:8px}.hood-photo-existing{display:flex;flex-wrap:wrap;gap:9px}.hood-photo-existing label{position:relative;width:92px;height:72px;border:1px solid #d6e1e9;border-radius:10px;overflow:hidden;background:#f5f8fa}.hood-photo-existing img{width:100%;height:100%;object-fit:cover}.hood-photo-existing input{position:absolute;right:5px;top:5px;width:18px;height:18px;accent-color:#c73e36}.hood-photo-hint{font-size:11px;color:#718392;line-height:1.4}.hood-photo-preview{position:fixed;inset:0;z-index:260;display:grid;place-items:center;padding:24px;background:rgba(8,19,29,.84)}.hood-photo-preview img{max-width:min(94vw,1500px);max-height:90vh;border-radius:12px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.hood-photo-preview button{position:fixed;top:22px;right:22px;width:44px;height:44px;border:0;border-radius:12px;background:#fff;color:#10283d;font-size:24px;cursor:pointer}
      @media(max-width:760px){.hood-welding-card{grid-template-columns:1fr;gap:8px}.hood-welding-card .button{justify-self:start}.hood-detail-status{align-items:flex-start;flex-direction:column}.hood-photo-thumb{width:70px;height:56px}}
    `;
    document.head.appendChild(style);
  }

  async function fetchRecord(){
    const response=await fetch(API,{cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||'Umwälzer-Daten konnten nicht geladen werden.');
    return data.current||null;
  }

  async function saveRecord(record,payload){
    const response=await fetch(API,{
      method:'PUT',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({expectedRevision:Number(record?.revision||0),payload,clientId:localStorage.getItem(CLIENT_KEY)||''})
    });
    const data=await response.json().catch(()=>null);
    if(response.status===409||data?.conflict)throw new Error('Die Anlagenüberwachung wurde inzwischen an einem anderen PC geändert. Bitte erneut öffnen und die Änderung wiederholen.');
    if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||'Änderung konnte nicht gespeichert werden.');
    return data.current;
  }

  function showOverlay(html){
    document.getElementById('monitoringOverlay')?.remove();
    const el=document.createElement('div');
    el.className='monitoring-overlay';
    el.id='monitoringOverlay';
    el.innerHTML=`<div class="monitoring-dialog">${html}</div>`;
    document.body.appendChild(el);
  }

  function toIsoDate(value){
    const v=clean(value);
    if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    let m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if(m){let year=m[3];if(year.length===2)year=(Number(year)<70?'20':'19')+year;return `${year}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
    m=v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return '';
  }

  function displayDate(value){
    const v=clean(value);const iso=toIsoDate(v);
    if(iso){const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);return `${m[3]}.${m[2]}.${m[1]}`;}
    return v||'–';
  }

  function hoodRepairs(hood){return Array.isArray(hood?.repairs)?hood.repairs:[];}
  function photoCount(hood){return hoodRepairs(hood).reduce((sum,r)=>sum+(Array.isArray(r.photos)?r.photos.length:0),0);}

  async function enhanceHoodRows(){
    if(enhancing)return;
    const active=document.querySelector('[data-umwaelzer-tab="hoods"].active');
    const table=document.querySelector('#umwaelzerTabBody .monitoring-table');
    if(!active||!table)return;
    const rows=[...table.querySelectorAll('.monitoring-table-row:not(.head)')];
    if(!rows.length)return;
    enhancing=true;
    try{
      const record=await fetchRecord();
      rows.forEach(row=>{
        const text=clean(row.textContent);
        const socketId=SOCKETS.find(s=>text.startsWith(s));
        if(!socketId)return;
        row.classList.add('hood-clickable');
        row.dataset.hoodSocket=socketId;
        row.setAttribute('title','Schutzhaube öffnen');
        const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);
        const count=photoCount(socket?.hood);
        row.querySelector('.hood-photo-count')?.remove();
        if(count){
          const badge=document.createElement('span');
          badge.className='hood-photo-count';
          badge.textContent=`Foto${count===1?'':'s'} ${count}`;
          const target=row.lastElementChild||row;
          target.appendChild(badge);
        }
      });
    }catch(error){console.warn('Schutzhauben konnten nicht erweitert werden:',error);}
    finally{enhancing=false;}
  }

  function weldingCard(repair){
    const photos=Array.isArray(repair.photos)?repair.photos:[];
    return `<article class="hood-welding-card">
      <div class="hood-welding-date"><strong>${esc(displayDate(repair.date))}</strong><span>Schweißung</span></div>
      <div class="hood-welding-main">${repair.note?`<p>${esc(repair.note)}</p>`:'<p>Keine Bemerkung hinterlegt.</p>'}${photos.length?`<div class="hood-photo-grid">${photos.map(p=>`<button type="button" class="hood-photo-thumb" data-hood-photo="${esc(p.id)}" data-hood-repair="${esc(repair.id)}"><img src="${esc(p.dataUrl)}" alt="Schutzhauben-Foto"></button>`).join('')}</div>`:''}</div>
      <button type="button" class="button secondary" data-edit-hood-repair="${esc(repair.id)}">Bearbeiten</button>
    </article>`;
  }

  async function openHood(socketId){
    try{
      const record=await fetchRecord();
      const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);
      if(!socket)throw new Error('Sockel wurde nicht gefunden.');
      const hood=socket.hood||{};
      const repairs=[...hoodRepairs(hood)].sort((a,b)=>clean(b.date).localeCompare(clean(a.date)));
      const legacy=hood.welded&&hood.date&&!repairs.some(r=>clean(r.date)===clean(hood.date));
      const count=photoCount(hood);
      showOverlay(`<div class="dialog-head"><div><p class="eyebrow">Schutzhaube</p><h2>${esc(socketId)}</h2></div><button class="icon-button" data-monitoring-close>×</button></div>
        <div class="dialog-actions"><button class="button primary" data-add-hood-repair="${esc(socketId)}">+ Schweißung eintragen</button></div>
        <div class="hood-detail-status"><div><strong>${hood.welded?'Schutzhaube als geschweißt geführt':'Noch keine Schweißung hinterlegt'}</strong><span>${hood.date?`Letzter Stand: ${esc(displayDate(hood.date))}`:'Kein Datum vorhanden'}</span></div><span>${count} Foto${count===1?'':'s'}</span></div>
        <div class="hood-welding-list">${legacy?`<article class="hood-welding-card"><div class="hood-welding-date"><strong>${esc(displayDate(hood.date))}</strong><span>Excel-Stand</span></div><div class="hood-welding-main"><p>Aus der ursprünglichen Schutzhauben-Liste übernommen.</p></div><button type="button" class="button secondary" data-add-hood-repair="${esc(socketId)}" data-prefill-date="${esc(toIsoDate(hood.date))}">Ergänzen</button></article>`:''}${repairs.length?repairs.map(weldingCard).join(''):(!legacy?'<div class="monitoring-empty"><strong>Noch keine Schweißung dokumentiert.</strong><span>Datum, Bemerkung und Fotos können hier zentral hinterlegt werden.</span></div>':'')}</div>`);
    }catch(error){alert(error.message);}
  }

  function repairForm(socketId,repair=null,prefillDate=''){
    const photos=Array.isArray(repair?.photos)?repair.photos:[];
    const formDate=toIsoDate(repair?.date||prefillDate)||clean(repair?.date||prefillDate);
    showOverlay(`<form id="hoodRepairForm" data-hood-socket="${esc(socketId)}" data-repair-id="${esc(repair?.id||'')}">
      <div class="dialog-head"><div><p class="eyebrow">Schutzhaube · ${esc(socketId)}</p><h2>${repair?'Schweißung bearbeiten':'Schweißung eintragen'}</h2></div><button type="button" class="icon-button" data-monitoring-close>×</button></div>
      <div class="monitoring-form-grid">
        <label><span>Datum der Schweißung</span><input name="date" type="date" required value="${esc(formDate)}"></label>
        <label class="full"><span>Bemerkung</span><textarea name="note" rows="4" placeholder="z. B. Riss geschweißt, Halter nachgearbeitet …">${esc(repair?.note||'')}</textarea></label>
        ${photos.length?`<div class="hood-photo-editor"><span class="hood-photo-hint">Vorhandene Fotos · Haken setzen, um ein Foto beim Speichern zu entfernen.</span><div class="hood-photo-existing">${photos.map(p=>`<label title="Foto entfernen"><img src="${esc(p.dataUrl)}" alt="Foto"><input type="checkbox" name="removePhoto" value="${esc(p.id)}"></label>`).join('')}</div></div>`:''}
        <label class="full"><span>Fotos hinzufügen</span><input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><small class="hood-photo-hint">Maximal 5 Fotos pro Schweißung. Bilder werden vor dem Speichern automatisch verkleinert und komprimiert.</small></label>
      </div>
      <div class="dialog-foot"><button type="button" class="button secondary" data-hood-detail-back="${esc(socketId)}">Abbrechen</button><button type="submit" class="button primary">Änderungen speichern</button></div>
    </form>`);
  }

  async function loadImage(file){
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.decoding='async';
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error(`Foto „${file.name}“ konnte nicht gelesen werden.`));img.src=url;});
    URL.revokeObjectURL(url);
    return img;
  }

  async function compressPhoto(file){
    if(!/^image\/(jpeg|png|webp)$/i.test(file.type))throw new Error(`„${file.name}“ ist kein unterstütztes Bildformat.`);
    const img=await loadImage(file);
    const maxSide=1400;
    const scale=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
    const width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
    const height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});ctx.drawImage(img,0,0,width,height);
    let quality=.74;
    let dataUrl=canvas.toDataURL('image/jpeg',quality);
    while(dataUrl.length>900000&&quality>.48){quality-=.08;dataUrl=canvas.toDataURL('image/jpeg',quality);}
    if(dataUrl.length>1100000)throw new Error(`Foto „${file.name}“ ist auch nach Komprimierung zu groß.`);
    return {id:uid(),name:file.name,type:'image/jpeg',dataUrl,createdAt:new Date().toISOString()};
  }

  async function saveRepair(form){
    const submit=form.querySelector('button[type="submit"]');
    if(submit){submit.disabled=true;submit.textContent='Speichert …';}
    try{
      const record=await fetchRecord();
      if(!record?.payload)throw new Error('Umwälzer-Daten konnten nicht geladen werden.');
      const socketId=clean(form.dataset.hoodSocket);
      const repairId=clean(form.dataset.repairId);
      const payload=structuredClone(record.payload);
      const socket=(payload.sockets||[]).find(s=>s.id===socketId);
      if(!socket)throw new Error('Sockel wurde nicht gefunden.');
      socket.hood=socket.hood||{};
      socket.hood.repairs=Array.isArray(socket.hood.repairs)?socket.hood.repairs:[];
      const fd=new FormData(form);
      const date=clean(fd.get('date'));
      const note=clean(fd.get('note'));
      if(!date)throw new Error('Bitte ein Schweißdatum auswählen.');
      const existing=repairId?socket.hood.repairs.find(r=>r.id===repairId):null;
      const removed=new Set(fd.getAll('removePhoto').map(clean));
      let photos=(Array.isArray(existing?.photos)?existing.photos:[]).filter(p=>!removed.has(clean(p.id)));
      const files=[...(form.elements.photos?.files||[])];
      if(photos.length+files.length>5)throw new Error('Pro Schweißung können maximal 5 Fotos gespeichert werden.');
      for(const file of files)photos.push(await compressPhoto(file));
      const repair={...(existing||{}),id:existing?.id||uid(),date,note,photos,updatedAt:new Date().toISOString(),createdAt:existing?.createdAt||new Date().toISOString()};
      if(existing){const index=socket.hood.repairs.findIndex(r=>r.id===repair.id);socket.hood.repairs.splice(index,1,repair);}else socket.hood.repairs.push(repair);
      socket.hood.welded=true;
      const dates=[clean(socket.hood.date),...socket.hood.repairs.map(r=>clean(r.date))].map(v=>toIsoDate(v)||v).filter(Boolean).sort();
      socket.hood.date=dates.at(-1)||date;
      payload.updatedAt=new Date().toISOString();
      await saveRecord(record,payload);
      await refreshToHoods(socketId,true);
    }catch(error){alert(error.message);if(submit){submit.disabled=false;submit.textContent='Änderungen speichern';}}
  }

  async function refreshToHoods(socketId='',reopen=false){
    document.getElementById('monitoringOverlay')?.remove();
    document.querySelector('[data-monitoring-asset-back]')?.click();
    await sleep(40);
    document.querySelector('[data-open-umwaelzer]')?.click();
    for(let i=0;i<40;i++){
      await sleep(50);
      const tab=document.querySelector('[data-umwaelzer-tab="hoods"]');
      if(tab){tab.click();break;}
    }
    for(let i=0;i<30;i++){await sleep(40);if(document.querySelector('#umwaelzerTabBody .monitoring-table'))break;}
    await enhanceHoodRows();
    if(reopen&&socketId)openHood(socketId);
  }

  async function openPhoto(socketId,repairId,photoId){
    try{
      const record=await fetchRecord();
      const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);
      const repair=hoodRepairs(socket?.hood).find(r=>r.id===repairId);
      const photo=(repair?.photos||[]).find(p=>p.id===photoId);
      if(!photo)return;
      const preview=document.createElement('div');preview.className='hood-photo-preview';preview.innerHTML=`<button type="button" aria-label="Schließen">×</button><img src="${esc(photo.dataUrl)}" alt="Schutzhauben-Foto">`;document.body.appendChild(preview);
      preview.addEventListener('click',event=>{if(event.target===preview||event.target.closest('button'))preview.remove();});
    }catch(error){alert(error.message);}
  }

  injectStyle();
  const observer=new MutationObserver(()=>requestAnimationFrame(enhanceHoodRows));
  observer.observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',async event=>{
    const row=event.target.closest('[data-hood-socket]');
    if(row&&!event.target.closest('a,input,select,textarea')&&!event.target.closest('[data-add-hood-repair],[data-edit-hood-repair],[data-hood-photo],[data-hood-detail-back]')){event.preventDefault();event.stopImmediatePropagation();openHood(row.dataset.hoodSocket);return;}
    const add=event.target.closest('[data-add-hood-repair]');
    if(add){event.preventDefault();event.stopImmediatePropagation();repairForm(add.dataset.addHoodRepair,null,add.dataset.prefillDate||'');return;}
    const edit=event.target.closest('[data-edit-hood-repair]');
    if(edit){
      event.preventDefault();event.stopImmediatePropagation();
      const socketId=clean(document.querySelector('#monitoringOverlay .dialog-head h2')?.textContent);
      try{const record=await fetchRecord();const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);const repair=hoodRepairs(socket?.hood).find(r=>r.id===edit.dataset.editHoodRepair);if(repair)repairForm(socketId,repair);}catch(error){alert(error.message);}return;
    }
    const back=event.target.closest('[data-hood-detail-back]');if(back){event.preventDefault();event.stopImmediatePropagation();openHood(back.dataset.hoodDetailBack);return;}
    const photo=event.target.closest('[data-hood-photo]');
    if(photo){event.preventDefault();event.stopImmediatePropagation();const socketId=clean(document.querySelector('#monitoringOverlay .dialog-head h2')?.textContent);openPhoto(socketId,photo.dataset.hoodRepair,photo.dataset.hoodPhoto);return;}
  },true);

  document.addEventListener('submit',event=>{
    const form=event.target.closest('#hoodRepairForm');if(!form)return;
    event.preventDefault();event.stopImmediatePropagation();saveRepair(form);
  },true);
})();
