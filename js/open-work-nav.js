(()=>{
  const setText=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};

  function loadThermalBMonitoring(){
    if(document.getElementById('thermalBMonitoringScript'))return;
    const script=document.createElement('script');
    script.id='thermalBMonitoringScript';
    script.src='js/thermal-lineb-monitoring.js';
    script.defer=true;
    document.head.appendChild(script);
  }

  function fixNumbers(){
    const nav=document.querySelector('.main-nav');
    if(!nav)return;
    setText(nav.querySelector('[data-open-work-link] .nav-icon'),'05');
    setText(nav.querySelector('[data-ersatzteile-link] .nav-icon'),'06');
    setText(nav.querySelector('[data-view="assets"] .nav-icon'),'07');
    setText(nav.querySelector('[data-view="team"] .nav-icon'),'08');
    setText(nav.querySelector('[data-asset-monitoring-link] .nav-icon'),'07.1');
  }

  function setup(){
    loadThermalBMonitoring();
    const nav=document.querySelector('.main-nav');
    const work=nav?.querySelector('[data-view="work"]');
    if(!nav||!work)return;

    if(!nav.querySelector('[data-open-work-link]')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='nav-item';
      btn.dataset.openWorkLink='true';
      btn.innerHTML='<span class="nav-icon">05</span><span>Offene Arbeiten</span>';
      work.insertAdjacentElement('afterend',btn);
    }

    fixNumbers();
    const observer=new MutationObserver(()=>fixNumbers());
    observer.observe(nav,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();