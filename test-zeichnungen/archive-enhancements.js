const DB_NAME='planungtool_demo_drawings_test_v1';
const DB_VERSION=1;
const DRAWING_STORE='drawings';
const GROUPS_KEY='planungtool_demo_drawings_test_groups_v1';

const $=(selector,root=document)=>root.querySelector(selector);

let fullPreviewUrl='';

function esc(value=''){
  return String(value).replace(/[&<>"']/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function toast(message){
  const el=$('#drawingToast');
  if(!el)return;
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>el.classList.remove('show'),2600);
}

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function getDrawing(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const request=db.transaction(DRAWING_STORE,'readonly').objectStore(DRAWING_STORE).get(id);
    request.onsuccess=()=>resolve(request.result||null);
    request.onerror=()=>reject(request.error);
  });
}

async function putDrawing(record){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(DRAWING_STORE,'readwrite');
    tx.objectStore(DRAWING_STORE).put(record);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

function readGroups(){
  try{
    const value=JSON.parse(localStorage.getItem(GROUPS_KEY)||'{}');
    return value&&typeof value==='object'?value:{};
  }catch{return {};}
}

function writeGroups(groups){
  localStorage.setItem(GROUPS_KEY,JSON.stringify(groups));
}

function groupsFor(assetId){
  const groups=readGroups()[assetId]||[];
  return [...new Set(groups.map((x)=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
}

function currentAssetId(){
  return $('.asset-row.active[data-asset-id]')?.dataset.assetId||'';
}

function isPdf(drawing){
  return drawing?.mime==='application/pdf'||/\.pdf$/i.test(drawing?.fileName||'');
}

function isImage(drawing){
  return /^image\//.test(drawing?.mime||'')||/\.(png|jpe?g|webp)$/i.test(drawing?.fileName||'');
}

function drawingType(drawing){
  return drawing?.fileName?.split('.').pop()?.toUpperCase()||'DATEI';
}

function openLayer(id){
  const layer=$(`#${id}`);
  if(!layer)return;
  layer.classList.add('open');
  layer.setAttribute('aria-hidden','false');
}

function closeLayer(id){
  const layer=$(`#${id}`);
  if(!layer)return;
  layer.classList.remove('open');
  layer.setAttribute('aria-hidden','true');
  if(id==='archiveFullPreviewModal'&&fullPreviewUrl){
    URL.revokeObjectURL(fullPreviewUrl);
    fullPreviewUrl='';
    const stage=$('#archiveFullPreviewStage');
    if(stage)stage.innerHTML='';
  }
}

function installUi(){
  if($('#archiveFullPreviewModal'))return;
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-backdrop" id="archiveFullPreviewModal" aria-hidden="true">
      <section class="modal archive-full-modal" role="dialog" aria-modal="true" aria-labelledby="archiveFullPreviewTitle">
        <div class="modal-head"><div><p class="eyebrow">Zeichnungsvorschau</p><h2 id="archiveFullPreviewTitle">Großansicht</h2><span class="archive-full-file" id="archiveFullPreviewFile"></span></div><button class="icon-button" data-archive-close="archiveFullPreviewModal" aria-label="Schließen">×</button></div>
        <div class="archive-full-body"><div class="archive-full-stage" id="archiveFullPreviewStage"></div></div>
      </section>
    </div>
    <div class="modal-backdrop" id="archiveEditDrawingModal" aria-hidden="true">
      <section class="modal archive-edit-modal" role="dialog" aria-modal="true" aria-labelledby="archiveEditDrawingTitle">
        <div class="modal-head"><div><p class="eyebrow">Zeichnung</p><h2 id="archiveEditDrawingTitle">Zeichnung bearbeiten</h2></div><button class="icon-button" data-archive-close="archiveEditDrawingModal" aria-label="Schließen">×</button></div>
        <div class="modal-body">
          <div class="archive-edit-grid">
            <label><span>Zeichnungsnummer</span><input id="archiveEditNumber" type="text"></label>
            <label><span>Revision</span><input id="archiveEditRevision" type="text" placeholder="–"></label>
            <label class="wide"><span>Bezeichnung / Name</span><input id="archiveEditTitle" type="text"></label>
            <label class="wide"><span>Baugruppe</span><select id="archiveEditGroup"></select></label>
          </div>
          <div class="archive-file-info" id="archiveEditFileInfo"></div>
          <div class="form-footer"><button class="button secondary" data-archive-close="archiveEditDrawingModal">Abbrechen</button><button class="button primary" id="archiveSaveDrawing">Änderungen speichern</button></div>
        </div>
      </section>
    </div>
    <div class="modal-backdrop" id="archiveRenameGroupModal" aria-hidden="true">
      <section class="modal archive-rename-modal" role="dialog" aria-modal="true" aria-labelledby="archiveRenameGroupTitle">
        <div class="modal-head"><div><p class="eyebrow">Baugruppe</p><h2 id="archiveRenameGroupTitle">Baugruppe umbenennen</h2></div><button class="icon-button" data-archive-close="archiveRenameGroupModal" aria-label="Schließen">×</button></div>
        <div class="modal-body">
          <div class="archive-rename-form"><label><span>Neuer Name</span><input id="archiveRenameGroupInput" type="text"></label></div>
          <div class="form-footer"><button class="button secondary" data-archive-close="archiveRenameGroupModal">Abbrechen</button><button class="button primary" id="archiveSaveGroupName">Umbenennen</button></div>
        </div>
      </section>
    </div>`);
}

function augmentPreviewActions(){
  const meta=$('#previewMeta');
  if(!meta||meta.classList.contains('hidden'))return;
  const actions=$('.preview-actions',meta);
  if(!actions)return;
  const source=actions.querySelector('[data-download-drawing],[data-delete-drawing]');
  const id=source?.dataset.downloadDrawing||source?.dataset.deleteDrawing||'';
  if(!id)return;

  let full=actions.querySelector('[data-full-preview-drawing]');
  if(!full){
    full=document.createElement('button');
    full.type='button';
    full.className='button secondary small archive-enhance-action';
    full.textContent='Groß öffnen';
    actions.prepend(full);
  }
  full.dataset.fullPreviewDrawing=id;

  let edit=actions.querySelector('[data-edit-drawing]');
  if(!edit){
    edit=document.createElement('button');
    edit.type='button';
    edit.className='button secondary small archive-enhance-action';
    edit.textContent='Bearbeiten';
    actions.insertBefore(edit,actions.querySelector('[data-delete-drawing]'));
  }
  edit.dataset.editDrawing=id;
}

function augmentGroupRows(){
  document.querySelectorAll('#managedGroups .managed-group').forEach((row)=>{
    if(row.dataset.enhanced==='1')return;
    const name=row.querySelector('strong')?.textContent?.trim();
    const deleteButton=row.querySelector('[data-delete-group]');
    if(!name||!deleteButton)return;

    const actions=document.createElement('div');
    actions.className='managed-group-actions';
    const rename=document.createElement('button');
    rename.type='button';
    rename.className='mini-edit';
    rename.textContent='Umbenennen';
    rename.dataset.renameGroup=name;
    deleteButton.before(actions);
    actions.append(rename,deleteButton);
    row.dataset.enhanced='1';
  });
}

function startObservers(){
  const preview=$('#previewMeta');
  if(preview)new MutationObserver(augmentPreviewActions).observe(preview,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  const groups=$('#managedGroups');
  if(groups)new MutationObserver(augmentGroupRows).observe(groups,{childList:true,subtree:true});
  augmentPreviewActions();
  augmentGroupRows();
}

async function openFullPreview(id){
  const drawing=await getDrawing(id);
  if(!drawing?.blob)return toast('Zeichnung konnte nicht geladen werden.');
  if(fullPreviewUrl)URL.revokeObjectURL(fullPreviewUrl);
  fullPreviewUrl=URL.createObjectURL(drawing.blob);
  $('#archiveFullPreviewTitle').textContent=drawing.title||drawing.number||'Zeichnung';
  $('#archiveFullPreviewFile').textContent=drawing.fileName||'';
  const stage=$('#archiveFullPreviewStage');
  if(isPdf(drawing))stage.innerHTML=`<iframe class="archive-full-frame" title="Großansicht ${esc(drawing.fileName)}" src="${fullPreviewUrl}#toolbar=1&navpanes=1"></iframe>`;
  else if(isImage(drawing))stage.innerHTML=`<img class="archive-full-image" alt="${esc(drawing.title||drawing.fileName)}" src="${fullPreviewUrl}">`;
  else stage.innerHTML=`<div class="archive-full-unsupported"><div class="preview-icon">${esc(drawingType(drawing))}</div><strong>Keine Browser-Vorschau verfügbar</strong><span>Für dieses Dateiformat bleibt nur der Download.</span></div>`;
  openLayer('archiveFullPreviewModal');
}

async function openEditDrawing(id){
  const drawing=await getDrawing(id);
  if(!drawing)return toast('Zeichnung konnte nicht geladen werden.');
  const modal=$('#archiveEditDrawingModal');
  modal.dataset.drawingId=id;
  $('#archiveEditNumber').value=drawing.number||'';
  $('#archiveEditRevision').value=drawing.revision||'';
  $('#archiveEditTitle').value=drawing.title||'';
  const groups=groupsFor(drawing.assetId);
  const groupSelect=$('#archiveEditGroup');
  const values=groups.includes(drawing.group)?groups:[drawing.group,...groups].filter(Boolean);
  groupSelect.innerHTML=values.length?values.map((group)=>`<option value="${esc(group)}">${esc(group)}</option>`).join(''):'<option value="">Keine Baugruppe</option>';
  groupSelect.value=drawing.group||'';
  $('#archiveEditFileInfo').innerHTML=`<strong>Datei bleibt unverändert</strong>${esc(drawing.fileName||'–')}`;
  openLayer('archiveEditDrawingModal');
  setTimeout(()=>$('#archiveEditTitle')?.focus(),60);
}

async function saveDrawingChanges(){
  const modal=$('#archiveEditDrawingModal');
  const id=modal.dataset.drawingId||'';
  const drawing=await getDrawing(id);
  if(!drawing)return toast('Zeichnung konnte nicht geladen werden.');
  const title=$('#archiveEditTitle').value.trim();
  const number=$('#archiveEditNumber').value.trim();
  const group=$('#archiveEditGroup').value.trim();
  const revision=$('#archiveEditRevision').value.trim();
  if(!title)return toast('Bitte eine Bezeichnung eingeben.');
  if(!group)return toast('Bitte eine Baugruppe auswählen.');
  drawing.title=title;
  drawing.number=number;
  drawing.group=group;
  drawing.revision=revision;
  drawing.updatedAt=new Date().toISOString();
  await putDrawing(drawing);
  closeLayer('archiveEditDrawingModal');
  toast('Zeichnung geändert.');
  setTimeout(()=>location.reload(),250);
}

function openRenameGroup(oldName){
  const assetId=currentAssetId();
  if(!assetId)return toast('Bitte zuerst eine Anlage auswählen.');
  const modal=$('#archiveRenameGroupModal');
  modal.dataset.assetId=assetId;
  modal.dataset.oldName=oldName;
  $('#archiveRenameGroupInput').value=oldName;
  openLayer('archiveRenameGroupModal');
  setTimeout(()=>{const input=$('#archiveRenameGroupInput');input?.focus();input?.select();},60);
}

async function renameGroup(){
  const modal=$('#archiveRenameGroupModal');
  const assetId=modal.dataset.assetId||'';
  const oldName=modal.dataset.oldName||'';
  const newName=$('#archiveRenameGroupInput').value.trim();
  if(!assetId||!oldName)return;
  if(!newName)return toast('Bitte einen Namen eingeben.');
  if(newName===oldName){closeLayer('archiveRenameGroupModal');return;}
  const groups=groupsFor(assetId);
  if(groups.some((group)=>group.toLocaleLowerCase('de')===newName.toLocaleLowerCase('de')&&group!==oldName))return toast('Diese Baugruppe gibt es bereits.');

  const all=readGroups();
  all[assetId]=(all[assetId]||[]).map((group)=>group===oldName?newName:group);
  writeGroups(all);

  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(DRAWING_STORE,'readwrite');
    const store=tx.objectStore(DRAWING_STORE);
    const request=store.getAll();
    request.onsuccess=()=>{
      (request.result||[]).forEach((drawing)=>{
        if(drawing.assetId===assetId&&drawing.group===oldName){
          drawing.group=newName;
          drawing.updatedAt=new Date().toISOString();
          store.put(drawing);
        }
      });
    };
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });

  closeLayer('archiveRenameGroupModal');
  toast('Baugruppe umbenannt. Zugeordnete Zeichnungen wurden aktualisiert.');
  setTimeout(()=>location.reload(),300);
}

function bindEvents(){
  document.addEventListener('click',(event)=>{
    const full=event.target.closest('[data-full-preview-drawing]');
    if(full){event.preventDefault();event.stopPropagation();openFullPreview(full.dataset.fullPreviewDrawing);return;}
    const edit=event.target.closest('[data-edit-drawing]');
    if(edit){event.preventDefault();event.stopPropagation();openEditDrawing(edit.dataset.editDrawing);return;}
    const rename=event.target.closest('[data-rename-group]');
    if(rename){event.preventDefault();event.stopPropagation();openRenameGroup(rename.dataset.renameGroup);return;}
    const close=event.target.closest('[data-archive-close]');
    if(close){event.preventDefault();closeLayer(close.dataset.archiveClose);}
  },true);

  $('#archiveSaveDrawing').addEventListener('click',saveDrawingChanges);
  $('#archiveSaveGroupName').addEventListener('click',renameGroup);
  $('#archiveRenameGroupInput').addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();renameGroup();}});

  ['archiveFullPreviewModal','archiveEditDrawingModal','archiveRenameGroupModal'].forEach((id)=>{
    $(`#${id}`).addEventListener('click',(event)=>{if(event.target===event.currentTarget)closeLayer(id);});
  });

  document.addEventListener('keydown',(event)=>{
    if(event.key!=='Escape')return;
    closeLayer('archiveFullPreviewModal');
    closeLayer('archiveEditDrawingModal');
    closeLayer('archiveRenameGroupModal');
  });
}

installUi();
bindEvents();
startObservers();
