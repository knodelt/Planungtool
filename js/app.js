import {
  addDays, dateKey, endOfWeek, formatDate, formatShort, formatWeekday, getISOWeek,
  holidayOn, parseDate, schoolBreakOn, startOfWeek
} from './calendar-data.js';
import {
  clearDemoFlag, emptyState, exportBackup, hasLegacyBrowserData, id, importLegacyBrowserData,
  importLegacyFiles, loadState, resetToDemo, saveState, syncMaintenancePlanTasks
} from './store.js';

let state = loadState();
syncMaintenancePlanTasks(state);
let activeView = localStorage.getItem('planungtool_demo_v2_view') || 'dashboard';
let plannerCursor = startOfWeek(new Date());
let monthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
let toastTimer;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const todayKey = () => dateKey(new Date());
const esc = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const initials = (name = '') => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '–';
const asset = (id) => state.assets.find((x) => x.id === id);
const employee = (id) => state.employees.find((x) => x.id === id);
const assetName = (id) => asset(id)?.name || 'Keine Anlage';
const employeeName = (id) => employee(id)?.name || 'Nicht zugeordnet';
const taskDate = (task) => task.dateFrom || task.date || '';
const taskEndDate = (task) => task.dateTo || task.dateFrom || task.date || '';
const isOpen = (task) => task.status !== 'done';
const isOverdue = (task) => isOpen(task) && Boolean(task.overdueSince);
const dayInRange = (key, start, end) => start && key >= start && key <= (end || start);
const tasksForDay = (key) => state.tasks.filter((t) => dayInRange(key, taskDate(t), taskEndDate(t)));
const absencesForDay = (key) => state.absences.filter((a) => dayInRange(key, a.start, a.end));
const sortTasks = (items) => [...items].sort((a, b) => `${taskDate(a)}${a.time || ''}`.localeCompare(`${taskDate(b)}${b.time || ''}`));

function formatOverdueDate(value) {
  if (!value) return '';
  const d = parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
}

function rollOverOverdueTasks() {
  if (!state?.tasks?.length) return false;
  const today = todayKey();
  let changed = false;

  for (const task of state.tasks) {
    if (!isOpen(task)) continue;
    const from = taskDate(task);
    const to = taskEndDate(task);
    if (!from || !to || to >= today) continue;

    if (!task.overdueSince) task.overdueSince = from;
    if (!task.originalDateFrom) task.originalDateFrom = from;
    if (!task.originalDateTo) task.originalDateTo = to;

    const startDate = parseDate(from);
    const endDate = parseDate(to);
    const spanDays = startDate && endDate
      ? Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86400000))
      : 0;

    task.dateFrom = today;
    task.dateTo = dateKey(addDays(parseDate(today), spanDays));
    task.rolledForwardAt = new Date().toISOString();
    changed = true;
  }

  if (changed) saveState(state);
  return changed;
}

function persist(message) {
  saveState(state);
  renderChrome();
  if (message) toast(message);
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = message;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function emptyHtml(title, text) {
  return `<div class="empty-state"><div><strong>${esc(title)}</strong><span>${esc(text)}</span></div></div>`;
}

function taskKindLabel(kind) { return kind === 'maintenance' ? 'Wartung' : 'Arbeit'; }
function absenceLabel(type) { return ({ vacation: 'Urlaub', sick: 'Krank', shift: 'Schicht' })[type] || 'Abwesenheit'; }
function priorityLabel(priority) { return ({ high: 'Hoch', normal: 'Normal', low: 'Niedrig' })[priority] || 'Normal'; }

function renderChrome() {
  const now = new Date();
  $('#topWeek').textContent = `KW ${getISOWeek(now)} · ${formatShort(startOfWeek(now))}–${formatShort(endOfWeek(now))}`;
  const labels = { dashboard: 'Übersicht', week: 'Wochenplanung', maintenance: 'Wartungen', work: 'Arbeitsaufträge', assets: 'Anlagen', team: 'Team' };
  $('#topContext').textContent = labels[activeView] || 'Übersicht';
  $('#demoPill').classList.toggle('hidden', !state.meta?.demo);
  $('#lastSaved').textContent = state.meta?.updatedAt ? `Zuletzt gespeichert: ${new Date(state.meta.updatedAt).toLocaleString('de-DE')}` : '';
}

function switchView(view) {
  activeView = view;
  localStorage.setItem('planungtool_demo_v2_view', view);
  $$('.view').forEach((el) => el.classList.toggle('active', el.id === `view-${view}`));
  $$('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.view === view));
  renderChrome();
  renderActiveView();
  closeMobileNav();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderActiveView() {
  syncMaintenancePlanTasks(state);
  rollOverOverdueTasks();
  if (activeView === 'dashboard') renderDashboard();
  if (activeView === 'week') renderPlanner();
  if (activeView === 'maintenance') renderMaintenance();
  if (activeView === 'work') renderWork();
  if (activeView === 'assets') renderAssets();
  if (activeView === 'team') renderTeam();
}

function renderDashboard() {
  const now = new Date();
  const hour = now.getHours();
  $('#dashboardGreeting').textContent = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  $('#dashboardDate').textContent = `${formatDate(now, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · Kalenderwoche ${getISOWeek(now)}`;

  const today = todayKey();
  const seven = dateKey(addDays(now, 7));
  const openTasks = state.tasks.filter(isOpen);
  const todayTasks = openTasks.filter((t) => dayInRange(today, taskDate(t), taskEndDate(t)));
  const overdue = openTasks.filter(isOverdue);
  const nextSeven = openTasks.filter((t) => taskDate(t) >= today && taskDate(t) <= seven);
  const absent = absencesForDay(today);
  $('#dashboardKpis').innerHTML = [
    kpi('Heute geplant', todayTasks.length, todayTasks.length ? 'Offene Aufgaben für heute' : 'Heute ist nichts offen', ''),
    kpi('Überfällig', overdue.length, overdue.length ? 'Automatisch auf heute weitergetragen' : 'Keine Rückstände', overdue.length ? 'alert' : 'good'),
    kpi('Nächste 7 Tage', nextSeven.length, `${nextSeven.filter((t) => t.kind === 'maintenance').length} Wartungen · ${nextSeven.filter((t) => t.kind === 'work').length} Arbeiten`, ''),
    kpi('Personal heute', absent.length, absent.length ? absent.map((a) => `${employeeName(a.employeeId)}: ${absenceLabel(a.type)}`).slice(0, 2).join(' · ') : 'Keine Abwesenheit eingetragen', absent.length ? 'warn' : 'good')
  ].join('');

  const timelineItems = sortTasks(tasksForDay(today)).filter(isOpen);
  $('#todayPlan').innerHTML = timelineItems.length ? timelineItems.map((t) => `
    <div class="timeline-item">
      <div class="timeline-time">${esc(t.time || 'ganztägig')}</div>
      <span class="kind-bar ${t.kind === 'work' ? 'work' : ''}"></span>
      <div class="timeline-main">
        <div class="timeline-title">${esc(t.title)}</div>
        <div class="timeline-meta"><span>${esc(assetName(t.assetId))}</span><span>${esc(employeeName(t.employeeId))}</span>${t.sapRef ? `<span>SAP ${esc(t.sapRef)}</span>` : ''}${isOverdue(t) ? `<span>Überfällig seit ${esc(formatOverdueDate(t.overdueSince))}</span>` : ''}</div>
      </div>
      <div class="timeline-actions"><button class="mini-button done" data-done-task="${t.id}">Erledigt</button><button class="mini-button" data-edit-task="${t.id}">Öffnen</button></div>
    </div>`).join('') : emptyHtml('Heute ist nichts offen.', 'Über „Arbeit planen“ kannst du direkt eine Aufgabe hinzufügen.');

  const attention = openTasks.filter((t) => t.blocker || t.decisionNeeded).sort((a, b) => taskDate(a).localeCompare(taskDate(b))).slice(0, 5);
  $('#attentionList').innerHTML = attention.length ? attention.map((t) => `
    <button class="compact-item ${t.blocker ? 'alert' : 'warn'}" data-edit-task="${t.id}" style="text-align:left;width:100%">
      <strong>${esc(t.title)}</strong><small>${t.blocker ? `Blocker: ${esc(t.blocker)}` : 'Entscheidung erforderlich'} · ${esc(formatShort(taskDate(t)))}</small>
    </button>`).join('') : emptyHtml('Keine offenen Blocker.', 'Aktuell ist keine Entscheidung oder Sperre hinterlegt.');

  const sap = openTasks.filter((t) => t.sapRef).sort((a, b) => taskDate(a).localeCompare(taskDate(b))).slice(0, 5);
  $('#sapList').innerHTML = sap.length ? sap.map((t) => `
    <button class="compact-item info" data-edit-task="${t.id}" style="text-align:left;width:100%"><strong>${esc(t.sapRef)}</strong><small>${esc(t.title)} · ${esc(assetName(t.assetId))}</small></button>`).join('') : emptyHtml('Keine SAP-Nachverfolgung.', 'SAP-Referenzen kannst du direkt am Arbeitsauftrag hinterlegen.');

  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i));
  $('#nextSeven').innerHTML = days.map((d) => {
    const key = dateKey(d);
    const items = tasksForDay(key).filter(isOpen);
    const holiday = holidayOn(key);
    const school = schoolBreakOn(key);
    return `<button class="upcoming-day ${key === today ? 'today' : ''}" data-jump-date="${key}">
      <div class="upcoming-day-head"><span>${esc(formatWeekday(d))}</span><span>${esc(formatShort(d))}</span></div>
      <div class="upcoming-count">${items.length}</div>
      <div class="upcoming-note">${holiday ? esc(holiday.name) : school ? esc(school.name) : items.length === 1 ? 'offene Aufgabe' : 'offene Aufgaben'}</div>
    </button>`;
  }).join('');
  $('#nextSevenMeta').textContent = `${nextSeven.length} offene Aufgaben`;
}

function kpi(label, value, foot, tone = '') {
  return `<div class="kpi-card ${tone}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div><div class="kpi-foot">${esc(foot)}</div></div>`;
}

function plannerFilters() {
  const assetSelect = $('#plannerAssetFilter');
  const employeeSelect = $('#plannerEmployeeFilter');
  const currentAsset = assetSelect.value;
  const currentEmp = employeeSelect.value;
  assetSelect.innerHTML = `<option value="all">Alle Anlagen</option>${state.assets.map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}`;
  employeeSelect.innerHTML = `<option value="all">Alle Mitarbeiter</option>${state.employees.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}`;
  if ([...assetSelect.options].some((o) => o.value === currentAsset)) assetSelect.value = currentAsset;
  if ([...employeeSelect.options].some((o) => o.value === currentEmp)) employeeSelect.value = currentEmp;
}

function filteredTasks(items) {
  const type = $('#plannerTypeFilter')?.value || 'all';
  const assetId = $('#plannerAssetFilter')?.value || 'all';
  const employeeId = $('#plannerEmployeeFilter')?.value || 'all';
  return items.filter((t) => (type === 'all' || t.kind === type) && (assetId === 'all' || t.assetId === assetId) && (employeeId === 'all' || t.employeeId === employeeId));
}

function renderPlanner() {
  rollOverOverdueTasks();
  plannerFilters();
  const mode = state.settings.weekMode || 'week';
  $$('#plannerMode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  $('#weekPlanner').classList.toggle('hidden', mode !== 'week');
  $('#monthPlanner').classList.toggle('hidden', mode !== 'month');
  if (mode === 'week') renderWeekPlanner(); else renderMonthPlanner();
}

function renderWeekPlanner() {
  const start = startOfWeek(plannerCursor);
  const end = endOfWeek(plannerCursor);
  $('#periodLabel').textContent = `KW ${getISOWeek(start)} · ${formatShort(start)}–${formatShort(end)}`;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  $('#weekPlanner').innerHTML = days.map((d) => renderDayColumn(d)).join('');
}

function renderDayColumn(d) {
  const key = dateKey(d);
  const holiday = holidayOn(key);
  const school = schoolBreakOn(key);
  const items = sortTasks(filteredTasks(tasksForDay(key)));
  const absences = absencesForDay(key).filter((a) => $('#plannerEmployeeFilter').value === 'all' || a.employeeId === $('#plannerEmployeeFilter').value);
  return `<section class="day-column ${[0,6].includes(d.getDay()) ? 'weekend' : ''} ${key === todayKey() ? 'today' : ''}">
    <header class="day-head">
      <div class="day-name"><strong>${esc(formatWeekday(d, true))}</strong><span class="day-number">${d.getDate()}</span></div>
      <div class="day-tags">${holiday ? `<span class="micro-tag holiday">${esc(holiday.name)}</span>` : ''}${school ? `<span class="micro-tag school">${esc(school.name)}</span>` : ''}</div>
    </header>
    <div class="day-body">
      ${items.map(renderPlanCard).join('')}
      ${absences.map((a) => `<button class="absence-card ${a.type}" data-edit-absence="${a.id}">${esc(employeeName(a.employeeId))} · ${esc(absenceLabel(a.type))}</button>`).join('')}
      <button class="add-day" data-add-date="${key}">+ Arbeit an diesem Tag</button>
    </div>
  </section>`;
}

function renderPlanCard(t) {
  const overdue = isOverdue(t);
  const overdueText = overdue ? `Überfällig seit ${formatOverdueDate(t.overdueSince)}` : '';
  const createdDate = t.originalDateFrom || t.overdueSince || taskDate(t);
  const doneDate = t.doneAt ? dateKey(new Date(t.doneAt)) : '';
  const doneMeta = t.status === 'done'
    ? `<br><span>Angelegt am: ${esc(formatOverdueDate(createdDate))}</span><br><span>Erledigt am: ${esc(formatOverdueDate(doneDate))}</span>`
    : '';
  return `<article class="plan-card ${t.kind === 'work' ? 'work' : ''} ${t.status === 'done' ? 'done' : ''} ${overdue ? 'overdue' : ''}" data-edit-task="${t.id}" title="Öffnen">
    <div class="plan-card-title">${esc(t.title)}</div>
    <div class="plan-card-meta">${t.time ? `${esc(t.time)} · ` : ''}${esc(assetName(t.assetId))}<br>${esc(employeeName(t.employeeId))}${doneMeta}</div>
    <div class="plan-card-flags">${overdue ? `<span class="flag high">${esc(overdueText)}</span>` : ''}${t.priority === 'high' ? '<span class="flag high">hoch</span>' : ''}${t.blocker ? '<span class="flag blocker">Blocker</span>' : ''}${t.decisionNeeded ? '<span class="flag decision">Entscheidung</span>' : ''}${t.sapRef ? '<span class="flag sap">SAP</span>' : ''}</div>
  </article>`;
}

function renderMonthPlanner() {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  $('#periodLabel').textContent = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(monthCursor);
  const first = new Date(year, month, 1, 12);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  $('#monthPlanner').innerHTML = `
    <div class="month-weekdays">${['Mo','Di','Mi','Do','Fr','Sa','So'].map((d) => `<div>${d}</div>`).join('')}</div>
    <div class="month-grid">${cells.map((d) => {
      const key = dateKey(d);
      const items = sortTasks(filteredTasks(tasksForDay(key)));
      const holiday = holidayOn(key);
      const school = schoolBreakOn(key);
      return `<div class="month-cell ${d.getMonth() !== month ? 'outside' : ''} ${key === todayKey() ? 'today' : ''}" data-add-date="${key}">
        <div class="month-date"><span>${d.getDate()}</span>${holiday ? `<span class="micro-tag holiday">Feiertag</span>` : school ? `<span class="micro-tag school">Ferien</span>` : ''}</div>
        <div class="month-events">${items.slice(0, 3).map((t) => `<button class="month-event ${t.kind === 'work' ? 'work' : ''}" data-edit-task="${t.id}">${esc(t.title)}${isOverdue(t) ? ` · überfällig seit ${esc(formatOverdueDate(t.overdueSince))}` : ''}</button>`).join('')}${items.length > 3 ? `<span class="month-more">+ ${items.length - 3} weitere</span>` : ''}</div>
      </div>`;
    }).join('')}</div>`;
}

function renderMaintenance() {
  const search = ($('#maintenanceSearch')?.value || '').trim().toLowerCase();
  const matches = (t) => {
    if (!search) return true;
    return [t.title, assetName(t.assetId), employeeName(t.employeeId), t.sapRef, t.notes, t.doneComment, t.blocker]
      .some((v) => String(v || '').toLowerCase().includes(search));
  };

  const tasks = state.tasks.filter((t) => t.kind === 'maintenance');
  const open = tasks.filter((t) => isOpen(t) && matches(t));

  $('#maintenancePlans').innerHTML = state.maintenancePlans.length ? state.maintenancePlans.map((p) => {
    const openCount = state.tasks.filter((t) => t.sourcePlanId === p.id && isOpen(t)).length;
    const interval = `${p.intervalValue || 1} ${p.intervalUnit === 'weeks' ? 'Woche(n)' : p.intervalUnit === 'days' ? 'Tag(e)' : 'Monat(e)'}`;
    return `<article class="entity-card"><div><h3>${esc(p.title)}</h3><div class="entity-meta"><span>${esc(assetName(p.assetId))}</span><span>alle ${esc(interval)}</span><span>nächster: ${esc(formatDate(p.nextDue))}</span><span>${openCount} offen</span>${p.active === false ? '<span>pausiert</span>' : ''}</div></div><div class="entity-actions"><button class="mini-button" data-edit-plan="${p.id}">Bearbeiten</button><button class="mini-button danger" data-delete-plan="${p.id}">Löschen</button></div></article>`;
  }).join('') : emptyHtml('Noch keine Wartungspläne.', 'Lege einen Plan an, damit kommende Termine automatisch erzeugt werden.');

  const history = tasks
    .filter((t) => t.status === 'done' && matches(t))
    .sort((a, b) => String(b.doneAt || taskEndDate(b) || '').localeCompare(String(a.doneAt || taskEndDate(a) || '')));

  $('#maintenanceTasks').innerHTML = open.length
    ? sortTasks(open).map(renderTaskRow).join('')
    : emptyHtml('Keine offenen Wartungsaufgaben.', 'Aktuell ist keine Wartung offen.');

  const historyEl = $('#maintenanceHistory');
  if (historyEl) {
    historyEl.innerHTML = history.length
      ? history.map(renderMaintenanceHistoryRow).join('')
      : emptyHtml('Noch keine Wartungshistorie.', 'Erledigte Wartungen werden automatisch hier abgelegt.');
  }

  const count = $('#maintenanceHistoryCount');
  if (count) count.textContent = history.length ? `${history.length} erledigt` : 'Keine erledigten Wartungen';
}

function renderMaintenanceHistoryRow(t) {
  const doneDate = t.doneAt
    ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(t.doneAt))
    : formatShort(taskEndDate(t));
  return `<div class="task-row maintenance-history-row">
    <div class="task-date"><strong>${esc(doneDate)}</strong><small>erledigt</small></div>
    <div class="task-main"><strong><span class="task-kind"></span>${esc(t.title)}</strong><small>${esc(assetName(t.assetId))}${t.doneComment ? ` · ${esc(t.doneComment)}` : ''}</small></div>
    <div class="task-cell hide-mobile-cell"><strong>${esc(employeeName(t.employeeId))}</strong><small>${t.sapRef ? `SAP ${esc(t.sapRef)}` : 'ohne SAP-Referenz'}</small></div>
    <div class="task-cell hide-mid"><span class="priority-badge ${esc(t.priority || 'normal')}">${esc(priorityLabel(t.priority))}</span></div>
    <div class="task-cell hide-tablet"><span class="status-badge done">Erledigt</span></div>
    <div class="row-actions"><button class="mini-button" data-edit-task="${t.id}">Öffnen</button><button class="mini-button danger" data-delete-task="${t.id}">Löschen</button></div>
  </div>`;
}

function renderWork() {
  const search = $('#workSearch').value.trim().toLowerCase();
  const priority = $('#workPriorityFilter').value;
  const matches = (t) => {
    if (priority !== 'all' && t.priority !== priority) return false;
    if (!search) return true;
    return [t.title, assetName(t.assetId), t.sapRef, t.notes, t.doneComment, employeeName(t.employeeId)]
      .some((v) => String(v || '').toLowerCase().includes(search));
  };

  const open = sortTasks(state.tasks.filter((t) => t.kind === 'work' && isOpen(t) && matches(t)));
  const history = state.tasks
    .filter((t) => t.kind === 'work' && t.status === 'done' && matches(t))
    .sort((a, b) => String(b.doneAt || taskEndDate(b) || '').localeCompare(String(a.doneAt || taskEndDate(a) || '')));

  $('#workOrders').innerHTML = open.length
    ? open.map(renderTaskRow).join('')
    : emptyHtml('Keine offenen Arbeitsaufträge.', 'Neue Arbeiten kannst du über „+ Arbeitsauftrag“ planen.');

  const historyEl = $('#workHistory');
  if (historyEl) {
    historyEl.innerHTML = history.length
      ? history.map(renderWorkHistoryRow).join('')
      : emptyHtml('Noch keine Historie.', 'Erledigte Arbeitsaufträge werden automatisch hier abgelegt.');
  }

  const count = $('#workHistoryCount');
  if (count) count.textContent = history.length ? `${history.length} erledigt` : 'Keine erledigten Aufträge';
}

function renderWorkHistoryRow(t) {
  const doneDate = t.doneAt
    ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(t.doneAt))
    : formatShort(taskEndDate(t));
  return `<div class="task-row work-history-row">
    <div class="task-date"><strong>${esc(doneDate)}</strong><small>erledigt</small></div>
    <div class="task-main"><strong><span class="task-kind work"></span>${esc(t.title)}</strong><small>${esc(assetName(t.assetId))}${t.doneComment ? ` · ${esc(t.doneComment)}` : ''}</small></div>
    <div class="task-cell hide-mobile-cell"><strong>${esc(employeeName(t.employeeId))}</strong><small>${t.sapRef ? `SAP ${esc(t.sapRef)}` : 'ohne SAP-Referenz'}</small></div>
    <div class="task-cell hide-mid"><span class="priority-badge ${esc(t.priority || 'normal')}">${esc(priorityLabel(t.priority))}</span></div>
    <div class="task-cell hide-tablet"><span class="status-badge done">Erledigt</span></div>
    <div class="row-actions"><button class="mini-button" data-edit-task="${t.id}">Öffnen</button><button class="mini-button danger" data-delete-task="${t.id}">Löschen</button></div>
  </div>`;
}

function renderTaskRow(t) {
  const overdue = isOverdue(t);
  const statusClass = t.status === 'done' ? 'done' : overdue ? 'overdue' : 'open';
  const statusText = t.status === 'done' ? 'Erledigt' : overdue ? `Überfällig seit ${formatOverdueDate(t.overdueSince)}` : 'Offen';
  return `<div class="task-row">
    <div class="task-date"><strong>${esc(formatShort(taskDate(t)))}</strong><small>${t.time ? esc(t.time) : `KW ${getISOWeek(parseDate(taskDate(t)))}`}</small></div>
    <div class="task-main"><strong><span class="task-kind ${t.kind === 'work' ? 'work' : ''}"></span>${esc(t.title)}</strong><small>${esc(assetName(t.assetId))}${t.blocker ? ` · Blocker: ${esc(t.blocker)}` : ''}${overdue ? ` · Überfällig seit ${esc(formatOverdueDate(t.overdueSince))}` : ''}</small></div>
    <div class="task-cell hide-mobile-cell"><strong>${esc(employeeName(t.employeeId))}</strong><small>${t.sapRef ? `SAP ${esc(t.sapRef)}` : 'ohne SAP-Referenz'}</small></div>
    <div class="task-cell hide-mid"><span class="priority-badge ${esc(t.priority || 'normal')}">${esc(priorityLabel(t.priority))}</span></div>
    <div class="task-cell hide-tablet"><span class="status-badge ${statusClass}">${esc(statusText)}</span></div>
    <div class="row-actions">${t.status !== 'done' ? `<button class="mini-button done" data-done-task="${t.id}">Erledigt</button>` : ''}<button class="mini-button" data-edit-task="${t.id}">Bearbeiten</button><button class="mini-button danger" data-delete-task="${t.id}">Löschen</button></div>
  </div>`;
}

function renderAssets() {
  const q = $('#assetSearch').value.trim().toLowerCase();
  const assets = state.assets.filter((a) => !q || [a.name, a.number, a.location].some((v) => String(v || '').toLowerCase().includes(q)));
  $('#assetGrid').innerHTML = assets.length ? assets.map((a) => {
    const open = state.tasks.filter((t) => t.assetId === a.id && isOpen(t));
    const overdue = open.filter(isOverdue).length;
    const plans = state.maintenancePlans.filter((p) => p.assetId === a.id && p.active !== false).length;
    return `<article class="asset-card"><div class="asset-top"><div><h2>${esc(a.name)}</h2><div class="asset-number">${esc(a.number || 'Keine Anlagennummer')}</div></div><button class="mini-button" data-edit-asset="${a.id}">Bearbeiten</button></div><p class="asset-location">${esc(a.location || 'Kein Standort hinterlegt')}</p><div class="asset-stats"><div class="asset-stat"><strong>${open.length}</strong><span>offen</span></div><div class="asset-stat"><strong>${overdue}</strong><span>überfällig</span></div><div class="asset-stat"><strong>${plans}</strong><span>Wartungspläne</span></div></div></article>`;
  }).join('') : emptyHtml('Keine Anlagen gefunden.', 'Lege eine Anlage an oder passe die Suche an.');
}

function renderTeam() {
  const thisWeekStart = dateKey(startOfWeek(new Date()));
  const thisWeekEnd = dateKey(endOfWeek(new Date()));
  $('#employeeGrid').innerHTML = state.employees.length ? state.employees.map((e) => {
    const tasks = state.tasks.filter((t) => t.employeeId === e.id && isOpen(t) && taskDate(t) <= thisWeekEnd && taskEndDate(t) >= thisWeekStart);
    const currentAbsence = state.absences.find((a) => a.employeeId === e.id && dayInRange(todayKey(), a.start, a.end));
    return `<article class="employee-card"><div class="employee-head"><div class="avatar">${esc(initials(e.name))}</div><div class="employee-name"><strong>${esc(e.name)}</strong><span>${esc(e.dept || 'Keine Abteilung')}</span></div><button class="mini-button" data-edit-employee="${e.id}">Bearbeiten</button></div><div class="capacity-row"><span>${currentAbsence ? esc(absenceLabel(currentAbsence.type)) : 'Heute verfügbar'}</span><strong>${tasks.length} Aufgabe${tasks.length === 1 ? '' : 'n'} diese Woche</strong></div></article>`;
  }).join('') : emptyHtml('Noch keine Mitarbeiter.', 'Lege dein Team an, damit Aufgaben zugeordnet werden können.');

  const absences = [...state.absences].sort((a, b) => a.start.localeCompare(b.start));
  $('#absenceList').innerHTML = absences.length ? absences.map((a) => `<article class="entity-card"><div><h3>${esc(employeeName(a.employeeId))} · ${esc(absenceLabel(a.type))}</h3><div class="entity-meta"><span>${esc(formatDate(a.start))} – ${esc(formatDate(a.end))}</span>${a.notes ? `<span>${esc(a.notes)}</span>` : ''}</div></div><div class="entity-actions"><button class="mini-button" data-edit-absence="${a.id}">Bearbeiten</button><button class="mini-button danger" data-delete-absence="${a.id}">Löschen</button></div></article>`).join('') : emptyHtml('Keine Abwesenheiten eingetragen.', 'Urlaub, Krankheit und Schichtabweichungen erscheinen hier und in der Wochenplanung.');
}

function options(items, selected, emptyLabel = 'Nicht zugeordnet') {
  return `<option value="">${esc(emptyLabel)}</option>${items.map((x) => `<option value="${x.id}" ${x.id === selected ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}`;
}

function openModal(type, entityId = '', defaults = {}) {
  const form = $('#entityForm');
  form.dataset.formType = type;
  form.dataset.entityId = entityId;
  let title = '';
  let eyebrow = 'Erfassen';
  let html = '';

  if (type === 'work' || type === 'task') {
    const t = state.tasks.find((x) => x.id === entityId) || { kind: defaults.kind || 'work', dateFrom: defaults.date || todayKey(), dateTo: defaults.date || todayKey(), priority: 'normal', status: 'open' };
    const isMaint = t.kind === 'maintenance';
    title = entityId ? `${isMaint ? 'Wartungsaufgabe' : 'Arbeitsauftrag'} bearbeiten` : 'Arbeitsauftrag planen';
    eyebrow = isMaint ? 'Wartungstermin' : 'Arbeitsplanung';
    html = `<div class="form-grid">
      <div class="form-field full"><label>Titel</label><input name="title" type="text" value="${esc(t.title || '')}" placeholder="z. B. Motor tauschen" required></div>
      <div class="form-field"><label>Anlage</label><select name="assetId" required>${options(state.assets, t.assetId, 'Anlage auswählen')}</select></div>
      <div class="form-field"><label>Verantwortlich</label><select name="employeeId">${options(state.employees, t.employeeId)}</select></div>
      <div class="form-field"><label>Datum von</label><input name="dateFrom" type="date" value="${esc(t.dateFrom || todayKey())}" required></div>
      <div class="form-field"><label>Datum bis</label><input name="dateTo" type="date" value="${esc(t.dateTo || t.dateFrom || todayKey())}"></div>
      <div class="form-field"><label>Uhrzeit</label><input name="time" type="time" value="${esc(t.time || '')}"></div>
      <div class="form-field"><label>Priorität</label><select name="priority"><option value="high" ${t.priority === 'high' ? 'selected' : ''}>Hoch</option><option value="normal" ${!t.priority || t.priority === 'normal' ? 'selected' : ''}>Normal</option><option value="low" ${t.priority === 'low' ? 'selected' : ''}>Niedrig</option></select></div>
      <div class="form-field full"><label>SAP PM / Auftrag / Meldung</label><input name="sapRef" type="text" value="${esc(t.sapRef || '')}" placeholder="z. B. 4001234 oder IW38"></div>
      <div class="form-field full"><label>Blocker</label><input name="blocker" type="text" value="${esc(t.blocker || '')}" placeholder="z. B. Ersatzteil fehlt, Freigabe ausstehend"></div>
      <div class="form-field full"><label class="check-row"><input name="decisionNeeded" type="checkbox" ${t.decisionNeeded ? 'checked' : ''}> Entscheidung erforderlich</label></div>
      <div class="form-field full"><label>Notizen</label><textarea name="notes" placeholder="Arbeitsumfang, Hinweise, Ersatzteile …">${esc(t.notes || '')}</textarea></div>
      ${isOverdue(t) ? `<div class="form-field full"><div class="form-note">Diese Aufgabe wurde automatisch weitergetragen. Ursprünglich fällig am ${esc(formatOverdueDate(t.overdueSince))}.</div></div>` : ''}
      ${isMaint && t.sourcePlanId ? '<div class="form-field full"><div class="form-note">Dieser Termin wurde aus einem Wartungsplan erzeugt. Änderungen hier gelten nur für diesen einzelnen Termin.</div></div>' : ''}
    </div>${formFooter(entityId ? 'Änderungen speichern' : 'Arbeitsauftrag anlegen')}`;
    form.dataset.kind = t.kind || 'work';
  }

  if (type === 'plan') {
    const p = state.maintenancePlans.find((x) => x.id === entityId) || { active: true, intervalValue: 4, intervalUnit: 'weeks', nextDue: defaults.date || todayKey() };
    title = entityId ? 'Wartungsplan bearbeiten' : 'Wartungsplan anlegen';
    eyebrow = 'Vorbeugende Instandhaltung';
    html = `<div class="form-grid">
      <div class="form-field full"><label>Wartung</label><input name="title" type="text" value="${esc(p.title || '')}" placeholder="z. B. Schmierung und Sichtkontrolle" required></div>
      <div class="form-field"><label>Anlage</label><select name="assetId" required>${options(state.assets, p.assetId, 'Anlage auswählen')}</select></div>
      <div class="form-field"><label>Standard-Verantwortlicher</label><select name="employeeId">${options(state.employees, p.employeeId)}</select></div>
      <div class="form-field"><label>Nächster Termin</label><input name="nextDue" type="date" value="${esc(p.nextDue || todayKey())}" required></div>
      <div class="form-field"><label>Intervall</label><div style="display:grid;grid-template-columns:90px 1fr;gap:7px"><input name="intervalValue" type="number" min="1" value="${esc(p.intervalValue || 1)}" required><select name="intervalUnit"><option value="days" ${p.intervalUnit === 'days' ? 'selected' : ''}>Tag(e)</option><option value="weeks" ${p.intervalUnit === 'weeks' ? 'selected' : ''}>Woche(n)</option><option value="months" ${!p.intervalUnit || p.intervalUnit === 'months' ? 'selected' : ''}>Monat(e)</option></select></div></div>
      <div class="form-field full"><label class="check-row"><input name="active" type="checkbox" ${p.active !== false ? 'checked' : ''}> Wartungsplan aktiv</label></div>
      <div class="form-field full"><label>Hinweise</label><textarea name="notes">${esc(p.notes || '')}</textarea></div>
      <div class="form-field full"><div class="form-note">Version 2.0 erzeugt aus diesem Plan automatisch die kommenden Wartungsaufgaben. Erledigte Termine bleiben als Historie erhalten.</div></div>
    </div>${formFooter(entityId ? 'Wartungsplan speichern' : 'Wartungsplan anlegen')}`;
  }

  if (type === 'asset') {
    const a = state.assets.find((x) => x.id === entityId) || {};
    title = entityId ? 'Anlage bearbeiten' : 'Anlage anlegen';
    eyebrow = 'Stammdaten';
    html = `<div class="form-grid"><div class="form-field full"><label>Bezeichnung</label><input name="name" type="text" value="${esc(a.name || '')}" required></div><div class="form-field"><label>Anlagennummer</label><input name="number" type="text" value="${esc(a.number || '')}"></div><div class="form-field"><label>Standort</label><input name="location" type="text" value="${esc(a.location || '')}"></div><div class="form-field full"><label>Notizen</label><textarea name="notes">${esc(a.notes || '')}</textarea></div></div>${formFooter(entityId ? 'Anlage speichern' : 'Anlage anlegen')}`;
  }

  if (type === 'employee') {
    const e = state.employees.find((x) => x.id === entityId) || {};
    title = entityId ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen';
    eyebrow = 'Team';
    html = `<div class="form-grid"><div class="form-field full"><label>Name</label><input name="name" type="text" value="${esc(e.name || '')}" required></div><div class="form-field full"><label>Bereich / Qualifikation</label><input name="dept" type="text" value="${esc(e.dept || '')}" placeholder="z. B. Mechanik"></div><div class="form-field full"><label>Notizen</label><textarea name="notes">${esc(e.notes || '')}</textarea></div></div>${formFooter(entityId ? 'Mitarbeiter speichern' : 'Mitarbeiter anlegen')}`;
  }

  if (type === 'absence') {
    const a = state.absences.find((x) => x.id === entityId) || { type: 'vacation', start: defaults.date || todayKey(), end: defaults.date || todayKey() };
    title = entityId ? 'Abwesenheit bearbeiten' : 'Abwesenheit eintragen';
    eyebrow = 'Teamplanung';
    html = `<div class="form-grid"><div class="form-field full"><label>Mitarbeiter</label><select name="employeeId" required>${options(state.employees, a.employeeId, 'Mitarbeiter auswählen')}</select></div><div class="form-field"><label>Art</label><select name="type"><option value="vacation" ${a.type === 'vacation' ? 'selected' : ''}>Urlaub</option><option value="sick" ${a.type === 'sick' ? 'selected' : ''}>Krank</option><option value="shift" ${a.type === 'shift' ? 'selected' : ''}>Schichtabweichung</option></select></div><div></div><div class="form-field"><label>Von</label><input name="start" type="date" value="${esc(a.start || todayKey())}" required></div><div class="form-field"><label>Bis</label><input name="end" type="date" value="${esc(a.end || a.start || todayKey())}" required></div><div class="form-field full"><label>Notiz</label><textarea name="notes">${esc(a.notes || '')}</textarea></div></div>${formFooter(entityId ? 'Eintrag speichern' : 'Abwesenheit eintragen')}`;
  }

  $('#modalEyebrow').textContent = eyebrow;
  $('#modalTitle').textContent = title;
  form.innerHTML = html;
  $('#modalBackdrop').classList.add('open');
  $('#modalBackdrop').setAttribute('aria-hidden', 'false');
  setTimeout(() => form.querySelector('input,select,textarea')?.focus(), 50);
}

function formFooter(label) { return `<div class="form-footer"><button type="button" class="button secondary" data-close-modal>Abbrechen</button><button type="submit" class="button primary">${esc(label)}</button></div>`; }
function closeModal() { $('#modalBackdrop').classList.remove('open'); $('#modalBackdrop').setAttribute('aria-hidden', 'true'); $('#entityForm').innerHTML = ''; }

function handleFormSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const type = form.dataset.formType;
  const entityId = form.dataset.entityId;

  if (type === 'work' || type === 'task') {
    const dateFrom = fd.get('dateFrom');
    const dateTo = fd.get('dateTo') || dateFrom;
    if (dateTo < dateFrom) return toast('„Datum bis“ darf nicht vor „Datum von“ liegen.');
    const existing = state.tasks.find((x) => x.id === entityId);
    const payload = {
      ...(existing || {}), id: existing?.id || id('task'), kind: existing?.kind || form.dataset.kind || 'work',
      title: String(fd.get('title') || '').trim(), assetId: fd.get('assetId') || '', employeeId: fd.get('employeeId') || '',
      dateFrom, dateTo, originalDateFrom: existing?.originalDateFrom || existing?.overdueSince || dateFrom, originalDateTo: existing?.originalDateTo || dateTo,
      createdAt: existing?.createdAt || new Date().toISOString(), time: fd.get('time') || '', priority: fd.get('priority') || 'normal', status: existing?.status || 'open',
      notes: String(fd.get('notes') || '').trim(), sapRef: String(fd.get('sapRef') || '').trim(),
      decisionNeeded: fd.get('decisionNeeded') === 'on', blocker: String(fd.get('blocker') || '').trim(),
      sourcePlanId: existing?.sourcePlanId || null, sourceKey: existing?.sourceKey || null
    };
    if (!payload.title || !payload.assetId || !payload.dateFrom) return toast('Bitte Titel, Anlage und Datum ausfüllen.');
    if (existing) Object.assign(existing, payload); else state.tasks.push(payload);
    persist(existing ? 'Aufgabe aktualisiert.' : 'Arbeitsauftrag angelegt.');
  }

  if (type === 'plan') {
    const existing = state.maintenancePlans.find((x) => x.id === entityId);
    const planId = existing?.id || id('plan');
    if (existing) {
      state.tasks = state.tasks.filter((t) => !(t.sourcePlanId === planId && isOpen(t) && taskDate(t) >= todayKey()));
    }
    const payload = {
      id: planId, title: String(fd.get('title') || '').trim(), assetId: fd.get('assetId') || '', employeeId: fd.get('employeeId') || '',
      nextDue: fd.get('nextDue') || '', intervalValue: Math.max(1, Number(fd.get('intervalValue')) || 1), intervalUnit: fd.get('intervalUnit') || 'months',
      active: fd.get('active') === 'on', notes: String(fd.get('notes') || '').trim()
    };
    if (!payload.title || !payload.assetId || !payload.nextDue) return toast('Bitte Wartung, Anlage und nächsten Termin ausfüllen.');
    if (existing) Object.assign(existing, payload); else state.maintenancePlans.push(payload);
    syncMaintenancePlanTasks(state);
    persist(existing ? 'Wartungsplan aktualisiert.' : 'Wartungsplan angelegt.');
  }

  if (type === 'asset') {
    const existing = state.assets.find((x) => x.id === entityId);
    const payload = { id: existing?.id || id('asset'), name: String(fd.get('name') || '').trim(), number: String(fd.get('number') || '').trim(), location: String(fd.get('location') || '').trim(), notes: String(fd.get('notes') || '').trim() };
    if (!payload.name) return toast('Bitte eine Anlagenbezeichnung eingeben.');
    if (existing) Object.assign(existing, payload); else state.assets.push(payload);
    persist(existing ? 'Anlage aktualisiert.' : 'Anlage angelegt.');
  }

  if (type === 'employee') {
    const existing = state.employees.find((x) => x.id === entityId);
    const payload = { id: existing?.id || id('emp'), name: String(fd.get('name') || '').trim(), dept: String(fd.get('dept') || '').trim(), notes: String(fd.get('notes') || '').trim() };
    if (!payload.name) return toast('Bitte einen Namen eingeben.');
    if (existing) Object.assign(existing, payload); else state.employees.push(payload);
    persist(existing ? 'Mitarbeiter aktualisiert.' : 'Mitarbeiter angelegt.');
  }

  if (type === 'absence') {
    const start = fd.get('start'); const end = fd.get('end');
    if (end < start) return toast('„Bis“ darf nicht vor „Von“ liegen.');
    const existing = state.absences.find((x) => x.id === entityId);
    const payload = { id: existing?.id || id('abs'), employeeId: fd.get('employeeId') || '', type: fd.get('type') || 'vacation', start, end, notes: String(fd.get('notes') || '').trim() };
    if (!payload.employeeId || !start || !end) return toast('Bitte Mitarbeiter und Zeitraum ausfüllen.');
    if (existing) Object.assign(existing, payload); else state.absences.push(payload);
    persist(existing ? 'Teamplanung aktualisiert.' : 'Abwesenheit eingetragen.');
  }

  closeModal();
  renderActiveView();
}

function markDone(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const comment = window.prompt('Kommentar zur Erledigung (optional):', task.doneComment || '');
  if (comment === null) return;
  const originalFrom = task.originalDateFrom || task.overdueSince || taskDate(task);
  const originalTo = task.originalDateTo || originalFrom;
  task.originalDateFrom = originalFrom;
  task.originalDateTo = originalTo;
  task.status = 'done';
  task.doneComment = comment.trim();
  task.doneAt = new Date().toISOString();
  task.dateFrom = originalFrom;
  task.dateTo = originalTo;
  persist('Aufgabe als erledigt markiert.');
  renderActiveView();
}

function deleteTask(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !confirm(`„${task.title}“ wirklich löschen?`)) return;
  state.tasks = state.tasks.filter((t) => t.id !== taskId);
  persist('Aufgabe gelöscht.');
  renderActiveView();
}

function deletePlan(planId) {
  const plan = state.maintenancePlans.find((p) => p.id === planId);
  if (!plan || !confirm(`Wartungsplan „${plan.title}“ löschen? Erledigte Historie bleibt erhalten.`)) return;
  state.maintenancePlans = state.maintenancePlans.filter((p) => p.id !== planId);
  state.tasks = state.tasks.filter((t) => !(t.sourcePlanId === planId && isOpen(t)));
  persist('Wartungsplan gelöscht.');
  renderMaintenance();
}

function deleteAbsence(absenceId) {
  const a = state.absences.find((x) => x.id === absenceId);
  if (!a || !confirm(`${employeeName(a.employeeId)} · ${absenceLabel(a.type)} löschen?`)) return;
  state.absences = state.absences.filter((x) => x.id !== absenceId);
  persist('Eintrag gelöscht.');
  renderActiveView();
}

function openDataPanel() {
  $('#dataBackdrop').classList.add('open');
  $('#dataBackdrop').setAttribute('aria-hidden', 'false');
  $('#importLegacyBrowser').classList.toggle('hidden', !hasLegacyBrowserData());
  renderChrome();
}
function closeDataPanel() { $('#dataBackdrop').classList.remove('open'); $('#dataBackdrop').setAttribute('aria-hidden', 'true'); }
function openMobileNav() { $('#sidebar').classList.add('open'); $('#mobileBackdrop').classList.add('open'); }
function closeMobileNav() { $('#sidebar').classList.remove('open'); $('#mobileBackdrop').classList.remove('open'); }

function bindEvents() {
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-view]');
    if (nav) switchView(nav.dataset.view);
    const viewLink = e.target.closest('[data-view-link]');
    if (viewLink) switchView(viewLink.dataset.viewLink);
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'new-work') openModal('work');
    if (action === 'new-maintenance-plan') openModal('plan');
    if (action === 'new-asset') openModal('asset');
    if (action === 'new-employee') openModal('employee');
    if (action === 'new-absence') openModal('absence');

    const editTask = e.target.closest('[data-edit-task]');
    if (editTask) { e.stopPropagation(); openModal('task', editTask.dataset.editTask); }
    const done = e.target.closest('[data-done-task]');
    if (done) { e.stopPropagation(); markDone(done.dataset.doneTask); }
    const delTask = e.target.closest('[data-delete-task]');
    if (delTask) { e.stopPropagation(); deleteTask(delTask.dataset.deleteTask); }
    const editPlan = e.target.closest('[data-edit-plan]'); if (editPlan) openModal('plan', editPlan.dataset.editPlan);
    const delPlan = e.target.closest('[data-delete-plan]'); if (delPlan) deletePlan(delPlan.dataset.deletePlan);
    const editAsset = e.target.closest('[data-edit-asset]'); if (editAsset) openModal('asset', editAsset.dataset.editAsset);
    const editEmployee = e.target.closest('[data-edit-employee]'); if (editEmployee) openModal('employee', editEmployee.dataset.editEmployee);
    const editAbsence = e.target.closest('[data-edit-absence]'); if (editAbsence) openModal('absence', editAbsence.dataset.editAbsence);
    const delAbsence = e.target.closest('[data-delete-absence]'); if (delAbsence) deleteAbsence(delAbsence.dataset.deleteAbsence);
    const addDate = e.target.closest('[data-add-date]'); if (addDate && !e.target.closest('[data-edit-task]')) openModal('work', '', { date: addDate.dataset.addDate });
    const jumpDate = e.target.closest('[data-jump-date]'); if (jumpDate) { plannerCursor = startOfWeek(parseDate(jumpDate.dataset.jumpDate)); monthCursor = new Date(parseDate(jumpDate.dataset.jumpDate).getFullYear(), parseDate(jumpDate.dataset.jumpDate).getMonth(), 1, 12); switchView('week'); }
    if (e.target.closest('[data-close-modal]')) closeModal();
  });

  $('#entityForm').addEventListener('submit', handleFormSubmit);
  $('#closeModal').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target === $('#modalBackdrop')) closeModal(); });
  $('#quickAddButton').addEventListener('click', () => openModal('work'));
  $('#backupButton').addEventListener('click', () => exportBackup(state));
  $('#openDataPanel').addEventListener('click', openDataPanel);
  $('#closeDataPanel').addEventListener('click', closeDataPanel);
  $('#dataBackdrop').addEventListener('click', (e) => { if (e.target === $('#dataBackdrop')) closeDataPanel(); });
  $('#exportData').addEventListener('click', () => exportBackup(state));
  $('#importFiles').addEventListener('change', async (e) => {
    if (!e.target.files?.length) return;
    const imported = await importLegacyFiles(e.target.files);
    if (!confirm(`Import gefunden: ${imported.assets.length} Anlagen, ${imported.employees.length} Mitarbeiter, ${imported.tasks.length} Aufgaben. Aktuellen Datenbestand ersetzen?`)) { e.target.value = ''; return; }
    state = imported; clearDemoFlag(state); syncMaintenancePlanTasks(state); rollOverOverdueTasks(); persist('Daten importiert.'); e.target.value = ''; closeDataPanel(); renderActiveView();
  });
  $('#importLegacyBrowser').addEventListener('click', () => {
    const imported = importLegacyBrowserData();
    if (!confirm(`Alte Browserdaten gefunden: ${imported.assets.length} Anlagen und ${imported.tasks.length} Termine. Aktuellen Datenbestand ersetzen?`)) return;
    state = imported; rollOverOverdueTasks(); persist('Alte Browserdaten übernommen.'); closeDataPanel(); renderActiveView();
  });
  $('#loadDemo').addEventListener('click', () => { if (!confirm('Aktuellen Datenbestand durch Beispieldaten ersetzen?')) return; state = resetToDemo(); rollOverOverdueTasks(); closeDataPanel(); renderActiveView(); renderChrome(); toast('Beispieldaten geladen.'); });
  $('#clearData').addEventListener('click', () => { if (!confirm('Planungsdaten in diesem Browser leeren?')) return; state = emptyState(); closeDataPanel(); renderActiveView(); renderChrome(); toast('Lokale Daten gelöscht.'); });

  $('#mobileMenu').addEventListener('click', openMobileNav);
  $('#mobileBackdrop').addEventListener('click', closeMobileNav);

  $$('#plannerMode button').forEach((b) => b.addEventListener('click', () => { state.settings.weekMode = b.dataset.mode; saveState(state); renderPlanner(); }));
  $('#prevPeriod').addEventListener('click', () => { if (state.settings.weekMode === 'month') monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1, 12); else plannerCursor = addDays(plannerCursor, -7); renderPlanner(); });
  $('#nextPeriod').addEventListener('click', () => { if (state.settings.weekMode === 'month') monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1, 12); else plannerCursor = addDays(plannerCursor, 7); renderPlanner(); });
  $('#todayPeriod').addEventListener('click', () => { plannerCursor = startOfWeek(new Date()); monthCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12); renderPlanner(); });
  ['plannerTypeFilter','plannerAssetFilter','plannerEmployeeFilter'].forEach((id) => $(`#${id}`).addEventListener('change', renderPlanner));
  $('#maintenanceSearch')?.addEventListener('input', renderMaintenance);
  ['workSearch','workPriorityFilter'].forEach((id) => $(`#${id}`).addEventListener(id === 'workSearch' ? 'input' : 'change', renderWork));
  $('#assetSearch').addEventListener('input', renderAssets);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeDataPanel(); closeMobileNav(); }
  });
}

function init() {
  bindEvents();
  rollOverOverdueTasks();
  renderChrome();
  switchView(activeView);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
