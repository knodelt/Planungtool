/* Browser-only API adapter. No planning data is sent to a server. */
(()=>{
  const PREFIX='planungtool_demo_',KEY=PREFIX+'api_v1',STATE=PREFIX+'inst_planung_v2';
  const collections={asset:'assets',employee:'employees',absence:'absences',maintenance_plan:'maintenancePlans',task:'tasks'};
  const now=()=>new Date().toISOString();
  function seed(){
    const state=PlanungDemo.createState(),entries=[];
    for(const [type,col] of Object.entries(collections))for(const payload of state[col])entries.push({type,id:payload.id,payload,revision:1,deleted:false});
    entries.push({type:'settings',id:'global',payload:state.settings,revision:1,deleted:false});
    return {seq:1,updatedAt:now(),entries,records:{'/api/monitoring/umwaelzer':{revision:1,payload:PlanungDemo.monitoring()},'/api/monitoring/umwaelzer?asset=lineb':{revision:1,payload:PlanungDemo.monitoring(true)},'/api/open-work':{revision:1,payload:{schemaVersion:1,items:[{id:'demo_open_1',title:'Beleuchtung am Prüfplatz verbessern',assetId:'demo_press',priority:'normal',status:'open',notes:'Fiktive Verbesserungsidee.',createdAt:now()}],updatedAt:now()}}}};
  }
  function read(){try{const d=JSON.parse(localStorage.getItem(KEY));if(d?.entries)return d;}catch{}const d=seed();write(d);return d;}
  function write(d){localStorage.setItem(KEY,JSON.stringify(d));}
  function snapshot(d){const state=PlanungDemo.createState();for(const col of Object.values(collections))state[col]=[];for(const r of d.entries){if(r.deleted)continue;if(r.type==='settings')state.settings=r.payload;else if(collections[r.type])state[collections[r.type]].push(r.payload);}state.meta.updatedAt=d.updatedAt;return {ok:true,state,sync:{seq:d.seq,entries:d.entries},updatedAt:d.updatedAt};}
  function mutate(d,b){
    if(!collections[b.type]&&b.type!=='settings')return {error:'Unbekannter Datensatztyp.'};
    const index=d.entries.findIndex(r=>r.type===b.type&&r.id===b.id),old=d.entries[index];
    if(Number(b.expectedRevision||0)!==Number(old?.revision||0))return {conflict:true,current:old,seq:d.seq};
    const current={type:b.type,id:b.id,payload:b.action==='delete'?null:b.payload,deleted:b.action==='delete',revision:(old?.revision||0)+1,updatedAt:now(),updatedBy:b.clientId||'demo'};
    if(index<0)d.entries.push(current);else d.entries[index]=current;
    d.seq++;d.updatedAt=now();return {ok:true,current,seq:d.seq,updatedAt:d.updatedAt};
  }
  const nativeFetch=globalThis.fetch.bind(globalThis);
  globalThis.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(!url.pathname.startsWith('/api/'))return nativeFetch(input,options);
    // Never forward API calls, including absolute URLs, to any backend.
    if(url.origin!==location.origin)return Response.json({ok:false,error:'Demo: externe Datenanbindung gesperrt.'},{status:403});
    try{
      const d=read(),method=(options.method||input.method||'GET').toUpperCase();
      const body=options.body?JSON.parse(options.body):input instanceof Request&&method!=='GET'?await input.clone().json():{};
      let result,status=200;
      if(url.pathname==='/api/state'&&method==='GET')result=snapshot(d);
      else if(url.pathname==='/api/version')result={ok:true,seq:d.seq,updatedAt:d.updatedAt};
      else if(url.pathname==='/api/mutate'&&method==='POST'){result=mutate(d,body);status=result.conflict?409:result.error?400:200;if(result.ok)write(d);}
      else if(url.pathname==='/api/open-work'||url.pathname==='/api/monitoring/umwaelzer'){
        const key=url.pathname+url.search,current=d.records[key]||null;
        if(method==='GET')result={ok:true,current};
        else if(method==='PUT'){
          if(Number(body.expectedRevision||0)!==Number(current?.revision||0)){status=409;result={ok:false,conflict:true,current};}
          else{d.records[key]={revision:(current?.revision||0)+1,payload:body.payload,updatedAt:now()};write(d);result={ok:true,current:d.records[key]};}
        }
      }else if(url.pathname==='/api/team-source-sync'&&method==='POST'){
        for(const id of body.oldIds||[]){const old=d.entries.find(x=>x.type==='absence'&&x.id===id);if(old)mutate(d,{type:'absence',id,action:'delete',expectedRevision:old.revision});}
        for(const range of body.ranges||[]){const id='demo_import_'+crypto.randomUUID();mutate(d,{type:'absence',id,action:'upsert',payload:{...range,id},expectedRevision:0});}
        write(d);result={ok:true,stored:(body.ranges||[]).length,shiftRanges:(body.ranges||[]).filter(x=>x.type==='shift').length,vacationRanges:(body.ranges||[]).filter(x=>x.type==='vacation').length,updatedAt:now()};
      }
      return Response.json(result||{ok:false,error:'Diese Schnittstelle ist in der Demo nicht verfügbar.'},{status:result?status:404});
    }catch(error){return Response.json({ok:false,error:'Demo konnte nicht gespeichert werden: '+error.message},{status:507});}
  };
  if(!localStorage.getItem(STATE))localStorage.setItem(STATE,JSON.stringify(snapshot(read()).state));
  document.addEventListener('DOMContentLoaded',()=>{
    const note=document.createElement('div');note.className='demo-notice';note.innerHTML='<span><strong>DEMO</strong> Fiktive Beispieldaten · Speicherung nur in diesem Browser · Passwort: <b>demo</b></span><button type="button">Demo zurücksetzen</button>';
    (document.querySelector('main.content')||document.querySelector('main')||document.body).prepend(note);
    note.querySelector('button').onclick=async()=>{
      if(!confirm('Alle Änderungen dieser Demo zurücksetzen und frische Beispieldaten laden?'))return;
      for(const key of Object.keys(localStorage))if(key.startsWith(PREFIX))localStorage.removeItem(key);
      const databases=['planungtool_demo_parts_v1','planungtool_demo_drawings_test_v1'];
      for(const name of databases)await new Promise(resolve=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=r.onerror=r.onblocked=resolve;});
      location.href='/';
    };
  });
})();
