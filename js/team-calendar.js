(()=>{
  const STORE_KEY='planungtool_demo_inst_planung_v2';
  const UNLOCK_KEY='planungtool_demo_team_calendar_unlocked_until';
  const TEAM_PASSWORD='demo';
  const UNLOCK_MS=5*60*1000;
  let relockTimer=null;

  const clean=v=>String(v??'').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
  const startOfWeek=d=>{const x=new Date(d);x.setHours(12,0,0,0);const day=x.getDay()||7;x.setDate(x.getDate()-day+1);return x};
  const endOfWeek=d=>add(startOfWeek(d),6);
  const short=d=>`${pad(d.getDate())}.${pad(d.getMonth()+1)}.`;
  const weekday=d=>['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][d.getDay()];
  const isoWeek=d=>{const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));x.setUTCDate(x.getUTCDate()+4-(x.getUTCDay()||7));const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y)/86400000)+1)/7)};
  const localState=()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}catch{return {employees:[],absences:[]}}};
  const label=t=>({vacation:'Urlaub',sick:'Krank',shift:'Spätschicht',nightshift:'Nachtschicht'})[t]||'Abwesenheit';

  let cursor=startOfWeek(new Date());
  let monthCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1,12);
  let mode='week';
  let remoteState=null;
  let remoteLoading=false;

  async function refreshRemote(){
    if(remoteLoading)return;
    remoteLoading=true;
    try{
      const response=await fetch('/api/state',{cache:'no-store'});
      const data=await response.json().catch(()=>null);
      if(response.ok&&data?.ok&&data.state){
        remoteState=data.state;
        if(document.getElementById('teamCalendarWrap'))render();
      }
    }catch(error){console.warn('Teamkalender: zentrale Daten konnten nicht geladen werden.',error)}
    finally{remoteLoading=false;}
  }

  function style(){
    if(document.getElementById('teamCalendarStyle'))return;
    const s=document.createElement('style');
    s.id='teamCalendarStyle';
    s.textContent=`
      #view-week .absence-card{display:none!important}
      #view-week .page-sub{max-width:780px}
      .team-calendar-wrap{margin-bottom:22px}
      .team-calendar-toolbar{margin-bottom:10px}
      .team-calendar-headline{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 0 12px}
      .team-calendar-headline h2{margin:0;font-size:24px}.team-calendar-headline p{margin:4px 0 0;color:#607286}
      .team-cal-filters{display:flex;gap:10px;flex-wrap:wrap}.team-cal-filters select{min-width:170px}
      .team-calendar .day-body{min-height:360px}
      .team-calendar .absence-card{width:100%;text-align:center}
      .team-calendar .absence-card.vacation{background:#eef9f3;color:#176b43}
      .team-calendar .absence-card.shift{background:#fff5df;color:#8a5a00}
      .team-calendar .absence-card.nightshift{background:#eef0ff;color:#3843a6}
      .team-calendar .absence-card.sick{background:#fff0ef;color:#a72b20}
      .team-calendar .month-event.vacation{background:#eef9f3;color:#176b43}
      .team-calendar .month-event.shift{background:#fff5df;color:#8a5a00}
      .team-calendar .month-event.nightshift{background:#eef0ff;color:#3843a6}
      .team-calendar .month-event.sick{background:#fff0ef;color:#a72b20}
      .team-calendar-empty{font-size:12px;color:#8a99a8;text-align:center;padding:18px 6px}
      #view-team.team-view-locked{position:relative}
      #view-team.team-view-locked .page-head,#view-team.team-view-locked .team-calendar-wrap,#view-team.team-view-locked .team-layout{filter:grayscale(1) blur(3px);opacity:.18;pointer-events:none;user-select:none}
      .team-calendar-lock-zone{position:static}
      .team-calendar-lock-overlay{display:none;position:absolute;inset:0;z-index:200;align-items:flex-start;justify-content:center;padding-top:110px;border-radius:18px;background:rgba(230,233,236,.58);backdrop-filter:blur(3px);cursor:pointer;pointer-events:auto}
      #view-team.team-view-locked > .team-calendar-lock-overlay{display:flex}
      .team-calendar-lock-card{min-width:260px;max-width:360px;padding:18px 20px;border:1px solid rgba(173,187,199,.75);border-radius:16px;background:rgba(255,255,255,.88);box-shadow:0 12px 30px rgba(33,51,68,.12);text-align:center}
      .team-calendar-lock-card strong{display:block;font-size:15px}
      .team-calendar-lock-card span{display:block;margin-top:5px;color:#607286;font-size:12px}
      .team-calendar-password-box{display:none;margin-top:12px;gap:8px}
      .team-calendar-password-box.open{display:flex}
      .team-calendar-password-box input{flex:1;min-width:0}
      .team-calendar-password-error{display:none;margin-top:8px!important;color:#b42318!important;font-weight:700}
      .team-calendar-password-error.show{display:block}
      @media(max-width:900px){.team-calendar-toolbar{grid-template-columns:1fr}.team-cal-filters{width:100%}.team-cal-filters select{flex:1;min-width:140px}}
    `;
    document.head.appendChild(s);
  }

  function ensure(){
    style();
    const view=document.getElementById('view-team');
    if(!view)return;
    const weekSub=document.querySelector('#view-week .page-sub');
    if(weekSub)weekSub.textContent='Wartungen, Arbeiten, Feiertage und Ferien in einer Ansicht. Urlaub und Schichten findest du im Teamkalender.';
    if(document.getElementById('teamCalendarWrap')){
      if(!document.getElementById('teamCalendarLockOverlay')){
        const overlay=document.createElement('div');
        overlay.id='teamCalendarLockOverlay';
        overlay.className='team-calendar-lock-overlay';
        overlay.innerHTML=`<div class="team-calendar-lock-card"><strong>Teamkalender geschützt</strong><span>Zum Freischalten hier klicken. Demo-Passwort: demo.</span><div id="teamCalendarPasswordBox" class="team-calendar-password-box"><input id="teamCalendarPassword" type="password" autocomplete="off" placeholder="Passwort"><button id="teamCalendarUnlockButton" class="button primary small" type="button">Freischalten</button></div><span id="teamCalendarPasswordError" class="team-calendar-password-error">Passwort ist falsch.</span></div>`;
        view.appendChild(overlay);
      }
      bindLock();applyLockState();render();refreshRemote();return;
    }
    const pageHead=view.querySelector('.page-head');
    const wrap=document.createElement('section');
    wrap.id='teamCalendarWrap';
    wrap.className='team-calendar-wrap';
    wrap.innerHTML=`
      <div class="team-calendar-headline"><div><p class="eyebrow">Personalplanung</p><h2>Teamkalender</h2><p>Urlaub, Krankheit sowie Spät- und Nachtschichten.</p></div></div>
      <div id="teamCalendarLockZone" class="team-calendar-lock-zone">
        <div class="team-calendar-locked-content">
          <div class="planner-toolbar panel-flat team-calendar-toolbar">
            <div class="segmented" id="teamCalendarMode"><button class="active" data-team-mode="week">Woche</button><button data-team-mode="month">Monat</button></div>
            <div class="week-nav"><button class="icon-button" id="teamPrev" aria-label="Zurück">←</button><button class="button secondary small" id="teamToday">Heute</button><button class="icon-button" id="teamNext" aria-label="Weiter">→</button><strong id="teamPeriod"></strong></div>
            <div class="team-cal-filters"><select id="teamEmployeeFilter"><option value="all">Alle Mitarbeiter</option></select><select id="teamTypeFilter"><option value="all">Alle Einträge</option><option value="vacation">Urlaub</option><option value="shift">Spätschicht</option><option value="nightshift">Nachtschicht</option><option value="sick">Krank</option></select></div>
          </div>
          <div id="teamWeekCalendar" class="week-planner team-calendar"></div>
          <div id="teamMonthCalendar" class="month-planner team-calendar hidden"></div>
        </div>
      </div>`;
    pageHead?.insertAdjacentElement('afterend',wrap);
    let overlay=document.getElementById('teamCalendarLockOverlay');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='teamCalendarLockOverlay';
      overlay.className='team-calendar-lock-overlay';
      overlay.innerHTML=`
        <div class="team-calendar-lock-card">
          <strong>Teamkalender geschützt</strong>
          <span>Zum Freischalten hier klicken. Demo-Passwort: demo.</span>
          <div id="teamCalendarPasswordBox" class="team-calendar-password-box">
            <input id="teamCalendarPassword" type="password" autocomplete="off" placeholder="Passwort">
            <button id="teamCalendarUnlockButton" class="button primary small" type="button">Freischalten</button>
          </div>
          <span id="teamCalendarPasswordError" class="team-calendar-password-error">Passwort ist falsch.</span>
        </div>`;
      view.appendChild(overlay);
    }
    bind();
    bindLock();
    applyLockState();
    render();
    refreshRemote();
  }

  function unlocked(){
    const until=Number(sessionStorage.getItem(UNLOCK_KEY)||0);
    return Number.isFinite(until)&&until>Date.now();
  }

  function scheduleRelock(){
    clearTimeout(relockTimer);
    const until=Number(sessionStorage.getItem(UNLOCK_KEY)||0);
    const remaining=until-Date.now();
    if(remaining<=0){
      sessionStorage.removeItem(UNLOCK_KEY);
      applyLockState();
      return;
    }
    relockTimer=setTimeout(()=>{
      sessionStorage.removeItem(UNLOCK_KEY);
      applyLockState();
    },remaining+50);
  }

  function applyLockState(){
    const zone=document.getElementById('teamCalendarLockZone');
    const view=document.getElementById('view-team');
    if(!zone||!view)return;
    view.classList.toggle('team-view-locked',!unlocked());
    const box=document.getElementById('teamCalendarPasswordBox');
    const error=document.getElementById('teamCalendarPasswordError');
    if(unlocked()){
      box?.classList.remove('open');error?.classList.remove('show');scheduleRelock();
    }else{
      sessionStorage.removeItem(UNLOCK_KEY);
      clearTimeout(relockTimer);
    }
  }

  function tryUnlock(){
    const input=document.getElementById('teamCalendarPassword');
    const error=document.getElementById('teamCalendarPasswordError');
    if(!input)return;
    if(input.value===TEAM_PASSWORD){
      sessionStorage.setItem(UNLOCK_KEY,String(Date.now()+UNLOCK_MS));
      input.value='';
      error?.classList.remove('show');
      applyLockState();
      return;
    }
    error?.classList.add('show');
    input.select();
  }

  function bindLock(){
    const overlay=document.getElementById('teamCalendarLockOverlay');
    const box=document.getElementById('teamCalendarPasswordBox');
    const input=document.getElementById('teamCalendarPassword');
    const button=document.getElementById('teamCalendarUnlockButton');
    if(!overlay||overlay.dataset.bound==='1')return;
    overlay.dataset.bound='1';
    overlay.addEventListener('click',e=>{
      e.stopPropagation();
      box?.classList.add('open');
      errorReset();
      setTimeout(()=>input?.focus(),0);
    });
    box?.addEventListener('click',e=>e.stopPropagation());
    button?.addEventListener('click',e=>{e.stopPropagation();tryUnlock()});
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();tryUnlock()}});
  }

  function errorReset(){document.getElementById('teamCalendarPasswordError')?.classList.remove('show')}

  function bind(){
    document.getElementById('teamPrev')?.addEventListener('click',()=>{if(mode==='month')monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()-1,1,12);else cursor=add(cursor,-7);render()});
    document.getElementById('teamNext')?.addEventListener('click',()=>{if(mode==='month')monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,1,12);else cursor=add(cursor,7);render()});
    document.getElementById('teamToday')?.addEventListener('click',()=>{cursor=startOfWeek(new Date());monthCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1,12);render()});
    document.querySelectorAll('[data-team-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.teamMode;render()}));
    document.getElementById('teamEmployeeFilter')?.addEventListener('change',render);
    document.getElementById('teamTypeFilter')?.addEventListener('change',render);
    document.addEventListener('click',e=>{
      const addBtn=e.target.closest('[data-team-add-date]');
      if(!addBtn)return;
      document.querySelector('[data-action="new-absence"]')?.click();
      setTimeout(()=>{const f=document.getElementById('entityForm');if(!f||f.dataset.formType!=='absence')return;const a=f.elements.namedItem('start'),b=f.elements.namedItem('end');if(a)a.value=addBtn.dataset.teamAddDate;if(b)b.value=addBtn.dataset.teamAddDate;},50);
    },true);
  }

  function data(){
    const local=localState();
    const source=(remoteState&&((remoteState.employees||[]).length||(remoteState.absences||[]).length))?remoteState:local;
    const employees=Array.isArray(source.employees)?source.employees:[];
    const absences=Array.isArray(source.absences)?source.absences:[];
    return {employees,absences,byId:new Map(employees.map(e=>[String(e.id),e]))};
  }

  function refreshEmployees(employees){
    const sel=document.getElementById('teamEmployeeFilter');if(!sel)return;
    const old=sel.value||'all';
    sel.innerHTML=`<option value="all">Alle Mitarbeiter</option>${employees.slice().sort((a,b)=>clean(a.name).localeCompare(clean(b.name),'de')).map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}`;
    if([...sel.options].some(o=>o.value===old))sel.value=old;
  }

  function filtered(absences){
    const emp=document.getElementById('teamEmployeeFilter')?.value||'all';
    const type=document.getElementById('teamTypeFilter')?.value||'all';
    return absences.filter(a=>(emp==='all'||String(a.employeeId)===emp)&&(type==='all'||a.type===type));
  }

  function forDay(absences,k){return absences.filter(a=>a.start&&a.start<=k&&(a.end||a.start)>=k)};

  function absenceCard(a,byId){
    const n=byId.get(String(a.employeeId))?.name||'Nicht zugeordnet';
    return `<button class="absence-card ${esc(a.type)}" data-edit-absence="${esc(a.id)}">${esc(n)} · ${esc(label(a.type))}</button>`;
  }

  function renderWeek(absences,byId){
    const start=startOfWeek(cursor),end=endOfWeek(cursor);
    document.getElementById('teamPeriod').textContent=`KW ${isoWeek(start)} · ${short(start)}–${short(end)}`;
    document.getElementById('teamWeekCalendar').innerHTML=Array.from({length:7},(_,i)=>add(start,i)).map(d=>{
      const k=key(d),entries=forDay(absences,k);
      return `<section class="day-column ${[0,6].includes(d.getDay())?'weekend':''} ${k===key(new Date())?'today':''}"><header class="day-head"><div class="day-name"><strong>${esc(weekday(d).toUpperCase())}</strong><span class="day-number">${d.getDate()}</span></div><div class="day-tags"></div></header><div class="day-body">${entries.map(a=>absenceCard(a,byId)).join('')}${entries.length?'':'<div class="team-calendar-empty">Keine Einträge</div>'}<button class="add-day" data-team-add-date="${k}">+ Eintrag an diesem Tag</button></div></section>`;
    }).join('');
  }

  function renderMonth(absences,byId){
    const year=monthCursor.getFullYear(),month=monthCursor.getMonth(),first=new Date(year,month,1,12),gridStart=startOfWeek(first),cells=Array.from({length:42},(_,i)=>add(gridStart,i));
    document.getElementById('teamPeriod').textContent=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(monthCursor);
    document.getElementById('teamMonthCalendar').innerHTML=`<div class="month-weekdays">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div>${x}</div>`).join('')}</div><div class="month-grid">${cells.map(d=>{const k=key(d),entries=forDay(absences,k);return `<div class="month-cell ${d.getMonth()!==month?'outside':''} ${k===key(new Date())?'today':''}"><div class="month-date"><span>${d.getDate()}</span></div><div class="month-events">${entries.slice(0,4).map(a=>{const n=byId.get(String(a.employeeId))?.name||'Nicht zugeordnet';return `<button class="month-event ${esc(a.type)}" data-edit-absence="${esc(a.id)}">${esc(n)} · ${esc(label(a.type))}</button>`}).join('')}${entries.length>4?`<span class="month-more">+ ${entries.length-4} weitere</span>`:''}</div></div>`}).join('')}</div>`;
  }

  function render(){
    const wrap=document.getElementById('teamCalendarWrap');if(!wrap)return;
    const {employees,absences,byId}=data();refreshEmployees(employees);const shown=filtered(absences);
    document.querySelectorAll('[data-team-mode]').forEach(b=>b.classList.toggle('active',b.dataset.teamMode===mode));
    document.getElementById('teamWeekCalendar')?.classList.toggle('hidden',mode!=='week');
    document.getElementById('teamMonthCalendar')?.classList.toggle('hidden',mode!=='month');
    if(mode==='week')renderWeek(shown,byId);else renderMonth(shown,byId);
  }

  function schedule(){
    setTimeout(()=>{ensure();render();},90);
    setTimeout(refreshRemote,220);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
  document.addEventListener('click',e=>{if(e.target.closest('[data-view="team"],[data-view="week"],[data-edit-absence],[data-action="new-absence"]'))schedule()},true);
  document.addEventListener('submit',schedule,true);
  document.addEventListener('change',e=>{if(e.target.closest('#entityForm'))schedule()},true);
  window.addEventListener('storage',e=>{if(e.key===STORE_KEY){remoteState=null;schedule();}});
})();