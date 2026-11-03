// Ask Fareej Management — local server.
// Zero dependencies: Node's http, crypto and fs only.
// Authentication, sessions, role permissions and community scoping are all enforced here,
// not in the browser.

import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createSeed, hashPassword, newId, DEMO_ACCOUNTS, DEFAULT_PREFS, RESIDENT_ACCOUNTS, ensureResidents,
} from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const DEMO_MODE = process.env.DEMO_MODE !== 'false';
const SECURE_COOKIES = process.env.SECURE_COOKIES === 'true';
const DATA_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const SESSION_COOKIE = 'af_session';
const SESSION_SHORT_MS = 12 * 60 * 60 * 1000;
const SESSION_LONG_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_BODY = 100 * 1024;

// ---------- Data store ----------

let db;
let saveChain = Promise.resolve();

async function loadDb() {
  if (!existsSync(DATA_FILE)) {
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    db = createSeed();
    await saveDb();
    console.log('Created demo data in data/db.json');
  } else {
    db = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  }
  if (ensureResidents(db)) await saveDb();
}

function saveDb() {
  saveChain = saveChain.then(async () => {
    const tmp = `${DATA_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2));
    await rename(tmp, DATA_FILE);
  });
  return saveChain;
}

function audit(user, action, entity, entityId) {
  db.audit.push({ id: newId('log'), at: new Date().toISOString(), userId: user.id, action, entity, entityId });
  if (db.audit.length > 1000) db.audit.splice(0, db.audit.length - 1000);
}

// ---------- Roles & permissions ----------

const ROLE_PERMS = {
  admin: ['*'],
  manager: [
    'communities.write', 'facilities.write', 'maintenance.write', 'maintenance.publish', 'reports.write',
    'announcements.write', 'announcements.approve', 'announcements.publish',
    'construction.write', 'construction.publish', 'finances.write', 'finances.share',
  ],
  coordinator: ['maintenance.write', 'reports.write', 'announcements.write', 'construction.write'],
  viewer: [],
  resident: [],
};
const STAFF_ROLES = ['admin', 'manager', 'coordinator', 'viewer'];
const ROLES = Object.keys(ROLE_PERMS);

const can = (user, perm) => ROLE_PERMS[user.role]?.includes('*') || ROLE_PERMS[user.role]?.includes(perm);
const permissionsFor = (user) => (ROLE_PERMS[user.role].includes('*')
  ? [...new Set(Object.values(ROLE_PERMS).flat().filter((p) => p !== '*')), 'users.manage', 'finances.approve', 'communities.delete']
  : ROLE_PERMS[user.role]);

const seesAll = (user) => user.communityIds.includes('all');
const canSeeCommunity = (user, communityId) => seesAll(user) || user.communityIds.includes(communityId);

// ---------- Validation ----------

const EMIRATES = ['abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah'];
const MAINT_CATEGORIES = ['ac', 'plumbing', 'electrical', 'lifts', 'pool', 'landscaping', 'cleaning', 'security', 'pest', 'other'];
const FACILITY_TYPES = ['tower', 'villas', 'pool', 'gym', 'park', 'playground', 'parking', 'lift', 'majlis', 'retail', 'gate'];
const FINANCE_CATEGORIES = ['maintenance_fund', 'security', 'cleaning', 'utilities', 'landscaping', 'reserve', 'events'];

// Field spec: type plus "!" for required.
const SCHEMAS = {
  communities: {
    perm: 'communities.write', deletePerm: 'communities.delete', scoped: false,
    fields: { name: 'text!', emirate: `enum!:${EMIRATES.join('|')}`, location: 'text!', units: 'int' },
  },
  facilities: {
    perm: 'facilities.write',
    fields: {
      communityId: 'community!', name: 'text!', type: `enum!:${FACILITY_TYPES.join('|')}`,
      status: 'enum!:open|maintenance|closed', residentNote: 'text', x: 'pct', y: 'pct',
    },
  },
  maintenance: {
    perm: 'maintenance.write',
    fields: {
      communityId: 'community!', facilityId: 'facility!', title: 'text!', category: `enum!:${MAINT_CATEGORIES.join('|')}`,
      description: 'text!', date: 'date!', startTime: 'time!', endTime: 'time!',
      status: 'enum:draft|scheduled|in_progress|completed|cancelled', reportIds: 'ids',
    },
  },
  reports: {
    perm: 'reports.write', noDelete: true,
    fields: {
      communityId: 'community!', facilityId: 'facilityOpt', category: `enum!:${MAINT_CATEGORIES.join('|')}`,
      title: 'text!', description: 'text', location: 'text', unit: 'text!', channel: 'enum:app|phone|walk_in|email',
      status: 'enum:new|in_review|in_progress|resolved', managerNote: 'text', residentReply: 'text', assignedTo: 'user',
    },
  },
  announcements: {
    perm: 'announcements.write',
    fields: {
      communityId: 'community!', category: 'enum!:general|maintenance|safety|event|finance',
      title: 'text!', body: 'text!', safetyReviewed: 'bool',
    },
  },
  construction: {
    perm: 'construction.write',
    fields: {
      communityId: 'community!', name: 'text!', contractor: 'text', progress: 'progress',
      status: 'enum!:planned|in_progress|on_hold|completed', startDate: 'date', endDate: 'date', residentUpdate: 'text',
    },
  },
  finances: {
    perm: 'finances.write',
    fields: {
      communityId: 'community!', year: 'year!', category: `enum!:${FINANCE_CATEGORIES.join('|')}`,
      budget: 'money!', spent: 'money',
    },
  },
};

// Friendlier, field-specific error codes for the maintenance workflow.
const FIELD_ERROR_CODES = {
  'maintenance.facilityId': 'maint_facility',
  'maintenance.description': 'maint_desc',
  'maintenance.date': 'maint_date',
};

class ApiError extends Error {
  constructor(status, code, field) {
    super(code);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

function validate(collection, input, user, { partial }) {
  const schema = SCHEMAS[collection];
  const out = {};
  for (const [field, spec] of Object.entries(schema.fields)) {
    const required = spec.includes('!');
    const [type, arg] = spec.replace('!', '').split(':');
    const present = Object.prototype.hasOwnProperty.call(input, field);
    if (partial && !present) continue;
    let v = input[field];
    if (typeof v === 'string') v = v.trim();
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (required) throw new ApiError(400, FIELD_ERROR_CODES[`${collection}.${field}`] || 'required_field', field);
      out[field] = type === 'bool' ? false : type === 'int' || type === 'money' ? 0 : type === 'ids' ? [] : '';
      continue;
    }
    switch (type) {
      case 'ids':
        if (!Array.isArray(v) || v.length > 50 || v.some((x) => typeof x !== 'string')) throw new ApiError(400, 'bad_request', field);
        out[field] = v;
        break;
      case 'user':
        if (!db.users.some((u) => u.id === v)) throw new ApiError(400, 'invalid_choice', field);
        out[field] = v;
        break;
      case 'facilityOpt':
        if (!db.facilities.some((x) => x.id === v && !x.deletedAt)) throw new ApiError(400, 'invalid_choice', field);
        out[field] = v;
        break;
      case 'text':
        if (typeof v !== 'string' || v.length > 4000) throw new ApiError(400, 'text_too_long', field);
        out[field] = v;
        break;
      case 'enum':
        if (!arg.split('|').includes(v)) throw new ApiError(400, 'invalid_choice', field);
        out[field] = v;
        break;
      case 'int':
      case 'money':
      case 'pct':
      case 'progress':
      case 'year': {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new ApiError(400, 'number', field);
        if ((type === 'pct' || type === 'progress') && n > 100) throw new ApiError(400, 'progress_range', field);
        if (type === 'year' && (n < 2000 || n > 2100)) throw new ApiError(400, 'year_range', field);
        out[field] = type === 'money' ? Math.round(n * 100) / 100 : Math.round(n);
        break;
      }
      case 'bool':
        out[field] = v === true || v === 'true';
        break;
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
          throw new ApiError(400, FIELD_ERROR_CODES[`${collection}.${field}`] || 'date_format', field);
        }
        out[field] = v;
        break;
      case 'time':
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new ApiError(400, 'time_format', field);
        out[field] = v;
        break;
      case 'community':
        if (!db.communities.some((c) => c.id === v && !c.deletedAt)) throw new ApiError(400, 'invalid_choice', field);
        if (!canSeeCommunity(user, v)) throw new ApiError(403, 'forbidden_community', field);
        out[field] = v;
        break;
      case 'facility':
        if (!db.facilities.some((x) => x.id === v && !x.deletedAt)) throw new ApiError(400, FIELD_ERROR_CODES[`${collection}.${field}`] || 'invalid_choice', field);
        out[field] = v;
        break;
      default:
        throw new Error(`Unknown field type ${type}`);
    }
  }
  return out;
}

// ---------- Sessions & login protection ----------

const sessions = new Map(); // token -> { userId, expires }
const loginAttempts = new Map(); // key -> { count, lockedUntil }

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((p) => p.trim().split('=')).filter(([k, v]) => k && v)
    .map(([k, v]) => [k, decodeURIComponent(v)]));
}

function sessionCookie(token, maxAgeSeconds) {
  const parts = [`${SESSION_COOKIE}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/'];
  if (maxAgeSeconds !== null) parts.push(`Max-Age=${maxAgeSeconds}`);
  if (SECURE_COOKIES) parts.push('Secure');
  return parts.join('; ');
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const s = sessions.get(token);
  if (!s || s.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  const user = db.users.find((u) => u.id === s.userId && u.active);
  return user ? { token, user } : null;
}

function endSessionsFor(userId) {
  for (const [token, s] of sessions) if (s.userId === userId) sessions.delete(token);
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
}

function tempPassword() {
  return `Fareej-${crypto.randomBytes(4).toString('hex')}-${crypto.randomInt(10, 99)}`;
}

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, communityIds: u.communityIds, unit: u.unit || '', active: u.active,
  prefs: u.prefs, createdAt: u.createdAt,
});

// ---------- HTTP helpers ----------

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new ApiError(413, 'too_large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      } catch {
        reject(new ApiError(400, 'bad_request'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2',
};

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'bad_request' });
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/app' || rel.startsWith('/app/') && !path.extname(rel)) rel = '/app/index.html';
  else if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, { error: 'not_found' });
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    send(res, 404, { error: 'not_found' });
  }
}

// ---------- API ----------

function visibleRecords(user, collection) {
  return db[collection].filter((r) => !r.deletedAt && (collection === 'communities'
    ? canSeeCommunity(user, r.id)
    : canSeeCommunity(user, r.communityId)));
}

function findRecord(user, collection, id) {
  const rec = db[collection].find((r) => r.id === id && !r.deletedAt);
  if (!rec) throw new ApiError(404, 'not_found');
  const communityId = collection === 'communities' ? rec.id : rec.communityId;
  if (!canSeeCommunity(user, communityId)) throw new ApiError(404, 'not_found');
  return rec;
}

function requirePerm(user, perm, code = 'forbidden') {
  if (!can(user, perm)) throw new ApiError(403, code);
}

function bootstrap(user) {
  const data = {
    user: publicUser(user),
    permissions: permissionsFor(user),
    demoMode: DEMO_MODE,
    dismissedGroups: db.dismissedGroups,
  };
  for (const c of ['communities', 'facilities', 'maintenance', 'reports', 'announcements', 'construction', 'finances']) {
    data[c] = visibleRecords(user, c);
  }
  data.people = db.users.map((u) => ({ id: u.id, name: u.name, role: u.role, active: u.active }));
  return data;
}

async function handleAuth(req, res, parts, body) {
  const action = parts[1];

  if (action === 'login' && req.method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email) throw new ApiError(400, 'email_required', 'email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'email_format', 'email');
    if (!password) throw new ApiError(400, 'password_required', 'password');

    const key = `${email}|${req.socket.remoteAddress || ''}`;
    const attempt = loginAttempts.get(key);
    if (attempt?.lockedUntil > Date.now()) throw new ApiError(429, 'auth_locked');

    const user = db.users.find((u) => u.email === email && u.active);
    // Hash even when the user doesn't exist so response timing doesn't reveal valid emails.
    const ok = user ? verifyPassword(password, user) : (hashPassword(password), false);
    if (!ok) {
      const count = (attempt?.lockedUntil && attempt.lockedUntil <= Date.now() ? 0 : attempt?.count || 0) + 1;
      loginAttempts.set(key, { count, lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
      throw new ApiError(401, count >= MAX_ATTEMPTS ? 'auth_locked' : 'auth_invalid');
    }
    loginAttempts.delete(key);
    // Residents and staff each have their own sign-in page.
    const residentPortal = body.portal === 'resident';
    if (residentPortal && user.role !== 'resident') throw new ApiError(403, 'wrong_portal_staff');
    if (!residentPortal && user.role === 'resident') throw new ApiError(403, 'wrong_portal_resident');

    const remember = body.remember === true;
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, { userId: user.id, expires: Date.now() + (remember ? SESSION_LONG_MS : SESSION_SHORT_MS) });
    audit(user, 'login', 'session', null);
    await saveDb();
    return send(res, 200, { user: publicUser(user) },
      { 'Set-Cookie': sessionCookie(token, remember ? SESSION_LONG_MS / 1000 : null) });
  }

  if (action === 'logout' && req.method === 'POST') {
    const s = getSession(req);
    if (s) sessions.delete(s.token);
    return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }

  if (action === 'me' && req.method === 'GET') {
    const s = getSession(req);
    if (!s) throw new ApiError(401, 'not_signed_in');
    return send(res, 200, { user: publicUser(s.user) });
  }

  throw new ApiError(404, 'not_found');
}

async function handleUsers(req, res, parts, body, user) {
  requirePerm(user, 'users.manage', 'forbidden_permissions');
  const [, id, action] = parts;

  const cleanCommunities = (list) => {
    if (!Array.isArray(list) || !list.length) throw new ApiError(400, 'communities_required', 'communityIds');
    if (list.includes('all')) return ['all'];
    const valid = list.filter((c) => db.communities.some((x) => x.id === c && !x.deletedAt));
    if (!valid.length) throw new ApiError(400, 'communities_required', 'communityIds');
    return valid;
  };

  // A resident belongs to exactly one community and must have a unit number.
  function residentUnit(role, unit, communityIds) {
    if (role !== 'resident') return '';
    if (communityIds.length !== 1 || communityIds[0] === 'all') throw new ApiError(400, 'resident_one_community', 'communityIds');
    const u = String(unit || '').trim();
    if (!u) throw new ApiError(400, 'required_field', 'unit');
    return u.slice(0, 40);
  }

  if (!id && req.method === 'GET') {
    return send(res, 200, { users: db.users.map(publicUser) });
  }

  if (!id && req.method === 'POST') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!name) throw new ApiError(400, 'required_field', 'name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'email_format', 'email');
    if (db.users.some((u) => u.email === email)) throw new ApiError(409, 'email_taken', 'email');
    if (!ROLES.includes(body.role)) throw new ApiError(400, 'invalid_choice', 'role');
    const communityIds = cleanCommunities(body.communityIds);
    const unit = residentUnit(body.role, body.unit, communityIds);
    const password = tempPassword();
    const { salt, hash } = hashPassword(password);
    const newUser = {
      id: newId('u'), name, email, role: body.role, communityIds, unit, active: true,
      salt, passwordHash: hash, prefs: { ...DEFAULT_PREFS, notifications: { ...DEFAULT_PREFS.notifications } },
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    audit(user, 'create', 'users', newUser.id);
    await saveDb();
    return send(res, 201, { user: publicUser(newUser), tempPassword: password });
  }

  const target = db.users.find((u) => u.id === id);
  if (!target) throw new ApiError(404, 'not_found');

  if (!action && req.method === 'PUT') {
    if (target.id === user.id && ((body.role && body.role !== target.role) || body.active === false)) {
      throw new ApiError(400, 'self_change');
    }
    if (body.role !== undefined) {
      if (!ROLES.includes(body.role)) throw new ApiError(400, 'invalid_choice', 'role');
      target.role = body.role;
    }
    if (body.communityIds !== undefined) target.communityIds = cleanCommunities(body.communityIds);
    if (body.unit !== undefined || body.role !== undefined || body.communityIds !== undefined) {
      target.unit = residentUnit(target.role, body.unit ?? target.unit, target.communityIds);
    }
    if (body.active !== undefined) {
      target.active = body.active === true;
      if (!target.active) endSessionsFor(target.id);
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw new ApiError(400, 'required_field', 'name');
      target.name = name;
    }
    audit(user, 'update', 'users', target.id);
    await saveDb();
    return send(res, 200, { user: publicUser(target) });
  }

  if (action === 'reset-password' && req.method === 'POST') {
    const password = tempPassword();
    const { salt, hash } = hashPassword(password);
    Object.assign(target, { salt, passwordHash: hash });
    endSessionsFor(target.id);
    audit(user, 'reset_password', 'users', target.id);
    await saveDb();
    return send(res, 200, { tempPassword: password });
  }

  throw new ApiError(404, 'not_found');
}

async function handlePrefs(req, res, body, user) {
  const p = user.prefs || { ...DEFAULT_PREFS };
  const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
  user.prefs = {
    lang: pick(body.lang, ['en', 'ar', 'hi'], p.lang),
    textSize: pick(body.textSize, ['standard', 'large', 'larger'], p.textSize),
    theme: pick(body.theme, ['light', 'dark'], p.theme),
    dashboardLayout: pick(body.dashboardLayout, ['simple', 'detailed'], p.dashboardLayout),
    notifications: {
      reports: typeof body.notifications?.reports === 'boolean' ? body.notifications.reports : p.notifications.reports,
      approvals: typeof body.notifications?.approvals === 'boolean' ? body.notifications.approvals : p.notifications.approvals,
      digest: typeof body.notifications?.digest === 'boolean' ? body.notifications.digest : p.notifications.digest,
    },
  };
  await saveDb();
  return send(res, 200, { prefs: user.prefs });
}

// Workflow actions that change what residents can see. Each checks its own permission.
async function handleWorkflow(res, collection, rec, action, body, user) {
  const stamp = () => { rec.updatedAt = new Date().toISOString(); };

  if (collection === 'maintenance' && action === 'publish') {
    requirePerm(user, 'maintenance.publish', 'forbidden_publish');
    if (rec.status !== 'draft') throw new ApiError(400, 'invalid_state');
    validate('maintenance', rec, user, { partial: false });
    if (rec.endTime <= rec.startTime) throw new ApiError(400, 'time_order', 'endTime');
    Object.assign(rec, { status: 'scheduled', published: true, publishedBy: user.id, publishedAt: new Date().toISOString() });
  } else if (collection === 'announcements' && action === 'submit') {
    requirePerm(user, 'announcements.write');
    if (rec.status !== 'draft') throw new ApiError(400, 'invalid_state');
    if (rec.category === 'safety' && !rec.safetyReviewed) throw new ApiError(400, 'safety_review', 'safetyReviewed');
    rec.status = 'pending';
  } else if (collection === 'announcements' && action === 'approve') {
    requirePerm(user, 'announcements.approve', 'forbidden_approve');
    if (rec.status !== 'pending') throw new ApiError(400, 'invalid_state');
    if (rec.category === 'safety' && !rec.safetyReviewed) throw new ApiError(400, 'safety_review', 'safetyReviewed');
    Object.assign(rec, { status: 'approved', approvedBy: user.id });
  } else if (collection === 'announcements' && action === 'return') {
    requirePerm(user, 'announcements.approve', 'forbidden_approve');
    if (!['pending', 'approved'].includes(rec.status)) throw new ApiError(400, 'invalid_state');
    Object.assign(rec, { status: 'draft', approvedBy: null });
  } else if (collection === 'announcements' && action === 'publish') {
    requirePerm(user, 'announcements.publish', 'forbidden_publish');
    if (rec.status !== 'approved') throw new ApiError(400, 'approval_needed');
    Object.assign(rec, { status: 'published', publishedBy: user.id, publishedAt: new Date().toISOString() });
  } else if (collection === 'announcements' && action === 'archive') {
    requirePerm(user, 'announcements.publish', 'forbidden_publish');
    if (rec.status !== 'published') throw new ApiError(400, 'invalid_state');
    rec.status = 'archived';
  } else if (collection === 'finances' && action === 'approve') {
    requirePerm(user, 'finances.approve', 'forbidden_finance_approve');
    if (rec.status === 'approved') throw new ApiError(400, 'invalid_state');
    Object.assign(rec, { status: 'approved', approvedBy: user.id });
  } else if (collection === 'finances' && action === 'share') {
    requirePerm(user, 'finances.share', 'forbidden_publish');
    const share = body.shared === true;
    if (share && rec.status !== 'approved') throw new ApiError(400, 'finance_must_approve');
    rec.sharedWithResidents = share;
  } else if (action === 'restore') {
    // handled by caller
  } else {
    throw new ApiError(404, 'not_found');
  }
  stamp();
  audit(user, action, collection, rec.id);
  await saveDb();
  return send(res, 200, { record: rec });
}

async function handleCollection(req, res, parts, body, user) {
  const [collection, id, action] = parts;
  const schema = SCHEMAS[collection];
  if (!schema) throw new ApiError(404, 'not_found');

  if (!id && req.method === 'GET') return send(res, 200, { records: visibleRecords(user, collection) });

  if (!id && req.method === 'POST') {
    if (schema.noCreate) throw new ApiError(405, 'bad_request');
    requirePerm(user, schema.perm);
    if (collection === 'communities' && !seesAll(user)) throw new ApiError(403, 'forbidden');
    const data = validate(collection, body, user, { partial: false });
    const now = new Date().toISOString();
    const rec = { id: newId(collection.slice(0, 3)), ...data, createdBy: user.id, createdAt: now, updatedAt: now };

    if (collection === 'maintenance') {
      if (data.endTime <= data.startTime) throw new ApiError(400, 'time_order', 'endTime');
      const fac = db.facilities.find((x) => x.id === data.facilityId);
      if (fac.communityId !== data.communityId) throw new ApiError(400, 'maint_facility', 'facilityId');
      Object.assign(rec, { status: 'draft', published: false });
    }
    if (collection === 'announcements') {
      if (data.category === 'safety' && body.safetyReviewed !== true) rec.safetyReviewed = false;
      rec.status = 'draft';
    }
    if (collection === 'construction' && data.residentUpdate && !can(user, 'construction.publish')) {
      throw new ApiError(403, 'forbidden_publish', 'residentUpdate');
    }
    if (collection === 'finances') Object.assign(rec, { status: 'draft', sharedWithResidents: false, approvedBy: null });
    if (collection === 'reports') {
      const fac = data.facilityId ? db.facilities.find((x) => x.id === data.facilityId) : null;
      if (fac && fac.communityId !== data.communityId) throw new ApiError(400, 'invalid_choice', 'facilityId');
      if (!fac && !data.location) throw new ApiError(400, 'required_field', 'location');
      Object.assign(rec, {
        status: 'new', channel: data.channel || 'phone', location: data.location || fac.name,
        history: [{ at: now, by: user.id, action: 'created' }],
      });
    }

    db[collection].push(rec);
    audit(user, 'create', collection, rec.id);
    await saveDb();
    return send(res, 201, { record: rec });
  }

  // Restore must find soft-deleted records too.
  if (action === 'restore' && req.method === 'POST') {
    requirePerm(user, schema.deletePerm || schema.perm);
    const rec = db[collection].find((r) => r.id === id && r.deletedAt);
    if (!rec) throw new ApiError(404, 'not_found');
    if (!canSeeCommunity(user, collection === 'communities' ? rec.id : rec.communityId)) throw new ApiError(404, 'not_found');
    delete rec.deletedAt;
    delete rec.deletedBy;
    audit(user, 'restore', collection, rec.id);
    await saveDb();
    return send(res, 200, { record: rec });
  }

  const rec = findRecord(user, collection, id);

  if (action && req.method === 'POST') return handleWorkflow(res, collection, rec, action, body, user);

  if (!action && req.method === 'PUT') {
    requirePerm(user, schema.perm, 'forbidden_edit');
    const data = validate(collection, body, user, { partial: true });

    if (collection === 'maintenance') {
      if (rec.published && !can(user, 'maintenance.publish')) throw new ApiError(403, 'forbidden_edit_published');
      if (data.status === 'scheduled' && rec.status === 'draft') throw new ApiError(400, 'use_publish');
      if (data.status === 'draft' && rec.published) throw new ApiError(400, 'invalid_state');
      const merged = { ...rec, ...data };
      if (merged.endTime <= merged.startTime) throw new ApiError(400, 'time_order', 'endTime');
      const fac = db.facilities.find((x) => x.id === merged.facilityId);
      if (fac?.communityId !== merged.communityId) throw new ApiError(400, 'maint_facility', 'facilityId');
    }
    if (collection === 'announcements') {
      if (['published', 'archived'].includes(rec.status)) throw new ApiError(400, 'ann_locked');
      // Editing sends approved or pending content back to draft so it is reviewed again.
      if (rec.status !== 'draft') Object.assign(data, { status: 'draft', approvedBy: null });
    }
    if (collection === 'construction' && data.residentUpdate !== undefined
      && data.residentUpdate !== rec.residentUpdate && !can(user, 'construction.publish')) {
      throw new ApiError(403, 'forbidden_publish', 'residentUpdate');
    }
    if (collection === 'facilities' && data.communityId && data.communityId !== rec.communityId) {
      throw new ApiError(400, 'invalid_choice', 'communityId');
    }
    if (collection === 'finances' && rec.status === 'approved'
      && ['budget', 'spent', 'category', 'year'].some((k) => data[k] !== undefined && data[k] !== rec[k])) {
      Object.assign(data, { status: 'draft', approvedBy: null, sharedWithResidents: false });
    }

    if (collection === 'reports') {
      if (data.communityId && data.communityId !== rec.communityId) throw new ApiError(400, 'invalid_choice', 'communityId');
      const at = new Date().toISOString();
      rec.history ||= [];
      if (data.status && data.status !== rec.status) rec.history.push({ at, by: user.id, action: 'status', value: data.status });
      if (data.assignedTo !== undefined && data.assignedTo !== (rec.assignedTo || '')) rec.history.push({ at, by: user.id, action: 'assigned', value: data.assignedTo });
      if (data.residentReply !== undefined && data.residentReply !== (rec.residentReply || '')) rec.history.push({ at, by: user.id, action: 'reply' });
      if (data.managerNote !== undefined && data.managerNote !== (rec.managerNote || '')) rec.history.push({ at, by: user.id, action: 'note' });
    }

    Object.assign(rec, data, { updatedAt: new Date().toISOString() });
    audit(user, 'update', collection, rec.id);
    await saveDb();
    return send(res, 200, { record: rec });
  }

  if (!action && req.method === 'DELETE') {
    if (schema.noDelete) throw new ApiError(405, 'bad_request');
    requirePerm(user, schema.deletePerm || schema.perm, 'forbidden_delete');
    if (collection === 'announcements' && rec.status === 'published') throw new ApiError(400, 'ann_locked');
    Object.assign(rec, { deletedAt: new Date().toISOString(), deletedBy: user.id });
    audit(user, 'delete', collection, rec.id);
    await saveDb();
    return send(res, 200, { ok: true });
  }

  throw new ApiError(404, 'not_found');
}

// ---------- Resident app API ----------
// Residents only ever see published, resident-facing information for their own community,
// and only their own reports. Internal notes and staff assignments are never sent.

function residentReport(r) {
  return {
    id: r.id, title: r.title, description: r.description, category: r.category, facilityId: r.facilityId,
    location: r.location, unit: r.unit, status: r.status, residentReply: r.residentReply || '', createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    history: (r.history || [{ at: r.createdAt, action: 'created' }])
      .filter((e) => ['created', 'status', 'reply'].includes(e.action))
      .map((e) => ({ at: e.at, action: e.action, value: e.action === 'status' ? e.value : undefined })),
  };
}

async function handleResident(req, res, parts, body, user) {
  const communityId = user.communityIds[0];
  const community = db.communities.find((c) => c.id === communityId && !c.deletedAt);
  if (!community) throw new ApiError(404, 'not_found');
  const live = (list) => list.filter((x) => x.communityId === communityId && !x.deletedAt);

  if (parts[1] === 'home' && req.method === 'GET') {
    const recent = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    return send(res, 200, {
      user: { id: user.id, name: user.name, email: user.email, unit: user.unit, prefs: user.prefs },
      community: { id: community.id, name: community.name, emirate: community.emirate, location: community.location },
      announcements: live(db.announcements).filter((a) => a.status === 'published')
        .map(({ id, title, body: text, category, publishedAt }) => ({ id, title, body: text, category, publishedAt }))
        .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || '')),
      maintenance: live(db.maintenance).filter((m) => m.published && (m.status !== 'completed' || m.date >= recent))
        .map(({ id, title, description, category, facilityId, date, startTime, endTime, status }) => ({ id, title, description, category, facilityId, date, startTime, endTime, status }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      facilities: live(db.facilities).map(({ id, name, type, status, residentNote, x, y }) => ({ id, name, type, status, residentNote, x, y })),
      construction: live(db.construction).filter((p) => p.residentUpdate)
        .map(({ id, name, status, progress, startDate, endDate, residentUpdate }) => ({ id, name, status, progress, startDate, endDate, residentUpdate })),
      finances: live(db.finances).filter((f) => f.status === 'approved' && f.sharedWithResidents)
        .map(({ id, year, category, budget, spent }) => ({ id, year, category, budget, spent })),
      reports: db.reports.filter((r) => r.residentId === user.id).map(residentReport)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }

  if (parts[1] === 'reports' && req.method === 'POST') {
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || '');
    if (!SCHEMAS.reports.fields.category.includes(category) || !category) throw new ApiError(400, 'required_field', 'category');
    if (!title) throw new ApiError(400, 'required_field', 'title');
    if (!description) throw new ApiError(400, 'required_field', 'description');
    if (title.length > 200 || description.length > 4000) throw new ApiError(400, 'text_too_long', 'description');
    let facilityId = '';
    let location = String(body.location || '').trim().slice(0, 200);
    if (body.facilityId) {
      const fac = db.facilities.find((f) => f.id === body.facilityId && f.communityId === communityId && !f.deletedAt);
      if (!fac) throw new ApiError(400, 'invalid_choice', 'facilityId');
      facilityId = fac.id;
      location ||= fac.name;
    }
    if (!location) location = user.unit;
    const now = new Date().toISOString();
    const rec = {
      id: newId('rep'), communityId, facilityId, category, title, description, location, unit: user.unit,
      channel: 'app', status: 'new', managerNote: '', residentReply: '', assignedTo: '', residentId: user.id,
      history: [{ at: now, by: user.id, action: 'created' }], createdBy: user.id, createdAt: now, updatedAt: now,
    };
    db.reports.push(rec);
    audit(user, 'create', 'reports', rec.id);
    await saveDb();
    return send(res, 201, { report: residentReport(rec) });
  }

  throw new ApiError(404, 'not_found');
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1);

  // Reject cross-site form posts: every state-changing request must come from our own scripts.
  if (req.method !== 'GET' && req.headers['x-fareej-request'] !== '1') throw new ApiError(403, 'forbidden');
  const body = req.method === 'GET' ? {} : await readBody(req);

  if (parts[0] === 'demo-accounts' && req.method === 'GET') {
    const list = url.searchParams.get('portal') === 'resident'
      ? RESIDENT_ACCOUNTS.map(({ email, password, name, unit }) => ({ email, password, role: 'resident', name, unit }))
      : DEMO_ACCOUNTS.map(({ email, password, role }) => ({ email, password, role }));
    return send(res, 200, DEMO_MODE ? { demo: true, accounts: list } : { demo: false, accounts: [] });
  }
  if (parts[0] === 'auth') return handleAuth(req, res, parts, body);

  const session = getSession(req);
  if (!session) throw new ApiError(401, 'session_expired');
  const { user } = session;

  // Residents can only use their own app's endpoints; staff cannot use the resident ones.
  if (user.role === 'resident' && parts[0] !== 'resident' && parts[0] !== 'me') throw new ApiError(403, 'forbidden');
  if (parts[0] === 'resident') {
    if (user.role !== 'resident') throw new ApiError(403, 'forbidden');
    return handleResident(req, res, parts, body, user);
  }

  if (parts[0] === 'bootstrap' && req.method === 'GET') return send(res, 200, bootstrap(user));
  if (parts[0] === 'me' && parts[1] === 'prefs' && req.method === 'PUT') return handlePrefs(req, res, body, user);
  if (parts[0] === 'me' && parts[1] === 'password' && req.method === 'POST') {
    const current = String(body.currentPassword || '');
    const next = String(body.newPassword || '');
    if (!current) throw new ApiError(400, 'password_required', 'currentPassword');
    if (!verifyPassword(current, user)) throw new ApiError(400, 'password_wrong', 'currentPassword');
    if (next.length < 10 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) throw new ApiError(400, 'password_weak', 'newPassword');
    if (next !== String(body.confirmPassword || '')) throw new ApiError(400, 'password_mismatch', 'confirmPassword');
    const { salt, hash } = hashPassword(next);
    Object.assign(user, { salt, passwordHash: hash });
    // Sign out other devices but keep this session.
    for (const [token, s] of sessions) if (s.userId === user.id && token !== session.token) sessions.delete(token);
    audit(user, 'change_password', 'users', user.id);
    await saveDb();
    return send(res, 200, { ok: true });
  }
  if (parts[0] === 'users') return handleUsers(req, res, parts, body, user);

  if (parts[0] === 'recurring' && parts[1] === 'dismiss' && req.method === 'POST') {
    requirePerm(user, 'reports.write', 'forbidden_edit');
    const key = String(body.key || '');
    const [communityId] = key.split('|');
    if (!key || !canSeeCommunity(user, communityId)) throw new ApiError(400, 'bad_request');
    if (!db.dismissedGroups.some((g) => g.key === key)) {
      db.dismissedGroups.push({ key, by: user.id, at: new Date().toISOString() });
    }
    audit(user, 'dismiss_recurring', 'reports', key);
    await saveDb();
    return send(res, 200, { ok: true });
  }
  if (parts[0] === 'recurring' && parts[1] === 'restore' && req.method === 'POST') {
    requirePerm(user, 'reports.write', 'forbidden_edit');
    db.dismissedGroups = db.dismissedGroups.filter((g) => g.key !== body.key);
    await saveDb();
    return send(res, 200, { ok: true });
  }

  return handleCollection(req, res, parts, body, user);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await serveStatic(req, res, url);
  } catch (err) {
    if (err instanceof ApiError) {
      send(res, err.status, { error: err.code, field: err.field });
    } else {
      console.error(err);
      send(res, 500, { error: 'generic' });
    }
  }
});

await loadDb();
server.listen(PORT, HOST, () => {
  console.log(`Ask Fareej Management running at http://localhost:${PORT}`);
  if (DEMO_MODE) console.log('Demo mode: demonstration accounts are listed on the login page.');
});
