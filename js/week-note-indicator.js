(()=>{
  const STORE_KEY='planungtool_demo_inst_planung_v2';
  let tooltip=null;
  let activeCard=null;

  function readState(){
    try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{}}catch{return{}}
  }

  function noteFor(task,state){
    const own=String(task?.notes||'').trim();
    if(own)return own;
    if(task?.kind==='maintenance'&&task?.sourcePlanId){
      const plan=(state.maintenancePlans||[]).find(p=>p.id===task.sourcePlanId);
      return String(plan?.notes||'').trim();
    }
    return '';
  }

  function additionalInfoFor(task,state){
    const note=noteFor(task,state);
    const doneComment=String(task?.doneComment||'').trim();
    if(note&&doneComment)return `Notiz: ${note}\n\nErledigt-Kommentar: ${doneComment}`;
    return note||doneComment||'';
  }

  function ensureTooltip(){
    if(tooltip)return tooltip;
    tooltip=document.createElement('div');
    tooltip.className='plan-note-tooltip';
    tooltip.setAttribute('role','tooltip');
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionTooltip(event){
    if(!tooltip||!tooltip.classList.contains('show'))return;
    const gap=14;
    let left=event.clientX+gap;
    let top=event.clientY+gap;
    const rect=tooltip.getBoundingClientRect();
    if(left+rect.width>window.innerWidth-10)left=Math.max(10,event.clientX-rect.width-gap);
    if(top+rect.height>window.innerHeight-10)top=Math.max(10,event.clientY-rect.height-gap);
    tooltip.style.left=`${left}px`;
    tooltip.style.top=`${top}px`;
  }

  function showTooltip(card,event){
    const info=String(card?.dataset.additionalNote||'').trim();
    if(!info)return;
    const el=ensureTooltip();
    activeCard=card;
    el.textContent=info;
    el.classList.add('show');
    positionTooltip(event);
  }

  function hideTooltip(){
    activeCard=null;
    if(tooltip)tooltip.classList.remove('show');
  }

  function syncDoneFlag(card,task){
    const flags=card.querySelector(':scope > .plan-card-flags');
    if(!flags)return;
    let doneFlag=flags.querySelector(':scope > .plan-done-flag');
    const isDone=task?.status==='done';
    if(!isDone){
      doneFlag?.remove();
      return;
    }
    if(doneFlag)return;
    doneFlag=document.createElement('span');
    doneFlag.className='flag plan-done-flag';
    doneFlag.textContent='erledigt';
    flags.prepend(doneFlag);
  }

  function annotate(){
    const state=readState();
    const tasks=new Map((state.tasks||[]).map(t=>[String(t.id),t]));
    document.querySelectorAll('.plan-card[data-edit-task]').forEach(card=>{
      const task=tasks.get(String(card.dataset.editTask||''));
      syncDoneFlag(card,task);
      const info=additionalInfoFor(task,state);
      const hasInfo=Boolean(info);
      const existing=card.querySelector(':scope > .plan-note-indicator');
      card.classList.toggle('has-additional-info',hasInfo);
      if(!hasInfo){
        delete card.dataset.additionalNote;
        existing?.remove();
        if(activeCard===card)hideTooltip();
        return;
      }
      card.dataset.additionalNote=info;
      card.removeAttribute('title');
      if(existing)return;
      const hint=document.createElement('div');
      hint.className='plan-note-indicator';
      hint.setAttribute('aria-label','Zusatzinfo vorhanden');
      hint.innerHTML='<span class="plan-note-bang">!</span><span class="plan-note-label">Zusatzinfo</span>';
      card.appendChild(hint);
    });
  }

  let queued=false;
  function queueAnnotate(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;annotate()});
  }

  const observer=new MutationObserver(queueAnnotate);
  function start(){
    observer.observe(document.body,{childList:true,subtree:true});
    annotate();

    document.addEventListener('mouseover',event=>{
      const card=event.target.closest?.('.plan-card.has-additional-info');
      if(!card)return;
      if(event.relatedTarget&&card.contains(event.relatedTarget))return;
      showTooltip(card,event);
    });

    document.addEventListener('mousemove',event=>{
      if(activeCard&&activeCard.contains(event.target))positionTooltip(event);
    });

    document.addEventListener('mouseout',event=>{
      const card=event.target.closest?.('.plan-card.has-additional-info');
      if(!card||card!==activeCard)return;
      if(event.relatedTarget&&card.contains(event.relatedTarget))return;
      hideTooltip();
    });

    window.addEventListener('blur',hideTooltip);
    document.addEventListener('scroll',hideTooltip,true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  window.addEventListener('storage',event=>{if(event.key===STORE_KEY)queueAnnotate()});
})();
