// Boot, login page, application shell, routing and help panel.
import { LANGS } from './i18n.js';
import {
  state, hooks, t, h, icon, logo, fullLogo, api, errorText, nextId, setFieldError, clearFieldError, openDialog,
  communityOptions, priorities, scoped, todayStr, can,
} from './core.js';
import { VIEWS } from './views.js';
import { renderAssistant, closeAssistant } from './assistant.js';

const NAV = [
  ['dashboard', 'grid'], ['communities', 'building'], ['maintenance', 'wrench'], ['reports', 'message'],
  ['map', 'map'], ['construction', 'hardhat'], ['announcements', 'megaphone'], ['permissions', 'shield'],
  ['finances', 'wallet'], ['insights', 'chart'], ['settings', 'sliders'],
];

const root = () => document.getElementById('app');

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

export function applyDocument() {
  const html = document.documentElement;
  html.lang = state.lang;
  html.dir = LANGS[state.lang].dir;
  const prefs = state.user?.prefs;
  html.dataset.theme = prefs?.theme || storageGet('af_theme') || 'light';
  html.dataset.textSize = prefs?.textSize || storageGet('af_text') || 'standard';
  document.title = state.user
    ? `${t(`nav.${state.route.name}`)} · ${t('app.management')}`
    : `${t('login.sign_in')} · ${t('app.management')}`;
  if (prefs) {
    storageSet('af_theme', prefs.theme);
    storageSet('af_text', prefs.textSize);
  }
}

// ---------- Language ----------

function languagePicker() {
  const id = nextId('lang');
  const select = h('select', { id, class: 'lang-select', dataset: { focusKey: 'lang' } },
    Object.entries(LANGS).map(([code, l]) => h('option', { value: code, lang: code, selected: code === state.lang }, l.name)));
  select.addEventListener('change', () => setLang(select.value));
  return h('div', { class: 'lang-picker' },
    h('label', { for: id, class: 'lang-icon' }, icon('globe'), h('span', { class: 'sr-only' }, t('common.language'))),
    select);
}

export async function setLang(code) {
  if (!LANGS[code] || code === state.lang) return;
  state.lang = code;
  state.langTouched = true;
  storageSet('af_lang', code);
  if (state.user) {
    state.user.prefs = { ...state.user.prefs, lang: code };
    api('/me/prefs', { method: 'PUT', body: state.user.prefs }).catch(() => {});
    renderShell();
  } else {
    renderLogin();
  }
  document.querySelector('[data-focus-key="lang"]')?.focus();
}

// ---------- Login ----------

const LOGIN_ART = `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0E3A2F"/><stop offset="0.55" stop-color="#5E7F63"/><stop offset="1" stop-color="#E7C98F"/>
  </linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2E6B5B"/><stop offset="1" stop-color="#0B2F26"/>
  </linearGradient>
</defs>
<rect width="600" height="800" fill="url(#sky)"/>
<circle cx="410" cy="520" r="78" fill="#F6E3B4" opacity="0.85"/>
<g fill="#2D5A4D" opacity="0.9">
  <rect x="40" y="330" width="46" height="300"/><rect x="96" y="380" width="38" height="250"/>
  <rect x="150" y="260" width="52" height="370"/><path d="M262 630V250l14-90 14 90v380z"/>
  <rect x="300" y="350" width="44" height="280"/><rect x="470" y="300" width="50" height="330"/>
  <rect x="530" y="390" width="40" height="240"/>
</g>
<g fill="#1C463A">
  <rect x="10" y="440" width="70" height="200"/><rect x="120" y="410" width="80" height="230"/>
  <rect x="360" y="420" width="76" height="220"/><rect x="450" y="460" width="90" height="180"/>
</g>
<g fill="#C9A86A" opacity="0.55">
  <rect x="22" y="460" width="8" height="10"/><rect x="40" y="460" width="8" height="10"/><rect x="58" y="460" width="8" height="10"/>
  <rect x="22" y="490" width="8" height="10"/><rect x="58" y="490" width="8" height="10"/><rect x="40" y="520" width="8" height="10"/>
  <rect x="134" y="430" width="10" height="12"/><rect x="156" y="430" width="10" height="12"/><rect x="178" y="430" width="10" height="12"/>
  <rect x="134" y="466" width="10" height="12"/><rect x="178" y="466" width="10" height="12"/><rect x="156" y="502" width="10" height="12"/>
  <rect x="374" y="440" width="10" height="12"/><rect x="396" y="440" width="10" height="12"/><rect x="418" y="440" width="10" height="12"/>
  <rect x="374" y="476" width="10" height="12"/><rect x="418" y="476" width="10" height="12"/>
  <rect x="466" y="480" width="10" height="12"/><rect x="490" y="480" width="10" height="12"/><rect x="514" y="480" width="10" height="12"/>
</g>
<g fill="#0E3B30">
  <path d="M0 640h600v160H0z"/>
  <path d="M30 640v-60h120v60z"/><path d="M60 640v-32a30 30 0 0 1 60 0v32z" fill="#C9A86A" opacity="0.35"/>
  <path d="M190 640v-74h150v74z"/><path d="M225 640v-40a40 40 0 0 1 80 0v40z" fill="#C9A86A" opacity="0.35"/>
  <path d="M380 640v-58h140v58z"/><path d="M420 640v-30a30 30 0 0 1 60 0v30z" fill="#C9A86A" opacity="0.35"/>
</g>
<g stroke="#0B2F26" stroke-width="7" fill="none" stroke-linecap="round">
  <path d="M168 646c4-50 2-90-6-130"/><path d="M548 646c-4-46-1-86 8-124"/>
</g>
<g fill="#0B2F26">
  <path d="M162 516c-30-6-52 4-66 22 22-8 44-10 66-22z"/><path d="M162 516c26-14 52-10 70 6-24-4-46-2-70-6z"/>
  <path d="M162 516c-10-26-34-38-58-36 22 8 40 20 58 36z"/><path d="M162 516c8-26 30-40 56-40-20 10-38 22-56 40z"/>
  <path d="M556 522c-28-8-52 0-68 16 22-6 46-6 68-16z"/><path d="M556 522c24-14 50-12 68 2-22-2-46 0-68-2z"/>
  <path d="M556 522c-8-26-30-40-54-40 20 10 38 22 54 40z"/><path d="M556 522c10-24 32-36 56-34-20 8-40 18-56 34z"/>
</g>
<rect y="700" width="600" height="100" fill="url(#water)" opacity="0.9"/>
<g stroke="#C9A86A" stroke-width="2" opacity="0.5"><path d="M60 730h80M220 750h120M400 728h90M120 770h60M460 772h70"/></g>`;

function loginArt() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 600 800');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('login.image_alt'));
  svg.setAttribute('class', 'login-art');
  svg.innerHTML = LOGIN_ART;
  return svg;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function renderLogin(message) {
  state.user = null;
  applyDocument();

  const emailId = nextId('email');
  const pwId = nextId('password');
  const rememberId = nextId('remember');

  const emailInput = h('input', {
    id: emailId, name: 'email', type: 'email', autocomplete: 'username', inputmode: 'email', required: true,
    'aria-describedby': `${emailId}-err`, spellcheck: 'false',
  });
  const pwInput = h('input', {
    id: pwId, name: 'password', type: 'password', autocomplete: 'current-password', required: true,
    'aria-describedby': `${pwId}-err`,
  });
  for (const input of [emailInput, pwInput]) input.addEventListener('input', () => clearFieldError(input));

  const toggle = h('button', {
    type: 'button', class: 'pw-toggle', 'aria-controls': pwId, 'aria-label': t('login.show_password'), title: t('login.show_password'),
  }, icon('eye'));
  toggle.addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    const label = t(show ? 'login.hide_password' : 'login.show_password');
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.replaceChildren(icon(show ? 'eye-off' : 'eye'));
  });

  const remember = h('input', { type: 'checkbox', id: rememberId, name: 'remember', 'aria-describedby': `${rememberId}-hint` });
  const alertBox = h('div', { class: 'form-alert', role: 'alert', tabindex: '-1', hidden: !message || message === 'login.signed_out' });
  if (message && message !== 'login.signed_out') alertBox.textContent = t(message);
  const status = h('p', { class: 'form-status', role: 'status' }, message === 'login.signed_out' ? t('login.signed_out') : '');
  const submit = h('button', { type: 'submit', class: 'btn btn-primary btn-block btn-lg' }, t('login.sign_in'));

  const form = h('form', { class: 'login-form', novalidate: true },
    alertBox,
    status,
    h('div', { class: 'field' },
      h('label', { for: emailId }, t('login.email')),
      emailInput,
      h('p', { class: 'field-error', id: `${emailId}-err`, hidden: true })),
    h('div', { class: 'field' },
      h('label', { for: pwId }, t('login.password')),
      h('div', { class: 'pw-wrap' }, pwInput, toggle),
      h('p', { class: 'field-error', id: `${pwId}-err`, hidden: true })),
    h('div', { class: 'login-row' },
      h('div', { class: 'check' },
        remember,
        h('label', { for: rememberId }, t('login.remember')),
        h('p', { class: 'hint', id: `${rememberId}-hint` }, t('login.remember_hint'))),
      h('button', { type: 'button', class: 'link-btn', onclick: forgotPassword }, t('login.forgot'))),
    submit,
    h('p', { class: 'secure-note' }, icon('lock'), h('span', {}, t('login.secure_note'))));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox.hidden = true;
    status.textContent = '';
    const email = emailInput.value.trim();
    const password = pwInput.value;
    let firstBad = null;
    if (!email) { setFieldError(emailInput, t('err.email_required')); firstBad ||= emailInput; }
    else if (!EMAIL_RE.test(email)) { setFieldError(emailInput, t('err.email_format')); firstBad ||= emailInput; }
    if (!password) { setFieldError(pwInput, t('err.password_required')); firstBad ||= pwInput; }
    if (firstBad) { firstBad.focus(); return; }

    submit.disabled = true;
    submit.textContent = t('login.signing_in');
    try {
      await api('/auth/login', { method: 'POST', body: { email, password, remember: remember.checked } });
      await startSession();
    } catch (err) {
      if (err.field === 'email' || err.field === 'password') {
        const input = err.field === 'email' ? emailInput : pwInput;
        setFieldError(input, errorText(err));
        input.focus();
      } else {
        alertBox.textContent = errorText(err);
        alertBox.hidden = false;
        alertBox.focus();
      }
      if (document.contains(submit)) {
        submit.disabled = false;
        submit.textContent = t('login.sign_in');
      }
    }
  });

  const demo = state.demo?.demo ? h('details', { class: 'demo-box', open: true },
    h('summary', {}, icon('info'), t('login.demo_title')),
    h('p', { class: 'hint' }, t('login.demo_note')),
    h('ul', { class: 'demo-list' }, state.demo.accounts.map((a) => h('li', {},
      h('div', {}, h('strong', {}, t(`role.${a.role}`)), h('span', { class: 'demo-email', dir: 'ltr' }, a.email)),
      h('button', {
        type: 'button', class: 'btn btn-sm btn-secondary',
        onclick: () => {
          emailInput.value = a.email;
          pwInput.value = a.password;
          clearFieldError(emailInput);
          clearFieldError(pwInput);
          form.requestSubmit();
        },
      }, t('login.demo_use')))))) : null;

  root().replaceChildren(
    h('div', { class: 'login' },
      h('section', { class: 'login-visual' },
        loginArt(),
        h('div', { class: 'login-overlay' }),
        h('div', { class: 'login-brand' },
          h('div', { class: 'login-logo-card' }, fullLogo(220, 'Ask Fareej')),
          h('p', { class: 'login-brand-name' }, t('app.management')),
          h('p', { class: 'login-brand-tag' }, t('app.tagline')))),
      h('main', { class: 'login-panel', id: 'main' },
        h('div', { class: 'login-top' }, languagePicker()),
        h('div', { class: 'login-card' },
          h('div', { class: 'login-mobile-brand' }, logo(44),
            h('div', {}, h('p', { class: 'brand-name' }, t('app.management')), h('p', { class: 'brand-sub' }, t('app.tagline')))),
          h('h1', {}, t('login.welcome')),
          h('p', { class: 'login-sub' }, t('login.subtitle')),
          demo,
          form))));
}

function forgotPassword() {
  let d;
  d = openDialog({
    title: t('login.forgot_title'),
    content: h('p', {}, t('login.forgot_body')),
    actions: [h('button', { type: 'button', class: 'btn btn-primary', onclick: () => d.close() }, t('common.close'))],
  });
}

// ---------- Session ----------

async function startSession() {
  const data = await api('/bootstrap');
  state.data = data;
  state.user = data.user;
  state.perms = data.permissions;
  if (state.langTouched && state.user.prefs.lang !== state.lang) {
    state.user.prefs.lang = state.lang;
    api('/me/prefs', { method: 'PUT', body: state.user.prefs }).catch(() => {});
  } else if (LANGS[state.user.prefs.lang]) {
    state.lang = state.user.prefs.lang;
    storageSet('af_lang', state.lang);
  }
  if (state.communityFilter !== 'all' && !data.communities.some((c) => c.id === state.communityFilter)) {
    state.communityFilter = 'all';
  }
  state.route = parseRoute();
  renderShell();
  document.getElementById('page-title')?.focus();
}

async function signOut() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* signing out anyway */ }
  resetSession();
  history.replaceState(null, '', '#/dashboard');
  renderLogin('login.signed_out');
}

function resetSession() {
  Object.assign(state, {
    user: null, perms: [], data: null, users: null, wizard: null, helpOpen: false,
    assistantOpen: false, assistantLog: [], navOpen: false, mapSelected: null,
  });
  document.querySelectorAll('dialog').forEach((d) => d.remove());
}

hooks.sessionExpired = () => {
  if (!state.user) return;
  resetSession();
  renderLogin('err.session_expired');
};

hooks.refresh = async () => {
  const data = await api('/bootstrap');
  state.data = data;
  state.user = data.user;
  state.perms = data.permissions;
  renderView();
  document.getElementById('sidebar')?.replaceWith(sidebar());
  document.querySelector('.notif')?.replaceWith(notificationBell());
};

// ---------- Routing ----------

function parseRoute() {
  // A second "#" marks an in-page anchor, e.g. #/reports#recurring.
  const raw = location.hash.replace(/^#\/?/, '').split('#')[0];
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const name = NAV.some(([n]) => n === parts[0]) ? parts[0] : 'dashboard';
  return { name, params: parts.slice(1), query: new URLSearchParams(qs || '') };
}

window.addEventListener('hashchange', () => {
  if (!state.user) return;
  state.route = parseRoute();
  state.navOpen = false;
  document.querySelector('.shell')?.classList.remove('nav-open');
  document.getElementById('sidebar')?.replaceWith(sidebar());
  document.getElementById('help-panel')?.replaceWith(helpPanel());
  renderView({ focusHeading: true });
});

// A link to the page you are already on fires no hashchange; re-open the page instead of doing nothing.
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="#/"]');
  if (!a || !state.user || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (a.getAttribute('href') !== location.hash) return;
  e.preventDefault();
  state.route = parseRoute();
  state.navOpen = false;
  document.querySelector('.shell')?.classList.remove('nav-open');
  renderView({ focusHeading: true });
  if (location.hash.endsWith('#recurring')) document.getElementById('recurring')?.scrollIntoView({ block: 'start' });
});

export function renderView({ focusHeading = false } = {}) {
  const main = document.getElementById('main');
  if (!main || !state.user) return;
  const focusKey = document.activeElement?.dataset?.focusKey;
  const view = VIEWS[state.route.name] || VIEWS.dashboard;
  main.replaceChildren(view());
  applyDocument();
  if (focusHeading) {
    document.getElementById('page-title')?.focus();
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  } else if (focusKey) {
    main.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus();
  }
}
hooks.renderView = renderView;

// ---------- Shell ----------

function navCount(name) {
  if (!state.data) return null;
  const p = priorities();
  const n = name === 'reports' ? p.review : name === 'announcements' ? p.ann : 0;
  return n ? h('span', { class: 'nav-count' }, String(n)) : null;
}

function sidebar() {
  return h('nav', { class: 'sidebar', id: 'sidebar', 'aria-label': t('nav.label') },
    h('div', { class: 'sidebar-brand' },
      logo(40),
      h('div', {}, h('p', { class: 'brand-name' }, t('app.name')), h('p', { class: 'brand-sub' }, t('app.tagline')))),
    h('button', { type: 'button', class: 'icon-btn sidebar-close', 'aria-label': t('common.close_menu'), onclick: closeNav }, icon('x')),
    h('ul', { class: 'nav-list' }, NAV.map(([name, ic]) => h('li', {},
      h('a', {
        href: `#/${name}`, class: 'nav-link', 'aria-current': state.route.name === name ? 'page' : null,
      }, icon(ic), h('span', { class: 'nav-text' }, t(`nav.${name}`)), navCount(name))))),
    h('div', { class: 'sidebar-foot' }, h('p', {}, t('app.management'))));
}

function openNav() {
  state.navOpen = true;
  document.querySelector('.shell')?.classList.add('nav-open');
  document.querySelector('.menu-btn')?.setAttribute('aria-expanded', 'true');
  document.querySelector('#sidebar .nav-link')?.focus();
}

function closeNav() {
  if (!state.navOpen) return;
  state.navOpen = false;
  document.querySelector('.shell')?.classList.remove('nav-open');
  const btn = document.querySelector('.menu-btn');
  btn?.setAttribute('aria-expanded', 'false');
  btn?.focus();
}

function communityFilter() {
  if (state.data.communities.length < 2) return null;
  const id = nextId('community-filter');
  const select = h('select', { id, class: 'community-select', dataset: { focusKey: 'community-filter' } },
    communityOptions({ withAll: true }).map((o) => h('option', { value: o.value, selected: o.value === state.communityFilter }, o.label)));
  select.addEventListener('change', () => {
    state.communityFilter = select.value;
    storageSet('af_community', select.value);
    renderView();
    document.getElementById('sidebar')?.replaceWith(sidebar());
  });
  return h('div', { class: 'community-filter' },
    h('label', { for: id }, icon('building'), h('span', { class: 'sr-only' }, t('common.community'))),
    select);
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function notifications() {
  const d = state.data;
  const p = priorities();
  const today = todayStr();
  const fresh = scoped(d.reports).filter((r) => r.status === 'new').length;
  const maintToday = scoped(d.maintenance).filter((m) => m.date === today && ['scheduled', 'in_progress'].includes(m.status)).length;
  const drafts = scoped(d.maintenance).filter((m) => m.status === 'draft').length;
  const prefs = state.user.prefs.notifications;
  return [
    prefs.reports && fresh ? { text: t('notif.reports', { n: fresh }), href: '#/reports?status=new', ic: 'message' } : null,
    prefs.approvals && p.ann ? { text: t('notif.approvals', { n: p.ann }), href: '#/announcements?status=pending', ic: 'megaphone' } : null,
    p.rec ? { text: t('notif.recurring', { n: p.rec }), href: '#/reports#recurring', ic: 'repeat' } : null,
    maintToday ? { text: t('notif.maint_today', { n: maintToday }), href: '#/maintenance', ic: 'calendar' } : null,
    drafts && can('maintenance.publish') ? { text: t('notif.drafts', { n: drafts }), href: '#/maintenance?status=draft', ic: 'edit' } : null,
  ].filter(Boolean);
}

function notificationBell() {
  const items = notifications();
  const menu = h('div', { id: 'notif-menu', class: 'notif-menu', hidden: true },
    h('h2', { class: 'notif-title' }, t('notif.title')),
    items.length
      ? h('ul', {}, items.map((i) => h('li', {}, h('a', { href: i.href, onclick: () => closeMenu() }, icon(i.ic), h('span', {}, i.text)))))
      : h('p', { class: 'muted' }, t('notif.none')));
  const button = h('button', {
    type: 'button', class: 'icon-btn notif-btn', 'aria-expanded': 'false', 'aria-controls': 'notif-menu',
    'aria-label': t('notif.open', { n: items.length }), dataset: { focusKey: 'notif' },
  }, icon('bell'), items.length ? h('span', { class: 'notif-dot', 'aria-hidden': 'true' }, String(items.length)) : null);
  function closeMenu(refocus) {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', outside, true);
    if (refocus) button.focus();
  }
  function outside(e) {
    if (!menu.contains(e.target) && !button.contains(e.target)) closeMenu();
  }
  button.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('click', outside, true);
      menu.querySelector('a')?.focus();
    } else closeMenu();
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeMenu(true); }
  });
  return h('div', { class: 'notif' }, button, menu);
}

function topbar() {
  return h('header', { class: 'topbar' },
    h('button', {
      type: 'button', class: 'icon-btn menu-btn', 'aria-label': t('common.menu'), 'aria-expanded': String(state.navOpen),
      'aria-controls': 'sidebar', onclick: openNav,
    }, icon('menu')),
    communityFilter(),
    h('div', { class: 'topbar-spacer' }),
    languagePicker(),
    notificationBell(),
    h('button', {
      type: 'button', class: 'btn btn-ghost help-btn', 'aria-expanded': String(state.helpOpen), 'aria-controls': 'help-panel',
      onclick: toggleHelp, dataset: { focusKey: 'help' },
    }, icon('help'), h('span', { class: 'hide-sm' }, t('common.help'))),
    h('div', { class: 'user-chip' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(state.user.name)),
      h('span', { class: 'user-meta hide-md' },
        h('span', { class: 'user-name' }, state.user.name),
        h('span', { class: 'user-role' }, t(`role.${state.user.role}`)))),
    h('button', { type: 'button', class: 'btn btn-ghost', onclick: signOut }, icon('logout'), h('span', { class: 'hide-sm' }, t('common.sign_out'))));
}

function helpPanel() {
  const glossary = [['g_recurring', 'g_recurring_text'], ['g_map', 'g_map_text'], ['g_finance', 'g_finance_text'], ['g_approval', 'g_approval_text']];
  return h('aside', { id: 'help-panel', class: 'help-panel', hidden: !state.helpOpen, 'aria-labelledby': 'help-title' },
    h('div', { class: 'help-head' },
      h('h2', { id: 'help-title', tabindex: '-1' }, icon('help'), t('help.title')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('help.close'), onclick: toggleHelp }, icon('x'))),
    h('section', { class: 'help-section' }, h('h3', {}, t('help.this_screen')), h('p', {}, t(`help.${state.route.name}`))),
    h('section', { class: 'help-section' }, h('h3', {}, t('help.glossary')),
      h('dl', { class: 'glossary' }, glossary.map(([k, v]) => [h('dt', {}, t(`help.${k}`)), h('dd', {}, t(`help.${v}`))]))),
    h('p', { class: 'hint' }, t('help.keyboard')),
    h('p', { class: 'help-stuck' }, icon('users'), t('help.stuck')));
}

function toggleHelp() {
  state.helpOpen = !state.helpOpen;
  document.getElementById('help-panel')?.replaceWith(helpPanel());
  document.querySelector('.shell')?.classList.toggle('help-open', state.helpOpen);
  const btn = document.querySelector('.help-btn');
  btn?.setAttribute('aria-expanded', String(state.helpOpen));
  if (state.helpOpen) document.getElementById('help-title')?.focus();
  else btn?.focus();
}

export function renderShell() {
  applyDocument();
  const shell = h('div', { class: `shell${state.helpOpen ? ' help-open' : ''}` },
    sidebar(),
    h('div', { class: 'nav-scrim', onclick: closeNav }),
    h('div', { class: 'shell-main' },
      topbar(),
      h('main', { id: 'main', class: 'main', tabindex: '-1' })),
    helpPanel());
  root().replaceChildren(
    h('a', {
      class: 'skip-link', href: '#main',
      onclick: (e) => { e.preventDefault(); document.getElementById('main').focus(); },
    }, t('common.skip')),
    shell,
    ...renderAssistant());
  renderView();
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (state.navOpen) closeNav();
  else if (state.assistantOpen) closeAssistant();
  else if (state.helpOpen) toggleHelp();
});

// ---------- Boot ----------

async function boot() {
  const saved = storageGet('af_lang');
  const browser = (navigator.language || 'en').slice(0, 2);
  state.lang = LANGS[saved] ? saved : LANGS[browser] ? browser : 'en';
  state.communityFilter = storageGet('af_community') || 'all';
  applyDocument();
  try {
    await api('/auth/me');
    await startSession();
  } catch {
    try { state.demo = await api('/demo-accounts'); } catch { state.demo = null; }
    renderLogin();
  }
}

boot();
