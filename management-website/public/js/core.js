// Shared state, translation, formatting, API and UI building blocks.
import { DICT, LANGS } from './i18n.js';

export const state = {
  lang: 'en',
  langTouched: false,
  user: null,
  perms: [],
  data: null,
  users: null,
  communityFilter: 'all',
  route: { name: 'dashboard', params: [], query: new URLSearchParams() },
  wizard: null,
  helpOpen: false,
  assistantOpen: false,
  assistantLog: [],
  navOpen: false,
  mapCommunity: null,
  mapSelected: null,
};

// Set by app.js to avoid circular imports.
export const hooks = {
  renderView: () => {},
  refresh: async () => {},
  sessionExpired: () => {},
};

// ---------- Translation & formatting ----------

export function t(key, vars = {}) {
  const s = DICT[state.lang]?.[key] ?? DICT.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export const hasKey = (key) => key in DICT.en;
export const locale = () => LANGS[state.lang].locale;
export const fmtNum = (n) => new Intl.NumberFormat(locale()).format(n);
export const fmtAED = (n) => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(n);

export function parseDate(s) {
  if (!s) return null;
  return s.length === 10 ? new Date(`${s}T00:00:00`) : new Date(s);
}

export function fmtDate(s, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = parseDate(s);
  return d ? new Intl.DateTimeFormat(locale(), opts).format(d) : t('common.na');
}

export function fmtTime(hhmm) {
  if (!hhmm) return t('common.na');
  const [hh, mm] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }).format(d);
}

export function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "Today", "Tomorrow", "3 days ago" or a formatted date.
export function relDay(s) {
  const d = parseDate(s);
  if (!d) return t('common.na');
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - start) / 86400000);
  if (diff === 0) return t('dash.today');
  if (diff === 1) return t('dash.tomorrow');
  if (diff === -1) return t('dash.yesterday');
  if (diff < -1 && diff > -30) return t('dash.days_ago', { n: fmtNum(-diff) });
  return fmtDate(s);
}

// ---------- DOM ----------

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  appendAll(el, children);
  return el;
}

export function appendAll(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

let uid = 0;
export const nextId = (p = 'id') => `${p}-${++uid}`;

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10"/><path d="M2 21h20"/><path d="M8 7h4M8 11h4M8 15h4"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>',
  hardhat: '<path d="M2 18h20"/><path d="M4 18v-2a8 8 0 0 1 16 0v2"/><path d="M10 9V5h4v4"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19.5 5.5a9 9 0 0 1 0 13"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M16 15h2"/><path d="M6 6V4h12v2"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  sparkle: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M19 14l.8 2.2 2.2.8-2.2.8L19 20l-.8-2.2-2.2-.8 2.2-.8z"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'chevron-end': '<polyline points="9 18 15 12 9 6"/>',
  'chevron-start': '<polyline points="15 18 9 12 15 6"/>',
  'arrow-end': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  pause: '<circle cx="12" cy="12" r="10"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="14" y1="9" x2="14" y2="15"/>',
  'x-circle': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
};

// Builds a UTF-8 CSV (with BOM so Excel shows Arabic and Hindi correctly) and downloads it.
export function downloadCSV(filename, headers, rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t('common.exported'));
}

const DIRECTIONAL = new Set(['chevron-end', 'chevron-start', 'arrow-end', 'logout', 'send', 'undo']);

export function icon(name, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', `icon${DIRECTIONAL.has(name) ? ' icon-dir' : ''}${cls ? ` ${cls}` : ''}`);
  // Static markup from the table above; never user content.
  svg.innerHTML = ICONS[name] || ICONS.dot;
  return svg;
}

// The Ask Fareej emblem on an ivory tile, so it reads on emerald and dark backgrounds.
// Decorative: the product name is always written next to it.
export function logo(size = 40) {
  return h('span', { class: 'logo-mark', style: { width: `${size}px`, height: `${size}px` } },
    h('img', { src: '/img/ask-fareej-mark.png', alt: '', width: String(size), height: String(size) }));
}

export function fullLogo(width = 260, alt = '') {
  return h('img', { class: 'logo-full', src: '/img/ask-fareej-logo-trim.png', alt, width: String(width) });
}

// Status badges always pair colour with an icon and words.
const TONES = {
  maint: { draft: ['neutral', 'edit'], scheduled: ['info', 'calendar'], in_progress: ['warning', 'clock'], completed: ['success', 'check'], cancelled: ['danger', 'x-circle'] },
  report: { new: ['info', 'info'], in_review: ['gold', 'eye'], in_progress: ['warning', 'clock'], resolved: ['success', 'check'] },
  ann: { draft: ['neutral', 'edit'], pending: ['gold', 'clock'], approved: ['info', 'check'], published: ['success', 'megaphone'], archived: ['neutral', 'archive'] },
  con: { planned: ['neutral', 'calendar'], in_progress: ['warning', 'clock'], on_hold: ['gold', 'pause'], completed: ['success', 'check'] },
  facility: { open: ['success', 'check'], maintenance: ['warning', 'wrench'], closed: ['danger', 'x-circle'] },
  budget: { draft: ['gold', 'edit'], approved: ['success', 'check'] },
};
const STATUS_KEYS = { maint: 'mstatus', report: 'rstatus', ann: 'astatus', con: 'cstatus', facility: 'fstatus', budget: 'bstatus' };

export function statusBadge(kind, status) {
  const [tone, ic] = TONES[kind]?.[status] || ['neutral', 'dot'];
  return badge(t(`${STATUS_KEYS[kind]}.${status}`), tone, ic);
}

export function badge(label, tone = 'neutral', ic = 'dot') {
  return h('span', { class: `badge badge-${tone}` }, icon(ic), h('span', {}, label));
}

export function emptyState(message = t('common.empty'), ic = 'check') {
  return h('div', { class: 'empty' }, icon(ic), h('p', {}, message));
}

// ---------- API ----------

export class ApiError extends Error {
  constructor(code, field, status) {
    super(code);
    this.code = code;
    this.field = field;
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Fareej-Request': '1' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network');
  }
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) hooks.sessionExpired();
    throw new ApiError(data.error || 'generic', data.field, res.status);
  }
  return data;
}

export function errorText(err) {
  const key = `err.${err?.code || 'generic'}`;
  if (!hasKey(key)) return t('err.generic');
  return t(key, { field: err?.field ? t(`field.${err.field}`) : '' });
}

// ---------- Permissions & data helpers ----------

export const can = (perm) => state.perms.includes(perm);

export const communityName = (id) => state.data?.communities.find((c) => c.id === id)?.name || t('common.unknown');
export const facility = (id) => state.data?.facilities.find((f) => f.id === id);
export const facilityName = (id) => facility(id)?.name || '';
export const personName = (id) => state.data?.people.find((p) => p.id === id)?.name || t('common.unknown');
// Staff who can be given work: active, and not view-only.
export const staffOptions = () => state.data.people.filter((p) => p.active && p.role !== 'viewer').map((p) => ({ value: p.id, label: `${p.name} – ${t(`role.${p.role}`)}` }));

export function scoped(list) {
  return state.communityFilter === 'all' ? list : list.filter((r) => (r.communityId || r.id) === state.communityFilter);
}

// Groups unresolved reports about the same category and place. A person decides whether they really match.
export function recurringGroups() {
  const dismissed = new Set(state.data.dismissedGroups.map((g) => g.key));
  const groups = new Map();
  for (const r of scoped(state.data.reports)) {
    if (r.status === 'resolved') continue;
    const key = `${r.communityId}|${r.category}|${r.facilityId || r.location}`;
    if (dismissed.has(key)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.entries()]
    .filter(([, reports]) => reports.length >= 2)
    .map(([key, reports]) => ({
      key,
      reports: reports.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      communityId: reports[0].communityId,
      category: reports[0].category,
      facilityId: reports[0].facilityId,
      place: facilityName(reports[0].facilityId) || reports[0].location,
    }))
    .sort((a, b) => b.reports.length - a.reports.length);
}

export function priorities() {
  const today = todayStr();
  const in7 = todayStr(7);
  return {
    review: scoped(state.data.reports).filter((r) => r.status === 'new' || r.status === 'in_review').length,
    maint: scoped(state.data.maintenance).filter((m) => m.status === 'scheduled' && m.date >= today && m.date <= in7).length,
    ann: scoped(state.data.announcements).filter((a) => a.status === 'pending').length,
    rec: recurringGroups().length,
  };
}

// ---------- Toasts ----------

export function toast(message, { undo, tone = 'success' } = {}) {
  const region = document.getElementById('toasts');
  let timer;
  const el = h('div', { class: `toast toast-${tone}` }, icon(tone === 'error' ? 'alert' : 'check'), h('span', { class: 'toast-msg' }, message));
  const remove = () => { clearTimeout(timer); el.remove(); };
  if (undo) {
    el.append(h('button', {
      class: 'btn btn-sm btn-toast',
      onclick: async () => {
        remove();
        try { await undo(); } catch (e) { toast(errorText(e), { tone: 'error' }); }
      },
    }, icon('undo'), t('common.undo')));
  }
  el.append(h('button', { class: 'icon-btn toast-close', 'aria-label': t('common.close'), onclick: remove }, icon('x')));
  region.append(el);
  timer = setTimeout(remove, undo ? 9000 : 5500);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('focusin', () => clearTimeout(timer));
}

// ---------- Dialogs ----------

export function openDialog({ title, content, actions = [], wide = false, onClose }) {
  const id = nextId('dlg');
  const previous = document.activeElement;
  const dlg = h('dialog', { class: `dialog${wide ? ' dialog-wide' : ''}`, 'aria-labelledby': `${id}-t` });
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    dlg.close();
    dlg.remove();
    if (previous && document.contains(previous)) previous.focus();
    onClose?.(result);
  };
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(false); });
  dlg.append(
    h('div', { class: 'dialog-head' },
      h('h2', { id: `${id}-t`, class: 'dialog-title' }, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('common.close'), onclick: () => close(false) }, icon('x'))),
    h('div', { class: 'dialog-body' }, content),
    actions.length ? h('div', { class: 'dialog-actions' }, actions) : null,
  );
  document.body.append(dlg);
  dlg.showModal();
  return { dlg, close };
}

export function confirmDialog({ title, body, confirmLabel, tone = 'primary' }) {
  return new Promise((resolve) => {
    let d;
    const no = h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => d.close(false) }, t('common.cancel'));
    const yes = h('button', { type: 'button', class: `btn btn-${tone}`, onclick: () => d.close(true) }, confirmLabel || t('common.yes_continue'));
    d = openDialog({
      title,
      content: typeof body === 'string' ? h('p', {}, body) : body,
      actions: [no, yes],
      onClose: (r) => resolve(r === true),
    });
    no.focus();
  });
}

// ---------- Forms ----------

export function field({ label, name, type = 'text', value = '', required, hint, options, placeholder, rows, min, max, step, disabled, autocomplete, inputmode }) {
  const id = nextId(name);
  const hintId = hint ? `${id}-hint` : null;
  const errId = `${id}-err`;
  let control;
  if (type === 'select') {
    control = h('select', { id, name, required, disabled },
      options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  } else if (type === 'textarea') {
    control = h('textarea', { id, name, rows: rows || 4, required, placeholder, disabled }, value ?? '');
  } else {
    control = h('input', { id, name, type, value: value ?? '', required, placeholder, min, max, step, disabled, autocomplete, inputmode });
  }
  control.setAttribute('aria-describedby', [hintId, errId].filter(Boolean).join(' '));
  control.addEventListener('input', () => clearFieldError(control));
  control.addEventListener('change', () => clearFieldError(control));
  return h('div', { class: 'field' },
    h('label', { for: id }, label, required ? h('span', { class: 'req' }, ` (${t('common.required')})`) : null),
    hint ? h('p', { class: 'hint', id: hintId }, hint) : null,
    control,
    h('p', { class: 'field-error', id: errId, hidden: true }));
}

export function checkbox({ label, name, checked, hint, value, group, disabled }) {
  const id = nextId(name);
  const input = h('input', { type: 'checkbox', id, name, checked, value, disabled, dataset: group ? { group: '1' } : undefined });
  if (hint) input.setAttribute('aria-describedby', `${id}-hint ${id}-err`);
  else input.setAttribute('aria-describedby', `${id}-err`);
  input.addEventListener('change', () => clearFieldError(input));
  return h('div', { class: 'check' },
    input,
    h('label', { for: id }, label),
    hint ? h('p', { class: 'hint', id: `${id}-hint` }, hint) : null,
    h('p', { class: 'field-error', id: `${id}-err`, hidden: true }));
}

export function radioGroup({ legend, name, value, options, hint }) {
  return h('fieldset', { class: 'radio-group' },
    h('legend', {}, legend),
    hint ? h('p', { class: 'hint' }, hint) : null,
    h('div', { class: 'radio-options' }, options.map((o) => {
      const id = nextId(name);
      return h('div', { class: 'radio' },
        h('input', { type: 'radio', id, name, value: o.value, checked: o.value === value }),
        h('label', { for: id, lang: o.lang }, o.icon ? icon(o.icon) : null, o.label));
    })));
}

export function setFieldError(control, message) {
  control.setAttribute('aria-invalid', 'true');
  const err = document.getElementById(`${control.id}-err`);
  if (err) {
    err.textContent = message;
    err.hidden = false;
  }
}

export function clearFieldError(control) {
  control.removeAttribute('aria-invalid');
  const err = document.getElementById(`${control.id}-err`);
  if (err) {
    err.hidden = true;
    err.textContent = '';
  }
}

export function showFormError(form, err) {
  const msg = errorText(err);
  const control = err?.field ? form.querySelector(`[name="${err.field}"]`) : null;
  if (control) {
    setFieldError(control, msg);
    control.focus();
    return;
  }
  const box = form.querySelector('.form-alert');
  if (box) {
    box.textContent = msg;
    box.hidden = false;
    box.focus();
  } else {
    toast(msg, { tone: 'error' });
  }
}

export function formAlert() {
  return h('div', { class: 'form-alert', role: 'alert', tabindex: '-1', hidden: true });
}

export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.group) {
        out[el.name] ||= [];
        if (el.checked) out[el.name].push(el.value);
      } else out[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else out[el.name] = el.value;
  }
  return out;
}

// Runs an async action with a busy button, showing errors in the form or as a toast.
export async function withBusy(button, fn, form) {
  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  }
  try {
    return await fn();
  } catch (err) {
    if (err?.code === '__cancelled') return undefined;
    if (form) showFormError(form, err);
    else toast(errorText(err), { tone: 'error' });
    return undefined;
  } finally {
    if (button && document.contains(button)) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

export const options = (values, prefix) => values.map((v) => ({ value: v, label: t(`${prefix}.${v}`) }));

export function communityOptions({ withAll = false } = {}) {
  const list = state.data.communities.map((c) => ({ value: c.id, label: c.name }));
  return withAll ? [{ value: 'all', label: t('common.all_communities') }, ...list] : list;
}

export const MAINT_CATEGORIES = ['ac', 'plumbing', 'electrical', 'lifts', 'pool', 'landscaping', 'cleaning', 'security', 'pest', 'other'];
export const FACILITY_TYPES = ['tower', 'villas', 'pool', 'gym', 'park', 'playground', 'parking', 'lift', 'majlis', 'retail', 'gate'];
export const FINANCE_CATEGORIES = ['maintenance_fund', 'security', 'cleaning', 'utilities', 'landscaping', 'reserve', 'events'];
export const ANN_CATEGORIES = ['general', 'maintenance', 'safety', 'event', 'finance'];
export const EMIRATES = ['abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah'];
