const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (value) => value ? new Date(`${value}T12:00:00`) : null;
export const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };

export function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d;
}

export function endOfWeek(date) { return addDays(startOfWeek(date), 6); }
export function formatDate(value, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  const d = typeof value === 'string' ? parseDate(value) : value;
  return d ? new Intl.DateTimeFormat('de-DE', options).format(d) : '';
}
export function formatShort(value) { return formatDate(value, { day: '2-digit', month: '2-digit' }); }
export function formatWeekday(value, long = false) { return formatDate(value, { weekday: long ? 'long' : 'short' }); }

function easterSunday(year) {
  const f = Math.floor;
  const a = year % 19;
  const b = f(year / 100);
  const c = year % 100;
  const d = f(b / 4);
  const e = b % 4;
  const g = f((8 * b + 13) / 25);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = f(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = f((a + 11 * h + 22 * l) / 451);
  const month = f((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}

export function holidaysNRW(year) {
  const easter = easterSunday(year);
  const fixed = [
    [`${year}-01-01`, 'Neujahr'],
    [`${year}-05-01`, 'Tag der Arbeit'],
    [`${year}-10-03`, 'Tag der Deutschen Einheit'],
    [`${year}-11-01`, 'Allerheiligen'],
    [`${year}-12-25`, '1. Weihnachtstag'],
    [`${year}-12-26`, '2. Weihnachtstag']
  ];
  const moving = [
    [dateKey(addDays(easter, -2)), 'Karfreitag'],
    [dateKey(addDays(easter, 1)), 'Ostermontag'],
    [dateKey(addDays(easter, 39)), 'Christi Himmelfahrt'],
    [dateKey(addDays(easter, 50)), 'Pfingstmontag'],
    [dateKey(addDays(easter, 60)), 'Fronleichnam']
  ];
  return [...fixed, ...moving].map(([date, name]) => ({ date, name }));
}

// Offizielle NRW-Ferienordnung, Schuljahre 2025/26 bis 2029/30.
export const schoolBreaksNRW = [
  { name: 'Sommerferien', start: '2025-07-14', end: '2025-08-26' },
  { name: 'Herbstferien', start: '2025-10-13', end: '2025-10-25' },
  { name: 'Weihnachtsferien', start: '2025-12-22', end: '2026-01-06' },
  { name: 'Osterferien', start: '2026-03-30', end: '2026-04-11' },
  { name: 'Pfingstferien', start: '2026-05-26', end: '2026-05-26' },
  { name: 'Sommerferien', start: '2026-07-20', end: '2026-09-01' },
  { name: 'Herbstferien', start: '2026-10-17', end: '2026-10-31' },
  { name: 'Weihnachtsferien', start: '2026-12-23', end: '2027-01-06' },
  { name: 'Osterferien', start: '2027-03-22', end: '2027-04-03' },
  { name: 'Pfingstferien', start: '2027-05-18', end: '2027-05-18' },
  { name: 'Sommerferien', start: '2027-07-19', end: '2027-08-31' },
  { name: 'Herbstferien', start: '2027-10-23', end: '2027-11-06' },
  { name: 'Weihnachtsferien', start: '2027-12-24', end: '2028-01-08' },
  { name: 'Osterferien', start: '2028-04-10', end: '2028-04-22' },
  { name: 'Sommerferien', start: '2028-07-10', end: '2028-08-22' },
  { name: 'Herbstferien', start: '2028-10-23', end: '2028-11-04' },
  { name: 'Weihnachtsferien', start: '2028-12-21', end: '2029-01-05' },
  { name: 'Osterferien', start: '2029-03-26', end: '2029-04-07' },
  { name: 'Pfingstferien', start: '2029-05-22', end: '2029-05-22' },
  { name: 'Sommerferien', start: '2029-07-02', end: '2029-08-14' },
  { name: 'Herbstferien', start: '2029-10-15', end: '2029-10-27' },
  { name: 'Weihnachtsferien', start: '2029-12-20', end: '2030-01-04' },
  { name: 'Osterferien', start: '2030-04-15', end: '2030-04-27' }
];

export function holidayOn(dateOrKey) {
  const key = typeof dateOrKey === 'string' ? dateOrKey : dateKey(dateOrKey);
  const year = Number(key.slice(0, 4));
  return holidaysNRW(year).find((h) => h.date === key) || null;
}

export function schoolBreakOn(dateOrKey) {
  const key = typeof dateOrKey === 'string' ? dateOrKey : dateKey(dateOrKey);
  return schoolBreaksNRW.find((f) => key >= f.start && key <= f.end) || null;
}

export function eachDay(start, end) {
  const out = [];
  let d = parseDate(start);
  const last = parseDate(end);
  while (d && last && d <= last) {
    out.push(dateKey(d));
    d = addDays(d, 1);
  }
  return out;
}
