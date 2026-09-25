(()=>{
const CLIENT='planungtool_demo_inst_planung_v2_client',META='planungtool_demo_team_source_meta',SOURCE='Dienstplan-Quelle ',LEGACY='Dienstplan-Import ';
const EXCLUDED=new Set();
const M={januar:1,februar:2,märz:3,maerz:3,april:4,mai:5,juni:6,juli:7,august:8,september:9,oktober:10,november:11,dezember:12,jan:1,feb:2,mrz:3,apr:4,jun:6,jul:7,aug:8,sep:9,sept:9,okt:10,nov:11,dez:12};
const clean=v=>String(v??'').trim(),norm=v=>clean(v).toLocaleLowerCase('de-DE').replace(/\s+/g,' '),sheetKey=v=>norm(v).replace(/[^a-z0-9äöüß]/g,'');
const excluded=n=>EXCLUDED.has(norm(n));
function addDays(k,n){const[a,b,c]=k.split('-').map(Number),d=new Date(a,b-1,c,12);d.setDate(d.getDate()+n);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dateKey(y,m,d){const x=new Date(y,m-1,d,12);return x.getFullYear()===y&&x.getMonth()+1===m&&x.getDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:''}
function typeOf(v){const n=norm(v);if(n==='s')return'shift';if(n==='g'||n==='1'||n==='2'||n==='3'||n==='zk')return'vacation';return''}
function person(v){const t=clean(v);if(!t.includes(','))return'';const p=t.split(','),last=clean(p.shift()),first=clean(p.join(','));return first&&last?`${first} ${last}`:''}
function parse(wb){
 const sn=wb.SheetNames.find(n=>sheetKey(n)==='instandhaltungdemo');if(!sn)throw Error('Tabelle „Instandhaltung Demo“ nicht gefunden.');
 const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:null}),people=new Map();let yr='';
 for(let r=0;r<rows.length-3;r++){
  const y=Number(rows[r]?.[0]);if(!Number.isInteger(y)||y<2020||y>2100)continue;yr=yr||String(y);const mr=rows[r]||[],dr=rows[r+2]||[],monthColumns=[];
  for(let c=1;c<mr.length;c++){const mm=M[norm(mr[c])];if(mm)monthColumns.push({c,mm})}
  const dates=[];let cm=0,cy=y,prevMonth=0,started=false;
  const firstMonth=monthColumns[0]?.mm||0;if(firstMonth===12&&monthColumns.some(x=>x.mm===1))cy=y-1;
  for(let c=1;c<Math.max(mr.length,dr.length);c++){
   const mm=M[norm(mr[c])];if(mm){if(started&&prevMonth&&mm<prevMonth)cy++;cm=mm;prevMonth=mm;started=true}
   const day=Number(dr[c]);if(!cm||!Number.isInteger(day)||day<1||day>31)continue;dates[c]=dateKey(cy,cm,day)
  }
  let rr=r+3;for(;rr<rows.length;rr++){
   const first=rows[rr]?.[0];if(Number.isInteger(Number(first))&&Number(first)>=2020&&Number(first)<=2100)break;const name=person(first);if(!name){if(rr>r+3)break;continue}if(excluded(name))continue;
   const key=norm(name);if(!people.has(key))people.set(key,{fullName:name,byDate:new Map()});const p=people.get(key);
   for(let c=1;c<dates.length;c++){if(!dates[c])continue;const t=typeOf(rows[rr]?.[c]);if(!t)continue;const old=p.byDate.get(dates[c]);if(!old||t==='vacation')p.byDate.set(dates[c],t)}
  }r=rr-1;
 }
 const out=[...people.values()].map(p=>({fullName:p.fullName,entries:[...p.byDate].map(([date,type])=>({date,type}))})).filter(p=>p.entries.length);
 if(!out.length)throw Error('Keine Urlaubs- oder Spätschicht-Einträge gefunden.');
 const shiftDays=out.reduce((n,p)=>n+p.entries.filter(x=>x.type==='shift').length,0);if(!shiftDays)throw Error('Import gestoppt: Die Excel-Datei enthält laut Parser keine Spätschichten. Der bestehende Kalender bleibt unverändert.');
 return{year:yr||'2026',sheetName:sn,people:out,shiftDays};
}
function groups(es){const s=[...es].sort((a,b)=>a.date.localeCompare(b.date)),g=[];for(const x of s){const l=g[g.length-1];if(l&&l.type===x.type&&addDays(l.end,1)===x.date)l.end=x.date;else g.push({type:x.type,start:x.date,end:x.date})}return g}
async function xlsx(){if(globalThis.XLSX)return;await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=ok;s.onerror=()=>no(Error('Excel-Bibliothek konnte nicht geladen werden.'));document.head.appendChild(s)});if(!globalThis.XLSX)throw Error('Excel-Bibliothek nicht verfügbar.')}
async function snap(){const r=await fetch('/api/state',{cache:'no-store'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw Error('Datenbestand konnte nicht geladen werden.');return d}
function meta(){try{return JSON.parse(localStorage.getItem(META)||'null')}catch{return null}}
function renderMeta(i){const m=meta();i.classList.remove('working');i.textContent=m?`Quelle: ${m.fileName} · ${new Date(m.updatedAt).toLocaleString('de-DE')} · geprüft`:'Noch keine Excel-Quellliste hinterlegt'}
function style(){if(document.getElementById('teamSourceStyle'))return;const s=document.createElement('style');s.id='teamSourceStyle';s.textContent='.team-source-info{font-size:11px;color:#607286;max-width:340px;line-height:1.35}.team-source-info.working{color:#0b5d96;font-weight:800}@media(max-width:720px){.team-source-info{width:100%;max-width:none}}';document.head.appendChild(s)}
async function sync(file){
 await xlsx();const wb=XLSX.read(await file.arrayBuffer(),{type:'array',cellStyles:true}),p=parse(wb),s=await snap();
 const employees=s.state?.employees||[],byName=new Map(employees.map(e=>[norm(e.name),e]));const ranges=[];const missing=[];
 for(const pp of p.people){if(excluded(pp.fullName)||!pp.entries.length)continue;const emp=byName.get(norm(pp.fullName));if(!emp){missing.push(pp.fullName);continue}for(const g of groups(pp.entries))ranges.push({employeeId:emp.id,type:g.type,start:g.start,end:g.end,name:pp.fullName})}
 if(missing.length)throw Error(`Import gestoppt: Mitarbeiter nicht gefunden: ${missing.join(', ')}.`);
 const shiftRanges=ranges.filter(x=>x.type==='shift').length;if(!shiftRanges)throw Error('Import gestoppt: 0 Spätschicht-Zeiträume erkannt. Der vorhandene Stand bleibt erhalten.');
 const oldIds=(s.state?.absences||[]).filter(a=>(a.type==='vacation'||a.type==='shift')&&(clean(a.notes).startsWith(SOURCE)||clean(a.notes).startsWith(LEGACY))).map(a=>a.id);
 const response=await fetch('/api/team-source-sync',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({year:p.year,oldIds,ranges:ranges.map(({employeeId,type,start,end})=>({employeeId,type,start,end})),clientId:localStorage.getItem(CLIENT)||''})});
 const data=await response.json().catch(()=>null);if(!response.ok||!data?.ok)throw Error(data?.detail||data?.error||'Quellliste konnte nicht gespeichert werden.');
 const updatedAt=data.updatedAt||new Date().toISOString();localStorage.setItem(META,JSON.stringify({fileName:file.name,updatedAt,sheet:p.sheetName,year:p.year,people:p.people.length,ranges:data.stored,shiftRanges:data.shiftRanges,vacationRanges:data.vacationRanges,verified:true}));
 return{...p,...data,shiftRanges};
}
async function chooseAndImport(button,info){
 const input=document.createElement('input');input.type='file';input.accept='.xlsx,.xls';input.style.position='fixed';input.style.left='-9999px';document.body.appendChild(input);
 input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file){input.remove();return}const old=button.textContent;button.disabled=true;button.textContent='Import läuft …';info.classList.add('working');info.textContent=`Import läuft: ${file.name} …`;try{const r=await sync(file);renderMeta(info);alert(`Quellliste vollständig aktualisiert.\n\n${r.stored} Bereiche atomar in D1 gespeichert.\n${r.shiftRanges} Spätschicht-Zeiträume.\n${r.vacationRanges} Urlaubs-Zeiträume.\n${r.shiftDays} einzelne Spätschicht-Tage in Excel erkannt.\n\nDer alte Stand wurde erst ersetzt, nachdem die neue Datei vollständig geprüft war.`);setTimeout(()=>location.reload(),150)}catch(e){console.error(e);info.classList.remove('working');info.textContent=`Import nicht übernommen: ${e.message}`;alert(e.message)}finally{button.disabled=false;button.textContent=old;input.remove()}},{once:true});input.click();
}
function ensure(){
 style();const a=document.querySelector('#view-team .hero-actions');if(!a)return;document.getElementById('dienstplanImportFile')?.remove();
 let b=document.getElementById('dienstplanImportButton');if(!b){b=document.createElement('button');b.type='button';b.className='button secondary';b.id='dienstplanImportButton';a.prepend(b)}b.textContent='Quellliste aktualisieren';
 let i=document.getElementById('teamSourceInfo');if(!i){i=document.createElement('div');i.id='teamSourceInfo';i.className='team-source-info';a.prepend(i)}renderMeta(i);
 if(b.dataset.atomicBound!=='1'){b.dataset.atomicBound='1';b.addEventListener('click',()=>chooseAndImport(b,i))}
}
function run(){setTimeout(ensure,0);setTimeout(ensure,100)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();document.addEventListener('click',run,true);
})();
