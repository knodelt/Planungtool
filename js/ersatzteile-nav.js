(()=>{
  function loadAssetMonitoring(){
    if(!document.querySelector('link[data-asset-monitoring-style]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/css/asset-monitoring.css?v=2';
      link.dataset.assetMonitoringStyle='true';
      document.head.appendChild(link);
    }
    if(!document.querySelector('link[data-umwaelzer-summary-cleanup]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='/css/umwaelzer-summary-cleanup.css?v=1';
      link.dataset.umwaelzerSummaryCleanup='true';
      document.head.appendChild(link);
    }
    if(!document.querySelector('script[data-asset-monitoring-script]')){
      const script=document.createElement('script');
      script.src='/js/asset-monitoring.js?v=2';
      script.dataset.assetMonitoringScript='true';
      document.body.appendChild(script);
    }
    if(!document.querySelector('script[data-umwaelzer-history-edit]')){
      const script=document.createElement('script');
      script.src='/js/umwaelzer-history-edit.js?v=2';
      script.dataset.umwaelzerHistoryEdit='true';
      document.body.appendChild(script);
    }
    if(!document.querySelector('script[data-umwaelzer-hood-v2]')){
      const script=document.createElement('script');
      script.src='/js/umwaelzer-hood-welding-v2.js?v=1';
      script.dataset.umwaelzerHoodV2='true';
      document.body.appendChild(script);
    }
    if(!document.querySelector('script[data-umwaelzer-hood-delete]')){
      const script=document.createElement('script');
      script.src='/js/umwaelzer-hood-delete.js?v=1';
      script.dataset.umwaelzerHoodDelete='true';
      document.body.appendChild(script);
    }
  }

  function setup(){
    const nav=document.querySelector('.main-nav');
    if(!nav)return;

    if(!nav.querySelector('[data-ersatzteile-link]')){
      const work=nav.querySelector('[data-view="work"]');
      const assets=nav.querySelector('[data-view="assets"]');
      const team=nav.querySelector('[data-view="team"]');
      if(!work||!assets||!team)return;

      const assetsNum=assets.querySelector('.nav-icon');
      const teamNum=team.querySelector('.nav-icon');
      if(assetsNum)assetsNum.textContent='06';
      if(teamNum)teamNum.textContent='07';

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='nav-item';
      btn.dataset.ersatzteileLink='true';
      btn.innerHTML='<span class="nav-icon">05</span><span>Ersatzteile</span>';
      btn.addEventListener('click',()=>{window.location.href='/ersatzteile/';});
      work.insertAdjacentElement('afterend',btn);
    }

    loadAssetMonitoring();

    const requested=new URLSearchParams(location.search).get('view');
    if(requested&&['dashboard','week','maintenance','work','assets','team'].includes(requested)){
      const target=nav.querySelector(`[data-view="${requested}"]`);
      if(target){
        setTimeout(()=>target.click(),0);
        history.replaceState(null,'','/');
      }
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
