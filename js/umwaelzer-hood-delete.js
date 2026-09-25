(()=>{
  const API='/api/monitoring/umwaelzer';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  const clean=(v='')=>String(v??'').trim();
  const repairsOf=hood=>Array.isArray(hood?.repairs)?hood.repairs:[];

  function injectStyle(){
    if(document.getElementById('umwaelzerHoodDeleteStyle'))return;
    const style=document.createElement('style');
    style.id='umwaelzerHoodDeleteStyle';
    style.textContent=`
      .hood-v2-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
      .hood-v2-delete{border-color:#efc1bd!important;color:#b42318!important;background:#fff!important}
      .hood-v2-delete:hover{background:#fff3f2!important;border-color:#d92d20!important}
      @media(max-width:760px){.hood-v2-actions{justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function enhanceCards(root=document){
    root.querySelectorAll?.('.hood-v2-card').forEach(card=>{
      const edit=card.querySelector('[data-hood-v2-edit]');
      if(!edit||card.querySelector('[data-hood-v2-delete]'))return;
      let actions=edit.closest('.hood-v2-actions');
      if(!actions){
        actions=document.createElement('div');
        actions.className='hood-v2-actions';
        edit.parentNode.insertBefore(actions,edit);
        actions.appendChild(edit);
      }
      const del=document.createElement('button');
      del.type='button';
      del.className='button secondary hood-v2-delete';
      del.dataset.hoodV2Delete=edit.dataset.hoodV2Edit||'';
      del.textContent='Löschen';
      actions.appendChild(del);
    });
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
    if(response.status===409||data?.conflict)throw new Error('Die Anlagenüberwachung wurde inzwischen an einem anderen PC geändert. Bitte erneut öffnen und wiederholen.');
    if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||`Löschen fehlgeschlagen (${response.status}).`);
    return data.current;
  }

  function currentSocketId(){
    const title=clean(document.querySelector('#monitoringOverlay .dialog-head h2')?.textContent);
    return /^S\s\d\.\d$/.test(title)?title:'';
  }

  function reopenSocket(socketId){
    document.getElementById('monitoringOverlay')?.remove();
    setTimeout(()=>{
      const row=[...document.querySelectorAll('[data-hood-v2-socket]')].find(el=>el.dataset.hoodV2Socket===socketId);
      if(row){row.click();return;}
      document.querySelector('[data-umwaelzer-tab="hoods"]')?.click();
      setTimeout(()=>{
        const refreshed=[...document.querySelectorAll('[data-hood-v2-socket]')].find(el=>el.dataset.hoodV2Socket===socketId);
        refreshed?.click();
      },250);
    },80);
  }

  async function deleteRepair(repairId,button){
    const socketId=currentSocketId();
    if(!socketId)return alert('Sockel konnte nicht bestimmt werden.');
    const card=button.closest('.hood-v2-card');
    const date=clean(card?.querySelector('strong')?.textContent);
    const question=`Schweißung${date?` vom ${date}`:''} wirklich löschen?\n\nBemerkung und angehängte Fotos dieses Eintrags werden ebenfalls gelöscht.`;
    if(!confirm(question))return;

    button.disabled=true;
    button.textContent='Löscht …';
    try{
      const record=await fetchRecord();
      if(!record?.payload)throw new Error('Umwälzer-Daten konnten nicht geladen werden.');
      const payload=structuredClone(record.payload);
      const socket=(payload.sockets||[]).find(s=>s.id===socketId);
      if(!socket)throw new Error('Sockel wurde nicht gefunden.');
      socket.hood=socket.hood||{};
      const before=repairsOf(socket.hood);
      const target=before.find(r=>clean(r.id)===repairId);
      if(!target)throw new Error('Der Eintrag wurde nicht gefunden oder bereits gelöscht.');
      const remaining=before.filter(r=>clean(r.id)!==repairId).map(r=>structuredClone(r));
      socket.hood.repairs=remaining;

      if(remaining.length){
        const dates=remaining.map(r=>clean(r.date)).filter(Boolean).sort();
        socket.hood.welded=true;
        socket.hood.date=dates.at(-1)||socket.hood.date||'';
      }else{
        socket.hood.welded=false;
        socket.hood.date='';
      }
      payload.updatedAt=new Date().toISOString();

      const saved=await saveRecord(record,payload);
      const savedSocket=(saved?.payload?.sockets||[]).find(s=>s.id===socketId);
      if(repairsOf(savedSocket?.hood).some(r=>clean(r.id)===repairId))throw new Error('Der Server hat das Löschen nicht bestätigt.');
      reopenSocket(socketId);
    }catch(error){
      alert(error.message);
      button.disabled=false;
      button.textContent='Löschen';
    }
  }

  injectStyle();
  enhanceCards();
  new MutationObserver(mutations=>{
    if(mutations.some(m=>m.addedNodes.length))requestAnimationFrame(()=>enhanceCards());
  }).observe(document.body,{childList:true,subtree:true});

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-hood-v2-delete]');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    deleteRepair(clean(button.dataset.hoodV2Delete),button);
  },true);
})();
