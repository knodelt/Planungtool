const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const DB_NAME = 'planungtool_demo_drawings_test_v1';
const DB_VERSION = 1;
const DRAWING_STORE = 'drawings';
const GROUPS_KEY = 'planungtool_demo_drawings_test_groups_v1';
const SELECTED_ASSET_KEY = 'planungtool_demo_drawings_test_asset_v1';
const MAIN_STATE_KEY = 'planungtool_demo_inst_planung_v2';

let assets = [];
let drawings = [];
let selectedAssetId = localStorage.getItem(SELECTED_ASSET_KEY) || '';
let activeDrawingId = '';
let previewUrl = '';
let stagedFiles = [];
let dbPromise;

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function uid(prefix = 'drawing') {
  return `${prefix}_${crypto.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`;
}

function toast(message) {
  const el = $('#drawingToast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAWING_STORE)) {
        const store = db.createObjectStore(DRAWING_STORE, { keyPath: 'id' });
        store.createIndex('assetId', 'assetId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function dbAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(DRAWING_STORE, 'readonly').objectStore(DRAWING_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAWING_STORE, 'readwrite');
    tx.objectStore(DRAWING_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbRemove(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAWING_STORE, 'readwrite');
    tx.objectStore(DRAWING_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function readGroups() {
  try {
    const value = JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function groupsFor(assetId = selectedAssetId) {
  const groups = readGroups()[assetId] || [];
  return [...new Set(groups.map((x) => String(x).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
}

function addGroup(name) {
  if (!selectedAssetId) return;
  const cleaned = String(name || '').trim();
  if (!cleaned) return;
  const all = readGroups();
  const current = all[selectedAssetId] || [];
  if (!current.some((x) => x.toLocaleLowerCase('de') === cleaned.toLocaleLowerCase('de'))) current.push(cleaned);
  all[selectedAssetId] = current;
  writeGroups(all);
  renderGroups();
  renderGroupControls();
  $('#newGroupName').value = '';
}

function removeGroup(name) {
  const used = drawings.some((d) => d.assetId === selectedAssetId && d.group === name);
  if (used) return toast(`„${name}“ wird bereits von Zeichnungen verwendet.`);
  const all = readGroups();
  all[selectedAssetId] = (all[selectedAssetId] || []).filter((x) => x !== name);
  writeGroups(all);
  renderGroups();
  renderGroupControls();
}

function assetById(id) {
  return assets.find((asset) => asset.id === id);
}

function selectedAsset() {
  return assetById(selectedAssetId);
}

async function loadAssets() {
  let loaded = [];
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    const data = await response.json();
    loaded = Array.isArray(data?.state?.assets) ? data.state.assets : [];
  } catch (error) {
    console.warn('D1-Anlagen konnten auf der Testseite nicht geladen werden.', error);
  }

  if (!loaded.length) {
    try {
      const local = JSON.parse(localStorage.getItem(MAIN_STATE_KEY) || '{}');
      loaded = Array.isArray(local.assets) ? local.assets : [];
    } catch {}
  }

  assets = loaded
    .filter((asset) => asset?.id && asset?.name)
    .map((asset) => ({ id: asset.id, name: asset.name, number: asset.number || '', location: asset.location || '' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  if (!assetById(selectedAssetId)) selectedAssetId = assets[0]?.id || '';
  if (selectedAssetId) localStorage.setItem(SELECTED_ASSET_KEY, selectedAssetId);
}

function renderAssets() {
  const query = $('#assetSearch').value.trim().toLocaleLowerCase('de');
  const filtered = assets.filter((asset) => `${asset.name} ${asset.number} ${asset.location}`.toLocaleLowerCase('de').includes(query));
  $('#assetCount').textContent = `${assets.length}`;
  $('#assetList').innerHTML = filtered.length ? filtered.map((asset) => {
    const count = drawings.filter((d) => d.assetId === asset.id).length;
    return `<button class="asset-row ${asset.id === selectedAssetId ? 'active' : ''}" data-asset-id="${esc(asset.id)}">
      <span><strong>${esc(asset.name)}</strong><small>${esc(asset.number || asset.location || 'Anlage')}</small></span>
      <span class="asset-badge">${count}</span>
    </button>`;
  }).join('') : `<div class="group-empty">Keine Anlage gefunden.</div>`;
}

function renderGroupControls() {
  const groups = groupsFor();
  const filter = $('#groupFilter');
  const previous = groups.includes(filter.value) ? filter.value : '';
  filter.innerHTML = `<option value="">Alle Baugruppen</option>${groups.map((group) => `<option value="${esc(group)}">${esc(group)}</option>`).join('')}`;
  filter.value = previous;

  const upload = $('#uploadGroup');
  const preferred = groups.includes(filter.value) && filter.value ? filter.value : (groups[0] || '');
  upload.innerHTML = groups.length ? groups.map((group) => `<option value="${esc(group)}">${esc(group)}</option>`).join('') : '<option value="">Keine Baugruppe angelegt</option>';
  upload.value = preferred;
}

function drawingType(drawing) {
  const ext = drawing.fileName?.split('.').pop()?.toUpperCase() || '';
  return ext || 'DATEI';
}

function renderDrawings() {
  const asset = selectedAsset();
  $('#topAssetContext').textContent = asset?.name || 'Anlage auswählen';
  $('#drawingListTitle').textContent = asset ? `${asset.name} · alle Zeichnungen` : 'Anlage auswählen';

  if (!asset) {
    $('#drawingTableBody').innerHTML = '';
    $('#drawingCount').textContent = '0 Zeichnungen';
    showEmpty('Keine Anlage verfügbar.', 'Lege zuerst Anlagen in der aktiven Planung an.');
    return;
  }

  const query = $('#drawingSearch').value.trim().toLocaleLowerCase('de');
  const group = $('#groupFilter').value;
  const allForAsset = drawings.filter((drawing) => drawing.assetId === selectedAssetId);
  const visible = allForAsset
    .filter((drawing) => !group || drawing.group === group)
    .filter((drawing) => !query || `${drawing.number} ${drawing.title} ${drawing.group} ${drawing.revision} ${drawing.fileName}`.toLocaleLowerCase('de').includes(query))
    .sort((a, b) => String(a.number || '').localeCompare(String(b.number || ''), 'de', { numeric: true }) || String(a.title || '').localeCompare(String(b.title || ''), 'de'));

  $('#drawingCount').textContent = `${visible.length} von ${allForAsset.length} Zeichnungen`;
  $('#drawingTableBody').innerHTML = visible.map((drawing) => `<tr class="drawing-row ${drawing.id === activeDrawingId ? 'active' : ''}" data-drawing-id="${esc(drawing.id)}">
    <td><strong>${esc(drawing.number || '–')}</strong></td>
    <td><span class="drawing-name" title="${esc(drawing.title || drawing.fileName)}">${esc(drawing.title || drawing.fileName)}</span></td>
    <td><span class="group-pill">${esc(drawing.group || 'Ohne Baugruppe')}</span></td>
    <td><span class="rev-pill">${esc(drawing.revision || '–')}</span></td>
    <td><span class="file-pill">${esc(drawingType(drawing))}</span></td>
  </tr>`).join('');

  if (!allForAsset.length) showEmpty('Noch keine Zeichnungen abgelegt.', 'Baugruppen anlegen und anschließend mehrere Zeichnungen auf einmal hochladen.');
  else if (!visible.length) showEmpty('Keine Zeichnung passt zum Filter.', 'Baugruppe auf „Alle Baugruppen“ stellen oder Suche ändern.');
  else hideEmpty();
}

function showEmpty(title, text) {
  const empty = $('#drawingEmpty');
  empty.innerHTML = `<div><strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
  empty.classList.remove('hidden');
}

function hideEmpty() {
  $('#drawingEmpty').classList.add('hidden');
}

function renderGroups() {
  const asset = selectedAsset();
  $('#groupAssetName').textContent = asset?.name || 'Keine Anlage ausgewählt';
  const groups = groupsFor();
  $('#managedGroups').innerHTML = groups.length ? groups.map((group) => {
    const count = drawings.filter((drawing) => drawing.assetId === selectedAssetId && drawing.group === group).length;
    return `<div class="managed-group"><div><strong>${esc(group)}</strong><small>${count} Zeichnung${count === 1 ? '' : 'en'}</small></div><button class="mini-danger" data-delete-group="${esc(group)}">Löschen</button></div>`;
  }).join('') : '<div class="group-empty">Noch keine Baugruppe angelegt. Nutze oben „Schnell hinzufügen“ oder gib eine eigene Baugruppe ein.</div>';
}

function selectAsset(id) {
  if (!assetById(id)) return;
  selectedAssetId = id;
  localStorage.setItem(SELECTED_ASSET_KEY, id);
  $('#groupFilter').value = '';
  $('#drawingSearch').value = '';
  clearPreview();
  renderAssets();
  renderGroupControls();
  renderGroups();
  renderDrawings();
}

function openModal(id) {
  const modal = $(`#${id}`);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  const modal = $(`#${id}`);
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
}

function openGroupManager() {
  if (!selectedAsset()) return toast('Bitte zuerst eine Anlage auswählen.');
  renderGroups();
  openModal('groupModal');
  setTimeout(() => $('#newGroupName').focus(), 80);
}

function openUpload() {
  const asset = selectedAsset();
  if (!asset) return toast('Bitte zuerst eine Anlage auswählen.');
  const groups = groupsFor();
  if (!groups.length) {
    toast('Für diese Anlage zuerst eine Baugruppe anlegen.');
    return openGroupManager();
  }
  $('#uploadAsset').value = asset.name;
  renderGroupControls();
  if ($('#groupFilter').value && groups.includes($('#groupFilter').value)) $('#uploadGroup').value = $('#groupFilter').value;
  stagedFiles = [];
  $('#drawingFiles').value = '';
  renderUploadReview();
  openModal('uploadModal');
}

function parseFilename(file) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : '';
  const base = extension ? file.name.slice(0, -(extension.length + 1)) : file.name;
  const revisionMatch = base.match(/(?:^|[\s_.-])rev(?:ision)?[\s_.-]*([a-z0-9]+)/i);
  const revision = revisionMatch?.[1]?.toUpperCase() || '';
  const withoutRevision = revisionMatch ? `${base.slice(0, revisionMatch.index)} ${base.slice(revisionMatch.index + revisionMatch[0].length)}`.trim() : base;
  const tokens = withoutRevision.split(/[\s_]+/).map((x) => x.trim()).filter(Boolean);
  const numberParts = [];
  while (tokens.length && numberParts.length < 2 && /\d/.test(tokens[0])) numberParts.push(tokens.shift());
  const number = numberParts.join('-').replace(/--+/g, '-') || withoutRevision.match(/[a-z]*\d+[a-z0-9-]*/i)?.[0] || '';
  let title = tokens.join(' ').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!title || title === number) title = withoutRevision.replace(number, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { number: number || base, title: title || base, revision };
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stageSelectedFiles(fileList) {
  const accepted = [...fileList].filter((file) => /\.(pdf|png|jpe?g|webp|dwg|dxf)$/i.test(file.name));
  stagedFiles = accepted.map((file) => ({ file, ...parseFilename(file) }));
  renderUploadReview();
  if (accepted.length !== fileList.length) toast('Nicht unterstützte Dateien wurden ausgelassen.');
}

function renderUploadReview() {
  const review = $('#uploadReview');
  const save = $('#saveUploadButton');
  if (!stagedFiles.length) {
    review.classList.add('hidden');
    $('#uploadReviewList').innerHTML = '';
    save.disabled = true;
    return;
  }
  review.classList.remove('hidden');
  $('#uploadFileCount').textContent = `${stagedFiles.length} Datei${stagedFiles.length === 1 ? '' : 'en'}`;
  $('#uploadReviewList').innerHTML = stagedFiles.map((entry, index) => `<div class="upload-review-row" data-upload-index="${index}">
    <div class="upload-file-name"><strong title="${esc(entry.file.name)}">${esc(entry.file.name)}</strong><small>${esc(formatBytes(entry.file.size))}</small></div>
    <label><span>Zeichnungsnr.</span><input data-upload-field="number" value="${esc(entry.number)}"></label>
    <label><span>Bezeichnung</span><input data-upload-field="title" value="${esc(entry.title)}"></label>
    <label><span>Revision</span><input data-upload-field="revision" value="${esc(entry.revision)}" placeholder="–"></label>
  </div>`).join('');
  save.disabled = false;
}

function syncUploadInputs() {
  $$('.upload-review-row').forEach((row) => {
    const item = stagedFiles[Number(row.dataset.uploadIndex)];
    if (!item) return;
    $$('[data-upload-field]', row).forEach((input) => { item[input.dataset.uploadField] = input.value.trim(); });
  });
}

async function saveUploads() {
  syncUploadInputs();
  const asset = selectedAsset();
  const group = $('#uploadGroup').value;
  if (!asset || !group) return toast('Bitte Anlage und Baugruppe auswählen.');
  if (!stagedFiles.length) return;

  $('#saveUploadButton').disabled = true;
  const saved = [];
  try {
    for (const item of stagedFiles) {
      const record = {
        id: uid('drawing'),
        assetId: asset.id,
        group,
        number: item.number || item.file.name.replace(/\.[^.]+$/, ''),
        title: item.title || item.file.name.replace(/\.[^.]+$/, ''),
        revision: item.revision || '',
        fileName: item.file.name,
        mime: item.file.type || '',
        size: item.file.size || 0,
        createdAt: new Date().toISOString(),
        blob: item.file
      };
      await dbPut(record);
      saved.push(record);
    }
    drawings.push(...saved);
    closeModal('uploadModal');
    stagedFiles = [];
    renderAssets();
    renderGroups();
    renderDrawings();
    toast(`${saved.length} Zeichnung${saved.length === 1 ? '' : 'en'} gespeichert.`);
    if (saved[0]) showPreview(saved[0].id);
  } catch (error) {
    console.error(error);
    toast('Dateien konnten lokal nicht gespeichert werden.');
    $('#saveUploadButton').disabled = false;
  }
}

function clearPreview() {
  activeDrawingId = '';
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = '';
  $('#clearPreview').classList.add('hidden');
  $('#previewMeta').classList.add('hidden');
  $('#previewMeta').innerHTML = '';
  $('#previewStage').innerHTML = `<div class="preview-placeholder"><div class="preview-icon">PDF</div><strong>Zeichnung anklicken</strong><span>PDFs und Bilder werden hier direkt angezeigt – ohne Download.</span></div>`;
  renderDrawings();
}

function isPdf(drawing) {
  return drawing.mime === 'application/pdf' || /\.pdf$/i.test(drawing.fileName || '');
}

function isImage(drawing) {
  return /^image\//.test(drawing.mime || '') || /\.(png|jpe?g|webp)$/i.test(drawing.fileName || '');
}

function showPreview(id) {
  const drawing = drawings.find((item) => item.id === id);
  if (!drawing?.blob) return;
  activeDrawingId = id;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(drawing.blob);

  if (isPdf(drawing)) {
    $('#previewStage').innerHTML = `<iframe class="pdf-frame" title="Vorschau ${esc(drawing.fileName)}" src="${previewUrl}#toolbar=1&navpanes=0"></iframe>`;
  } else if (isImage(drawing)) {
    $('#previewStage').innerHTML = `<img class="image-preview" alt="${esc(drawing.title || drawing.fileName)}" src="${previewUrl}">`;
  } else {
    $('#previewStage').innerHTML = `<div class="unsupported-preview"><div class="preview-icon">${esc(drawingType(drawing))}</div><strong>Keine Browser-Vorschau</strong><span>Dieses Dateiformat wird im Test gespeichert, aber noch nicht direkt dargestellt.</span></div>`;
  }

  $('#clearPreview').classList.remove('hidden');
  const meta = $('#previewMeta');
  meta.classList.remove('hidden');
  meta.innerHTML = `<div class="preview-meta-head"><div><strong>${esc(drawing.title || drawing.fileName)}</strong><small>${esc(drawing.fileName)}</small></div><div class="preview-actions"><button class="button secondary small" data-download-drawing="${esc(drawing.id)}">Herunterladen</button><button class="button danger small" data-delete-drawing="${esc(drawing.id)}">Löschen</button></div></div>
    <div class="preview-detail-grid"><div class="preview-detail"><span>Zeichnungsnr.</span><strong>${esc(drawing.number || '–')}</strong></div><div class="preview-detail"><span>Baugruppe</span><strong>${esc(drawing.group || '–')}</strong></div><div class="preview-detail"><span>Revision</span><strong>${esc(drawing.revision || '–')}</strong></div></div>`;
  renderDrawings();
}

function downloadDrawing(id) {
  const drawing = drawings.find((item) => item.id === id);
  if (!drawing?.blob) return;
  const url = URL.createObjectURL(drawing.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = drawing.fileName || 'zeichnung';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function deleteDrawing(id) {
  const drawing = drawings.find((item) => item.id === id);
  if (!drawing) return;
  if (!confirm(`Zeichnung „${drawing.number || drawing.title}“ aus der Testseite löschen?`)) return;
  await dbRemove(id);
  drawings = drawings.filter((item) => item.id !== id);
  if (activeDrawingId === id) clearPreview();
  renderAssets();
  renderGroups();
  renderDrawings();
  toast('Zeichnung aus dem Testarchiv gelöscht.');
}

function bindEvents() {
  $('#assetSearch').addEventListener('input', renderAssets);
  $('#drawingSearch').addEventListener('input', renderDrawings);
  $('#groupFilter').addEventListener('change', () => { clearPreview(); renderDrawings(); });
  $('#manageGroupsButton').addEventListener('click', openGroupManager);
  $('#uploadButton').addEventListener('click', openUpload);
  $('#addGroupButton').addEventListener('click', () => addGroup($('#newGroupName').value));
  $('#newGroupName').addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addGroup(event.currentTarget.value); } });
  $('#drawingFiles').addEventListener('change', (event) => stageSelectedFiles(event.target.files));
  $('#saveUploadButton').addEventListener('click', saveUploads);
  $('#clearPreview').addEventListener('click', clearPreview);

  const drop = $('#dropZone');
  ['dragenter', 'dragover'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.remove('dragging'); }));
  drop.addEventListener('drop', (event) => stageSelectedFiles(event.dataTransfer.files));

  document.addEventListener('click', (event) => {
    const assetButton = event.target.closest('[data-asset-id]');
    if (assetButton) selectAsset(assetButton.dataset.assetId);

    const row = event.target.closest('[data-drawing-id]');
    if (row) showPreview(row.dataset.drawingId);

    const close = event.target.closest('[data-close-modal]');
    if (close) closeModal(close.dataset.closeModal);

    const suggested = event.target.closest('[data-suggest-group]');
    if (suggested) addGroup(suggested.dataset.suggestGroup);

    const remove = event.target.closest('[data-delete-group]');
    if (remove) removeGroup(remove.dataset.deleteGroup);

    const download = event.target.closest('[data-download-drawing]');
    if (download) { event.stopPropagation(); downloadDrawing(download.dataset.downloadDrawing); }

    const delDrawing = event.target.closest('[data-delete-drawing]');
    if (delDrawing) { event.stopPropagation(); deleteDrawing(delDrawing.dataset.deleteDrawing); }
  });

  ['groupModal', 'uploadModal'].forEach((id) => {
    $(`#${id}`).addEventListener('click', (event) => { if (event.target === event.currentTarget) closeModal(id); });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal('groupModal');
      closeModal('uploadModal');
    }
  });
}

async function init() {
  bindEvents();
  try {
    [drawings] = await Promise.all([dbAll(), loadAssets()]);
    if (!localStorage.getItem('planungtool_demo_drawing_seeded')) {
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#f8fbfd"/><g stroke="#204861" stroke-width="3" fill="none"><rect x="210" y="210" width="540" height="200"/><circle cx="350" cy="310" r="66"/><circle cx="610" cy="310" r="66"/><path d="M350 244h260M350 376h260M160 460h640M210 430v50M750 430v50"/></g><g font-family="sans-serif" fill="#204861"><text x="60" y="70" font-size="28">DEMO · Förderband 01</text><text x="60" y="110" font-size="18">Frei erfundenes Schema · Nicht zur Fertigung</text><text x="440" y="495" font-size="20">540 mm</text><text x="60" y="585" font-size="18">D-DEMO-001 · Revision A</text></g></svg>';
      const blob=new Blob([svg],{type:'image/svg+xml'});
      const record={id:'demo_drawing_1',assetId:'demo_conveyor',group:'Mechanik',number:'D-DEMO-001',title:'Förderband – Demoschema',revision:'A',fileName:'Demoschema.svg',mime:'image/svg+xml',size:blob.size,createdAt:new Date().toISOString(),blob};
      await dbPut(record);drawings.push(record);
      localStorage.setItem('planungtool_demo_drawings_test_groups_v1',JSON.stringify({'demo_conveyor':['Mechanik']}));
      localStorage.setItem('planungtool_demo_drawing_seeded','1');
    }
  } catch (error) {
    console.error(error);
    await loadAssets();
    drawings = [];
    toast('Lokales Zeichnungsarchiv konnte nicht geladen werden.');
  }
  renderAssets();
  renderGroupControls();
  renderGroups();
  renderDrawings();
}

init();
