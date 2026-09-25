(()=>{
  const API='/api/open-work';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  const STATE_KEY='planungtool_demo_inst_planung_v2';
  let assets=[];
  let record={revision:0,payload:{schemaVersion:1,items:[],updatedAt:new Date().toISOString()}};
  let filter='open';
  let setupDone=false;
  let planningContext=null;
  let syncingLinks=false;

  const clean=(v='')=>String(v??'').trim();
  const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>globalThis.crypto?.randomUUID?.()||`ow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const items=()=>Array.isArray(record?.payload?.items)?record.payload.items:[];
  const activeItems=()=>items().filter(x=>x.status!=='done');
  const unplannedItems=()=>activeItems().filter(x=>x.status!=='planned');
  const plannedItems=()=>activeItems().filter(x=>x.status==='planned');
  const assetName=id=>assets.find(a=>String(a.id)===String(id))?.name||'Keine Anlage';
  const priorityLabel=p=>({high:'Hoch',normal:'Normal',low:'Niedrig'})[p]||'Normal';

  function readPlannerState(){
    try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}');}catch{return {};}
  }

  function plannerTasks(){
    const state=readPlannerState();
    return Array.isArray(state?.tasks)?state.tasks:[];
  }

  function plannerTaskById(id){
    if(!id)return null;
    return plannerTasks().find(t=>String(t.id)===String(id))||null;
  }

  function formatPlannedRange(item){
    const from=item.plannedDateFrom;
    const to=item.plannedDateTo||from;
    if(!from)return '';
    const fmt=v=>{const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});};
    return from===to?fmt(from):`${fmt(from)} – ${fmt(to)}`;
  }

  function injectStyle(){
    if(document.getElementById('openWorkStyle'))return;
    const style=document.createElement('style');
    style.id='openWorkStyle';
    style.textContent=`
      .open-work-summary{margin-top:16px;width:100%;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 22px;border:1px solid #d5e1eb;border-radius:18px;background:#fff;color:#10283d;text-align:left;cursor:pointer;box-shadow:0 8px 22px rgba(13,48,77,.04)}
      .open-work-summary:hover{border-color:#9bc4e4;background:#fbfdff}.open-work-summary-main{display:flex;align-items:baseline;gap:12px}.open-work-summary strong{font-size:18px}.open-work-summary-count{font-size:28px;font-weight:850;color:#005ca8}.open-work-summary small{color:#6c7f90}.open-work-summary-arrow{font-size:22px;color:#005ca8}.open-work-summary-detail{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}.open-work-summary-chip{font-size:10px;font-weight:800;padding:4px 8px;border-radius:999px;background:#edf4fa;color:#315b7a}.open-work-summary-chip.planned{background:#eaf7ef;color:#177245}
      .open-work-quick{display:grid;grid-template-columns:minmax(260px,2fr) minmax(180px,1fr) 150px minmax(260px,2fr) auto;gap:10px;align-items:end;padding:18px}.open-work-quick label{display:grid;gap:6px}.open-work-quick label span{font-size:11px;font-weight:800;color:#607286;text-transform:uppercase;letter-spacing:.03em}.open-work-quick input,.open-work-quick select{width:100%;height:46px;border:1px solid #cbd9e5;border-radius:12px;background:#fff;padding:0 12px;font:inherit}.open-work-quick .button{height:46px;white-space:nowrap}.open-work-edit-note{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:10px;background:#edf6fd;color:#0b5d96;font-size:12px;font-weight:700}
      .open-work-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:18px 0 12px}.open-work-tabs{display:flex;gap:6px;padding:4px;background:#eaf1f6;border-radius:12px}.open-work-tabs button{border:0;background:transparent;border-radius:9px;padding:9px 14px;font:inherit;font-weight:750;color:#52687b;cursor:pointer}.open-work-tabs button.active{background:#fff;color:#0c2c46;box-shadow:0 2px 8px rgba(14,47,74,.08)}
      .open-work-list{display:grid}.open-work-row{display:grid;grid-template-columns:minmax(220px,2fr) minmax(150px,1fr) 110px minmax(220px,1.5fr) auto;gap:14px;align-items:center;padding:16px 18px;border-bottom:1px solid #e8eef3}.open-work-row:last-child{border-bottom:0}.open-work-title strong{display:block;font-size:14px}.open-work-title small{display:block;margin-top:4px;color:#718395;font-size:11px}.open-work-note{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#536a7d;font-size:12px}.open-work-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}.open-work-priority{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:850;background:#eef3f7}.open-work-priority.high{background:#fff0ef;color:#b42318}.open-work-priority.low{background:#edf8f1;color:#137a45}.open-work-done{opacity:.65}.open-work-done .open-work-title strong{text-decoration:line-through}.open-work-planned{background:linear-gradient(90deg,rgba(25,135,84,.035),transparent 55%)}.open-work-state{display:inline-flex;margin-top:6px;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:850}.open-work-state.planned{background:#eaf7ef;color:#177245}.open-work-plan-button{border-color:#83bfa0!important;background:#f3fbf6!important;color:#176f45!important}.open-work-plan-button:hover{background:#e8f7ee!important}.open-work-planned-meta{display:block;margin-top:4px;color:#177245!important;font-weight:700}
      @media(max-width:1100px){.open-work-quick{grid-template-columns:1fr 1fr}.open-work-quick .button{width:100%}.open-work-row{grid-template-columns:1.5fr 1fr 100px auto}.open-work-note{grid-column:1/4}.open-work-actions{grid-column:4;grid-row:1/3}}
      @media(max-width:720px){.open-work-summary{padding:15px 16px}.open-work-summary-main{display:grid;gap:2px}.open-work-summary-count{font-size:24px}.open-work-quick{grid-template-columns:1fr}.open-work-row{grid-template-columns:1fr;padding:14px}.open-work-note,.open-work-actions{grid-column:auto;grid-row:auto}.open-work-actions{justify-content:flex-start}.open-work-toolbar{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  async function loadAssets(){
    // Der zentrale Store synchronisiert /api/state bereits selbst und schreibt
    // den aktuellen Stand in localStorage. Hier deshalb niemals zusätzlich den
    // kompletten D1-Datenbestand laden – das hatte alle 15 Sekunden unnötig
    // viele D1-Lesevorgänge erzeugt.
    try{
      const state=JSON.parse(localStorage.getItem(STATE_KEY)||'{}');
      assets=Array.isArray(state.assets)?state.assets:[];
    }catch{assets=[];}
  }

  async function loadRecord(){
    const response=await fetch(API,{cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||'Offene Arbeiten konnten nicht geladen werden.');
    record=data.current||{revision:0,payload:{schemaVersion:1,items:[],updatedAt:new Date().toISOString()}};
    return record;
  }

  async function savePayload(base,payload){
    const response=await fetch(API,{method:'PUT',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:Number(base?.revision||0),payload,clientId:localStorage.getItem(CLIENT_KEY)||''})});
    const data=await response.json().catch(()=>null);
    if(response.status===409||data?.conflict){record=data?.current||record;throw new Error('Die offenen Arbeiten wurden gerade an einem anderen PC geändert. Bitte erneut versuchen.');}
    if(!response.ok||!data?.ok)throw new Error(data?.error||data?.detail||'Speichern fehlgeschlagen.');
    record=data.current;
    return record;
  }

  function ensureSection(){
    const content=document.querySelector('main.content');
    if(!content)return null;
    let section=document.getElementById('view-open-work');
    if(!section){section=document.createElement('section');section.className='view';section.id='view-open-work';content.appendChild(section);}
    return section;
  }

  function ensureSummary(){
    const month=document.getElementById('monthPlanner');
    if(!month)return;
    let card=document.getElementById('openWorkWeekSummary');
    if(!card){card=document.createElement('button');card.type='button';card.id='openWorkWeekSummary';card.className='open-work-summary';card.dataset.openWorkLink='true';month.insertAdjacentElement('afterend',card);}
    renderSummary();
  }

  function renderSummary(){
    const card=document.getElementById('openWorkWeekSummary');
    if(!card)return;
    card.innerHTML=`<div><div class="open-work-summary-main"><strong>Offene Arbeiten</strong><span class="open-work-summary-count">${activeItems().length}</span></div><small>Arbeitsvorrat und bereits eingeplante Arbeiten</small><div class="open-work-summary-detail"><span class="open-work-summary-chip">${unplannedItems().length} noch nicht eingeplant</span>${plannedItems().length?`<span class="open-work-summary-chip planned">${plannedItems().length} eingeplant</span>`:''}</div></div><span class="open-work-summary-arrow">→</span>`;
  }

  function assetOptions(selected=''){
    return `<option value="">Keine Anlage</option>${assets.slice().sort((a,b)=>clean(a.name).localeCompare(clean(b.name),'de',{numeric:true})).map(a=>`<option value="${esc(a.id)}" ${String(a.id)===String(selected)?'selected':''}>${esc(a.name)}</option>`).join('')}`;
  }

  function quickForm(edit=null){
    const priorities=['high','normal','low'];
    const pLabels={high:'Hoch',normal:'Normal',low:'Niedrig'};
    return `<form id="openWorkQuickForm" class="panel open-work-quick" data-edit-id="${esc(edit?.id||'')}">${edit?`<div class="open-work-edit-note"><span>Eintrag wird bearbeitet</span><button type="button" class="text-button" data-open-work-cancel>Abbrechen</button></div>`:''}<label><span>Arbeit</span><input name="title" type="text" required value="${esc(edit?.title||'')}" placeholder="z. B. Schutzblech richten"></label><label><span>Anlage</span><select name="assetId">${assetOptions(edit?.assetId||'')}</select></label><label><span>Priorität</span><select name="priority">${priorities.map(p=>`<option value="${p}" ${(edit?.priority||'normal')===p?'selected':''}>${pLabels[p]}</option>`).join('')}</select></label><label><span>Kurznotiz</span><input name="notes" type="text" value="${esc(edit?.notes||'')}" placeholder="optional"></label><button class="button primary" type="submit">${edit?'Speichern':'+ Schnell eintragen'}</button></form>`;
  }

  function row(item){
    const done=item.status==='done';
    const planned=item.status==='planned';
    const plannedTask=planned?plannerTaskById(item.plannedTaskId):null;
    const plannedText=planned?`Eingeplant${formatPlannedRange(item)?` · ${formatPlannedRange(item)}`:''}`:'';
    return `<article class="open-work-row ${done?'open-work-done':''} ${planned?'open-work-planned':''}"><div class="open-work-title"><strong>${esc(item.title)}</strong><small>${done?'Erledigt':planned?plannedText:`Offen · eingetragen ${new Date(item.createdAt||Date.now()).toLocaleDateString('de-DE')}`}</small>${planned?`<span class="open-work-state planned">In Wochenplanung</span>`:''}</div><div><strong>${esc(assetName(item.assetId))}</strong>${planned&&plannedTask?.employeeId?`<small class="open-work-planned-meta">Mitarbeiter zugeordnet</small>`:''}</div><div><span class="open-work-priority ${esc(item.priority||'normal')}">${esc(priorityLabel(item.priority))}</span></div><div class="open-work-note" title="${esc(item.notes||'')}">${esc(item.notes||'–')}</div><div class="open-work-actions">${!done&&!planned?`<button class="mini-button open-work-plan-button" data-open-work-plan="${esc(item.id)}">In Wochenplanung</button><button class="mini-button done" data-open-work-done="${esc(item.id)}">Erledigt</button>`:''}${planned?`<button class="mini-button open-work-plan-button" data-open-work-open-plan="${esc(item.id)}">Wochenplanung öffnen</button>`:''}<button class="mini-button" data-open-work-edit="${esc(item.id)}">Bearbeiten</button><button class="mini-button danger" data-open-work-delete="${esc(item.id)}">Löschen</button></div></article>`;
  }

  function renderView(editId=''){
    const section=ensureSection();
    if(!section)return;
    const edit=items().find(x=>x.id===editId)||null;
    const shown=items().filter(x=>filter==='all'||(filter==='open'?x.status!=='done':x.status==='done')).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    section.innerHTML=`<div class="page-head"><div><p class="eyebrow">Arbeitsvorrat</p><h1>Offene Arbeiten</h1><p class="page-sub">Noch nicht terminierte Arbeiten schnell erfassen und bei Bedarf direkt in die Wochenplanung übernehmen.</p></div><strong>${activeItems().length} offen</strong></div>${quickForm(edit)}<div class="open-work-toolbar"><strong>${shown.length} Einträge</strong><div class="open-work-tabs"><button type="button" data-open-work-filter="open" class="${filter==='open'?'active':''}">Offen</button><button type="button" data-open-work-filter="done" class="${filter==='done'?'active':''}">Erledigt</button><button type="button" data-open-work-filter="all" class="${filter==='all'?'active':''}">Alle</button></div></div><section class="panel"><div class="open-work-list">${shown.length?shown.map(row).join(''):'<div class="empty-state"><div><strong>Keine Einträge.</strong><span>Über den Schnelleintrag oben kannst du sofort etwas hinzufügen.</span></div></div>'}</div></section>`;
  }

  function openView(){
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    ensureSection()?.classList.add('active');
    document.querySelector('[data-open-work-link]')?.classList.add('active');
    document.querySelector('[data-assets-nav-group]')?.classList.remove('open');
    const context=document.getElementById('topContext');if(context)context.textContent='Offene Arbeiten';
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('mobileBackdrop')?.classList.remove('open');
    window.scrollTo({top:0,behavior:'instant'});
    renderView();
  }

  function quickFormHasDraft(){
    const form=document.getElementById('openWorkQuickForm');
    if(!form)return false;
    if(clean(form.dataset.editId))return true;
    if(form.contains(document.activeElement))return true;
    const fd=new FormData(form);
    return Boolean(clean(fd.get('title'))||clean(fd.get('assetId'))||clean(fd.get('notes'))||(clean(fd.get('priority'))&&clean(fd.get('priority'))!=='normal'));
  }

  function findCreatedTask(beforeIds,item,submitted){
    const title=clean(submitted?.title);
    const assetId=clean(submitted?.assetId);
    const dateFrom=clean(submitted?.dateFrom);
    const candidates=plannerTasks().filter(t=>!beforeIds.has(String(t.id))&&t.kind==='work');
    return candidates.find(t=>clean(t.title)===title&&String(t.assetId||'')===assetId&&String(t.dateFrom||'')===dateFrom)
      ||candidates.find(t=>clean(t.title)===clean(item.title)&&String(t.assetId||'')===String(item.assetId||''))
      ||candidates[0]
      ||null;
  }

  async function markPlanned(itemId,task){
    const fresh=await loadRecord();
    const payload=structuredClone(fresh.payload||{schemaVersion:1,items:[]});
    payload.items=Array.isArray(payload.items)?payload.items:[];
    const item=payload.items.find(x=>x.id===itemId);
    if(!item)return;
    const now=new Date().toISOString();
    item.status='planned';
    item.plannedTaskId=task.id;
    item.plannedDateFrom=task.dateFrom||task.date||'';
    item.plannedDateTo=task.dateTo||task.dateFrom||task.date||'';
    item.plannedAt=now;
    item.updatedAt=now;
    payload.updatedAt=now;
    await savePayload(fresh,payload);
    renderSummary();
    if(document.getElementById('view-open-work')?.classList.contains('active'))renderView();
  }

  async function syncPlannedLinks(){
    if(syncingLinks)return;
    syncingLinks=true;
    try{
      const fresh=await loadRecord();
      const payload=structuredClone(fresh.payload||{schemaVersion:1,items:[]});
      payload.items=Array.isArray(payload.items)?payload.items:[];
      const tasks=plannerTasks();
      const byId=new Map(tasks.map(t=>[String(t.id),t]));
      const now=new Date().toISOString();
      let changed=false;
      for(const item of payload.items){
        if(item.status!=='planned'||!item.plannedTaskId)continue;
        const task=byId.get(String(item.plannedTaskId));
        if(!task){
          item.status='open';
          item.plannedTaskId='';
          item.plannedDateFrom='';
          item.plannedDateTo='';
          item.plannedAt='';
          item.updatedAt=now;
          changed=true;
          continue;
        }
        const from=task.dateFrom||task.date||'';
        const to=task.dateTo||from;
        if(item.plannedDateFrom!==from||item.plannedDateTo!==to){item.plannedDateFrom=from;item.plannedDateTo=to;item.updatedAt=now;changed=true;}
        if(task.status==='done'){
          item.status='done';
          item.doneAt=task.doneAt||now;
          item.updatedAt=now;
          changed=true;
        }
      }
      if(changed){payload.updatedAt=now;await savePayload(fresh,payload);}
      renderSummary();
      const viewActive=document.getElementById('view-open-work')?.classList.contains('active');
      if(viewActive&&!quickFormHasDraft())renderView();
    }catch(error){console.warn('Offene Arbeiten Synchronisierung:',error);}finally{syncingLinks=false;}
  }

  function startPlanning(itemId){
    const item=items().find(x=>x.id===itemId);
    if(!item||item.status==='done'||item.status==='planned')return;
    const beforeIds=new Set(plannerTasks().map(t=>String(t.id)));
    planningContext={itemId:item.id,beforeIds};
    const trigger=document.querySelector('[data-action="new-work"]')||document.getElementById('quickAddButton');
    if(!trigger){planningContext=null;alert('Die Wochenplanung konnte nicht geöffnet werden.');return;}
    trigger.click();
    requestAnimationFrame(()=>{
      const form=document.getElementById('entityForm');
      if(!form){planningContext=null;return;}
      const set=(name,value)=>{const el=form.elements.namedItem(name);if(el)el.value=value??'';};
      set('title',item.title||'');
      set('assetId',item.assetId||'');
      set('priority',item.priority||'normal');
      set('notes',item.notes||'');
      const title=document.getElementById('modalTitle');if(title)title.textContent='Offene Arbeit einplanen';
      const eyebrow=document.getElementById('modalEyebrow');if(eyebrow)eyebrow.textContent='Aus offenen Arbeiten';
      form.dataset.openWorkSourceId=item.id;
    });
  }

  function openPlannedItem(itemId){
    const item=items().find(x=>x.id===itemId);
    if(!item)return;
    const task=plannerTaskById(item.plannedTaskId);
    const date=task?.dateFrom||item.plannedDateFrom||'';
    const weekButton=document.querySelector('[data-view="week"]');
    if(weekButton)weekButton.click();
    if(date){
      setTimeout(()=>{
        const jump=document.querySelector(`[data-jump-date="${CSS.escape(date)}"]`);
        if(jump)jump.click();
        const card=task?.id?document.querySelector(`[data-edit-task="${CSS.escape(String(task.id))}"]`):null;
        if(card)card.scrollIntoView({behavior:'smooth',block:'center'});
      },50);
    }
  }

  async function mutateItem(kind,idValue='',form=null){
    try{
      const fresh=await loadRecord();
      const payload=structuredClone(fresh.payload||{schemaVersion:1,items:[]});
      payload.items=Array.isArray(payload.items)?payload.items:[];
      const now=new Date().toISOString();
      if(kind==='save'){
        const fd=new FormData(form);const title=clean(fd.get('title'));
        if(!title)throw new Error('Bitte eine Arbeit eingeben.');
        const editId=clean(form.dataset.editId);const existing=payload.items.find(x=>x.id===editId);
        const value={...(existing||{}),id:existing?.id||uid(),title,assetId:clean(fd.get('assetId')),priority:clean(fd.get('priority'))||'normal',notes:clean(fd.get('notes')),status:existing?.status||'open',createdAt:existing?.createdAt||now,updatedAt:now};
        if(existing)payload.items.splice(payload.items.indexOf(existing),1,value);else payload.items.push(value);
      }
      if(kind==='done'){const item=payload.items.find(x=>x.id===idValue);if(item&&item.status!=='planned'){item.status='done';item.doneAt=now;item.updatedAt=now;}}
      if(kind==='delete')payload.items=payload.items.filter(x=>x.id!==idValue);
      payload.updatedAt=now;
      await savePayload(fresh,payload);
      renderSummary();renderView();
    }catch(error){alert(error.message);renderView();}
  }

  async function setup(){
    if(setupDone)return;
    setupDone=true;
    injectStyle();ensureSection();ensureSummary();
    try{await loadAssets();await syncPlannedLinks();renderSummary();}catch(error){console.warn('Offene Arbeiten:',error);}

    document.addEventListener('click',event=>{
      const link=event.target.closest('[data-open-work-link]');if(link){event.preventDefault();event.stopPropagation();openView();return;}
      const filterBtn=event.target.closest('[data-open-work-filter]');if(filterBtn){filter=filterBtn.dataset.openWorkFilter;renderView();return;}
      const plan=event.target.closest('[data-open-work-plan]');if(plan){startPlanning(plan.dataset.openWorkPlan);return;}
      const openPlan=event.target.closest('[data-open-work-open-plan]');if(openPlan){openPlannedItem(openPlan.dataset.openWorkOpenPlan);return;}
      const edit=event.target.closest('[data-open-work-edit]');if(edit){renderView(edit.dataset.openWorkEdit);return;}
      if(event.target.closest('[data-open-work-cancel]')){renderView();return;}
      const done=event.target.closest('[data-open-work-done]');if(done){mutateItem('done',done.dataset.openWorkDone);return;}
      const del=event.target.closest('[data-open-work-delete]');if(del){const item=items().find(x=>x.id===del.dataset.openWorkDelete);if(item&&confirm(`„${item.title}“ wirklich löschen?`))mutateItem('delete',item.id);}
    },true);

    document.addEventListener('submit',event=>{
      if(event.target?.id==='openWorkQuickForm'){
        event.preventDefault();event.stopImmediatePropagation();mutateItem('save','',event.target);return;
      }
      if(event.target?.id==='entityForm'&&planningContext&&event.target.dataset.openWorkSourceId===planningContext.itemId){
        const item=items().find(x=>x.id===planningContext.itemId);
        const context=planningContext;
        planningContext=null;
        const form=event.target;
        const submitted={title:form.elements.namedItem('title')?.value||'',assetId:form.elements.namedItem('assetId')?.value||'',dateFrom:form.elements.namedItem('dateFrom')?.value||''};
        setTimeout(async()=>{
          try{
            if(!item)return;
            const task=findCreatedTask(context.beforeIds,item,submitted);
            if(task)await markPlanned(item.id,task);
          }catch(error){console.warn('Offene Arbeit konnte nicht verknüpft werden:',error);}
        },80);
      }
    },true);

    document.getElementById('modalBackdrop')?.addEventListener('click',event=>{if(event.target===event.currentTarget)planningContext=null;});
    document.getElementById('closeModal')?.addEventListener('click',()=>{planningContext=null;});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')planningContext=null;});

    if(new URLSearchParams(location.search).get('view')==='openwork'){setTimeout(()=>openView(),0);history.replaceState(null,'','/');}

    setInterval(async()=>{
      if(document.visibilityState!=='visible')return;
      try{
        await loadAssets();
        await syncPlannedLinks();
      }catch{}
    },30000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();