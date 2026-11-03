// Screen renderers. Each view returns a DOM node for <main>.
import {
  state, hooks, t, h, icon, api, can, errorText, toast, openDialog, confirmDialog, field, checkbox, radioGroup,
  formAlert, readForm, withBusy, showFormError, setFieldError, statusBadge, badge, emptyState, scoped, priorities,
  recurringGroups, communityName, facility, facilityName, personName, fmtDate, fmtTime, fmtAED, fmtNum, relDay,
  todayStr, options, communityOptions, nextId, MAINT_CATEGORIES, FACILITY_TYPES, FINANCE_CATEGORIES, ANN_CATEGORIES,
  EMIRATES, ApiError, downloadCSV, staffOptions,
} from './core.js';
import { LANGS } from './i18n.js';

// ---------- Shared pieces ----------

function pageHeader(titleKey, introKey, { actions = [], tech } = {}) {
  return h('header', { class: 'page-head' },
    h('div', { class: 'page-head-text' },
      h('h1', { id: 'page-title', tabindex: '-1' }, t(titleKey)),
      tech ? h('p', { class: 'tech-name' }, tech) : null,
      introKey ? h('p', { class: 'page-intro' }, t(introKey)) : null),
    actions.filter(Boolean).length ? h('div', { class: 'page-actions' }, actions) : null);
}

function viewOnlyNote(...perms) {
  return perms.some((p) => can(p)) ? null : h('p', { class: 'note' }, icon('lock'), t('common.view_only'));
}

function section(title, content, { link, id, headingId } = {}) {
  const hid = headingId || nextId('sec');
  return h('section', { class: 'card section', id, 'aria-labelledby': hid },
    h('div', { class: 'section-head' },
      h('h2', { id: hid }, title),
      link ? h('a', { href: link, class: 'text-link' }, t('common.view_all'), icon('arrow-end')) : null),
    content);
}

function rtable(caption, columns, rows) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'rtable' },
      h('caption', { class: 'sr-only' }, caption),
      h('thead', {}, h('tr', {}, columns.map((c) => h('th', { scope: 'col' }, c.label)))),
      h('tbody', {}, rows.map((r) => h('tr', {}, columns.map((c, i) => h(i === 0 ? 'th' : 'td', {
        scope: i === 0 ? 'row' : null, 'data-label': c.label, class: c.cls,
      }, c.render(r))))))));
}

function btn(label, { cls = 'btn-secondary', ic, onclick, focusKey, disabled, type = 'button' } = {}) {
  return h('button', { type, class: `btn ${cls}`, onclick, disabled, dataset: focusKey ? { focusKey } : undefined },
    ic ? icon(ic) : null, h('span', {}, label));
}

function searchBox(onInput) {
  const id = nextId('search');
  const input = h('input', { id, type: 'search', placeholder: t('common.search_placeholder'), autocomplete: 'off' });
  input.addEventListener('input', () => onInput(input.value.trim().toLowerCase()));
  return h('div', { class: 'field field-inline search' },
    h('label', { for: id }, icon('search'), h('span', {}, t('common.search'))), input);
}

function selectFilter(label, opts, value, onChange) {
  const id = nextId('filter');
  const select = h('select', { id }, opts.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)));
  select.addEventListener('change', () => onChange(select.value));
  return h('div', { class: 'field field-inline' }, h('label', { for: id }, label), select);
}

function noPermission(messageKey = 'err.forbidden') {
  return h('div', {},
    h('h1', { id: 'page-title', tabindex: '-1', class: 'sr-only' }, t('common.view_only')),
    h('div', { class: 'card empty-card' }, icon('lock'), h('p', {}, t(messageKey))));
}

async function run(fn, success, { undo } = {}) {
  try {
    await fn();
    await hooks.refresh();
    if (success) toast(success, { undo });
    return true;
  } catch (e) {
    toast(errorText(e), { tone: 'error' });
    return false;
  }
}

async function deleteRecord(collection, rec) {
  const ok = await confirmDialog({
    title: t('common.confirm_delete_title'), body: t('common.confirm_delete_body'), confirmLabel: t('common.delete'), tone: 'danger',
  });
  if (!ok) return;
  await run(() => api(`/${collection}/${rec.id}`, { method: 'DELETE' }), t('common.deleted'), {
    undo: async () => {
      await api(`/${collection}/${rec.id}/restore`, { method: 'POST' });
      await hooks.refresh();
      toast(t('common.restored'));
    },
  });
}

function formDialog({ title, fields, submitLabel, onSubmit, intro }) {
  const formId = nextId('form');
  const form = h('form', { id: formId, novalidate: true, class: 'form-grid' }, formAlert(), intro, fields);
  const submit = h('button', { type: 'submit', class: 'btn btn-primary', form: formId }, submitLabel || t('common.save'));
  let d;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await withBusy(submit, async () => {
      await onSubmit(readForm(form), form);
      d.close(true);
    }, form);
  });
  const cancel = h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => d.close(false) }, t('common.cancel'));
  d = openDialog({ title, content: form, actions: [cancel, submit], wide: true });
  form.querySelector('input:not([type=hidden]), select, textarea')?.focus();
  return d;
}

function dl(rows) {
  return h('dl', { class: 'details' }, rows.filter(Boolean).map(([k, v]) => h('div', { class: 'details-row' }, h('dt', {}, k), h('dd', {}, v))));
}

function progressBar(value, label) {
  return h('div', {
    class: 'progress', role: 'progressbar', 'aria-valuenow': String(value), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': label,
  }, h('div', { class: 'progress-fill', style: { width: `${Math.min(100, Math.max(0, value))}%` } }));
}

// Opens a record dialog requested through ?open=<id>, then removes the parameter.
function openFromQuery(collection, opener) {
  const id = state.route.query.get('open');
  if (!id) return;
  const rec = state.data[collection].find((r) => r.id === id);
  state.route.query.delete('open');
  history.replaceState(null, '', `#/${state.route.name}`);
  if (rec) setTimeout(() => opener(rec), 0);
}

// ---------- Dashboard ----------

function viewDashboard() {
  const p = priorities();
  const today = todayStr();
  const cards = [
    { n: p.review, label: 'dash.p_review', hint: 'dash.p_review_hint', ic: 'message', tone: p.review ? 'attention' : 'calm', href: '#/reports?status=open' },
    { n: p.maint, label: 'dash.p_maint', hint: 'dash.p_maint_hint', ic: 'calendar', tone: 'info', href: '#/maintenance?status=upcoming' },
    { n: p.ann, label: 'dash.p_ann', hint: 'dash.p_ann_hint', ic: 'megaphone', tone: p.ann ? 'attention' : 'calm', href: '#/announcements?status=pending' },
    { n: p.rec, label: 'dash.p_recurring', hint: 'dash.p_recurring_hint', ic: 'repeat', tone: p.rec ? 'attention' : 'calm', href: '#/reports#recurring' },
  ];

  const upcoming = scoped(state.data.maintenance)
    .filter((m) => m.status === 'in_progress' || (m.status === 'scheduled' && m.date >= today))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)).slice(0, 5);
  const unresolved = scoped(state.data.reports).filter((r) => r.status !== 'resolved')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 5);
  const toPublish = [
    ...scoped(state.data.announcements).filter((a) => a.status === 'pending' || a.status === 'approved')
      .map((a) => ({ title: a.title, meta: `${t('nav.announcements')} · ${communityName(a.communityId)}`, badge: statusBadge('ann', a.status), href: `#/announcements?status=${a.status}` })),
    ...scoped(state.data.maintenance).filter((m) => m.status === 'draft')
      .map((m) => ({ title: m.title, meta: `${t('nav.maintenance')} · ${communityName(m.communityId)}`, badge: statusBadge('maint', 'draft'), href: `#/maintenance?open=${m.id}` })),
  ].slice(0, 5);
  const groups = recurringGroups().slice(0, 3);

  const listOrEmpty = (items) => (items.length ? h('ul', { class: 'item-list' }, items) : emptyState(t('dash.all_clear')));
  const item = ({ title, meta, badgeEl, href }) => h('li', { class: 'item' },
    h('div', { class: 'item-main' },
      href ? h('a', { href, class: 'item-title' }, title) : h('span', { class: 'item-title' }, title),
      h('span', { class: 'item-meta' }, meta)),
    badgeEl);

  const detailed = state.user.prefs.dashboardLayout === 'detailed';
  const approved = scoped(state.data.finances).filter((f) => f.status === 'approved');
  const budget = approved.reduce((s, f) => s + f.budget, 0);
  const spent = approved.reduce((s, f) => s + f.spent, 0);
  const communities = scoped(state.data.communities);

  return h('div', { class: 'view' },
    pageHeader('nav.dashboard', null),
    h('p', { class: 'welcome' }, h('strong', {}, t('dash.welcome', { name: state.user.name.split(' ')[0] })), ' ',
      t('dash.subtitle'), ' ', h('span', { class: 'muted' }, fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' }))),
    h('section', { class: 'priorities', 'aria-labelledby': 'prio-title' },
      h('h2', { id: 'prio-title' }, t('dash.priorities')),
      h('ul', { class: 'prio-grid' }, cards.map((c) => h('li', {},
        h('a', { href: c.href, class: `prio-card prio-${c.tone}` },
          h('span', { class: 'prio-icon' }, icon(c.ic)),
          h('span', { class: 'prio-num' }, fmtNum(c.n)),
          h('span', { class: 'prio-label' }, t(c.label)),
          h('span', { class: 'prio-hint' }, t(c.hint)),
          h('span', { class: 'prio-open' }, t('common.open'), icon('arrow-end'))))))),
    detailed ? h('section', { class: 'stats', 'aria-labelledby': 'overview-title' },
      h('h2', { id: 'overview-title' }, t('dash.overview')),
      h('ul', { class: 'stat-grid' },
        stat(t('dash.stat_communities'), fmtNum(communities.length), 'building'),
        stat(t('dash.stat_homes'), fmtNum(communities.reduce((s, c) => s + (c.units || 0), 0)), 'home'),
        stat(t('dash.stat_construction'), fmtNum(scoped(state.data.construction).filter((c) => c.status === 'in_progress').length), 'hardhat'),
        stat(t('dash.stat_budget'), budget ? t('fin.used', { n: fmtNum(Math.round((spent / budget) * 100)) }) : t('common.na'), 'wallet'))) : null,
    h('div', { class: 'dash-grid' },
      section(t('dash.upcoming'), listOrEmpty(upcoming.map((m) => item({
        title: m.title,
        meta: `${facilityName(m.facilityId)} · ${relDay(m.date)} ${fmtTime(m.startTime)}`,
        badgeEl: statusBadge('maint', m.status),
        href: `#/maintenance?open=${m.id}`,
      }))), { link: '#/maintenance' }),
      section(t('dash.unresolved'), listOrEmpty(unresolved.map((r) => item({
        title: r.title,
        meta: `${facilityName(r.facilityId) || r.location} · ${relDay(r.createdAt)}`,
        badgeEl: statusBadge('report', r.status),
        href: `#/reports?open=${r.id}`,
      }))), { link: '#/reports?status=open' }),
      section(t('dash.to_publish'), listOrEmpty(toPublish.map((x) => item({ title: x.title, meta: x.meta, badgeEl: x.badge, href: x.href }))),
        { link: '#/announcements' }),
      section(t('dash.recurring'), listOrEmpty(groups.map((g) => item({
        title: t('rep.recurring_group', { category: t(`cat.${g.category}`), place: g.place }),
        meta: `${communityName(g.communityId)} · ${t('rep.recurring_count', { n: fmtNum(g.reports.length) })}`,
        badgeEl: badge(t('rep.recurring_badge'), 'gold', 'repeat'),
        href: '#/reports#recurring',
      }))), { link: '#/reports#recurring' })));
}

function stat(label, value, ic) {
  return h('li', { class: 'stat card' }, h('span', { class: 'stat-icon' }, icon(ic)),
    h('span', { class: 'stat-value' }, value), h('span', { class: 'stat-label' }, label));
}

// ---------- Communities ----------

function viewCommunities() {
  const today = todayStr();
  const list = scoped(state.data.communities);
  return h('div', { class: 'view' },
    pageHeader('nav.communities', 'comm.intro', {
      actions: [can('communities.delete') ? btn(t('comm.add'), { cls: 'btn-primary', ic: 'plus', onclick: () => communityForm() }) : null],
    }),
    list.length ? h('ul', { class: 'card-grid' }, list.map((c) => {
      const open = state.data.reports.filter((r) => r.communityId === c.id && r.status !== 'resolved').length;
      const maint = state.data.maintenance.filter((m) => m.communityId === c.id && m.status === 'scheduled' && m.date >= today).length;
      const facilities = state.data.facilities.filter((f) => f.communityId === c.id).length;
      return h('li', { class: 'card community-card' },
        h('div', { class: 'community-top' },
          h('span', { class: 'community-icon' }, icon('building')),
          h('div', {}, h('h2', {}, c.name), h('p', { class: 'muted' }, icon('pin'), `${c.location}, ${t(`emirate.${c.emirate}`)}`))),
        h('ul', { class: 'mini-stats' },
          h('li', {}, h('strong', {}, fmtNum(c.units || 0)), h('span', {}, t('comm.homes'))),
          h('li', {}, h('strong', {}, fmtNum(facilities)), h('span', {}, t('comm.facilities'))),
          h('li', {}, h('strong', {}, fmtNum(open)), h('span', {}, t('comm.open_reports'))),
          h('li', {}, h('strong', {}, fmtNum(maint)), h('span', {}, t('comm.upcoming_maint')))),
        h('div', { class: 'card-actions' },
          h('a', { class: 'btn btn-secondary', href: '#/map', onclick: () => { state.mapCommunity = c.id; state.mapSelected = null; } }, icon('map'), t('comm.view_map')),
          h('a', { class: 'btn btn-ghost', href: '#/reports?status=open', onclick: () => { state.communityFilter = c.id; } }, icon('message'), t('comm.view_reports')),
          can('communities.write') ? btn(t('common.edit'), { cls: 'btn-ghost', ic: 'edit', onclick: () => communityForm(c), focusKey: `comm-${c.id}` }) : null));
    })) : emptyState());
}

function communityForm(c) {
  formDialog({
    title: t(c ? 'comm.edit' : 'comm.add'),
    fields: [
      field({ label: t('field.name'), name: 'name', value: c?.name, required: true }),
      field({ label: t('field.emirate'), name: 'emirate', type: 'select', value: c?.emirate || 'dubai', options: options(EMIRATES, 'emirate') }),
      field({ label: t('field.location'), name: 'location', value: c?.location, required: true }),
      field({ label: t('field.units'), name: 'units', type: 'number', min: '0', value: c?.units ?? '' }),
    ],
    onSubmit: async (data) => {
      await api(c ? `/communities/${c.id}` : '/communities', { method: c ? 'PUT' : 'POST', body: data });
      await hooks.refresh();
      toast(t('common.saved'));
    },
  });
}

// ---------- Maintenance ----------

const MAINT_ORDER = { in_progress: 0, scheduled: 1, draft: 2, completed: 3, cancelled: 4 };

function viewMaintenance() {
  const [sub, id] = state.route.params;
  if (sub === 'new' || sub === 'edit') return viewWizard(sub, id);

  let status = state.route.query.get('status') || 'all';
  let search = '';
  const host = h('div');
  const today = todayStr();

  const draw = () => {
    let rows = scoped(state.data.maintenance);
    if (status === 'upcoming') rows = rows.filter((m) => m.status === 'scheduled' && m.date >= today && m.date <= todayStr(7));
    else if (status !== 'all') rows = rows.filter((m) => m.status === status);
    if (search) rows = rows.filter((m) => `${m.title} ${facilityName(m.facilityId)}`.toLowerCase().includes(search));
    rows.sort((a, b) => (MAINT_ORDER[a.status] - MAINT_ORDER[b.status]) || a.date.localeCompare(b.date));
    visible = rows;
    host.replaceChildren(rows.length ? rtable(t('nav.maintenance'), [
      { label: t('common.title'), render: (m) => h('div', {}, h('span', { class: 'cell-title' }, m.title), h('span', { class: 'cell-sub' }, t(`cat.${m.category}`))) },
      { label: t('common.place'), render: (m) => h('div', {}, h('span', {}, facilityName(m.facilityId)), h('span', { class: 'cell-sub' }, communityName(m.communityId))) },
      { label: t('maint.when'), render: (m) => h('div', {}, h('span', {}, fmtDate(m.date)), h('span', { class: 'cell-sub' }, `${fmtTime(m.startTime)} – ${fmtTime(m.endTime)}`)) },
      { label: t('common.status'), render: (m) => statusBadge('maint', m.status) },
      { label: t('maint.visible'), render: (m) => (m.published ? badge(t('maint.visible'), 'success', 'eye') : badge(t('maint.not_visible'), 'neutral', 'eye-off')) },
      { label: t('common.actions'), cls: 'cell-actions', render: (m) => btn(t('common.open'), { ic: 'chevron-end', onclick: () => openMaintenance(m), focusKey: `maint-${m.id}` }) },
    ], rows) : emptyState(t('common.no_results'), 'search'));
  };
  let visible = [];
  draw();
  openFromQuery('maintenance', openMaintenance);
  const exportCSV = () => downloadCSV(`maintenance-${todayStr()}.csv`,
    [t('common.title'), t('common.category'), t('common.community'), t('maint.facility'), t('field.date'), t('field.startTime'), t('field.endTime'), t('common.status'), t('maint.visible')],
    visible.map((m) => [m.title, t(`cat.${m.category}`), communityName(m.communityId), facilityName(m.facilityId), m.date, m.startTime, m.endTime,
      t(`mstatus.${m.status}`), m.published ? t('maint.visible') : t('maint.not_visible')]));

  return h('div', { class: 'view' },
    pageHeader('nav.maintenance', 'maint.intro', {
      actions: [btn(t('common.export'), { ic: 'download', onclick: exportCSV }), can('maintenance.write') ? h('a', {
        href: '#/maintenance/new', class: 'btn btn-primary', onclick: () => { state.wizard = null; },
      }, icon('plus'), t('maint.new')) : null],
    }),
    viewOnlyNote('maintenance.write'),
    h('div', { class: 'toolbar' },
      selectFilter(t('common.filter_by_status'), [
        { value: 'all', label: t('common.all') },
        { value: 'upcoming', label: `${t('dash.p_maint')} – ${t('dash.p_maint_hint')}` },
        ...options(['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'], 'mstatus'),
      ], status, (v) => { status = v; draw(); }),
      searchBox((v) => { search = v; draw(); })),
    h('div', { class: 'card' }, host));
}

function openMaintenance(m) {
  let d;
  const close = () => d.close();
  const actions = [];
  const writable = can('maintenance.write') && (!m.published || can('maintenance.publish'));
  if (m.status === 'draft' && can('maintenance.publish')) {
    actions.push(btn(t('maint.publish'), { cls: 'btn-primary', ic: 'megaphone', onclick: () => { close(); publishMaintenance(m); } }));
  }
  if (writable && m.status === 'scheduled') {
    actions.push(btn(t('maint.mark_in_progress'), { ic: 'clock', onclick: () => { close(); changeMaintStatus(m, 'in_progress'); } }));
  }
  if (writable && ['scheduled', 'in_progress'].includes(m.status)) {
    actions.push(btn(t('maint.mark_completed'), { ic: 'check', onclick: () => { close(); changeMaintStatus(m, 'completed'); } }));
  }
  if (writable && !['completed', 'cancelled'].includes(m.status)) {
    actions.push(h('a', { class: 'btn btn-secondary', href: `#/maintenance/edit/${m.id}`, onclick: () => { state.wizard = null; close(); } }, icon('edit'), t('common.edit')));
  }
  if (writable && ['scheduled', 'in_progress'].includes(m.status)) {
    actions.push(btn(t('maint.cancel_work'), {
      cls: 'btn-danger-ghost', ic: 'x-circle',
      onclick: async () => {
        close();
        const ok = await confirmDialog({ title: t('maint.cancel_title'), body: t('maint.cancel_body'), confirmLabel: t('maint.cancel_work'), tone: 'danger' });
        if (ok) changeMaintStatus(m, 'cancelled');
      },
    }));
  }
  if (writable) actions.push(btn(t('common.delete'), { cls: 'btn-danger-ghost', ic: 'trash', onclick: () => { close(); deleteRecord('maintenance', m); } }));
  if (!actions.length) actions.push(btn(t('common.close'), { onclick: close }));

  const fac = facility(m.facilityId);
  d = openDialog({
    title: m.title,
    wide: true,
    content: h('div', {},
      h('div', { class: 'badge-row' }, statusBadge('maint', m.status),
        m.published ? badge(t('maint.visible'), 'success', 'eye') : badge(t('maint.not_visible'), 'neutral', 'eye-off')),
      dl([
        [t('common.community'), communityName(m.communityId)],
        [t('maint.facility'), fac ? `${fac.name} (${t(`ftype.${fac.type}`)})` : t('common.unknown')],
        [t('common.category'), t(`cat.${m.category}`)],
        [t('maint.when'), `${fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${fmtTime(m.startTime)} – ${fmtTime(m.endTime)}`],
        [t('common.description'), h('p', { class: 'prewrap' }, m.description)],
        [t('common.details'), t('common.created_by', { name: personName(m.createdBy) })],
        m.reportIds?.length ? [t('maint.linked_reports'), h('ul', { class: 'plain-list' }, m.reportIds
          .map((id) => state.data.reports.find((r) => r.id === id)).filter(Boolean)
          .map((r) => h('li', {}, h('a', { href: `#/reports?open=${r.id}`, onclick: close }, r.title), ' ', statusBadge('report', r.status))))] : null,
      ]),
      m.status === 'draft' && !can('maintenance.publish') ? h('p', { class: 'note' }, icon('info'), t('maint.no_publish_perm')) : null),
    actions,
  });
}

async function publishMaintenance(m) {
  const ok = await confirmDialog({
    title: t('maint.publish_title'), body: t('maint.publish_body', { community: communityName(m.communityId) }), confirmLabel: t('maint.publish_yes'),
  });
  if (ok) await run(() => api(`/maintenance/${m.id}/publish`, { method: 'POST' }), t('maint.published'));
}

async function changeMaintStatus(m, status) {
  const previous = m.status;
  const ok = await run(() => api(`/maintenance/${m.id}`, { method: 'PUT', body: { status } }), t('maint.status_changed', { status: t(`mstatus.${status}`) }), {
    undo: async () => {
      await api(`/maintenance/${m.id}`, { method: 'PUT', body: { status: previous } });
      await hooks.refresh();
      toast(t('maint.status_changed', { status: t(`mstatus.${previous}`) }));
    },
  });
  // Finished work may close the resident reports it was created from; a person decides.
  const open = (m.reportIds || []).map((id) => state.data.reports.find((r) => r.id === id)).filter((r) => r && r.status !== 'resolved');
  if (ok && status === 'completed' && open.length && can('reports.write')) {
    const yes = await confirmDialog({ title: t('maint.resolve_title'), body: t('maint.resolve_body', { n: fmtNum(open.length) }), confirmLabel: t('maint.resolve_yes') });
    if (yes) {
      await run(async () => {
        for (const r of open) await api(`/reports/${r.id}`, { method: 'PUT', body: { status: 'resolved' } });
      }, t('maint.resolved_msg'));
    }
  }
}

// Guided five-step maintenance workflow.
const WIZ_FIELDS = ['communityId', 'facilityId', 'title', 'category', 'description', 'date', 'startTime', 'endTime'];
const FIELD_STEP = { communityId: 1, facilityId: 1, title: 2, category: 2, description: 2, date: 3, startTime: 3, endTime: 3 };
const FTYPE_ICON = { tower: 'building', villas: 'home', pool: 'sparkle', gym: 'users', park: 'map', playground: 'users', parking: 'grid', lift: 'chart', majlis: 'home', retail: 'wallet', gate: 'shield' };

function viewWizard(mode, id) {
  if (!can('maintenance.write')) return noPermission('err.forbidden_edit');
  let w = state.wizard;
  if (!w || w.mode !== mode || w.id !== (id || null)) {
    if (mode === 'edit') {
      const m = state.data.maintenance.find((x) => x.id === id);
      if (!m) return noPermission('err.not_found');
      if (m.published && !can('maintenance.publish')) return noPermission('err.forbidden_edit_published');
      w = { mode, id, step: 1, record: m, data: { ...Object.fromEntries(WIZ_FIELDS.map((k) => [k, m[k]])), reportIds: m.reportIds || [] } };
    } else {
      const list = state.data.communities;
      const communityId = state.communityFilter !== 'all' ? state.communityFilter : list.length === 1 ? list[0].id : '';
      w = {
        mode: 'new', id: null, step: 1,
        data: { communityId, facilityId: '', title: '', category: 'other', description: '', date: '', startTime: '09:00', endTime: '12:00' },
      };
    }
    state.wizard = w;
  }

  const steps = ['maint.s1', 'maint.s2', 'maint.s3', 'maint.s4', 'maint.s5'];
  const goTo = (n) => {
    w.step = n;
    hooks.renderView();
    document.getElementById('step-title')?.focus();
  };

  const form = h('form', { class: 'wizard-form', novalidate: true });
  const errorBox = formAlert();
  const content = [errorBox];
  const d = w.data;

  if (w.step === 1) {
    const communitySelect = field({
      label: t('field.communityId'), name: 'communityId', type: 'select', value: d.communityId, required: true,
      options: [{ value: '', label: '—' }, ...communityOptions()],
    });
    communitySelect.querySelector('select').addEventListener('change', (e) => {
      d.communityId = e.target.value;
      d.facilityId = '';
      hooks.renderView();
      document.querySelector('[name="communityId"]')?.focus();
    });
    const facilities = state.data.facilities.filter((f) => f.communityId === d.communityId);
    const errId = nextId('fac-err');
    content.push(communitySelect,
      h('fieldset', { class: 'facility-picker', 'aria-describedby': errId },
        h('legend', {}, t('field.facilityId'), h('span', { class: 'req' }, ` (${t('common.required')})`)),
        h('p', { class: 'field-error', id: errId, role: 'alert', hidden: true }),
        facilities.length ? h('div', { class: 'facility-grid' }, facilities.map((f) => {
          const rid = nextId('fac');
          return h('div', { class: 'facility-option' },
            h('input', { type: 'radio', name: 'facilityId', id: rid, value: f.id, checked: d.facilityId === f.id }),
            h('label', { for: rid },
              h('span', { class: 'facility-icon' }, icon(FTYPE_ICON[f.type] || 'pin')),
              h('span', { class: 'facility-text' }, h('strong', {}, f.name), h('span', {}, t(`ftype.${f.type}`))),
              statusBadge('facility', f.status)));
        })) : h('p', { class: 'hint' }, t('maint.choose_community_first'))));
  } else if (w.step === 2) {
    content.push(
      field({ label: t('field.title'), name: 'title', value: d.title, required: true, placeholder: t('maint.title_ph') }),
      field({ label: t('field.category'), name: 'category', type: 'select', value: d.category, options: options(MAINT_CATEGORIES, 'cat') }),
      field({ label: t('field.description'), name: 'description', type: 'textarea', value: d.description, required: true, rows: 5, placeholder: t('maint.desc_ph'), hint: t('maint.s2_help') }));
  } else if (w.step === 3) {
    content.push(h('div', { class: 'field-row' },
      field({ label: t('field.date'), name: 'date', type: 'date', value: d.date, required: true, min: w.mode === 'new' ? todayStr() : undefined }),
      field({ label: t('field.startTime'), name: 'startTime', type: 'time', value: d.startTime, required: true }),
      field({ label: t('field.endTime'), name: 'endTime', type: 'time', value: d.endTime, required: true })));
  } else if (w.step === 4) {
    const fac = facility(d.facilityId);
    const row = (label, value, step) => [label, h('div', { class: 'review-value' }, h('span', { class: 'prewrap' }, value),
      h('button', { type: 'button', class: 'link-btn', onclick: () => goTo(step) }, t('maint.change'), h('span', { class: 'sr-only' }, `: ${label}`)))];
    content.push(dl([
      row(t('common.community'), communityName(d.communityId), 1),
      row(t('maint.facility'), fac?.name || t('common.unknown'), 1),
      row(t('field.title'), d.title, 2),
      row(t('common.category'), t(`cat.${d.category}`), 2),
      row(t('common.description'), d.description, 2),
      row(t('maint.when'), `${fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${fmtTime(d.startTime)} – ${fmtTime(d.endTime)}`, 3),
    ]));
  } else {
    const published = w.record?.published;
    const canPublish = can('maintenance.publish');
    if (published) {
      content.push(h('div', { class: 'choice-grid' },
        h('div', { class: 'choice' }, icon('eye'), h('p', {}, t('maint.visible')),
          btn(t('common.save_changes'), { cls: 'btn-primary btn-lg', ic: 'check', onclick: (e) => saveWizard(false, e.currentTarget) }))));
    } else {
      content.push(h('div', { class: 'choice-grid' },
        h('div', { class: 'choice' }, icon('edit'), h('p', {}, t('maint.not_visible')),
          btn(t('maint.save_draft'), { cls: 'btn-secondary btn-lg', ic: 'edit', onclick: (e) => saveWizard(false, e.currentTarget) })),
        h('div', { class: 'choice' }, icon('megaphone'), h('p', {}, t('maint.visible')),
          btn(t('maint.publish'), { cls: 'btn-primary btn-lg', ic: 'megaphone', disabled: !canPublish, onclick: (e) => saveWizard(true, e.currentTarget) }),
          canPublish ? null : h('p', { class: 'note' }, icon('info'), t('maint.no_publish_perm')))));
    }
  }

  const collect = () => {
    for (const el of form.elements) {
      if (!el.name || !WIZ_FIELDS.includes(el.name)) continue;
      if (el.type === 'radio') { if (el.checked) d[el.name] = el.value; } else d[el.name] = el.value.trim ? el.value.trim() : el.value;
    }
  };

  const validate = () => {
    const fail = (name, code) => {
      const control = form.querySelector(`[name="${name}"]`);
      const msg = errorText({ code, field: name });
      if (name === 'facilityId') {
        const box = form.querySelector('.facility-picker .field-error');
        box.textContent = msg;
        box.hidden = false;
        (form.querySelector('[name="facilityId"]') || form.querySelector('[name="communityId"]'))?.focus();
      } else if (control) {
        setFieldError(control, msg);
        control.focus();
      }
      return false;
    };
    if (w.step === 1) {
      if (!d.communityId) return fail('communityId', 'required_field');
      if (!d.facilityId) return fail('facilityId', 'maint_facility');
    }
    if (w.step === 2) {
      if (!d.title) return fail('title', 'required_field');
      if (!d.description) return fail('description', 'maint_desc');
    }
    if (w.step === 3) {
      if (!d.date) return fail('date', 'maint_date');
      if (!d.startTime) return fail('startTime', 'time_format');
      if (!d.endTime) return fail('endTime', 'time_format');
      if (d.endTime <= d.startTime) return fail('endTime', 'time_order');
    }
    return true;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    collect();
    if (validate() && w.step < 5) goTo(w.step + 1);
  });
  // Keep typed values when going back.
  form.addEventListener('input', collect);
  form.addEventListener('change', collect);

  const nav = h('div', { class: 'wizard-nav' },
    w.step > 1 ? btn(t('common.back'), { ic: 'chevron-start', onclick: () => { collect(); goTo(w.step - 1); } }) : null,
    h('a', { href: '#/maintenance', class: 'btn btn-ghost', onclick: () => { state.wizard = null; } }, t('common.cancel')),
    w.step < 5 ? btn(t('common.next'), { cls: 'btn-primary', type: 'submit' }) : null);
  nav.querySelector('[type=submit]')?.addEventListener('click', () => {});
  appendChildren(form, content, nav);

  // Show an error returned by the server on the step it belongs to.
  if (w.error) {
    const err = w.error;
    w.error = null;
    setTimeout(() => {
      const control = form.querySelector(`[name="${err.field}"]`);
      if (control && err.field !== 'facilityId') {
        setFieldError(control, errorText(err));
        control.focus();
      } else {
        errorBox.textContent = errorText(err);
        errorBox.hidden = false;
        errorBox.focus();
      }
    }, 0);
  }

  return h('div', { class: 'view' },
    pageHeader(mode === 'edit' ? 'maint.edit' : 'maint.new', null),
    w.fromReport ? h('p', { class: 'note' }, icon('repeat'), t('maint.from_report')) : null,
    h('nav', { class: 'stepper', 'aria-label': t('maint.progress_label') },
      h('ol', {}, steps.map((key, i) => {
        const n = i + 1;
        const stateCls = n < w.step ? 'done' : n === w.step ? 'current' : 'todo';
        return h('li', { class: `step step-${stateCls}`, 'aria-current': n === w.step ? 'step' : null },
          h('span', { class: 'step-num' }, n < w.step ? icon('check') : fmtNum(n)),
          h('span', { class: 'step-label' }, t(key)));
      })),
      h('p', { class: 'step-count' }, t('maint.step_of', { n: fmtNum(w.step), total: fmtNum(5) })),
      progressBar((w.step / 5) * 100, t('maint.step_of', { n: w.step, total: 5 }))),
    h('section', { class: 'card wizard-card', 'aria-labelledby': 'step-title' },
      h('h2', { id: 'step-title', tabindex: '-1' }, t(steps[w.step - 1])),
      h('p', { class: 'hint' }, t(`${steps[w.step - 1]}_help`)),
      form));
}

function appendChildren(el, ...kids) {
  for (const k of kids.flat()) if (k) el.append(k);
}

async function saveWizard(publish, button) {
  const w = state.wizard;
  if (publish) {
    const ok = await confirmDialog({
      title: t('maint.publish_title'), body: t('maint.publish_body', { community: communityName(w.data.communityId) }), confirmLabel: t('maint.publish_yes'),
    });
    if (!ok) return;
  }
  if (button) button.disabled = true;
  let saved = null;
  try {
    saved = w.mode === 'new'
      ? (await api('/maintenance', { method: 'POST', body: w.data })).record
      : (await api(`/maintenance/${w.id}`, { method: 'PUT', body: w.data })).record;
    if (publish && saved.status === 'draft') await api(`/maintenance/${saved.id}/publish`, { method: 'POST' });
    state.wizard = null;
    await hooks.refresh();
    location.hash = '#/maintenance';
    toast(publish ? t('maint.published') : w.mode === 'edit' ? t('common.saved') : t('maint.saved_draft'));
  } catch (err) {
    if (saved) {
      // Saved as a draft, but publishing failed.
      state.wizard = null;
      await hooks.refresh();
      location.hash = '#/maintenance';
      toast(errorText(err), { tone: 'error' });
      return;
    }
    if (err instanceof ApiError && FIELD_STEP[err.field]) {
      w.error = err;
      w.step = FIELD_STEP[err.field];
      hooks.renderView();
    } else {
      toast(errorText(err), { tone: 'error' });
      if (button && document.contains(button)) button.disabled = false;
    }
  }
}

// ---------- Resident reports ----------

function viewReports() {
  let status = state.route.query.get('status') || 'open';
  let search = '';
  const host = h('div');
  const groups = recurringGroups();
  const inGroup = new Set(groups.flatMap((g) => g.reports.map((r) => r.id)));

  const draw = () => {
    let rows = scoped(state.data.reports);
    if (status === 'open') rows = rows.filter((r) => r.status !== 'resolved');
    else if (status !== 'all') rows = rows.filter((r) => r.status === status);
    if (search) rows = rows.filter((r) => `${r.title} ${r.location} ${r.unit} ${facilityName(r.facilityId)}`.toLowerCase().includes(search));
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    visible = rows;
    host.replaceChildren(rows.length ? rtable(t('nav.reports'), [
      { label: t('rep.complaint'), render: (r) => h('div', {},
        h('button', { type: 'button', class: 'cell-link', onclick: () => openReport(r), dataset: { focusKey: `rep-${r.id}` } }, r.title),
        h('span', { class: 'cell-sub' }, `${t(`cat.${r.category}`)} · ${t(`channel.${r.channel || 'app'}`)}`),
        inGroup.has(r.id) ? badge(t('rep.recurring_badge'), 'gold', 'repeat') : null) },
      { label: t('rep.reason'), cls: 'cell-reason', render: (r) => h('p', { class: 'reason-text' }, r.description || t('common.na')) },
      { label: t('common.place'), render: (r) => h('div', {}, h('span', {}, facilityName(r.facilityId) || r.location), h('span', { class: 'cell-sub' }, communityName(r.communityId))) },
      { label: t('rep.unit'), render: (r) => h('span', { dir: 'ltr' }, r.unit) },
      { label: t('rep.assigned'), render: (r) => (r.assignedTo ? personName(r.assignedTo) : h('span', { class: 'muted' }, t('rep.unassigned'))) },
      { label: t('rep.received'), render: (r) => relDay(r.createdAt) },
      { label: t('common.status'), render: (r) => (can('reports.write') ? reportStatusSelect(r) : statusBadge('report', r.status)) },
      { label: t('common.actions'), cls: 'cell-actions', render: (r) => btn(t('common.open'), { ic: 'chevron-end', onclick: () => openReport(r) }) },
    ], rows) : emptyState(t('common.no_results'), 'search'));
  };
  let visible = [];
  draw();
  openFromQuery('reports', openReport);

  if (location.hash.endsWith('#recurring')) {
    setTimeout(() => document.getElementById('recurring')?.scrollIntoView({ block: 'start' }), 0);
  }

  const exportCSV = () => downloadCSV(`resident-reports-${todayStr()}.csv`,
    [t('common.title'), t('common.category'), t('common.community'), t('common.place'), t('rep.unit'), t('field.channel'),
      t('rep.assigned'), t('common.status'), t('rep.received'), t('common.description')],
    visible.map((r) => [r.title, t(`cat.${r.category}`), communityName(r.communityId), facilityName(r.facilityId) || r.location, r.unit,
      t(`channel.${r.channel || 'app'}`), r.assignedTo ? personName(r.assignedTo) : '', t(`rstatus.${r.status}`), fmtDate(r.createdAt), r.description]));

  return h('div', { class: 'view' },
    pageHeader('nav.reports', 'rep.intro', {
      actions: [
        btn(t('common.export'), { ic: 'download', onclick: exportCSV }),
        can('reports.write') ? btn(t('rep.log_new'), { cls: 'btn-primary', ic: 'plus', onclick: () => logReportForm() }) : null,
      ],
    }),
    viewOnlyNote('reports.write'),
    h('section', { class: 'card section recurring', id: 'recurring', 'aria-labelledby': 'recurring-title' },
      h('div', { class: 'section-head' }, h('h2', { id: 'recurring-title' }, icon('repeat'), t('rep.recurring_title'))),
      h('p', { class: 'explain' }, icon('info'), t('rep.recurring_help')),
      groups.length ? h('ul', { class: 'group-list' }, groups.map(groupCard)) : emptyState(t('dash.all_clear'))),
    h('div', { class: 'toolbar' },
      selectFilter(t('common.filter_by_status'), [
        { value: 'open', label: `${t('rstatus.new')} / ${t('rstatus.in_review')} / ${t('rstatus.in_progress')}` },
        { value: 'all', label: t('common.all') },
        ...options(['new', 'in_review', 'in_progress', 'resolved'], 'rstatus'),
      ], status, (v) => { status = v; draw(); }),
      searchBox((v) => { search = v; draw(); })),
    h('div', { class: 'card' }, host),
    h('p', { class: 'note' }, icon('lock'), t('rep.privacy_note')));
}

function groupCard(g) {
  const title = t('rep.recurring_group', { category: t(`cat.${g.category}`), place: g.place });
  return h('li', { class: 'group-card' },
    h('div', { class: 'group-head' },
      h('h3', {}, title),
      badge(t('rep.recurring_count', { n: fmtNum(g.reports.length) }), 'gold', 'repeat')),
    h('p', { class: 'muted' }, communityName(g.communityId)),
    h('ul', { class: 'group-reports' }, g.reports.map((r) => h('li', {},
      h('span', {}, r.title), h('span', { class: 'muted' }, ` · ${r.unit} · ${relDay(r.createdAt)}`)))),
    h('div', { class: 'card-actions' },
      can('maintenance.write') ? btn(t('rep.schedule_fix'), {
        cls: 'btn-primary', ic: 'calendar', onclick: () => scheduleFromReports(g.reports, title),
      }) : null,
      can('reports.write') ? btn(t('rep.not_same'), {
        ic: 'x-circle',
        onclick: () => run(() => api('/recurring/dismiss', { method: 'POST', body: { key: g.key } }), t('rep.not_same_done'), {
          undo: async () => {
            await api('/recurring/restore', { method: 'POST', body: { key: g.key } });
            await hooks.refresh();
            toast(t('common.restored'));
          },
        }),
      }) : null));
}

// Opens the maintenance wizard prefilled from one or more reports, keeping the link between them.
function scheduleFromReports(reports, title) {
  const first = reports[0];
  state.wizard = {
    mode: 'new', id: null, step: first.facilityId ? 2 : 1, fromReport: true,
    data: {
      communityId: first.communityId, facilityId: first.facilityId || '', category: first.category,
      title: (title || first.title).slice(0, 120),
      description: reports.map((r) => `• ${r.title} (${r.unit})`).join('\n'),
      date: '', startTime: '09:00', endTime: '12:00',
      reportIds: reports.map((r) => r.id),
    },
  };
  location.hash = '#/maintenance/new';
}

function openReport(r) {
  let d;
  const editable = can('reports.write');
  const linked = state.data.maintenance.filter((m) => (m.reportIds || []).includes(r.id));
  const formId = nextId('report-form');
  const form = h('form', { id: formId, novalidate: true, class: 'form-grid' },
    formAlert(),
    h('div', { class: 'field-row' },
      field({ label: t('field.status'), name: 'status', type: 'select', value: r.status, disabled: !editable, options: options(['new', 'in_review', 'in_progress', 'resolved'], 'rstatus') }),
      field({ label: t('field.assignedTo'), name: 'assignedTo', type: 'select', value: r.assignedTo || '', disabled: !editable, options: [{ value: '', label: t('rep.unassigned') }, ...staffOptions()] })),
    field({ label: t('field.residentReply'), name: 'residentReply', type: 'textarea', rows: 3, value: r.residentReply || '', disabled: !editable, hint: t('rep.reply_hint') }),
    field({ label: t('field.managerNote'), name: 'managerNote', type: 'textarea', rows: 3, value: r.managerNote || '', disabled: !editable, hint: t('rep.note_hint') }));
  const save = h('button', { type: 'submit', class: 'btn btn-primary', form: formId }, icon('check'), t('common.save_changes'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await withBusy(save, async () => {
      await api(`/reports/${r.id}`, { method: 'PUT', body: readForm(form) });
      d.close(true);
      await hooks.refresh();
      toast(t('rep.saved'));
    }, form);
  });

  const history = (r.history?.length ? r.history : [{ at: r.createdAt, action: 'created' }]).slice().reverse();
  const historyText = (e) => {
    if (e.action === 'status') return t('hist.status', { status: t(`rstatus.${e.value}`) });
    if (e.action === 'assigned') return e.value ? t('hist.assigned', { name: personName(e.value) }) : t('hist.unassigned');
    return t(`hist.${e.action}`);
  };

  const actions = [btn(t('common.close'), { onclick: () => d.close() })];
  if (editable && can('maintenance.write') && r.status !== 'resolved') {
    actions.push(btn(t('rep.schedule_fix'), { ic: 'calendar', onclick: () => { d.close(); scheduleFromReports([r]); } }));
  }
  if (editable) actions.push(save);

  d = openDialog({
    title: r.title,
    wide: true,
    content: h('div', { class: 'report-detail' },
      h('div', { class: 'badge-row' }, statusBadge('report', r.status),
        badge(t(`channel.${r.channel || 'app'}`), 'neutral', r.channel === 'phone' ? 'phone' : 'message'),
        badge(t(`cat.${r.category}`), 'neutral', 'wrench')),
      dl([
        [t('common.community'), communityName(r.communityId)],
        [t('common.place'), facilityName(r.facilityId) || r.location],
        [t('rep.unit'), h('span', { dir: 'ltr' }, r.unit)],
        [t('rep.received'), `${fmtDate(r.createdAt, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })} (${relDay(r.createdAt)})`],
        [t('rep.reason'), h('p', { class: 'prewrap reason-full' }, r.description || t('common.na'))],
      ]),
      form,
      h('section', { class: 'detail-block' },
        h('h3', {}, t('rep.linked_maint')),
        linked.length ? h('ul', { class: 'plain-list' }, linked.map((m) => h('li', {},
          h('a', { href: `#/maintenance?open=${m.id}`, onclick: () => d.close() }, m.title), ' ', statusBadge('maint', m.status), h('span', { class: 'muted' }, ` · ${fmtDate(m.date)}`))))
          : h('p', { class: 'muted' }, t('rep.no_linked'))),
      h('section', { class: 'detail-block' },
        h('h3', {}, t('rep.history')),
        h('ol', { class: 'timeline' }, history.map((e) => h('li', {},
          h('span', { class: 'timeline-text' }, historyText(e)),
          h('span', { class: 'muted' }, `${fmtDate(e.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}${e.by ? ` · ${personName(e.by)}` : ''}`)))))),
    actions,
  });
}

function logReportForm() {
  const communityId = state.communityFilter !== 'all' ? state.communityFilter : state.data.communities[0]?.id || '';
  const facilityOptions = (cid) => [{ value: '', label: t('rep.no_place') },
    ...state.data.facilities.filter((f) => f.communityId === cid).map((f) => ({ value: f.id, label: f.name }))];
  const communityField = field({ label: t('field.communityId'), name: 'communityId', type: 'select', required: true, value: communityId, options: communityOptions() });
  const facilityField = field({ label: t('common.place'), name: 'facilityId', type: 'select', value: '', options: facilityOptions(communityId) });
  communityField.querySelector('select').addEventListener('change', (e) => {
    const select = facilityField.querySelector('select');
    select.replaceChildren(...facilityOptions(e.target.value).map((o) => h('option', { value: o.value }, o.label)));
  });
  formDialog({
    title: t('rep.log_new'),
    intro: h('p', { class: 'note' }, icon('phone'), t('rep.log_help')),
    fields: [
      communityField,
      h('div', { class: 'field-row' }, facilityField,
        field({ label: t('field.location'), name: 'location', hint: t('rep.location_hint') })),
      h('div', { class: 'field-row' },
        field({ label: t('field.unit'), name: 'unit', required: true }),
        field({ label: t('field.channel'), name: 'channel', type: 'select', value: 'phone', options: options(['phone', 'walk_in', 'email', 'app'], 'channel') })),
      field({ label: t('field.category'), name: 'category', type: 'select', value: 'other', options: options(MAINT_CATEGORIES, 'cat') }),
      field({ label: t('field.title'), name: 'title', required: true }),
      field({ label: t('rep.reason'), name: 'description', type: 'textarea', rows: 4, hint: t('rep.reason_hint') }),
    ],
    onSubmit: async (data) => {
      await api('/reports', { method: 'POST', body: data });
      await hooks.refresh();
      toast(t('rep.logged'));
    },
  });
}

function reportStatusSelect(r) {
  const id = nextId('rstatus');
  const select = h('select', { id, class: 'status-select', dataset: { focusKey: `rstatus-${r.id}` } },
    ['new', 'in_review', 'in_progress', 'resolved'].map((s) => h('option', { value: s, selected: s === r.status }, t(`rstatus.${s}`))));
  select.addEventListener('change', () => {
    const previous = r.status;
    const next = select.value;
    run(() => api(`/reports/${r.id}`, { method: 'PUT', body: { status: next } }), t('rep.status_updated', { status: t(`rstatus.${next}`) }), {
      undo: async () => {
        await api(`/reports/${r.id}`, { method: 'PUT', body: { status: previous } });
        await hooks.refresh();
        toast(t('rep.status_updated', { status: t(`rstatus.${previous}`) }));
      },
    });
  });
  return h('div', { class: 'status-cell' },
    statusBadge('report', r.status),
    h('label', { for: id, class: 'sr-only' }, `${t('rep.change_status')}: ${r.title}`),
    select);
}

// ---------- Community map ----------

const MAP_ART = `
<rect width="100" height="62" fill="#EFEBE1"/>
<path d="M0 40h100M46 0v62" stroke="#D9D1BF" stroke-width="5"/>
<path d="M0 40h100M46 0v62" stroke="#FFFFFF" stroke-width="0.4" stroke-dasharray="2 2"/>
<path d="M60 8q14 -4 30 4v18q-12 6 -30 0z" fill="#CFE3D3"/>
<path d="M4 46h34v12H4z" fill="#CFE3D3"/>
<path d="M54 46q10 -3 20 2t20 0v12H54z" fill="#CFE3D3"/>
<circle cx="74" cy="20" r="3" fill="#B7D4C0"/><circle cx="66" cy="14" r="2" fill="#B7D4C0"/><circle cx="84" cy="24" r="2.4" fill="#B7D4C0"/>
<g fill="#E3DCCB"><rect x="8" y="8" width="14" height="12" rx="1"/><rect x="26" y="6" width="14" height="16" rx="1"/><rect x="8" y="24" width="30" height="10" rx="1"/></g>
<path d="M0 62l100 0" stroke="#C9A86A" stroke-width="0.8"/>`;

function viewMap() {
  const communities = scoped(state.data.communities);
  if (!communities.length) return h('div', { class: 'view' }, pageHeader('nav.map', 'map.intro'), emptyState());
  if (!communities.some((c) => c.id === state.mapCommunity)) {
    state.mapCommunity = communities[0].id;
    state.mapSelected = null;
  }
  const community = communities.find((c) => c.id === state.mapCommunity);
  const places = state.data.facilities.filter((f) => f.communityId === community.id);
  const selected = places.find((f) => f.id === state.mapSelected);

  const select = (id) => {
    state.mapSelected = id;
    hooks.renderView();
    document.getElementById('place-title')?.focus();
  };

  const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  art.setAttribute('viewBox', '0 0 100 62');
  art.setAttribute('preserveAspectRatio', 'none');
  art.setAttribute('aria-hidden', 'true');
  art.setAttribute('class', 'map-art');
  art.innerHTML = MAP_ART;

  const map = h('div', { class: 'map-canvas', role: 'group', 'aria-label': t('map.alt', { community: community.name }), dir: 'ltr' },
    art,
    places.map((f) => h('button', {
      type: 'button',
      class: `map-pin pin-${f.status}${f.id === state.mapSelected ? ' is-selected' : ''}`,
      style: { left: `${f.x}%`, top: `${f.y}%` },
      'aria-pressed': String(f.id === state.mapSelected),
      dataset: { focusKey: `pin-${f.id}` },
      onclick: () => select(f.id),
    },
    h('span', { class: 'pin-dot' }, icon(f.status === 'open' ? 'check' : f.status === 'maintenance' ? 'wrench' : 'x')),
    h('span', { class: 'pin-label' }, f.name, h('span', { class: 'sr-only' }, ` – ${t(`fstatus.${f.status}`)}`)))));

  const panel = selected ? placePanel(selected, community) : h('div', { class: 'place-empty' }, icon('pin'), h('p', {}, t('map.select_place')));

  const communityPicker = communities.length > 1 ? selectFilter(t('common.community'), communities.map((c) => ({ value: c.id, label: c.name })),
    community.id, (v) => { state.mapCommunity = v; state.mapSelected = null; hooks.renderView(); }) : null;

  return h('div', { class: 'view' },
    pageHeader('nav.map', 'map.intro', {
      tech: t('map.tech'),
      actions: [can('facilities.write') ? btn(t('map.add'), { cls: 'btn-primary', ic: 'plus', onclick: () => placeForm(null, community) }) : null],
    }),
    viewOnlyNote('facilities.write'),
    h('div', { class: 'toolbar' }, communityPicker,
      h('div', { class: 'legend', 'aria-label': t('map.legend'), role: 'group' },
        ['open', 'maintenance', 'closed'].map((s) => statusBadge('facility', s)))),
    h('div', { class: 'map-layout' },
      h('div', { class: 'card map-card' },
        h('h2', { class: 'map-title' }, community.name),
        map,
        h('h3', { class: 'places-title' }, t('map.places')),
        h('ul', { class: 'place-list' }, places.map((f) => h('li', {},
          h('button', {
            type: 'button', class: `place-btn${f.id === state.mapSelected ? ' is-selected' : ''}`, 'aria-pressed': String(f.id === state.mapSelected),
            dataset: { focusKey: `place-${f.id}` }, onclick: () => select(f.id),
          }, h('span', {}, f.name), statusBadge('facility', f.status)))))),
      h('aside', { class: 'card place-panel', 'aria-live': 'polite' }, panel)));
}

function placePanel(f, community) {
  const editable = can('facilities.write');
  const preview = h('div', { class: 'resident-preview' });
  const form = h('form', { novalidate: true, class: 'form-grid' });
  const statusGroup = radioGroup({
    legend: t('field.status'), name: 'status', value: f.status,
    options: ['open', 'maintenance', 'closed'].map((s) => ({
      value: s, label: t(`fstatus.${s}`), icon: s === 'open' ? 'check' : s === 'maintenance' ? 'wrench' : 'x-circle',
    })),
  });
  const note = field({ label: t('field.residentNote'), name: 'residentNote', type: 'textarea', value: f.residentNote, rows: 3 });

  const drawPreview = () => {
    const data = readForm(form);
    preview.replaceChildren(
      h('p', { class: 'preview-label' }, t('map.resident_preview')),
      h('div', { class: 'preview-card' },
        h('strong', {}, f.name), statusBadge('facility', data.status || f.status),
        h('p', {}, data.residentNote?.trim() || t('map.no_note'))));
  };

  if (editable) {
    const save = btn(t('map.save_update'), { cls: 'btn-primary', ic: 'check', type: 'submit' });
    appendChildren(form, formAlert(), statusGroup, note, preview, save);
    form.addEventListener('input', drawPreview);
    form.addEventListener('change', drawPreview);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = readForm(form);
      const ok = await confirmDialog({
        title: t('map.confirm_title'), body: t('map.confirm_body', { community: community.name, place: f.name }), confirmLabel: t('common.save'),
      });
      if (!ok) return;
      await withBusy(save, async () => {
        await api(`/facilities/${f.id}`, { method: 'PUT', body: { status: data.status, residentNote: data.residentNote } });
        await hooks.refresh();
        toast(t('map.updated'));
        document.getElementById('place-title')?.focus();
      }, form);
    });
  } else {
    appendChildren(form, preview);
  }
  drawPreview();

  return h('div', {},
    h('h2', { id: 'place-title', tabindex: '-1' }, f.name),
    h('p', { class: 'muted' }, t(`ftype.${f.type}`)),
    editable ? h('div', { class: 'card-actions place-actions' },
      btn(t('map.edit_place'), { cls: 'btn-ghost btn-sm', ic: 'edit', onclick: () => placeForm(f, community) }),
      btn(t('common.delete'), {
        cls: 'btn-danger-ghost btn-sm', ic: 'trash',
        onclick: async () => { await deleteRecord('facilities', f); state.mapSelected = null; hooks.renderView(); },
      })) : null,
    form);
}

function placeForm(f, community) {
  formDialog({
    title: f ? t('map.edit_place') : t('map.add'),
    intro: h('p', { class: 'muted' }, icon('building'), community.name),
    fields: [
      field({ label: t('field.name'), name: 'name', value: f?.name, required: true }),
      field({ label: t('field.type'), name: 'type', type: 'select', value: f?.type || 'park', options: options(FACILITY_TYPES, 'ftype') }),
      f ? null : field({ label: t('field.status'), name: 'status', type: 'select', value: 'open', options: options(['open', 'maintenance', 'closed'], 'fstatus') }),
      h('div', { class: 'field-row' },
        field({ label: t('field.x'), name: 'x', type: 'number', min: '0', max: '100', value: f?.x ?? 50, hint: t('map.position_hint') }),
        field({ label: t('field.y'), name: 'y', type: 'number', min: '0', max: '100', value: f?.y ?? 50 })),
    ],
    onSubmit: async (data) => {
      const res = await api(f ? `/facilities/${f.id}` : '/facilities', {
        method: f ? 'PUT' : 'POST',
        body: f ? data : { ...data, communityId: community.id, residentNote: '' },
      });
      state.mapSelected = res.record.id;
      await hooks.refresh();
      toast(t('common.saved'));
    },
  });
}

// ---------- Construction ----------

function viewConstruction() {
  const list = scoped(state.data.construction);
  return h('div', { class: 'view' },
    pageHeader('nav.construction', 'con.intro', {
      actions: [can('construction.write') ? btn(t('con.add'), { cls: 'btn-primary', ic: 'plus', onclick: () => constructionForm() }) : null],
    }),
    viewOnlyNote('construction.write'),
    list.length ? h('ul', { class: 'card-grid' }, list.map((p) => h('li', { class: 'card project-card' },
      h('div', { class: 'project-head' },
        h('h2', {}, p.name),
        statusBadge('con', p.status)),
      h('p', { class: 'muted' }, icon('building'), communityName(p.communityId), p.contractor ? ` · ${p.contractor}` : ''),
      h('div', { class: 'progress-row' },
        progressBar(p.progress, t('field.progress')),
        h('span', { class: 'progress-text' }, t('con.progress', { n: fmtNum(p.progress) }))),
      h('p', { class: 'muted' }, icon('calendar'), t('con.dates', { start: fmtDate(p.startDate), end: fmtDate(p.endDate) })),
      h('div', { class: 'resident-preview' },
        h('p', { class: 'preview-label' }, t('map.resident_preview')),
        h('p', { class: 'preview-card' }, p.residentUpdate || t('con.no_update'))),
      can('construction.write') ? h('div', { class: 'card-actions' },
        btn(t('common.edit'), { ic: 'edit', onclick: () => constructionForm(p), focusKey: `con-${p.id}` }),
        btn(t('common.delete'), { cls: 'btn-danger-ghost', ic: 'trash', onclick: () => deleteRecord('construction', p) })) : null))) : emptyState());
}

function constructionForm(p) {
  const canPublish = can('construction.publish');
  formDialog({
    title: t(p ? 'con.edit' : 'con.add'),
    fields: [
      p ? null : field({ label: t('field.communityId'), name: 'communityId', type: 'select', value: state.communityFilter !== 'all' ? state.communityFilter : '', options: communityOptions(), required: true }),
      field({ label: t('field.name'), name: 'name', value: p?.name, required: true }),
      field({ label: t('field.contractor'), name: 'contractor', value: p?.contractor }),
      h('div', { class: 'field-row' },
        field({ label: t('field.status'), name: 'status', type: 'select', value: p?.status || 'planned', options: options(['planned', 'in_progress', 'on_hold', 'completed'], 'cstatus') }),
        field({ label: t('field.progress'), name: 'progress', type: 'number', min: '0', max: '100', value: p?.progress ?? 0 })),
      h('div', { class: 'field-row' },
        field({ label: t('field.startDate'), name: 'startDate', type: 'date', value: p?.startDate }),
        field({ label: t('field.endDate'), name: 'endDate', type: 'date', value: p?.endDate })),
      field({
        label: t('field.residentUpdate'), name: 'residentUpdate', type: 'textarea', value: p?.residentUpdate, rows: 3,
        disabled: !canPublish, hint: canPublish ? null : t('con.update_perm'),
      }),
    ],
    onSubmit: async (data) => {
      if (!canPublish) delete data.residentUpdate;
      await api(p ? `/construction/${p.id}` : '/construction', { method: p ? 'PUT' : 'POST', body: data });
      await hooks.refresh();
      toast(t('common.saved'));
    },
  });
}

// ---------- Announcements ----------

function viewAnnouncements() {
  let status = state.route.query.get('status') || 'all';
  const host = h('div');
  const tabsHost = h('div');
  const all = scoped(state.data.announcements);
  const statuses = ['draft', 'pending', 'approved', 'published', 'archived'];

  const draw = () => {
    tabsHost.replaceChildren(h('div', { class: 'tabs', role: 'group', 'aria-label': t('common.filter_by_status') },
      ['all', ...statuses].map((s) => {
        const count = s === 'all' ? all.length : all.filter((a) => a.status === s).length;
        return h('button', {
          type: 'button', class: 'tab', 'aria-pressed': String(status === s), dataset: { focusKey: `tab-${s}` },
          onclick: () => { status = s; draw(); tabsHost.querySelector(`[data-focus-key="tab-${s}"]`)?.focus(); },
        }, s === 'all' ? t('common.all') : t(`astatus.${s}`), h('span', { class: 'tab-count' }, fmtNum(count)));
      })));
    const rows = all.filter((a) => status === 'all' || a.status === status)
      .sort((a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status) || b.updatedAt.localeCompare(a.updatedAt));
    host.replaceChildren(rows.length ? h('ul', { class: 'ann-list' }, rows.map(announcementCard)) : emptyState(t('common.no_results'), 'megaphone'));
  };
  draw();

  return h('div', { class: 'view' },
    pageHeader('nav.announcements', 'ann.intro', {
      actions: [can('announcements.write') ? btn(t('ann.new'), { cls: 'btn-primary', ic: 'plus', onclick: () => openAnnouncementForm() }) : null],
    }),
    viewOnlyNote('announcements.write', 'announcements.approve'),
    h('div', { class: 'flow card' },
      h('h2', {}, t('ann.flow')),
      h('ol', { class: 'flow-steps' }, ['draft', 'pending', 'approved', 'published'].map((s) => h('li', {}, statusBadge('ann', s))))),
    tabsHost,
    host);
}

function announcementCard(a) {
  const actions = [];
  const action = (label, opts) => actions.push(btn(label, { ...opts, focusKey: `ann-${a.id}-${label}` }));
  const post = (path, msg) => run(() => api(`/announcements/${a.id}/${path}`, { method: 'POST' }), msg);

  if (a.status === 'draft' && can('announcements.write')) {
    action(t('ann.submit'), { cls: 'btn-primary', ic: 'send', onclick: () => post('submit', t('ann.submitted')) });
  }
  if (a.status === 'pending' && can('announcements.approve')) {
    action(t('ann.approve'), { cls: 'btn-primary', ic: 'check', onclick: () => post('approve', t('ann.approved_msg')) });
  }
  if (a.status === 'approved' && can('announcements.publish')) {
    action(t('ann.publish'), { cls: 'btn-primary', ic: 'megaphone', onclick: () => publishAnnouncement(a) });
  }
  if (['pending', 'approved'].includes(a.status) && can('announcements.approve')) {
    action(t('ann.return'), { ic: 'undo', onclick: () => post('return', t('ann.returned')) });
  }
  if (['draft', 'pending', 'approved'].includes(a.status) && can('announcements.write')) {
    action(t('common.edit'), { ic: 'edit', onclick: () => openAnnouncementForm({ record: a }) });
  }
  if (a.status === 'published' && can('announcements.publish')) {
    action(t('ann.archive'), {
      ic: 'archive',
      onclick: async () => {
        const ok = await confirmDialog({ title: t('ann.archive'), body: t('ann.archived_msg'), confirmLabel: t('ann.archive') });
        if (ok) post('archive', t('ann.archived_msg'));
      },
    });
  }
  if (a.status !== 'published' && a.status !== 'archived' && can('announcements.write')) {
    action(t('common.delete'), { cls: 'btn-danger-ghost', ic: 'trash', onclick: () => deleteRecord('announcements', a) });
  }

  return h('li', { class: 'card ann-card' },
    h('div', { class: 'ann-head' },
      h('h2', {}, a.title),
      h('div', { class: 'badge-row' },
        statusBadge('ann', a.status),
        badge(t(`acat.${a.category}`), a.category === 'safety' ? 'danger' : 'neutral', a.category === 'safety' ? 'alert' : 'megaphone'),
        a.category === 'safety' && a.safetyReviewed ? badge(t('field.safetyReviewed'), 'success', 'check') : null)),
    h('p', { class: 'muted' }, icon('building'), communityName(a.communityId)),
    h('p', { class: 'ann-body prewrap' }, a.body),
    h('p', { class: 'ann-meta' },
      t('common.created_by', { name: personName(a.createdBy) }),
      a.approvedBy ? ` · ${t('ann.approved_by', { name: personName(a.approvedBy) })}` : '',
      a.publishedAt ? ` · ${fmtDate(a.publishedAt)}` : ''),
    actions.length ? h('div', { class: 'card-actions' }, actions) : null);
}

async function publishAnnouncement(a) {
  const ok = await confirmDialog({
    title: t('ann.publish_title'),
    body: h('div', {},
      h('p', {}, t('ann.publish_body', { community: communityName(a.communityId) })),
      h('div', { class: 'preview-card' }, h('strong', {}, a.title), h('p', { class: 'prewrap' }, a.body))),
    confirmLabel: t('ann.publish'),
  });
  if (ok) await run(() => api(`/announcements/${a.id}/publish`, { method: 'POST' }), t('ann.published_msg'));
}

export function openAnnouncementForm({ record, prefill, fromAssistant } = {}) {
  const src = record || prefill || {};
  const safetyBox = checkbox({ label: t('ann.safety_label'), name: 'safetyReviewed', checked: !!src.safetyReviewed, hint: t('ann.safety_hint') });
  const safetyWrap = h('div', { class: 'safety-wrap', hidden: src.category !== 'safety' }, safetyBox);
  const categoryField = field({ label: t('field.category'), name: 'category', type: 'select', value: src.category || 'general', options: options(ANN_CATEGORIES, 'acat') });
  categoryField.querySelector('select').addEventListener('change', (e) => { safetyWrap.hidden = e.target.value !== 'safety'; });

  formDialog({
    title: t(record ? 'ann.edit' : 'ann.new'),
    intro: [
      fromAssistant ? h('p', { class: 'note note-gold' }, icon('sparkle'), t('ann.draft_from_assistant')) : null,
      record && record.status !== 'draft' ? h('p', { class: 'note' }, icon('info'), t('ann.edit_note')) : null,
    ],
    fields: [
      field({
        label: t('field.communityId'), name: 'communityId', type: 'select', required: true,
        value: src.communityId || (state.communityFilter !== 'all' ? state.communityFilter : ''), options: communityOptions(),
      }),
      categoryField,
      field({ label: t('field.title'), name: 'title', value: src.title, required: true, placeholder: t('ann.title_ph') }),
      field({ label: t('field.body'), name: 'body', type: 'textarea', value: src.body, required: true, rows: 6, placeholder: t('ann.body_ph') }),
      safetyWrap,
    ],
    onSubmit: async (data, form) => {
      if (data.category !== 'safety') data.safetyReviewed = false;
      await api(record ? `/announcements/${record.id}` : '/announcements', { method: record ? 'PUT' : 'POST', body: data });
      await hooks.refresh();
      toast(t('common.saved'));
    },
  });
}

// ---------- Permissions ----------

function viewPermissions() {
  if (!can('users.manage')) return h('div', { class: 'view' }, pageHeader('nav.permissions', 'perm.intro'), noPermissionCard('perm.no_access'));
  const host = h('div', {}, h('p', { class: 'muted' }, t('common.loading')));

  const draw = () => {
    const users = state.users || [];
    host.replaceChildren(rtable(t('perm.users'), [
      { label: t('field.name'), render: (u) => h('div', {}, h('span', { class: 'cell-title' }, u.name), u.id === state.user.id ? badge(t('perm.you'), 'info', 'users') : null) },
      { label: t('field.email'), render: (u) => h('span', { dir: 'ltr' }, u.email) },
      { label: t('field.role'), render: (u) => t(`role.${u.role}`) },
      { label: t('field.communityIds'), render: (u) => (u.communityIds.includes('all') ? t('perm.all_communities') : u.communityIds.map(communityName).join(', ')) },
      { label: t('common.status'), render: (u) => (u.active ? badge(t('perm.active'), 'success', 'check') : badge(t('perm.inactive'), 'neutral', 'lock')) },
      { label: t('common.actions'), cls: 'cell-actions', render: (u) => h('div', { class: 'btn-group' },
        btn(t('perm.edit'), { ic: 'edit', onclick: () => userForm(u, reload), focusKey: `user-${u.id}` }),
        btn(t('perm.reset'), { ic: 'key', cls: 'btn-ghost', onclick: () => resetPassword(u) }),
        u.id !== state.user.id ? (u.active
          ? btn(t('perm.deactivate'), { cls: 'btn-danger-ghost', ic: 'lock', onclick: () => setActive(u, false, reload) })
          : btn(t('perm.activate'), { ic: 'check', onclick: () => setActive(u, true, reload) })) : null) },
    ], users));
  };

  const reload = async () => {
    try {
      state.users = (await api('/users')).users;
      draw();
    } catch (e) {
      host.replaceChildren(h('p', { class: 'form-alert' }, errorText(e)));
    }
  };
  if (state.users) draw();
  reload();

  return h('div', { class: 'view' },
    pageHeader('nav.permissions', 'perm.intro', {
      actions: [btn(t('perm.add'), { cls: 'btn-primary', ic: 'plus', onclick: () => userForm(null, reload) })],
    }),
    h('section', { 'aria-labelledby': 'roles-title' },
      h('h2', { id: 'roles-title' }, t('perm.roles')),
      h('ul', { class: 'role-grid' }, ['admin', 'manager', 'coordinator', 'viewer'].map((r) => h('li', { class: 'card role-card' },
        h('h3', {}, icon(r === 'admin' ? 'shield' : r === 'manager' ? 'building' : r === 'coordinator' ? 'wrench' : 'eye'), t(`role.${r}`)),
        h('p', {}, t(`role.${r}_desc`)))))),
    section(t('perm.users'), host));
}

function noPermissionCard(key) {
  return h('div', { class: 'card empty-card' }, icon('lock'), h('p', {}, t(key)));
}

function communityChecks(selected) {
  const all = selected.includes('all');
  return h('fieldset', { class: 'check-group' },
    h('legend', {}, t('field.communityIds')),
    h('p', { class: 'field-error', id: nextId('comm-err'), hidden: true }),
    checkbox({ label: t('perm.all_communities'), name: 'communityIds', value: 'all', checked: all, group: true }),
    state.data.communities.map((c) => checkbox({ label: c.name, name: 'communityIds', value: c.id, checked: !all && selected.includes(c.id), group: true })));
}

function userForm(u, reload) {
  const self = u?.id === state.user.id;
  formDialog({
    title: u ? `${t('perm.edit')}: ${u.name}` : t('perm.add'),
    fields: [
      field({ label: t('field.name'), name: 'name', value: u?.name, required: true }),
      u ? null : field({ label: t('field.email'), name: 'email', type: 'email', required: true, autocomplete: 'off' }),
      field({
        label: t('field.role'), name: 'role', type: 'select', value: u?.role || 'viewer', disabled: self,
        options: ['admin', 'manager', 'coordinator', 'viewer'].map((r) => ({ value: r, label: t(`role.${r}`) })),
        hint: self ? t('err.self_change') : null,
      }),
      communityChecks(u?.communityIds || []),
    ],
    onSubmit: async (data) => {
      if (self) delete data.role;
      if (u && data.role && data.role !== u.role) {
        const ok = await confirmDialog({
          title: t('perm.role_title', { name: u.name }),
          body: t('perm.role_body', { role: t(`role.${data.role}`), desc: t(`role.${data.role}_desc`) }),
        });
        if (!ok) throw new ApiError('__cancelled');
      }
      if (u) {
        await api(`/users/${u.id}`, { method: 'PUT', body: data });
        toast(t('common.saved'));
      } else {
        const res = await api('/users', { method: 'POST', body: data });
        showTempPassword(res.user.name, res.tempPassword);
      }
      await reload();
      await hooks.refresh();
    },
  });
}

async function resetPassword(u) {
  const ok = await confirmDialog({ title: t('perm.reset_title', { name: u.name }), body: t('perm.reset_body'), confirmLabel: t('perm.reset'), tone: 'danger' });
  if (!ok) return;
  try {
    const res = await api(`/users/${u.id}/reset-password`, { method: 'POST' });
    showTempPassword(u.name, res.tempPassword);
  } catch (e) {
    toast(errorText(e), { tone: 'error' });
  }
}

function showTempPassword(name, password) {
  let d;
  d = openDialog({
    title: t('perm.temp_title'),
    content: h('div', {},
      h('p', {}, t('perm.temp_body', { name })),
      h('p', { class: 'temp-password', dir: 'ltr' }, h('code', {}, password))),
    actions: [btn(t('common.close'), { cls: 'btn-primary', onclick: () => d.close() })],
  });
}

async function setActive(u, active, reload) {
  if (!active) {
    const ok = await confirmDialog({ title: t('perm.deactivate_title', { name: u.name }), body: t('perm.deactivate_body'), confirmLabel: t('perm.deactivate'), tone: 'danger' });
    if (!ok) return;
  }
  try {
    await api(`/users/${u.id}`, { method: 'PUT', body: { active } });
    await reload();
    toast(t('common.saved'), {
      undo: async () => {
        await api(`/users/${u.id}`, { method: 'PUT', body: { active: !active } });
        await reload();
        toast(t('common.restored'));
      },
    });
  } catch (e) {
    toast(errorText(e), { tone: 'error' });
  }
}

// ---------- Finances ----------

function viewFinances() {
  const rows = scoped(state.data.finances).sort((a, b) => a.communityId.localeCompare(b.communityId) || a.category.localeCompare(b.category));
  const approved = rows.filter((f) => f.status === 'approved');
  const total = approved.reduce((s, f) => s + f.budget, 0);
  const spent = approved.reduce((s, f) => s + f.spent, 0);

  return h('div', { class: 'view' },
    pageHeader('nav.finances', 'fin.intro', {
      tech: t('fin.tech'),
      actions: [btn(t('common.export'), {
        ic: 'download',
        onclick: () => downloadCSV(`community-finances-${todayStr()}.csv`,
          [t('common.category'), t('common.community'), t('field.year'), t('field.budget'), t('field.spent'), t('common.status'), t('fin.shown')],
          rows.map((f) => [t(`fcat.${f.category}`), communityName(f.communityId), f.year, f.budget, f.spent, t(`bstatus.${f.status}`),
            f.sharedWithResidents ? t('fin.shown') : t('fin.hidden')])),
      }), can('finances.write') ? btn(t('fin.add'), { cls: 'btn-primary', ic: 'plus', onclick: () => financeForm() }) : null],
    }),
    viewOnlyNote('finances.write'),
    h('ul', { class: 'stat-grid' },
      stat(t('fin.total_budget'), fmtAED(total), 'wallet'),
      stat(t('fin.total_spent'), fmtAED(spent), 'chart'),
      stat(t('fin.remaining'), fmtAED(total - spent), 'check')),
    h('p', { class: 'note' }, icon('info'), t('fin.only_approved'), can('finances.approve') ? '' : ` ${t('fin.only_admin')}`),
    h('div', { class: 'card' }, rows.length ? rtable(t('nav.finances'), [
      { label: t('common.category'), render: (f) => h('div', {}, h('span', { class: 'cell-title' }, t(`fcat.${f.category}`)), h('span', { class: 'cell-sub' }, `${communityName(f.communityId)} · ${fmtNum(f.year).replace(/[,٬.]/g, '')}`)) },
      { label: t('field.budget'), render: (f) => fmtAED(f.budget) },
      { label: t('field.spent'), render: (f) => {
        const pct = f.budget ? Math.round((f.spent / f.budget) * 100) : 0;
        return h('div', { class: 'spend' }, h('span', {}, fmtAED(f.spent)), progressBar(pct, t('fin.used', { n: pct })), h('span', { class: 'cell-sub' }, t('fin.used', { n: fmtNum(pct) })));
      } },
      { label: t('common.status'), render: (f) => h('div', { class: 'badge-stack' }, statusBadge('budget', f.status),
        f.sharedWithResidents ? badge(t('fin.shown'), 'success', 'eye') : badge(t('fin.hidden'), 'neutral', 'eye-off')) },
      { label: t('common.actions'), cls: 'cell-actions', render: (f) => h('div', { class: 'btn-group' },
        can('finances.write') ? btn(t('common.edit'), { ic: 'edit', onclick: () => financeForm(f), focusKey: `fin-edit-${f.id}` }) : null,
        f.status === 'draft' && can('finances.approve') ? btn(t('fin.approve'), {
          cls: 'btn-primary', ic: 'check', focusKey: `fin-approve-${f.id}`,
          onclick: async () => {
            const ok = await confirmDialog({ title: t('fin.approve_title'), body: t('fin.approve_body'), confirmLabel: t('fin.approve') });
            if (ok) run(() => api(`/finances/${f.id}/approve`, { method: 'POST' }), t('fin.approved_msg'));
          },
        }) : null,
        f.status === 'approved' && can('finances.share') ? (f.sharedWithResidents
          ? btn(t('fin.hide'), {
            ic: 'eye-off', focusKey: `fin-share-${f.id}`,
            onclick: () => run(() => api(`/finances/${f.id}/share`, { method: 'POST', body: { shared: false } }), t('common.saved'), {
              undo: async () => { await api(`/finances/${f.id}/share`, { method: 'POST', body: { shared: true } }); await hooks.refresh(); },
            }),
          })
          : btn(t('fin.show'), {
            ic: 'eye', focusKey: `fin-share-${f.id}`,
            onclick: async () => {
              const ok = await confirmDialog({ title: t('fin.show_title'), body: t('fin.show_body', { community: communityName(f.communityId), category: t(`fcat.${f.category}`) }), confirmLabel: t('fin.show') });
              if (ok) run(() => api(`/finances/${f.id}/share`, { method: 'POST', body: { shared: true } }), t('common.saved'));
            },
          })) : null) },
    ], rows) : emptyState()));
}

function financeForm(f) {
  formDialog({
    title: t(f ? 'fin.edit' : 'fin.add'),
    intro: f?.status === 'approved' ? h('p', { class: 'note' }, icon('info'), t('fin.only_approved')) : null,
    fields: [
      f ? null : field({ label: t('field.communityId'), name: 'communityId', type: 'select', required: true, value: state.communityFilter !== 'all' ? state.communityFilter : '', options: communityOptions() }),
      field({ label: t('field.category'), name: 'category', type: 'select', value: f?.category || 'maintenance_fund', options: options(FINANCE_CATEGORIES, 'fcat') }),
      field({ label: t('field.year'), name: 'year', type: 'number', min: '2000', max: '2100', value: f?.year || new Date().getFullYear(), required: true }),
      h('div', { class: 'field-row' },
        field({ label: t('field.budget'), name: 'budget', type: 'number', min: '0', step: '0.01', value: f?.budget ?? '', required: true, inputmode: 'decimal' }),
        field({ label: t('field.spent'), name: 'spent', type: 'number', min: '0', step: '0.01', value: f?.spent ?? 0, inputmode: 'decimal' })),
    ],
    onSubmit: async (data) => {
      await api(f ? `/finances/${f.id}` : '/finances', { method: f ? 'PUT' : 'POST', body: data });
      await hooks.refresh();
      toast(t('common.saved'));
    },
  });
}

// ---------- Reports & insights ----------

function viewInsights() {
  const reports = scoped(state.data.reports);
  const maint = scoped(state.data.maintenance);
  const countBy = (list, key) => list.reduce((m, r) => m.set(r[key], (m.get(r[key]) || 0) + 1), new Map());
  const chart = (title, map, labelFn) => {
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(([, n]) => n));
    return section(title, entries.length ? h('ul', { class: 'bars' }, entries.map(([k, n]) => h('li', { class: 'bar-row' },
      h('span', { class: 'bar-label' }, labelFn(k)),
      h('span', { class: 'bar-track', 'aria-hidden': 'true' }, h('span', { class: 'bar-fill', style: { width: `${(n / max) * 100}%` } })),
      h('span', { class: 'bar-value' }, fmtNum(n))))) : emptyState());
  };
  const resolved = reports.filter((r) => r.status === 'resolved').length;
  const places = countBy(reports, 'facilityId');

  return h('div', { class: 'view' },
    pageHeader('nav.insights', 'ins.intro', { tech: t('ins.tech') }),
    h('p', { class: 'note' }, icon('info'), t('ins.note')),
    h('ul', { class: 'stat-grid' },
      stat(t('ins.resolved_rate'), reports.length ? `${fmtNum(resolved)} / ${fmtNum(reports.length)}` : t('common.na'), 'check'),
      stat(t('nav.reports'), t('ins.count', { n: fmtNum(reports.length) }), 'message'),
      stat(t('nav.maintenance'), t('ins.count', { n: fmtNum(maint.length) }), 'wrench')),
    h('div', { class: 'dash-grid' },
      chart(t('ins.by_category'), countBy(reports, 'category'), (k) => t(`cat.${k}`)),
      chart(t('ins.by_status'), countBy(reports, 'status'), (k) => t(`rstatus.${k}`)),
      chart(t('ins.maint_status'), countBy(maint, 'status'), (k) => t(`mstatus.${k}`)),
      chart(t('ins.top_places'), new Map([...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)), (k) => facilityName(k) || t('common.unknown'))));
}

// ---------- Settings ----------

function viewSettings() {
  const p = state.user.prefs;
  const form = h('form', { class: 'settings-form', novalidate: true },
    h('div', { class: 'card' }, radioGroup({
      legend: t('set.language'), name: 'lang', value: state.lang,
      options: Object.entries(LANGS).map(([code, l]) => ({ value: code, label: l.name, lang: code })),
    })),
    h('div', { class: 'card' }, radioGroup({
      legend: t('set.text_size'), name: 'textSize', value: p.textSize,
      options: ['standard', 'large', 'larger'].map((s) => ({ value: s, label: t(`set.size_${s}`) })),
    })),
    h('div', { class: 'card' }, radioGroup({
      legend: t('set.appearance'), name: 'theme', value: p.theme,
      options: [{ value: 'light', label: t('set.light') }, { value: 'dark', label: t('set.dark') }],
      hint: t('set.motion_note'),
    })),
    h('div', { class: 'card' }, h('fieldset', { class: 'check-group' },
      h('legend', {}, t('set.notifications')),
      h('p', { class: 'hint' }, t('set.notif_note')),
      checkbox({ label: t('set.notif_reports'), name: 'n_reports', checked: p.notifications.reports }),
      checkbox({ label: t('set.notif_approvals'), name: 'n_approvals', checked: p.notifications.approvals }),
      checkbox({ label: t('set.notif_digest'), name: 'n_digest', checked: p.notifications.digest }))),
    h('div', { class: 'card' }, radioGroup({
      legend: t('set.layout'), name: 'dashboardLayout', value: p.dashboardLayout,
      options: [{ value: 'simple', label: t('set.layout_simple') }, { value: 'detailed', label: t('set.layout_detailed') }],
    })),
    h('div', { class: 'form-actions' }, btn(t('common.save_changes'), { cls: 'btn-primary btn-lg', ic: 'check', type: 'submit', focusKey: 'settings-save' })));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = readForm(form);
    const prefs = {
      lang: d.lang, textSize: d.textSize, theme: d.theme, dashboardLayout: d.dashboardLayout,
      notifications: { reports: d.n_reports, approvals: d.n_approvals, digest: d.n_digest },
    };
    try {
      const res = await api('/me/prefs', { method: 'PUT', body: prefs });
      state.user.prefs = res.prefs;
      const langChanged = res.prefs.lang !== state.lang;
      if (langChanged) {
        const { setLang } = await import('./app.js');
        await setLang(res.prefs.lang);
      } else {
        hooks.renderView();
      }
      document.querySelector('[data-focus-key="settings-save"]')?.focus();
      toast(t('set.saved'));
    } catch (err) {
      showFormError(form, err);
    }
  });

  return h('div', { class: 'view' },
    pageHeader('nav.settings', 'set.intro'),
    form,
    section(t('set.account'), h('div', { class: 'form-grid' },
      h('p', {}, t('set.signed_in_as', { name: state.user.name, role: t(`role.${state.user.role}`) }),
        h('br'), h('span', { class: 'muted', dir: 'ltr' }, state.user.email)),
      passwordForm())));
}

function passwordForm() {
  const form = h('form', { class: 'form-grid password-form', novalidate: true },
    h('h3', {}, icon('key'), t('pw.title')),
    formAlert(),
    field({ label: t('field.currentPassword'), name: 'currentPassword', type: 'password', required: true, autocomplete: 'current-password' }),
    field({ label: t('field.newPassword'), name: 'newPassword', type: 'password', required: true, autocomplete: 'new-password', hint: t('pw.hint') }),
    field({ label: t('field.confirmPassword'), name: 'confirmPassword', type: 'password', required: true, autocomplete: 'new-password' }));
  const submit = btn(t('pw.title'), { cls: 'btn-secondary', ic: 'key', type: 'submit' });
  form.append(h('div', { class: 'form-actions' }, submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await withBusy(submit, async () => {
      await api('/me/password', { method: 'POST', body: readForm(form) });
      form.reset();
      toast(t('pw.changed'));
    }, form);
  });
  return form;
}

export const VIEWS = {
  dashboard: viewDashboard,
  communities: viewCommunities,
  maintenance: viewMaintenance,
  reports: viewReports,
  map: viewMap,
  construction: viewConstruction,
  announcements: viewAnnouncements,
  permissions: viewPermissions,
  finances: viewFinances,
  insights: viewInsights,
  settings: viewSettings,
};
