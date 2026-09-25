(()=>{
  const STORE_KEY='planungtool_demo_inst_planung_v2';
  const EXCLUDED_NAMES=new Set();
  const BLOCKING_TYPES=new Set(['vacation','shift','nightshift','sick']);
  const SOURCE_PREFIX='Dienstplan-Quelle ';
  let observer=null;
  let scheduled=false;

  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLocaleLowerCase('de-DE').replace(/\s+/g,' ');
  const state=()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}catch{return {employees:[],absences:[]}}};
  const isSchlosser=e=>norm(e?.dept)==='schlosser';

  function ensureStyle(){
    if(document.getElementById('weekHeadcountStyle'))return;
    const style=document.createElement('style');
    style.id='weekHeadcountStyle';
    style.textContent=`
      #view-week .early-shift-count{background:#edf6fd;color:#0b5d96;border:1px solid #cfe5f6;font-weight:800}
      #view-week .late-shift-count{background:#fff5df;color:#8a5a00;border:1px solid #efd9a5;font-weight:800}
      #view-week .day-tags{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      @media(max-width:720px){#view-week .early-shift-count,#view-week .late-shift-count{font-size:9px;padding:3px 6px}}
    `;
    document.head.appendChild(style);
  }

  function sourceEmployees(s){
    const employees=(Array.isArray(s.employees)?s.employees:[])
      .filter(e=>!EXCLUDED_NAMES.has(norm(e.name)))
      .filter(isSchlosser);
    const absences=Array.isArray(s.absences)?s.absences:[];
    const sourceIds=new Set(
      absences
        .filter(a=>clean(a.notes).startsWith(SOURCE_PREFIX))
        .map(a=>String(a.employeeId))
    );

    const fromSource=employees.filter(e=>sourceIds.has(String(e.id)));
    return fromSource.length?fromSource:employees;
  }

  function countsForDate(dateKey){
    const s=state();
    const employees=sourceEmployees(s);
    const employeeIds=new Set(employees.map(e=>String(e.id)));
    const absences=Array.isArray(s.absences)?s.absences:[];
    const blocked=new Set();
    const late=new Set();

    for(const absence of absences){
      const employeeId=String(absence.employeeId||'');
      if(!employeeIds.has(employeeId)||!absence.start)continue;
      const end=absence.end||absence.start;
      if(!(absence.start<=dateKey&&end>=dateKey))continue;
      if(BLOCKING_TYPES.has(absence.type))blocked.add(employeeId);
      if(absence.type==='shift')late.add(employeeId);
    }

    return {
      early:employees.filter(e=>!blocked.has(String(e.id))).length,
      late:late.size
    };
  }

  function isWeekend(dateKey){
    const [y,m,d]=String(dateKey||'').split('-').map(Number);
    const date=new Date(y,m-1,d,12);
    return date.getDay()===0||date.getDay()===6;
  }

  function patchWeek(){
    ensureStyle();
    const planner=document.getElementById('weekPlanner');
    if(!planner)return;

    planner.querySelectorAll('.day-column').forEach(column=>{
      const date=column.querySelector('[data-add-date]')?.dataset.addDate;
      const tags=column.querySelector('.day-tags');
      if(!date||!tags)return;

      let earlyBadge=tags.querySelector('.early-shift-count');
      let lateBadge=tags.querySelector('.late-shift-count');
      if(isWeekend(date)){
        earlyBadge?.remove();
        lateBadge?.remove();
        return;
      }

      const counts=countsForDate(date);
      if(!earlyBadge){
        earlyBadge=document.createElement('span');
        earlyBadge.className='micro-tag early-shift-count';
        tags.appendChild(earlyBadge);
      }
      if(!lateBadge){
        lateBadge=document.createElement('span');
        lateBadge.className='micro-tag late-shift-count';
        tags.appendChild(lateBadge);
      }

      const earlyText=`Frühschicht: ${counts.early} Schlosser`;
      const lateText=`Spätschicht: ${counts.late} Schlosser`;
      if(earlyBadge.textContent!==earlyText)earlyBadge.textContent=earlyText;
      if(lateBadge.textContent!==lateText)lateBadge.textContent=lateText;
    });
  }

  function schedulePatch(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;patchWeek();});
  }

  function setup(){
    patchWeek();
    const planner=document.getElementById('weekPlanner');
    if(planner){
      observer=new MutationObserver(schedulePatch);
      observer.observe(planner,{childList:true,subtree:true});
    }
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-view="week"],#prevPeriod,#nextPeriod,#todayPeriod,#plannerMode,#plannerTypeFilter,#plannerAssetFilter,#plannerEmployeeFilter'))setTimeout(schedulePatch,0);
    },true);
    document.addEventListener('change',event=>{
      if(event.target.closest('#plannerTypeFilter,#plannerAssetFilter,#plannerEmployeeFilter'))setTimeout(schedulePatch,0);
    },true);
    window.addEventListener('storage',event=>{if(event.key===STORE_KEY)schedulePatch();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
