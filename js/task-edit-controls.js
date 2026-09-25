(()=>{
  const STORE_KEY='planungtool_demo_inst_planung_v2';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  let saving=false;

  function readLocal(){
    try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{}}catch{return{}}
  }

  function currentLocalTask(id){
    return (readLocal().tasks||[]).find(t=>String(t.id)===String(id))||null;
  }

  function setModalHeading(kind){
    const title=document.getElementById('modalTitle');
    const eyebrow=document.getElementById('modalEyebrow');
    if(title)title.textContent=kind==='maintenance'?'Wartungsaufgabe bearbeiten':'Arbeitsauftrag bearbeiten';
    if(eyebrow)eyebrow.textContent=kind==='maintenance'?'Wartungstermin':'Arbeitsplanung';
  }

  function toggleDoneComment(form){
    const status=form.querySelector('[name="taskStatusControl"]')?.value||'open';
    const field=form.querySelector('.task-done-comment-field');
    if(field)field.hidden=status!=='done';
  }

  function controlsBelongToCurrentTask(form){
    const entityId=String(form.dataset.entityId||'');
    return Boolean(
      entityId&&
      form.dataset.taskControlsEntityId===entityId&&
      form.querySelector('[name="taskStatusControl"]')&&
      form.querySelector('[name="taskKindControl"]')
    );
  }

  function clearControlMarkers(form){
    form.querySelectorAll('.task-status-field,.task-kind-field,.task-done-comment-field').forEach(el=>el.remove());
    delete form.dataset.taskControlsReady;
    delete form.dataset.taskControlsEntityId;
  }

  function injectControls(){
    const form=document.getElementById('entityForm');
    if(!form)return false;
    if(form.dataset.formType!=='task'||!form.dataset.entityId){
      clearControlMarkers(form);
      return false;
    }
    if(controlsBelongToCurrentTask(form))return true;

    clearControlMarkers(form);
    const grid=form.querySelector('.form-grid');
    if(!grid)return false;
    const task=currentLocalTask(form.dataset.entityId);
    if(!task)return false;

    const statusField=document.createElement('div');
    statusField.className='form-field task-status-field';
    statusField.innerHTML=`<label>Status</label><select name="taskStatusControl"><option value="open" ${task.status==='done'?'':'selected'}>In Arbeit</option><option value="done" ${task.status==='done'?'selected':''}>Erledigt</option></select>`;

    const kindField=document.createElement('div');
    kindField.className='form-field task-kind-field';
    kindField.innerHTML=`<label>Art</label><select name="taskKindControl"><option value="maintenance" ${task.kind==='maintenance'?'selected':''}>Einzelwartung</option><option value="work" ${task.kind==='work'?'selected':''}>Arbeitsauftrag</option></select>`;

    const commentField=document.createElement('div');
    commentField.className='form-field full task-done-comment-field';
    commentField.innerHTML=`<label>Kommentar bei Erledigung</label><textarea name="taskDoneComment" placeholder="Optionaler Kommentar zur Erledigung …"></textarea>`;
    commentField.querySelector('textarea').value=String(task.doneComment||'');

    const sapField=form.querySelector('[name="sapRef"]')?.closest('.form-field');
    if(sapField){
      grid.insertBefore(statusField,sapField);
      grid.insertBefore(kindField,sapField);
      grid.insertBefore(commentField,sapField);
    }else{
      grid.append(statusField,kindField,commentField);
    }

    form.dataset.taskControlsReady='1';
    form.dataset.taskControlsEntityId=String(form.dataset.entityId);
    kindField.querySelector('select').addEventListener('change',e=>setModalHeading(e.target.value));
    statusField.querySelector('select').addEventListener('change',()=>toggleDoneComment(form));
    setModalHeading(task.kind||'work');
    toggleDoneComment(form);
    return true;
  }

  async function fetchCurrent(id){
    const response=await fetch('/api/state',{cache:'no-store'});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.ok)throw new Error(data?.error||'Daten konnten nicht geladen werden.');
    const entry=(data.sync?.entries||[]).find(x=>x.type==='task'&&String(x.id)===String(id)&&!x.deleted);
    const payload=entry?.payload||(data.state?.tasks||[]).find(t=>String(t.id)===String(id));
    if(!entry||!payload)throw new Error('Aufgabe wurde im Backend nicht gefunden.');
    return {entry,payload};
  }

  function updateLocalCache(id,payload){
    const state=readLocal();
    const task=(state.tasks||[]).find(t=>String(t.id)===String(id));
    if(task)Object.assign(task,payload);
    localStorage.setItem(STORE_KEY,JSON.stringify(state));
  }

  async function saveTask(form,event){
    if(saving)return;
    event.preventDefault();
    event.stopImmediatePropagation();

    injectControls();
    const id=String(form.dataset.entityId||'');
    const fd=new FormData(form);
    const dateFrom=String(fd.get('dateFrom')||'');
    const dateTo=String(fd.get('dateTo')||dateFrom);
    if(dateTo<dateFrom){alert('„Datum bis“ darf nicht vor „Datum von“ liegen.');return;}
    const title=String(fd.get('title')||'').trim();
    const assetId=String(fd.get('assetId')||'');
    if(!title||!assetId||!dateFrom){alert('Bitte Titel, Anlage und Datum ausfüllen.');return;}

    const submit=form.querySelector('button[type="submit"]');
    const oldText=submit?.textContent||'Änderungen speichern';
    if(submit){submit.disabled=true;submit.textContent='Speichert …';}
    saving=true;
    try{
      const {entry,payload:current}=await fetchCurrent(id);
      const kind=String(fd.get('taskKindControl')||current.kind||'work');
      const status=String(fd.get('taskStatusControl')||current.status||'open');
      const changedKind=kind!==current.kind;
      const payload={
        ...current,
        title,
        assetId,
        employeeId:String(fd.get('employeeId')||''),
        dateFrom,
        dateTo,
        originalDateFrom:current.originalDateFrom||current.overdueSince||dateFrom,
        originalDateTo:current.originalDateTo||dateTo,
        createdAt:current.createdAt||new Date().toISOString(),
        time:String(fd.get('time')||''),
        priority:String(fd.get('priority')||'normal'),
        kind,
        status,
        notes:String(fd.get('notes')??'').trim(),
        sapRef:String(fd.get('sapRef')||'').trim(),
        decisionNeeded:fd.get('decisionNeeded')==='on',
        blocker:String(fd.get('blocker')||'').trim(),
        sourceKey:current.sourceKey||null,
        sourcePlanId:changedKind?null:(current.sourcePlanId||null)
      };

      if(status==='done'){
        payload.doneAt=current.status==='done'&&current.doneAt?current.doneAt:new Date().toISOString();
        payload.doneComment=String(fd.get('taskDoneComment')??'').trim();
        const originalFrom=current.originalDateFrom||current.overdueSince||dateFrom;
        const originalTo=current.originalDateTo||originalFrom;
        payload.originalDateFrom=originalFrom;
        payload.originalDateTo=originalTo;
        payload.dateFrom=originalFrom;
        payload.dateTo=originalTo;
      }else{
        payload.doneAt=null;
        payload.doneComment='';
      }

      const response=await fetch('/api/mutate',{
        method:'POST',
        cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          action:'upsert',type:'task',id,
          expectedRevision:Number(entry.revision||0),
          payload,
          clientId:localStorage.getItem(CLIENT_KEY)||''
        })
      });
      const result=await response.json().catch(()=>null);
      if(response.status===409||result?.conflict){
        alert('Die Aufgabe wurde zwischenzeitlich an einem anderen PC geändert. Die Seite wird neu geladen.');
        location.reload();
        return;
      }
      if(!response.ok||!result?.ok)throw new Error(result?.error||'Änderung konnte nicht gespeichert werden.');
      updateLocalCache(id,result.current?.payload||payload);
      location.reload();
    }catch(error){
      alert(error?.message||'Änderung konnte nicht gespeichert werden.');
      if(submit){submit.disabled=false;submit.textContent=oldText;}
      saving=false;
    }
  }

  function start(){
    const form=document.getElementById('entityForm');
    if(!form)return;

    const observer=new MutationObserver(()=>queueMicrotask(injectControls));
    observer.observe(form,{childList:true,subtree:true});

    document.addEventListener('click',event=>{
      if(event.target.closest('[data-edit-task]'))queueMicrotask(injectControls);
    });

    form.addEventListener('submit',event=>{
      if(form.dataset.formType==='task'&&form.dataset.entityId){
        injectControls();
        saveTask(form,event);
      }
    },true);

    injectControls();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
