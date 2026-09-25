(()=>{
  let popover=null;

  const style=document.createElement('style');
  style.textContent=`
    .day-entry-choice{position:fixed;z-index:1200;width:260px;padding:10px;border:1px solid #d7e2eb;border-radius:14px;background:#fff;box-shadow:0 18px 42px rgba(23,48,70,.18)}
    .day-entry-choice-title{padding:3px 4px 9px;color:#5d6b79;font-size:11px;font-weight:750}
    .day-entry-choice-actions{display:grid;gap:7px}
    .day-entry-choice button{width:100%;display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px solid #dfe7ee;border-radius:10px;background:#fff;color:#15202b;text-align:left;font:inherit;font-size:12px;font-weight:750;cursor:pointer}
    .day-entry-choice button:hover{background:#f4f9fd;border-color:#b8cfdf}
    .day-entry-choice-icon{width:28px;height:28px;display:grid;place-items:center;flex:0 0 auto;border-radius:8px;background:#e8f2fb;color:#064f8f;font-size:13px;font-weight:900}
    .day-entry-choice button[data-kind="maintenance"] .day-entry-choice-icon{background:#fff4dd;color:#b56b00}
    .day-entry-choice-copy{display:grid;gap:1px}
    .day-entry-choice-copy small{color:#74818e;font-size:9px;font-weight:600}
  `;
  document.head.appendChild(style);

  function closePopover(){
    popover?.remove();
    popover=null;
  }

  function positionPopover(trigger){
    if(!popover)return;
    const r=trigger.getBoundingClientRect();
    const pr=popover.getBoundingClientRect();
    const gap=7;
    let left=r.left;
    let top=r.bottom+gap;
    if(left+pr.width>window.innerWidth-10)left=window.innerWidth-pr.width-10;
    if(left<10)left=10;
    if(top+pr.height>window.innerHeight-10)top=Math.max(10,r.top-pr.height-gap);
    popover.style.left=`${left}px`;
    popover.style.top=`${top}px`;
  }

  function adjustMaintenanceModal(){
    const form=document.querySelector('#entityForm');
    const backdrop=document.querySelector('#modalBackdrop');
    if(!form||!backdrop?.classList.contains('open'))return;
    form.dataset.kind='maintenance';
    const title=document.querySelector('#modalTitle');
    const eyebrow=document.querySelector('#modalEyebrow');
    if(title)title.textContent='Einzelwartung eintragen';
    if(eyebrow)eyebrow.textContent='Wartungstermin';
    const submit=form.querySelector('button[type="submit"]');
    if(submit)submit.textContent='Einzelwartung anlegen';
    const titleInput=form.querySelector('input[name="title"]');
    if(titleInput)titleInput.placeholder='z. B. Sichtkontrolle, Schmierung, Prüfung';
    if(!form.querySelector('[data-single-maintenance-note]')){
      const footer=form.querySelector('.form-footer');
      if(footer){
        const note=document.createElement('div');
        note.className='form-field full';
        note.dataset.singleMaintenanceNote='true';
        note.innerHTML='<div class="form-note">Einzeltermin ohne Wartungsplan. Dieser Termin wird nicht automatisch wiederholt.</div>';
        footer.before(note);
      }
    }
  }

  function triggerExistingFlow(trigger,kind){
    trigger.dataset.dayEntryBypass=kind;
    trigger.click();
  }

  function openChoice(trigger){
    closePopover();
    popover=document.createElement('div');
    popover.className='day-entry-choice';
    popover.setAttribute('role','dialog');
    popover.setAttribute('aria-label','Eintrag an diesem Tag auswählen');
    popover.innerHTML=`
      <div class="day-entry-choice-title">Was möchtest du an diesem Tag eintragen?</div>
      <div class="day-entry-choice-actions">
        <button type="button" data-kind="work"><span class="day-entry-choice-icon">A</span><span class="day-entry-choice-copy">Arbeitsauftrag<small>einmalige Arbeit planen</small></span></button>
        <button type="button" data-kind="maintenance"><span class="day-entry-choice-icon">W</span><span class="day-entry-choice-copy">Einzelwartung<small>Wartung ohne Wiederholung</small></span></button>
      </div>`;
    document.body.appendChild(popover);
    positionPopover(trigger);
    popover.querySelectorAll('button[data-kind]').forEach(btn=>btn.addEventListener('click',()=>{
      const kind=btn.dataset.kind;
      closePopover();
      triggerExistingFlow(trigger,kind);
    }));
    popover.querySelector('button')?.focus();
  }

  document.addEventListener('click',e=>{
    const trigger=e.target.closest?.('[data-add-date]');
    if(!trigger||e.target.closest?.('[data-edit-task]'))return;

    const bypass=trigger.dataset.dayEntryBypass;
    if(bypass){
      delete trigger.dataset.dayEntryBypass;
      if(bypass==='maintenance')queueMicrotask(adjustMaintenanceModal);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    openChoice(trigger);
  },true);

  document.addEventListener('pointerdown',e=>{
    if(popover&&!popover.contains(e.target)&&!e.target.closest?.('[data-add-date]'))closePopover();
  });

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')closePopover();
  });

  document.addEventListener('submit',e=>{
    const form=e.target;
    if(form?.id!=='entityForm'||form.dataset.kind!=='maintenance'||form.dataset.entityId)return;
    setTimeout(()=>{
      const toast=document.querySelector('#toast');
      if(toast&&toast.textContent.trim()==='Arbeitsauftrag angelegt.')toast.textContent='Einzelwartung angelegt.';
    },0);
  },true);
})();
