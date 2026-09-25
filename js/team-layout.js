(()=>{
  const STORE_KEY='planungtool_demo_inst_planung_v2';
  let scheduled=false;

  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).toLocaleLowerCase('de-DE').replace(/\s+/g,' ');
  const state=()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}catch{return {employees:[]}}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  function ensureStyle(){
    if(document.getElementById('teamLayoutStyle'))return;
    const s=document.createElement('style');
    s.id='teamLayoutStyle';
    s.textContent=`
      #view-team .page-head>div:first-child{display:none!important}
      #view-team .page-head{justify-content:flex-end!important;min-height:0!important;margin-bottom:12px!important}
      #view-team .team-layout{display:block!important}
      #view-team .team-layout>section{width:100%}
      #view-team .team-layout>section:nth-child(2){display:none!important}
      #view-team #employeeGrid{display:block!important}
      .team-role-groups{display:grid;gap:22px}
      .team-role-section{border:1px solid #d9e4ed;border-radius:16px;padding:16px;background:#fbfdff}
      .team-role-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e4ebf1}
      .team-role-head h3{margin:0;font-size:18px;color:#10283d}
      .team-role-count{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:26px;padding:0 9px;border-radius:999px;background:#edf4fa;color:#315b7a;font-size:11px;font-weight:800}
      .team-role-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .team-role-grid .employee-card{margin:0}
      .team-role-section.unassigned{background:#fffdf8}
      .team-role-section.unassigned .team-role-head h3{color:#7a5b16}
      @media(max-width:1200px){.team-role-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:720px){.team-role-grid{grid-template-columns:1fr}.team-role-section{padding:12px}}
    `;
    document.head.appendChild(s);
  }

  function roleOf(employee){
    const d=norm(employee?.dept);
    if(d.includes('elekt'))return'Elektriker';
    if(d.includes('schloss')||d.includes('mechan'))return'Schlosser';
    return'Nicht zugeordnet';
  }

  function patchEmployeeForm(){
    const form=document.getElementById('entityForm');
    if(!form||form.dataset.formType!=='employee')return;
    const field=form.querySelector('input[name="dept"]');
    if(!field||form.querySelector('select[name="dept"]'))return;
    const current=clean(field.value);
    const select=document.createElement('select');
    select.name='dept';
    select.innerHTML=`<option value="">Bitte auswählen</option><option value="Schlosser">Schlosser</option><option value="Elektriker">Elektriker</option>`;
    const role=roleOf({dept:current});
    select.value=role==='Nicht zugeordnet'?'':role;
    field.replaceWith(select);
    const label=select.closest('.form-field')?.querySelector('label');
    if(label)label.textContent='Bereich / Qualifikation';
  }

  function renderGroups(){
    ensureStyle();
    const grid=document.getElementById('employeeGrid');
    if(!grid)return;
    const employees=Array.isArray(state().employees)?state().employees:[];
    const byId=new Map(employees.map(e=>[String(e.id),e]));
    const cards=[...grid.querySelectorAll(':scope > .employee-card')];
    if(!cards.length){
      patchEmployeeForm();
      return;
    }

    const groups={Schlosser:[],Elektriker:[],'Nicht zugeordnet':[]};
    for(const card of cards){
      const id=card.querySelector('[data-edit-employee]')?.dataset.editEmployee;
      const employee=byId.get(String(id));
      groups[roleOf(employee)].push(card);
    }

    const wrap=document.createElement('div');
    wrap.className='team-role-groups';
    for(const name of ['Schlosser','Elektriker','Nicht zugeordnet']){
      const list=groups[name];
      if(name==='Nicht zugeordnet'&&!list.length)continue;
      const section=document.createElement('section');
      section.className=`team-role-section${name==='Nicht zugeordnet'?' unassigned':''}`;
      section.innerHTML=`<div class="team-role-head"><h3>${esc(name)}</h3><span class="team-role-count">${list.length}</span></div><div class="team-role-grid"></div>`;
      const target=section.querySelector('.team-role-grid');
      list.forEach(card=>target.appendChild(card));
      wrap.appendChild(section);
    }
    grid.replaceChildren(wrap);

    const panel=grid.closest('.panel');
    const eyebrow=panel?.querySelector('.panel-head .eyebrow');
    const title=panel?.querySelector('.panel-head h2');
    if(eyebrow)eyebrow.textContent='Mitarbeiter';
    if(title)title.textContent='Teamübersicht nach Qualifikation';
    patchEmployeeForm();
  }

  function patch(){
    if(!document.getElementById('view-team'))return;
    renderGroups();
    patchEmployeeForm();
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{scheduled=false;patch()},0);
  }

  function setup(){
    ensureStyle();
    schedule();
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-view="team"],[data-edit-employee],[data-action="new-employee"]'))schedule();
    },true);
    document.addEventListener('submit',schedule,true);
    window.addEventListener('storage',e=>{if(e.key===STORE_KEY)schedule()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
