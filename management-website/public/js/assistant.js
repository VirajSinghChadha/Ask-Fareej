// Ask Fareej assistant: a guided helper that reads the user's scoped records and built-in help.
// It never changes records. Drafts open in a form the user must review and save themselves.
import {
  state, t, h, icon, can, priorities, recurringGroups, scoped, communityName, facilityName, relDay, fmtTime,
  fmtAED, todayStr, nextId,
} from './core.js';
import { openAnnouncementForm } from './views.js';

const KW = {
  draft: /(draft|write|prepare|compose|مسودة|اكتب|أعد|ड्राफ़्ट|ड्राफ्ट|मसौदा|लिख|तैयार)/i,
  announce: /(announc|إعلان|घोषणा)/i,
  act: /(publish|approve|delete|remove|grant|انشر|اعتمد|احذف|प्रकाशित|स्वीकृत|मंज़ूर|मंजूर|हटा)/i,
  how: /(how|steps|كيف|خطوات|कैसे)/i,
  today: /(today|attention|priorit|اليوم|أولوي|اهتمام|आज|प्राथमिकता|ध्यान)/i,
  recurring: /(recurr|repeat|same problem|متكرر|تكرار|बार-बार|बार बार|आवर्ती)/i,
  maint: /(maint|repair|schedul|صيان|إصلاح|جدول|रखरखाव|मरम्मत|शेड्यूल)/i,
  complaints: /(complain|report|unresolved|issue|شكو|شكاو|بلاغ|مشكل|शिकायत|समस्या)/i,
  map: /(map|خريط|नक्श)/i,
  finance: /(budget|financ|spend|ميزاني|مالي|बजट|वित्त|खर्च)/i,
  perm: /(permission|role|access|صلاحي|अनुमति|भूमिका)/i,
};
const TOPICS = {
  pool: /(pool|swim|مسبح|पूल)/i,
  lifts: /(lift|elevator|مصعد|लिफ़्ट|लिफ्ट)/i,
  ac: /(\bac\b|air con|cooling|تكييف|एसी|एयर)/i,
  plumbing: /(water|plumb|leak|مياه|سباكة|पानी)/i,
  electrical: /(electric|power|light|كهرباء|बिजली)/i,
  cleaning: /(clean|نظاف|सफ़ाई|सफाई)/i,
  pest: /(pest|insect|حشرات|कीट)/i,
  landscaping: /(garden|landscap|irrigat|حديقة|बाग)/i,
  security: /(gate|security|أمن|बوابة|सुरक्षा)/i,
};

const nav = (screen, href) => ({ type: 'nav', label: t('asst.open', { screen: t(`nav.${screen}`) }), href });

function topicOf(text) {
  return Object.keys(TOPICS).find((k) => TOPICS[k].test(text));
}

function reply(text) {
  const d = state.data;
  const topic = topicOf(text);

  if (KW.draft.test(text) || (KW.announce.test(text) && !KW.act.test(text))) {
    if (!can('announcements.write')) return { text: t('err.forbidden') };
    const communities = scoped(d.communities);
    const community = communities.find((c) => text.toLowerCase().includes(c.name.toLowerCase())) || communities[0];
    const topicLabel = t(`cat.${topic || 'other'}`);
    const draft = {
      communityId: community?.id,
      category: 'maintenance',
      title: t('asst.draft_title', { topic: topicLabel }),
      body: t('asst.draft_body', { topic: topicLabel, community: community?.name || '' }),
    };
    return { text: t('asst.draft_ready'), actions: [{ type: 'draft', label: t('asst.review_draft'), draft }] };
  }
  if (KW.act.test(text)) {
    const screen = KW.announce.test(text) ? 'announcements' : KW.perm.test(text) ? 'permissions' : KW.finance.test(text) ? 'finances' : 'maintenance';
    return { text: t('asst.cannot_act'), actions: [nav(screen, `#/${screen}`)] };
  }
  if (KW.recurring.test(text)) {
    const groups = recurringGroups();
    return {
      text: `${t('asst.recurring_explain')} ${groups.length ? t('asst.recurring_list') : t('dash.all_clear')}`,
      items: groups.map((g) => ({
        title: t('rep.recurring_group', { category: t(`cat.${g.category}`), place: g.place }),
        sub: `${communityName(g.communityId)} · ${t('rep.recurring_count', { n: g.reports.length })}`,
      })),
      actions: [nav('reports', '#/reports#recurring')],
    };
  }
  if (KW.maint.test(text) && KW.how.test(text)) {
    return { text: t('asst.how_maint'), actions: [can('maintenance.write') ? { type: 'nav', label: t('maint.new'), href: '#/maintenance/new' } : nav('maintenance', '#/maintenance')] };
  }
  if (KW.today.test(text)) {
    const p = priorities();
    return { text: t('asst.today', { review: p.review, maint: p.maint, ann: p.ann, rec: p.rec }), actions: [nav('dashboard', '#/dashboard')] };
  }
  if (KW.maint.test(text) || (topic && !KW.complaints.test(text))) {
    const today = todayStr();
    const list = scoped(d.maintenance)
      .filter((m) => m.status === 'in_progress' || (m.status === 'scheduled' && m.date >= today) || m.status === 'draft')
      .filter((m) => !topic || m.category === topic)
      .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
    return {
      text: list.length ? t('asst.maint_list') : t('asst.none'),
      items: list.map((m) => ({ title: m.title, sub: `${facilityName(m.facilityId)} · ${relDay(m.date)} ${fmtTime(m.startTime)} · ${t(`mstatus.${m.status}`)}` })),
      actions: [nav('maintenance', '#/maintenance')],
    };
  }
  if (KW.complaints.test(text)) {
    const list = scoped(d.reports).filter((r) => r.status !== 'resolved').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 6);
    return {
      text: list.length ? t('asst.unresolved_list') : t('dash.all_clear'),
      items: list.map((r) => ({ title: r.title, sub: `${facilityName(r.facilityId) || r.location} · ${relDay(r.createdAt)} · ${t(`rstatus.${r.status}`)}` })),
      actions: [nav('reports', '#/reports?status=open')],
    };
  }
  if (KW.map.test(text)) return { text: t('asst.map_explain'), actions: [nav('map', '#/map')] };
  if (KW.finance.test(text)) {
    const approved = scoped(d.finances).filter((f) => f.status === 'approved');
    return {
      text: t('asst.finance_explain', { budget: fmtAED(approved.reduce((s, f) => s + f.budget, 0)), spent: fmtAED(approved.reduce((s, f) => s + f.spent, 0)) }),
      actions: [nav('finances', '#/finances')],
    };
  }
  if (KW.perm.test(text)) return { text: t('asst.perm_explain'), actions: can('users.manage') ? [nav('permissions', '#/permissions')] : [] };
  if (KW.how.test(text)) return { text: t(`help.${state.route.name}`) };

  // Fall back to a plain search of record titles.
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  if (words.length) {
    const pool = [
      ...scoped(d.maintenance).map((m) => ({ title: m.title, sub: `${t('nav.maintenance')} · ${t(`mstatus.${m.status}`)}` })),
      ...scoped(d.reports).map((r) => ({ title: r.title, sub: `${t('nav.reports')} · ${t(`rstatus.${r.status}`)}` })),
      ...scoped(d.announcements).map((a) => ({ title: a.title, sub: `${t('nav.announcements')} · ${t(`astatus.${a.status}`)}` })),
    ];
    const hits = pool.filter((x) => words.some((w) => x.title.toLowerCase().includes(w))).slice(0, 6);
    if (hits.length) return { text: t('asst.found', { n: hits.length }), items: hits };
  }
  return { text: t('asst.not_understood') };
}

function messageNode(msg) {
  if (msg.from === 'user') {
    return h('li', { class: 'msg msg-user' }, h('span', { class: 'sr-only' }, `${t('asst.you')}: `), msg.text);
  }
  return h('li', { class: 'msg msg-bot' },
    h('span', { class: 'sr-only' }, `${t('asst.button')}: `),
    h('p', {}, msg.text),
    msg.items?.length ? h('ul', { class: 'msg-items' }, msg.items.map((i) => h('li', {}, h('strong', {}, i.title), h('span', {}, i.sub)))) : null,
    msg.actions?.length ? h('div', { class: 'msg-actions' }, msg.actions.map((a) => (a.type === 'nav'
      // Close the panel so the screen it opens is visible.
      ? h('a', { href: a.href, class: 'btn btn-sm btn-secondary', onclick: () => closeAssistant({ refocus: false }) }, a.label, icon('arrow-end'))
      : h('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: () => openAnnouncementForm({ prefill: a.draft, fromAssistant: true }) }, icon('edit'), a.label)))) : null);
}

function send(text, log) {
  const clean = text.trim().slice(0, 500);
  if (!clean) return;
  const userMsg = { from: 'user', text: clean };
  const botMsg = { from: 'bot', ...reply(clean) };
  state.assistantLog.push(userMsg, botMsg);
  log.append(messageNode(userMsg), messageNode(botMsg));
  log.lastElementChild.scrollIntoView({ block: 'nearest' });
}

export function renderAssistant() {
  const fab = h('button', {
    type: 'button', id: 'assistant-fab', class: 'assistant-fab', 'aria-expanded': String(state.assistantOpen),
    'aria-controls': 'assistant-panel', hidden: state.assistantOpen, onclick: toggleAssistant,
  }, icon('sparkle'), h('span', {}, 'Ask Fareej'));

  const log = h('ul', { class: 'msg-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' },
    messageNode({ from: 'bot', text: t('asst.intro') }),
    state.assistantLog.map(messageNode));
  const inputId = nextId('ask');
  const input = h('input', { id: inputId, type: 'text', placeholder: t('asst.placeholder'), autocomplete: 'off', maxlength: '500' });
  const form = h('form', { class: 'ask-form' },
    h('label', { for: inputId, class: 'sr-only' }, t('asst.placeholder')),
    input,
    h('button', { type: 'submit', class: 'btn btn-primary', 'aria-label': t('asst.send') }, icon('send')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send(input.value, log);
    input.value = '';
    input.focus();
  });
  const suggestions = h('div', { class: 'suggestions' },
    ['s_today', 's_maint', 's_recurring', 's_draft', 's_how'].map((k) => h('button', {
      type: 'button', class: 'chip', onclick: () => send(t(`asst.${k}`), log),
    }, t(`asst.${k}`))));

  const panel = h('section', { id: 'assistant-panel', class: 'assistant-panel', 'aria-labelledby': 'assistant-title', hidden: !state.assistantOpen },
    h('div', { class: 'assistant-head' },
      h('h2', { id: 'assistant-title', tabindex: '-1' }, icon('sparkle'), t('asst.title')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('asst.close'), onclick: toggleAssistant }, icon('x'))),
    h('p', { class: 'assistant-mode' }, icon('lock'), t('asst.mode')),
    log, suggestions, form);
  return [fab, panel];
}

export function toggleAssistant({ refocus = true } = {}) {
  state.assistantOpen = !state.assistantOpen;
  const [fab, panel] = renderAssistant();
  document.getElementById('assistant-fab')?.replaceWith(fab);
  document.getElementById('assistant-panel')?.replaceWith(panel);
  if (state.assistantOpen) panel.querySelector('input')?.focus();
  else if (refocus) fab.focus();
}

export function closeAssistant(opts) {
  if (state.assistantOpen) toggleAssistant(opts);
}
