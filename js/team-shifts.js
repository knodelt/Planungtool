(()=>{
  const STORE_KEY='planungtool_demo_inst_planung_v2';
  const CLIENT_KEY='planungtool_demo_inst_planung_v2_client';
  const EXCLUDED_NAMES=new Set();
  const TYPE_LABELS={vacation:'Urlaub',sick:'Krank',shift:'Spätschicht',nightshift:'Nachtschicht'};
  const TEAM_SCRIPT_VERSION='20260917-atomic2';
  let cleanupRunning=false;

  const clean=value=>String(value??'').trim();
  const norm=value=>clean(value).toLocaleLowerCase('de-DE');
  const isExcludedName=value=>EXCLUDED_NAMES.has(norm(value));

  function localState(){
    try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}');}catch{return {};}
  }

  function saveLocal(state){
    try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch{}
  }

  function label(type){return TYPE_LABELS[type]||'Abwesenheit';}

  function patchTeamNav(){
    const button=document.querySelector('.nav-item[data-view="team"]');
    const text=button?.querySelector('span:last-child');
    if(text&&text.textContent!=='Teamkalender')text.textContent='Teamkalender';
  }

  function patchForm(){
    const form=document.getElementById('entityForm');
    if(!form||form.dataset.formType!=='absence')return;
    const select=form.querySelector('select[name="type"]');
    if(!select)return;

    const shift=[...select.options].find(o=>o.value==='shift');
    if(shift)shift.textContent='Spätschicht';

    let night=[...select.options].find(o=>o.value==='nightshift');
    if(!night){
      night=document.createElement('option');
      night.value='nightshift';
      night.textContent='Nachtschicht';
      select.appendChild(night);
    }

    const id=form.dataset.entityId;
    if(id){
      const absence=(localState().absences||[]).find(a=>String(a.id)===String(id));
      if(absence?.type==='nightshift')select.value='nightshift';

      const footer=form.querySelector('.form-footer');
      if(footer&&!footer.querySelector('[data-modal-delete-absence]')){
        const del=document.createElement('button');
        del.type='button';
        del.className='button secondary';
        del.dataset.modalDeleteAbsence=id;
        del.textContent='Löschen';
        del.style.marginRight='auto';
        del.style.color='#b42318';
        del.style.borderColor='#efb5b0';
        footer.prepend(del);
      }
    }
  }

  function patchWeekCards(){
    document.querySelectorAll('.absence-card.shift').forEach(el=>{
      el.textContent=el.textContent.replace(/\s·\s(?:Schicht|Schichtabweichung|Abwesenheit)\s*$/,' · Spätschicht');
    });
    document.querySelectorAll('.absence-card.nightshift').forEach(el=>{
      el.textContent=el.textContent.replace(/\s·\s(?:Schicht|Schichtabweichung|Abwesenheit)\s*$/,' · Nachtschicht');
    });
  }

  function patchTeamView(){
    const state=localState();
    const employees=Array.isArray(state.employees)?state.employees:[];
    const absences=Array.isArray(state.absences)?state.absences:[];
    const byEmployee=new Map(employees.map(e=>[String(e.id),e]));

    document.querySelectorAll('#employeeGrid .employee-card').forEach(card=>{
      const name=clean(card.querySelector('.employee-name strong')?.textContent);
      if(isExcludedName(name)){card.remove();return;}
    });

    document.querySelectorAll('#absenceList .entity-card').forEach(card=>{
      const edit=card.querySelector('[data-edit-absence]');
      if(!edit)return;
      const absence=absences.find(a=>String(a.id)===String(edit.dataset.editAbsence));
      if(!absence)return;
      const emp=byEmployee.get(String(absence.employeeId));
      if(isExcludedName(emp?.name)){card.remove();return;}
      const h3=card.querySelector('h3');
      if(h3&&emp)h3.textContent=`${emp.name} · ${label(absence.type)}`;
    });

    const subtitle=document.querySelector('#view-team .page-sub');
    if(subtitle)subtitle.textContent='Urlaub und Spätschichten werden aus der Excel-Quellliste „Instandhaltung Demo“ synchronisiert. Krankheit und Nachtschicht können weiterhin manuell gepflegt werden.';
  }

  function patchDashboard(){
    const state=localState();
    const employees=Array.isArray(state.employees)?state.employees:[];
    const absences=Array.isArray(state.absences)?state.absences:[];
    const today=new Date().toISOString().slice(0,10);
    const current=absences.filter(a=>a.start<=today&&a.end>=today).filter(a=>{
      const emp=employees.find(e=>String(e.id)===String(a.employeeId));
      return !isExcludedName(emp?.name);
    });
    const card=[...document.querySelectorAll('#dashboardKpis .kpi-card')].find(c=>clean(c.querySelector('.kpi-label')?.textContent)==='Personal heute');
    if(!card)return;
    const value=card.querySelector('.kpi-value');
    const foot=card.querySelector('.kpi-foot');
    if(value)value.textContent=String(current.length);
    if(foot)foot.textContent=current.length?current.slice(0,2).map(a=>{
      const emp=employees.find(e=>String(e.id)===String(a.employeeId));
      return `${emp?.name||'Nicht zugeordnet'}: ${label(a.type)}`;
    }).join(' · '):'Keine Abwesenheit eingetragen';
  }

  function patchEmployeeOptions(){
    document.querySelectorAll('select[name="employeeId"] option,#plannerEmployeeFilter option').forEach(option=>{
      if(isExcludedName(option.textContent))option.remove();
    });
  }

  function patchAll(){
    patchTeamNav();
    patchForm();
    patchWeekCards();
    patchTeamView();
    patchDashboard();
    patchEmployeeOptions();
  }

  function pruneLocal(employeeId){
    const state=localState();
    state.employees=(state.employees||[]).filter(e=>String(e.id)!==String(employeeId)&&!isExcludedName(e.name));
    state.absences=(state.absences||[]).filter(a=>String(a.employeeId)!==String(employeeId));
    state.tasks=(state.tasks||[]).map(t=>String(t.employeeId)===String(employeeId)?{...t,employeeId:''}:t);
    state.maintenancePlans=(state.maintenancePlans||[]).map(p=>String(p.employeeId)===String(employeeId)?{...p,employeeId:''}:p);
    saveLocal(state);
  }

  async function mutate(type,id,action,payload,revision){
    const response=await fetch('/api/mutate',{
      method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type,id,action,payload:action==='upsert'?payload:undefined,expectedRevision:Number(revision||0),clientId:localStorage.getItem(CLIENT_KEY)||''})
    });
    if(!response.ok&&response.status!==409)throw new Error(`Mutation ${type}:${id} fehlgeschlagen`);
    return response.json().catch(()=>null);
  }

  async function cleanupExcluded(){
    if(cleanupRunning||sessionStorage.getItem('planungtool_demo_excluded_team_cleanup_v2')==='1')return;
    cleanupRunning=true;
    try{
      const response=await fetch('/api/state',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok||!data?.ok)return;

      const targets=(data.state?.employees||[]).filter(e=>isExcludedName(e.name));
      if(!targets.length){sessionStorage.setItem('planungtool_demo_excluded_team_cleanup_v2','1');patchAll();return;}

      const entries=data.sync?.entries||[];
      const entry=(type,id)=>entries.find(e=>e.type===type&&String(e.id)===String(id)&&!e.deleted);

      for(const target of targets){
        for(const absence of (data.state?.absences||[]).filter(a=>String(a.employeeId)===String(target.id))){
          const base=entry('absence',absence.id);
          if(base)await mutate('absence',absence.id,'delete',null,base.revision);
        }
        for(const task of (data.state?.tasks||[]).filter(t=>String(t.employeeId)===String(target.id))){
          const base=entry('task',task.id);
          if(base)await mutate('task',task.id,'upsert',{...task,employeeId:''},base.revision);
        }
        for(const plan of (data.state?.maintenancePlans||[]).filter(p=>String(p.employeeId)===String(target.id))){
          const base=entry('maintenance_plan',plan.id);
          if(base)await mutate('maintenance_plan',plan.id,'upsert',{...plan,employeeId:''},base.revision);
        }
        const employeeEntry=entry('employee',target.id);
        if(employeeEntry)await mutate('employee',target.id,'delete',null,employeeEntry.revision);
        pruneLocal(target.id);
      }

      sessionStorage.setItem('planungtool_demo_excluded_team_cleanup_v2','1');
      setTimeout(()=>location.reload(),250);
    }catch(error){console.warn('Team-Bereinigung:',error);}finally{cleanupRunning=false;}
  }

  function loadScript(src,id){
    if(document.getElementById(id))return;
    const s=document.createElement('script');
    s.src=`${src}${src.includes('?')?'&':'?'}v=${TEAM_SCRIPT_VERSION}`;
    s.id=id;
    s.defer=true;
    document.head.appendChild(s);
  }

  function setup(){
    loadScript('js/team-source-excel.js','teamSourceExcelScript');
    loadScript('js/team-calendar.js','teamCalendarScript');
    loadScript('js/week-headcount.js','weekHeadcountScript');
    loadScript('js/team-layout.js','teamLayoutScript');
    patchAll();
    setTimeout(cleanupExcluded,1200);
    document.addEventListener('click',event=>{
      const del=event.target.closest('[data-modal-delete-absence]');
      if(del){
        const absenceId=del.dataset.modalDeleteAbsence;
        if(typeof window.deleteAbsence==='function'){
          window.deleteAbsence(absenceId);
          setTimeout(()=>{
            const stillExists=(localState().absences||[]).some(a=>String(a.id)===String(absenceId));
            if(!stillExists&&typeof window.closeModal==='function')window.closeModal();
          },0);
        }
        return;
      }
      setTimeout(patchAll,0);
    },true);
    document.addEventListener('change',()=>setTimeout(patchAll,0),true);
    document.addEventListener('submit',()=>setTimeout(patchAll,0),true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();