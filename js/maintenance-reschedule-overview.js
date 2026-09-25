(()=>{
  const STORE_KEY='planungtool_demo_inst_planung_v2';

  function readState(){
    try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{}}catch{return{}}
  }

  function esc(value=''){
    return String(value).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  }

  function parseDate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;
    const [y,m,d]=value.split('-').map(Number);
    return new Date(y,m-1,d,12);
  }

  function isoWeek(date){
    if(!date)return '';
    const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
    const day=d.getUTCDay()||7;
    d.setUTCDate(d.getUTCDate()+4-day);
    const start=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d-start)/86400000)+1)/7);
  }

  function shortDate(value){
    const d=parseDate(value);
    return d?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit'}).format(d):String(value||'');
  }

  function originalDate(task){
    const key=String(task?.sourceKey||'');
    const match=key.match(/_(\d{4}-\d{2}-\d{2})$/);
    return task?.scheduledDate||match?.[1]||'';
  }

  function currentDate(task){
    return task?.dateFrom||task?.date||'';
  }

  function assetName(state,id){
    return (state.assets||[]).find(a=>a.id===id)?.name||'Keine Anlage';
  }

  function shiftedTasks(state){
    return (state.tasks||[])
      .filter(t=>t.kind==='maintenance'&&t.sourcePlanId)
      .map(t=>({...t,_originalDate:originalDate(t),_currentDate:currentDate(t)}))
      .filter(t=>t._originalDate&&t._currentDate&&t._originalDate!==t._currentDate)
      .sort((a,b)=>{
        const sa=a.status==='done'?1:0;
        const sb=b.status==='done'?1:0;
        return sa-sb||String(a._currentDate).localeCompare(String(b._currentDate));
      });
  }

  function ensurePanel(){
    const view=document.querySelector('#view-maintenance');
    if(!view)return null;
    let panel=view.querySelector('#maintenanceReschedulePanel');
    if(panel)return panel;
    panel=document.createElement('section');
    panel.id='maintenanceReschedulePanel';
    panel.className='panel maintenance-reschedule-panel';
    const split=view.querySelector('.split-layout');
    if(split)split.insertAdjacentElement('afterend',panel);
    else view.appendChild(panel);
    return panel;
  }

  function render(){
    const panel=ensurePanel();
    if(!panel)return;
    const state=readState();
    const items=shiftedTasks(state);
    panel.innerHTML=`
      <div class="panel-head maintenance-reschedule-head">
        <div><p class="eyebrow">Terminabweichungen</p><h2>Verschobene Wartungen</h2></div>
        <span class="panel-meta">${items.length} ${items.length===1?'Verschiebung':'Verschiebungen'}</span>
      </div>
      <div class="maintenance-reschedule-list">
        ${items.length?items.map(t=>{
          const oldDate=parseDate(t._originalDate);
          const newDate=parseDate(t._currentDate);
          const oldKw=isoWeek(oldDate);
          const newKw=isoWeek(newDate);
          const status=t.status==='done'?'Erledigt':'Offen';
          return `<button class="maintenance-reschedule-row" data-edit-task="${esc(t.id)}">
            <div class="maintenance-reschedule-main">
              <strong>${esc(t.title||'Wartung')} · ${esc(assetName(state,t.assetId))}</strong>
              <span>von <b>KW ${oldKw} · ${esc(shortDate(t._originalDate))}</b> auf <b>KW ${newKw} · ${esc(shortDate(t._currentDate))}</b> verschoben</span>
            </div>
            <span class="maintenance-reschedule-status ${t.status==='done'?'done':'open'}">${status}</span>
          </button>`;
        }).join(''):`<div class="maintenance-reschedule-empty"><strong>Keine Wartung verschoben.</strong><span>Manuell geänderte Regeltermine erscheinen automatisch hier.</span></div>`}
      </div>`;
  }

  let queued=false;
  function queueRender(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;render()});
  }

  function start(){
    const view=document.querySelector('#view-maintenance');
    if(!view)return;
    render();
    const observer=new MutationObserver(records=>{
      const relevant=records.some(record=>{
        const target=record.target;
        return !(target instanceof Element&&target.closest('#maintenanceReschedulePanel'));
      });
      if(relevant)queueRender();
    });
    observer.observe(view,{childList:true,subtree:true});
    window.addEventListener('storage',e=>{if(e.key===STORE_KEY)queueRender()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
