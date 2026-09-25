(()=>{
  const API='/api/monitoring/umwaelzer';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  let enhancing=false;

  const clean=(value='')=>String(value??'').trim();
  const esc=(value='')=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function injectStyle(){
    if(document.getElementById('umwaelzerHistoryEditStyle'))return;
    const style=document.createElement('style');
    style.id='umwaelzerHistoryEditStyle';
    style.textContent=`
      .history-list article{position:relative;padding-right:118px}
      .umwaelzer-entry-edit{position:absolute;right:0;top:14px;min-height:34px;padding:7px 11px;border:1px solid #cbd9e5;border-radius:9px;background:#fff;color:#0b5f9d;font:inherit;font-size:11px;font-weight:800;cursor:pointer}
      .umwaelzer-entry-edit:hover{background:#f2f8fc;border-color:#8eb8d7}
      @media(max-width:760px){.history-list article{padding-right:0}.umwaelzer-entry-edit{position:static;grid-column:1/-1;justify-self:start;margin-top:6px}}
    `;
    document.head.appendChild(style);
  }

  async function fetchRecord(){
    const response=await fetch(API,{cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||'Umwälzer-Daten konnten nicht geladen werden.');
    return data.current||null;
  }

  function currentHistorySocket(){
    const overlay=document.getElementById('monitoringOverlay');
    const title=clean(overlay?.querySelector('.dialog-head h2')?.textContent);
    const match=title.match(/^(S\s*\d\.\d)\s*·\s*Historie$/i);
    return match?match[1].replace(/\s+/,' '):'';
  }

  async function enhanceHistory(){
    if(enhancing)return;
    const overlay=document.getElementById('monitoringOverlay');
    const list=overlay?.querySelector('.history-list');
    const socketId=currentHistorySocket();
    if(!overlay||!list||!socketId||overlay.querySelector('#umwaelzerEditEntryForm'))return;
    const articles=[...list.querySelectorAll(':scope > article')];
    if(!articles.length||articles.every(a=>a.querySelector('[data-edit-umwaelzer-entry]')))return;
    enhancing=true;
    try{
      const record=await fetchRecord();
      const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);
      if(!socket)return;
      const history=[...(socket.history||[])].reverse();
      articles.forEach((article,index)=>{
        if(article.querySelector('[data-edit-umwaelzer-entry]'))return;
        const entry=history[index];
        if(!entry?.id)return;
        const button=document.createElement('button');
        button.type='button';
        button.className='umwaelzer-entry-edit';
        button.textContent='Bearbeiten';
        button.dataset.editUmwaelzerEntry=entry.id;
        button.dataset.editUmwaelzerSocket=socketId;
        article.appendChild(button);
      });
    }catch(error){console.warn('Umwälzer-Historie konnte nicht erweitert werden:',error);}
    finally{enhancing=false;}
  }

  function editorHtml(socketId,entry){
    const options=['S 1.1','S 1.2','S 2.1','S 2.2','S 3.1','S 3.2','S 4.1','S 4.2']
      .map(s=>`<option value="${esc(s)}" ${s===socketId?'selected':''}>${esc(s)}</option>`).join('');
    return `<form id="umwaelzerEditEntryForm" data-original-socket="${esc(socketId)}" data-entry-id="${esc(entry.id)}">
      <div class="dialog-head"><div><p class="eyebrow">Umwälzer</p><h2>Historieneintrag bearbeiten</h2></div><button type="button" class="icon-button" data-monitoring-close>×</button></div>
      <div class="monitoring-form-grid">
        <label><span>Sockel</span><select name="socket" required>${options}</select></label>
        <label><span>Einbau-Datum</span><input name="inDate" type="date" value="${esc(entry.inDate||'')}"></label>
        <label><span>Motor Nr.</span><input name="motor" type="text" value="${esc(entry.motor||'')}"></label>
        <label><span>Lüfterrad Nr.</span><input name="fan" type="text" value="${esc(entry.fan||'')}"></label>
        <label><span>Ausbau-Datum</span><input name="outDate" type="date" value="${esc(entry.outDate||'')}"></label>
        <label class="full"><span>Bemerkung</span><textarea name="note" rows="4">${esc(entry.note||'')}</textarea></label>
      </div>
      <div class="dialog-foot"><button type="button" class="button secondary" data-monitoring-close>Abbrechen</button><button type="submit" class="button primary">Änderungen speichern</button></div>
    </form>`;
  }

  async function openEditor(socketId,entryId){
    try{
      const record=await fetchRecord();
      const socket=(record?.payload?.sockets||[]).find(s=>s.id===socketId);
      const entry=(socket?.history||[]).find(h=>h.id===entryId);
      if(!entry)throw new Error('Der Historieneintrag wurde nicht gefunden.');
      const dialog=document.querySelector('#monitoringOverlay .monitoring-dialog');
      if(!dialog)return;
      dialog.innerHTML=editorHtml(socketId,entry);
    }catch(error){alert(error.message);}
  }

  function waitForSocketCard(socketId,timeout=7000){
    return new Promise(resolve=>{
      const started=Date.now();
      const check=()=>{
        const card=[...document.querySelectorAll('[data-socket-open]')].find(el=>el.dataset.socketOpen===socketId);
        if(card)return resolve(card);
        if(Date.now()-started>=timeout)return resolve(null);
        setTimeout(check,60);
      };
      check();
    });
  }

  async function refreshMainView(socketId){
    const back=document.querySelector('[data-monitoring-asset-back]');
    if(!back){location.reload();return;}
    back.click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const open=document.querySelector('[data-open-umwaelzer]');
    if(!open){location.reload();return;}
    open.click();
    const card=await waitForSocketCard(socketId);
    if(card)card.click();
    else location.reload();
  }

  async function saveEditor(form){
    const submit=form.querySelector('button[type="submit"]');
    if(submit){submit.disabled=true;submit.textContent='Speichert …';}
    try{
      const record=await fetchRecord();
      if(!record?.payload)throw new Error('Umwälzer-Daten konnten nicht geladen werden.');
      const originalSocketId=clean(form.dataset.originalSocket);
      const entryId=clean(form.dataset.entryId);
      const sourceSocket=(record.payload.sockets||[]).find(s=>s.id===originalSocketId);
      const sourceIndex=(sourceSocket?.history||[]).findIndex(h=>h.id===entryId);
      if(!sourceSocket||sourceIndex<0)throw new Error('Der Historieneintrag wurde inzwischen geändert oder entfernt.');

      const fd=new FormData(form);
      const targetSocketId=clean(fd.get('socket'));
      const updated={
        ...sourceSocket.history[sourceIndex],
        socket:targetSocketId,
        inDate:clean(fd.get('inDate')),
        outDate:clean(fd.get('outDate')),
        motor:clean(fd.get('motor')),
        fan:clean(fd.get('fan')),
        note:clean(fd.get('note')),
        updatedAt:new Date().toISOString()
      };
      if(!updated.inDate&&!updated.outDate&&!updated.motor&&!updated.fan&&!updated.note){
        throw new Error('Bitte mindestens eine Angabe im Eintrag belassen.');
      }

      const payload=structuredClone(record.payload);
      const oldSocket=payload.sockets.find(s=>s.id===originalSocketId);
      const oldIndex=oldSocket.history.findIndex(h=>h.id===entryId);
      oldSocket.history.splice(oldIndex,1);
      const targetSocket=payload.sockets.find(s=>s.id===targetSocketId);
      if(!targetSocket)throw new Error('Der gewählte Sockel wurde nicht gefunden.');
      if(targetSocketId===originalSocketId)targetSocket.history.splice(oldIndex,0,updated);
      else targetSocket.history.push(updated);
      payload.updatedAt=new Date().toISOString();

      const response=await fetch(API,{
        method:'PUT',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({expectedRevision:Number(record.revision||0),payload,clientId:localStorage.getItem(CLIENT_KEY)||''})
      });
      const data=await response.json().catch(()=>null);
      if(response.status===409||data?.conflict)throw new Error('Die Anlagenüberwachung wurde inzwischen an einem anderen PC geändert. Bitte erneut öffnen und die Änderung wiederholen.');
      if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||'Änderung konnte nicht gespeichert werden.');

      document.getElementById('monitoringOverlay')?.remove();
      await refreshMainView(targetSocketId);
    }catch(error){
      alert(error.message);
      if(submit){submit.disabled=false;submit.textContent='Änderungen speichern';}
    }
  }

  injectStyle();
  const observer=new MutationObserver(()=>requestAnimationFrame(enhanceHistory));
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-edit-umwaelzer-entry]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openEditor(button.dataset.editUmwaelzerSocket,button.dataset.editUmwaelzerEntry);
  },true);
  document.addEventListener('submit',event=>{
    const form=event.target.closest('#umwaelzerEditEntryForm');
    if(!form)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    saveEditor(form);
  },true);
})();
