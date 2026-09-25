
const FILTER_CSS='/test-ersatzteile/excel-filter.css?v=1';
const FILTER_JS='/test-ersatzteile/excel-filter.js?v=3';
const FILTER_SEARCH_FIX_JS='/test-ersatzteile/excel-filter-search-fix.js?v=1';
const EDIT_GUARD_CSS='/test-ersatzteile/edit-mode-guard.css?v=1';
const EDIT_GUARD_JS='/test-ersatzteile/edit-mode-guard.js?v=1';
const LAYOUT_CLEANUP_CSS='/test-ersatzteile/layout-cleanup.css?v=4';
const TABLE_SEARCH_CSS='/test-ersatzteile/table-search-placement.css?v=2';
const TABLE_SEARCH_JS='/test-ersatzteile/table-search-placement.js?v=3';
const COLUMN_RESIZE_CSS='/test-ersatzteile/column-resize.css?v=1';
const COLUMN_RESIZE_JS='/test-ersatzteile/column-resize.js?v=1';
const MAIN_SIDEBAR_CSS='/test-ersatzteile/sidebar-main-match.css?v=1';
const PLANNER_NAV_JS='/js/ersatzteile-nav.js?v=2';
const OPEN_WORK_NAV_JS='/js/open-work-nav.js?v=1';
const OPEN_WORK_JS='/js/open-work.js?v=1';
const PLANNER_NOTE_CSS='/css/week-note-indicator.css?v=4';
const PLANNER_NOTE_JS='/js/week-note-indicator.js?v=5';
const RESCHEDULE_CSS='/css/maintenance-reschedule-overview.css?v=2';
const RESCHEDULE_JS='/js/maintenance-reschedule-overview.js?v=2';
const DAY_ENTRY_JS='/js/day-entry-choice.js?v=1';
const TASK_EDIT_JS='/js/task-edit-controls.js?v=2';
const DRAWING_LAYOUT_CSS='/test-zeichnungen/layout-room.css?v=1';

const productionNav=`<nav class="main-nav" aria-label="Hauptnavigation"><a class="nav-item" href="/"><span class="nav-icon">01</span><span>Übersicht</span></a><a class="nav-item" href="/?view=week"><span class="nav-icon">02</span><span>Wochenplanung</span></a><a class="nav-item" href="/?view=maintenance"><span class="nav-icon">03</span><span>Wartungen</span></a><a class="nav-item" href="/?view=work"><span class="nav-icon">04</span><span>Arbeitsaufträge</span></a><a class="nav-item" href="/?view=openwork"><span class="nav-icon">05</span><span>Offene Arbeiten</span></a><a class="nav-item active" href="/ersatzteile/"><span class="nav-icon">06</span><span>Ersatzteile</span></a><a class="nav-item" href="/?view=assets"><span class="nav-icon">07</span><span>Anlagen</span></a><a class="nav-item" href="/?view=team"><span class="nav-icon">08</span><span>Team</span></a></nav>`;
const productionBottom=`<div class="sidebar-bottom"><a class="ghost-row" href="/"><span>Daten &amp; Backup</span><span>→</span></a><div class="storage-state"><span class="state-dot"></span><span>Nur in diesem Browser gespeichert</span></div></div>`;

function htmlResponse(asset,html){
  const headers=new Headers(asset.headers);
  headers.set('Content-Type','text/html; charset=utf-8');
  headers.set('Cache-Control','no-store, max-age=0');
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  return new Response(html,{status:asset.status,headers});
}

async function servePlanner(request,env){
  const url=new URL(request.url);
  const asset=await env.ASSETS.fetch(new Request(new URL('/index.html',url),{method:'GET',headers:request.headers}));
  if(!asset.ok)return asset;
  let html=await asset.text();
  if(!html.includes(PLANNER_NOTE_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${PLANNER_NOTE_CSS}"></head>`);
  if(!html.includes(RESCHEDULE_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${RESCHEDULE_CSS}"></head>`);
  if(!html.includes(PLANNER_NAV_JS))html=html.replace('</body>',`<script src="${PLANNER_NAV_JS}"></script></body>`);
  if(!html.includes(OPEN_WORK_NAV_JS))html=html.replace('</body>',`<script src="${OPEN_WORK_NAV_JS}"></script></body>`);
  if(!html.includes(OPEN_WORK_JS))html=html.replace('</body>',`<script src="${OPEN_WORK_JS}"></script></body>`);
  if(!html.includes(PLANNER_NOTE_JS))html=html.replace('</body>',`<script src="${PLANNER_NOTE_JS}"></script></body>`);
  if(!html.includes(RESCHEDULE_JS))html=html.replace('</body>',`<script src="${RESCHEDULE_JS}"></script></body>`);
  if(!html.includes(DAY_ENTRY_JS))html=html.replace('</body>',`<script src="${DAY_ENTRY_JS}"></script></body>`);
  if(!html.includes(TASK_EDIT_JS))html=html.replace('</body>',`<script src="${TASK_EDIT_JS}"></script></body>`);
  return htmlResponse(asset,html);
}

async function mainBrandHtml(request,env,url){
  const planner=await env.ASSETS.fetch(new Request(new URL('/index.html',url),{method:'GET',headers:request.headers}));
  if(!planner.ok)return '';
  const plannerHtml=await planner.text();
  return plannerHtml.match(/<div class="brand">[\s\S]*?<\/div>\s*(?=<nav class="main-nav")/)?.[0]||'';
}

async function serveDrawingsTest(request,env){
  const url=new URL(request.url);
  const asset=await env.ASSETS.fetch(new Request(new URL('/test-zeichnungen/index.html',url),{method:'GET',headers:request.headers}));
  if(!asset.ok)return asset;
  let html=await asset.text();
  const brand=await mainBrandHtml(request,env,url);
  const fallbackBrand='<div class="brand"><div class="brand-copy"><strong>Inst. Planung</strong><span>Version 2.0</span></div></div>';
  html=html.replace('<!--MAIN_BRAND-->',brand||fallbackBrand);
  if(!html.includes(DRAWING_LAYOUT_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${DRAWING_LAYOUT_CSS}"></head>`);
  return htmlResponse(asset,html);
}

async function serveErsatzteile(request,env,{production=false}={}){
  const url=new URL(request.url);
  const assetUrl=new URL('/test-ersatzteile/index.html',url);
  const asset=await env.ASSETS.fetch(new Request(assetUrl,{method:'GET',headers:request.headers}));
  if(!asset.ok)return asset;
  let html=await asset.text();

  if(production){
    const brand=await mainBrandHtml(request,env,url);
    const fallbackBrand='<div class="brand"><div class="brand-copy"><strong>Inst. Planung</strong><span>Version 2.0</span></div></div>';
    const sidebar=`<aside class="sidebar" id="sidebar">${brand||fallbackBrand}${productionNav}${productionBottom}</aside>`;
    html=html.replace('<body>','<body class="production-ersatzteile">');
    html=html.replace('<title>Planungtool · Demo · Ersatzteile Test</title>','<title>Planungtool · Demo · Ersatzteile</title>');
    html=html.replace('<span>Mehrquellen-Test</span>','<span>Material & Bestand</span>');
    html=html.replace(/<aside class="sidebar" id="sidebar">[\s\S]*?<\/aside>/,sidebar);
  }

  if(!html.includes(FILTER_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${FILTER_CSS}"></head>`);
  if(!html.includes(EDIT_GUARD_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${EDIT_GUARD_CSS}"></head>`);
  if(!html.includes(LAYOUT_CLEANUP_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${LAYOUT_CLEANUP_CSS}"></head>`);
  if(!html.includes(TABLE_SEARCH_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${TABLE_SEARCH_CSS}"></head>`);
  if(!html.includes(COLUMN_RESIZE_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${COLUMN_RESIZE_CSS}"></head>`);
  if(production&&!html.includes(MAIN_SIDEBAR_CSS))html=html.replace('</head>',`<link rel="stylesheet" href="${MAIN_SIDEBAR_CSS}"></head>`);
  if(!html.includes(FILTER_JS))html=html.replace('</body>',`<script src="${FILTER_JS}"></script></body>`);
  if(!html.includes(FILTER_SEARCH_FIX_JS))html=html.replace('</body>',`<script src="${FILTER_SEARCH_FIX_JS}"></script></body>`);
  if(!html.includes(EDIT_GUARD_JS))html=html.replace('</body>',`<script src="${EDIT_GUARD_JS}"></script></body>`);
  if(!html.includes(TABLE_SEARCH_JS))html=html.replace('</body>',`<script src="${TABLE_SEARCH_JS}"></script></body>`);
  if(!html.includes(COLUMN_RESIZE_JS))html=html.replace('</body>',`<script src="${COLUMN_RESIZE_JS}"></script></body>`);
  return htmlResponse(asset,html);
}

export default{
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname.replace(/\/+$/,'')||'/';
    if(path==='/'||path==='/index.html')return servePlanner(request,env);
    if(path==='/ersatzteile')return serveErsatzteile(request,env,{production:true});
    if(path==='/test-ersatzteile')return serveErsatzteile(request,env,{production:false});
    if(path==='/test-zeichnungen')return serveDrawingsTest(request,env);
    if(path.startsWith('/api/'))return Response.json({ok:false,error:'Demo: keine Server-Datenanbindung.'},{status:404});
    return env.ASSETS.fetch(request);
  }
};
