import { addDays, dateKey, parseDate } from './calendar-data.js';

const STORE_KEY = 'planungtool_demo_inst_planung_v2';
const CLIENT_KEY = 'planungtool_demo_inst_planung_v2_client';
const PRE_D1_BACKUP_KEY = 'planungtool_demo_inst_planung_v2_pre_d1_backup';
const API_BASE = '/api';
const POLL_MS = 15000;
export const STORE_VERSION = 2;

export const id = (prefix = 'id') => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

let activeStateRef = null;
let backendReady = false;
let backendOnline = false;
let syncing = false;
let syncRequested = false;
let syncTimer = null;
let pollTimer = null;
let serverSeq = 0;
let serverIndex = new Map();
let clientId = localStorage.getItem(CLIENT_KEY);
if (!clientId) {
  clientId = globalThis.crypto?.randomUUID?.() || `browser_${Date.now().toString(36)}`;
  localStorage.setItem(CLIENT_KEY, clientId);
}

function demoState() { return globalThis.PlanungDemo.createState(); }

export function normalizeState(input = {}) {
  return {
    version: STORE_VERSION,
    meta: {
      createdAt: input.meta?.createdAt || new Date().toISOString(),
      updatedAt: input.meta?.updatedAt || new Date().toISOString(),
      demo: Boolean(input.meta?.demo),
      backend: input.meta?.backend || 'local-cache'
    },
    assets: Array.isArray(input.assets) ? input.assets : [],
    employees: Array.isArray(input.employees) ? input.employees : [],
    absences: Array.isArray(input.absences) ? input.absences : [],
    maintenancePlans: Array.isArray(input.maintenancePlans) ? input.maintenancePlans : [],
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    settings: { weekMode: 'week', showWeekends: true, ...(input.settings || {}) }
  };
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return demoState();
    return normalizeState(JSON.parse(raw));
  } catch (err) {
    console.error('Lokaler Cache konnte nicht geladen werden', err);
    return demoState();
  }
}

export function loadState() {
  const state = readLocalState();
  activeStateRef = state;
  queueMicrotask(() => initializeBackend(state));
  return state;
}

function storeLocalCache(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (error) { console.warn('Lokaler Cache konnte nicht geschrieben werden', error); }
}

export function saveState(state) {
  activeStateRef = state;
  state.version = STORE_VERSION;
  state.meta = { ...(state.meta || {}), updatedAt: new Date().toISOString(), backend: backendReady ? 'd1' : 'local-cache' };
  storeLocalCache(state);
  scheduleSync();
}

export function clearDemoFlag(state) {
  state.meta = { ...(state.meta || {}), demo: true };
}

export function resetToDemo() {
  const state = demoState();
  saveState(state);
  return state;
}

export function emptyState() {
  const state = normalizeState({ meta: { demo: true, backend: backendReady ? 'd1' : 'local-cache' } });
  saveState(state);
  return state;
}

function legacyArray(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

export function hasLegacyBrowserData() {
  return ['planungtool_demo_legacy_assets', 'planungtool_demo_legacy_maintenance', 'planungtool_demo_legacy_repairs', 'planungtool_demo_legacy_employees', 'planungtool_demo_legacy_absences'].some((key) => localStorage.getItem(key));
}

function mapLegacy(legacy) {
  const state = normalizeState({ meta: { demo: true } });
  state.assets = (legacy.assets || []).map((a) => ({ id: a.id || id('asset'), name: a.name || a.title || 'Anlage', number: a.number || '', location: a.location || '', notes: a.notes || '' }));
  state.employees = (legacy.employees || []).map((e) => ({ id: e.id || id('emp'), name: e.name || 'Mitarbeiter', dept: e.dept || '', notes: e.notes || '' }));
  state.absences = (legacy.absences || []).map((a) => ({ id: a.id || id('abs'), employeeId: a.employeeId || '', type: ['vacation', 'sick', 'shift'].includes(a.type) ? a.type : 'vacation', start: a.start || a.dateFrom || '', end: a.end || a.dateTo || a.start || '', notes: a.notes || '' })).filter((a) => a.start && a.end);
  const maint = (legacy.maintenance || []).map((m) => ({
    id: m.id || id('task'), kind: 'maintenance', title: m.title || 'Wartung', assetId: m.assetId || m.asset || '', employeeId: m.employeeId || '', dateFrom: m.date || m.dateFrom || '', dateTo: m.dateTo || m.date || m.dateFrom || '', time: m.time || '', priority: 'normal', status: m.status === 'done' ? 'done' : 'open', notes: m.notes || '', doneComment: m.doneComment || '', doneAt: m.doneAt || null, sapRef: m.sapRef || '', decisionNeeded: false, blocker: '', sourcePlanId: null
  })).filter((m) => m.dateFrom);
  const repairs = (legacy.repairs || []).map((r) => ({
    id: r.id || id('task'), kind: 'work', title: r.title || 'Arbeitsauftrag', assetId: r.assetId || r.asset || '', employeeId: r.employeeId || '', dateFrom: r.dateFrom || r.date || '', dateTo: r.dateTo || r.dateFrom || r.date || '', time: r.time || '', priority: 'normal', status: r.status === 'done' ? 'done' : 'open', notes: r.notes || '', doneComment: r.doneComment || '', doneAt: r.doneAt || null, sapRef: r.sapRef || '', decisionNeeded: false, blocker: '', sourcePlanId: null
  })).filter((r) => r.dateFrom);
  state.tasks = [...maint, ...repairs];
  state.meta.demo = false;
  return state;
}

export function importLegacyBrowserData() {
  return mapLegacy({
    assets: legacyArray('planungtool_demo_legacy_assets'),
    maintenance: legacyArray('planungtool_demo_legacy_maintenance'),
    repairs: legacyArray('planungtool_demo_legacy_repairs'),
    employees: legacyArray('planungtool_demo_legacy_employees'),
    absences: legacyArray('planungtool_demo_legacy_absences')
  });
}

export async function importLegacyFiles(fileList) {
  const legacy = { assets: [], maintenance: [], repairs: [], employees: [], absences: [] };
  const files = [...fileList];
  for (const file of files) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { continue; }
    const name = file.name.toLowerCase();
    if (name.includes('anlagen')) legacy.assets = data;
    else if (name.includes('wartung')) legacy.maintenance = data;
    else if (name.includes('reparatur')) legacy.repairs = data;
    else if (name.includes('mitarbeiter')) legacy.employees = data;
    else if (name.includes('abwesen')) legacy.absences = data;
    else if (data?.version === 2 && data?.tasks) return normalizeState(data);
  }
  return mapLegacy(legacy);
}

export function exportBackup(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planungtool_demo-inst-planung-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function addInterval(dateString, value, unit) {
  const d = parseDate(dateString);
  if (!d) return dateString;
  if (unit === 'days') d.setDate(d.getDate() + value);
  if (unit === 'weeks') d.setDate(d.getDate() + (value * 7));
  if (unit === 'months') d.setMonth(d.getMonth() + value);
  return dateKey(d);
}

export function syncMaintenancePlanTasks(state, horizonDays = 180) {
  const today = new Date();
  const horizon = dateKey(addDays(today, horizonDays));
  let changed = false;
  for (const plan of state.maintenancePlans.filter((p) => p.active !== false && p.nextDue && p.assetId)) {
    let due = plan.nextDue;
    let guard = 0;
    while (due <= horizon && guard < 200) {
      const sourceKey = `${plan.id}_${due}`;
      if (!state.tasks.some((t) => t.sourceKey === sourceKey)) {
        state.tasks.push({
          id: `task_${plan.id}_${due}`, kind: 'maintenance', title: plan.title, assetId: plan.assetId, employeeId: plan.employeeId || '', dateFrom: due, dateTo: due, time: '', priority: 'normal', status: 'open', notes: plan.notes || '', sapRef: '', decisionNeeded: false, blocker: '', sourcePlanId: plan.id, sourceKey
        });
        changed = true;
      }
      due = addInterval(due, Math.max(1, Number(plan.intervalValue) || 1), plan.intervalUnit || 'months');
      guard += 1;
    }
  }
  if (changed) saveState(state);
  return changed;
}

const COLLECTIONS = [
  ['asset', 'assets'],
  ['employee', 'employees'],
  ['absence', 'absences'],
  ['maintenance_plan', 'maintenancePlans'],
  ['task', 'tasks']
];

function keyFor(type, recordId) { return `${type}:${recordId}`; }

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stateRecords(state) {
  const records = new Map();
  for (const [type, collection] of COLLECTIONS) {
    for (const item of state[collection] || []) {
      if (!item?.id) continue;
      records.set(keyFor(type, item.id), { type, id: item.id, payload: structuredClone(item) });
    }
  }
  records.set(keyFor('settings', 'global'), { type: 'settings', id: 'global', payload: structuredClone(state.settings || {}) });
  return records;
}

function stateHasRealData(state) {
  return ((state.assets?.length || 0) + (state.employees?.length || 0) + (state.absences?.length || 0) + (state.maintenancePlans?.length || 0) + (state.tasks?.length || 0) > 0);
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok && response.status !== 409) throw new Error(data?.error || `HTTP ${response.status}`);
  return { response, data };
}

function setBackendStatus(text, online = backendOnline) {
  text = 'Demo · nur in diesem Browser gespeichert';
  const update = () => {
    const label = document.querySelector('.storage-state span:last-child');
    const dot = document.querySelector('.storage-state .state-dot');
    if (label) label.textContent = text;
    if (dot) dot.style.opacity = online ? '1' : '0.45';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, { once: true });
  else update();
}

function refreshUi() {
  const run = () => {
    const active = document.querySelector('.nav-item.active');
    if (active) active.click();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else queueMicrotask(run);
}

function replaceStateInPlace(target, source) {
  const normalized = normalizeState(source);
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, normalized);
  activeStateRef = target;
  storeLocalCache(target);
}

function applySnapshot(snapshot, target = activeStateRef) {
  serverSeq = Number(snapshot?.sync?.seq || 0);
  serverIndex = new Map();
  for (const entry of snapshot?.sync?.entries || []) {
    serverIndex.set(keyFor(entry.type, entry.id), {
      type: entry.type,
      id: entry.id,
      revision: Number(entry.revision || 0),
      deleted: Boolean(entry.deleted),
      payload: entry.payload ? structuredClone(entry.payload) : null,
      updatedAt: entry.updatedAt || null,
      updatedBy: entry.updatedBy || ''
    });
  }
  if (target && snapshot?.state) {
    snapshot.state.meta = { ...(snapshot.state.meta || {}), demo: true, backend: 'browser-demo' };
    replaceStateInPlace(target, snapshot.state);
  }
}

async function fetchSnapshot() {
  const { data } = await api('/state');
  if (!data?.ok) throw new Error(data?.error || 'D1-State konnte nicht geladen werden.');
  return data;
}

async function initializeBackend(initialState) {
  setBackendStatus('Verbinde mit zentraler D1-Datenbank …', false);
  try {
    const snapshot = await fetchSnapshot();
    backendReady = true;
    backendOnline = true;
    const remoteHasData = (snapshot.sync?.entries || []).some((entry) => !entry.deleted && entry.type !== 'settings');

    if (!remoteHasData && stateHasRealData(initialState)) {
      applySnapshot(snapshot, null);
      activeStateRef = initialState;
      setBackendStatus('Übernehme bisherigen Stand nach D1 …', true);
      await syncCurrentState(initialState);
      const finalSnapshot = await fetchSnapshot();
      applySnapshot(finalSnapshot, initialState);
      refreshUi();
    } else {
      if (remoteHasData && stateHasRealData(initialState) && canonical(initialState) !== canonical(snapshot.state)) {
        try { localStorage.setItem(PRE_D1_BACKUP_KEY, JSON.stringify(initialState)); } catch { /* best effort */ }
      }
      applySnapshot(snapshot, initialState);
      syncRequested = false;
      refreshUi();
    }

    setBackendStatus('Zentral in D1 gespeichert', true);
    startPolling();
  } catch (error) {
    backendReady = false;
    backendOnline = false;
    console.error('D1-Verbindung fehlgeschlagen', error);
    setBackendStatus('D1 nicht erreichbar · lokaler Cache aktiv', false);
    window.addEventListener('online', () => initializeBackend(activeStateRef), { once: true });
  }
}

function scheduleSync() {
  syncRequested = true;
  if (!backendReady || syncing) {
    if (backendReady) setBackendStatus('Änderungen warten auf D1 …', backendOnline);
    return;
  }
  clearTimeout(syncTimer);
  setBackendStatus('Synchronisiere mit D1 …', true);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncCurrentState(activeStateRef);
  }, 120);
}

function shallowMerge(base, local, remote) {
  if (!base || !local || !remote) return { conflict: true, value: local };
  const merged = structuredClone(remote);
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const key of keys) {
    const b = canonical(base[key]);
    const l = canonical(local[key]);
    const r = canonical(remote[key]);
    const localChanged = l !== b;
    const remoteChanged = r !== b;
    if (localChanged && remoteChanged && l !== r) return { conflict: true, value: local };
    if (localChanged) {
      if (local[key] === undefined) delete merged[key];
      else merged[key] = structuredClone(local[key]);
    }
  }
  return { conflict: false, value: merged };
}

function updateLocalRecord(type, recordId, payload, deleted = false) {
  if (!activeStateRef) return;
  if (type === 'settings') {
    if (!deleted && payload) activeStateRef.settings = { ...activeStateRef.settings, ...structuredClone(payload) };
    return;
  }
  const collection = COLLECTIONS.find(([t]) => t === type)?.[1];
  if (!collection) return;
  const list = activeStateRef[collection] || (activeStateRef[collection] = []);
  const index = list.findIndex((item) => item.id === recordId);
  if (deleted) {
    if (index >= 0) list.splice(index, 1);
  } else if (index >= 0) {
    list[index] = structuredClone(payload);
  } else {
    list.push(structuredClone(payload));
  }
}

async function sendMutation(record, action, expectedRevision) {
  const { response, data } = await api('/mutate', {
    method: 'POST',
    body: JSON.stringify({
      type: record.type,
      id: record.id,
      action,
      payload: action === 'upsert' ? record.payload : undefined,
      expectedRevision,
      clientId
    })
  });
  if (response.status === 409 || data?.conflict) return { conflict: true, data };
  if (!data?.ok) throw new Error(data?.error || 'D1-Änderung fehlgeschlagen.');
  return { conflict: false, data };
}

async function resolveConflict(localRecord, action, baseEntry, conflictData) {
  const remote = conflictData?.current;
  if (action === 'upsert' && remote && !remote.deleted && remote.payload && canonical(remote.payload) === canonical(localRecord.payload)) {
    return { ok: true, current: remote, seq: conflictData.seq, updatedAt: conflictData.updatedAt };
  }
  if (action === 'upsert' && baseEntry?.payload && remote && !remote.deleted && remote.payload) {
    const merged = shallowMerge(baseEntry.payload, localRecord.payload, remote.payload);
    if (!merged.conflict) {
      const retryRecord = { ...localRecord, payload: merged.value };
      const retry = await sendMutation(retryRecord, 'upsert', Number(remote.revision || 0));
      if (!retry.conflict) {
        updateLocalRecord(localRecord.type, localRecord.id, merged.value, false);
        return retry.data;
      }
    }
  }

  backendOnline = true;
  try { localStorage.setItem('planungtool_demo_inst_planung_v2_conflict_backup', JSON.stringify(activeStateRef)); } catch { /* best effort */ }
  const snapshot = await fetchSnapshot();
  applySnapshot(snapshot, activeStateRef);
  storeLocalCache(activeStateRef);
  refreshUi();
  setBackendStatus('Konflikt erkannt · Serverstand geladen', true);
  setTimeout(() => {
    alert('Dieser Datensatz wurde inzwischen auf einem anderen PC geändert. Deine Änderung wurde deshalb NICHT darübergeschrieben. Der aktuelle D1-Stand wurde geladen. Bitte prüfe den Datensatz und trage deine Änderung erneut ein.');
  }, 0);
  return null;
}

async function syncCurrentState(state) {
  if (!backendReady || !state || syncing) return;
  syncing = true;
  syncRequested = false;
  backendOnline = true;
  try {
    const current = stateRecords(state);
    const operations = [];

    for (const [key, record] of current.entries()) {
      const base = serverIndex.get(key);
      if (!base || base.deleted || canonical(base.payload) !== canonical(record.payload)) {
        operations.push({ record, action: 'upsert', expectedRevision: Number(base?.revision || 0), base });
      }
    }
    for (const [key, base] of serverIndex.entries()) {
      if (!base.deleted && !current.has(key)) {
        operations.push({ record: { type: base.type, id: base.id, payload: null }, action: 'delete', expectedRevision: Number(base.revision || 0), base });
      }
    }

    for (const operation of operations) {
      const result = await sendMutation(operation.record, operation.action, operation.expectedRevision);
      let data = result.data;
      if (result.conflict) {
        data = await resolveConflict(operation.record, operation.action, operation.base, result.data);
        if (!data) return;
      }
      serverSeq = Math.max(serverSeq, Number(data.seq || 0));
      const currentRecord = data.current;
      if (currentRecord) {
        serverIndex.set(keyFor(currentRecord.type, currentRecord.id), {
          type: currentRecord.type,
          id: currentRecord.id,
          revision: Number(currentRecord.revision || 0),
          deleted: Boolean(currentRecord.deleted),
          payload: currentRecord.payload ? structuredClone(currentRecord.payload) : null,
          updatedAt: currentRecord.updatedAt || data.updatedAt || null,
          updatedBy: currentRecord.updatedBy || clientId
        });
      }
    }

    state.meta = { ...(state.meta || {}), demo: true, backend: 'browser-demo', updatedAt: new Date().toISOString() };
    storeLocalCache(state);
    setBackendStatus('Zentral in D1 gespeichert', true);
  } catch (error) {
    backendOnline = false;
    syncRequested = true;
    console.error('D1-Synchronisierung fehlgeschlagen', error);
    setBackendStatus('D1 nicht erreichbar · Änderung bleibt im Cache', false);
  } finally {
    syncing = false;
    if (syncRequested && backendReady && backendOnline) scheduleSync();
  }
}

async function pollRemote() {
  if (!backendReady || syncing || syncRequested || syncTimer || document.visibilityState !== 'visible' || document.querySelector('dialog[open], #modalBackdrop.open')) return;
  try {
    const { data } = await api('/version');
    backendOnline = true;
    const remoteSeq = Number(data?.seq || 0);
    if (remoteSeq <= serverSeq) return;
    const snapshot = await fetchSnapshot();
    applySnapshot(snapshot, activeStateRef);
    refreshUi();
    setBackendStatus('D1 aktualisiert · Änderung von anderem PC übernommen', true);
  } catch (error) {
    backendOnline = false;
    console.warn('D1-Polling fehlgeschlagen', error);
    setBackendStatus('D1 vorübergehend nicht erreichbar', false);
  }
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(pollRemote, POLL_MS);
  window.addEventListener('focus', pollRemote);
  window.addEventListener('online', () => {
    if (backendReady) {
      syncCurrentState(activeStateRef).then(pollRemote);
    } else {
      initializeBackend(activeStateRef);
    }
  });
}
