import crypto from 'node:crypto';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

// Demonstration accounts for this local installation only.
// They are NOT production credentials. Set DEMO_MODE=false to hide them on the login page.
export const DEMO_ACCOUNTS = [
  { email: 'admin@askfareej.demo', password: 'Fareej-Admin-2026', role: 'admin', name: 'Mariam Al Suwaidi' },
  { email: 'manager@askfareej.demo', password: 'Fareej-Manager-2026', role: 'manager', name: 'Omar Farouk' },
  { email: 'coordinator@askfareej.demo', password: 'Fareej-Coord-2026', role: 'coordinator', name: 'Priya Nair' },
  { email: 'viewer@askfareej.demo', password: 'Fareej-Viewer-2026', role: 'viewer', name: 'Daniel Reyes' },
];

// Demonstration residents for the resident app (local demo only).
export const RESIDENT_ACCOUNTS = [
  { id: 'u_res_aisha', email: 'aisha@resident.demo', password: 'Fareej-Resident-2026', name: 'Aisha Rahman', communityId: 'c_reem', unit: 'B-904', reportId: 'r_1' },
  { id: 'u_res_rajesh', email: 'rajesh@resident.demo', password: 'Fareej-Resident-2026', name: 'Rajesh Kumar', communityId: 'c_palm', unit: 'T2-0801', reportId: 'r_5' },
];

// Adds the demo residents to a database that was created before the resident app existed.
export function ensureResidents(db) {
  let changed = false;
  for (const r of RESIDENT_ACCOUNTS) {
    if (db.users.some((u) => u.id === r.id)) continue;
    const { salt, hash } = hashPassword(r.password);
    db.users.push({
      id: r.id, name: r.name, email: r.email, role: 'resident', communityIds: [r.communityId], unit: r.unit, active: true,
      salt, passwordHash: hash, prefs: { ...DEFAULT_PREFS, notifications: { ...DEFAULT_PREFS.notifications } },
      createdAt: new Date().toISOString(),
    });
    const report = db.reports.find((x) => x.id === r.reportId);
    if (report && !report.residentId) report.residentId = r.id;
    changed = true;
  }
  return changed;
}

export const DEFAULT_PREFS = {
  lang: 'en',
  textSize: 'standard',
  theme: 'light',
  dashboardLayout: 'simple',
  notifications: { reports: true, approvals: true, digest: false },
};

export const newId = (prefix) => `${prefix}_${crypto.randomBytes(6).toString('hex')}`;

function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(n, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

export function createSeed() {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();

  const users = DEMO_ACCOUNTS.map((a, i) => {
    const { salt, hash } = hashPassword(a.password);
    return {
      id: `u_${a.role}`,
      name: a.name,
      email: a.email,
      role: a.role,
      communityIds: a.role === 'manager' ? ['c_reem', 'c_palm'] : a.role === 'coordinator' ? ['c_reem'] : ['all'],
      active: true,
      salt,
      passwordHash: hash,
      prefs: { ...DEFAULT_PREFS, notifications: { ...DEFAULT_PREFS.notifications } },
      createdAt: now,
      order: i,
    };
  });

  const communities = [
    { id: 'c_reem', name: 'Al Reem Gardens', emirate: 'abu_dhabi', location: 'Al Reem Island', units: 420, createdAt: now },
    { id: 'c_palm', name: 'Palm Vista Residences', emirate: 'dubai', location: 'Jumeirah Village Circle', units: 310, createdAt: now },
    { id: 'c_noor', name: 'Al Noor Villas', emirate: 'sharjah', location: 'Al Tai', units: 96, createdAt: now },
  ];

  const f = (id, communityId, name, type, x, y, status = 'open', residentNote = '') =>
    ({ id, communityId, name, type, x, y, status, residentNote, createdAt: now });

  const facilities = [
    f('f_reem_ta', 'c_reem', 'Tower A', 'tower', 22, 32),
    f('f_reem_tb', 'c_reem', 'Tower B', 'tower', 42, 26, 'open', 'Corridor air conditioning on floors 9–12 is being checked.'),
    f('f_reem_pool', 'c_reem', 'Swimming pool', 'pool', 64, 46, 'maintenance', 'Closed tomorrow 8:00–12:00 for pump replacement.'),
    f('f_reem_gym', 'c_reem', 'Gym', 'gym', 30, 60),
    f('f_reem_play', 'c_reem', "Children's playground", 'playground', 78, 24),
    f('f_reem_park', 'c_reem', 'Basement parking', 'parking', 52, 78),
    f('f_reem_majlis', 'c_reem', 'Community majlis', 'majlis', 84, 64),

    f('f_palm_l1', 'c_palm', 'Tower 1 lift lobby', 'lift', 24, 30),
    f('f_palm_l2', 'c_palm', 'Tower 2 lift lobby', 'lift', 48, 26, 'maintenance', 'Lift 2 safety inspection this week. Please use Lift 1.'),
    f('f_palm_pool', 'c_palm', 'Rooftop pool', 'pool', 72, 34),
    f('f_palm_gym', 'c_palm', 'Gym', 'gym', 30, 64),
    f('f_palm_park', 'c_palm', 'Community park', 'park', 62, 68),
    f('f_palm_vpark', 'c_palm', 'Visitor parking', 'parking', 86, 78),

    f('f_noor_north', 'c_noor', 'North villa cluster', 'villas', 30, 24),
    f('f_noor_south', 'c_noor', 'South villa cluster', 'villas', 34, 72),
    f('f_noor_park', 'c_noor', 'Community park', 'park', 60, 48),
    f('f_noor_pool', 'c_noor', 'Clubhouse pool', 'pool', 80, 30),
    f('f_noor_retail', 'c_noor', 'Retail kiosk', 'retail', 82, 70),
    f('f_noor_gate', 'c_noor', 'Main gate', 'gate', 12, 50),
  ];

  const m = (id, communityId, facilityId, title, category, dayOffset, startTime, endTime, status, description, published = true) => ({
    id, communityId, facilityId, title, category, date: localDate(dayOffset), startTime, endTime, status, description,
    published: status === 'draft' ? false : published,
    createdBy: 'u_manager', createdAt: now, updatedAt: now,
  });

  const maintenance = [
    m('m_1', 'c_reem', 'f_reem_pool', 'Pool pump replacement', 'pool', 1, '08:00', '12:00', 'scheduled',
      'The pool pump will be replaced. The pool will be closed during the work.'),
    m('m_2', 'c_reem', 'f_reem_tb', 'Corridor AC inspection – Tower B', 'ac', 2, '10:00', '14:00', 'scheduled',
      'Technicians will inspect corridor air conditioning on floors 9 to 12.'),
    m('m_3', 'c_reem', 'f_reem_gym', 'Gym equipment servicing', 'other', 0, '07:00', '11:00', 'in_progress',
      'Routine servicing of treadmills and weight machines.'),
    m('m_4', 'c_palm', 'f_palm_l2', 'Lift 2 annual safety inspection', 'lifts', 3, '09:00', '13:00', 'scheduled',
      'Annual safety inspection. Lift 2 will be out of service during the inspection.'),
    m('m_5', 'c_palm', 'f_palm_park', 'Irrigation repair', 'landscaping', 5, '06:30', '09:00', 'draft',
      'Repair of damaged irrigation pipes near the park entrance.'),
    m('m_6', 'c_noor', 'f_noor_north', 'Pest control – north villas', 'pest', 6, '08:00', '12:00', 'scheduled',
      'Outdoor pest control treatment around the north villa cluster.'),
    m('m_7', 'c_reem', 'f_reem_park', 'Parking lighting upgrade', 'electrical', -4, '22:00', '23:59', 'completed',
      'Replacement of basement parking lights with LED fittings.'),
    m('m_8', 'c_palm', 'f_palm_pool', 'Rooftop pool tile repair', 'pool', 12, '08:00', '16:00', 'draft',
      'Repair of cracked tiles along the pool edge.'),
  ];

  const r = (id, communityId, facilityId, category, title, location, unit, status, ago, description) => ({
    id, communityId, facilityId, category, title, location, unit, status, description,
    managerNote: '', residentReply: '', assignedTo: '', channel: 'app',
    history: [{ at: daysAgo(ago), by: null, action: 'created' }],
    createdAt: daysAgo(ago), updatedAt: daysAgo(ago),
  });

  const reports = [
    r('r_1', 'c_reem', 'f_reem_tb', 'ac', 'AC not cooling in Tower B corridor', 'Tower B · Floor 9', 'B-904', 'new', 1,
      'The corridor outside our flat has been very hot for two days.'),
    r('r_2', 'c_reem', 'f_reem_tb', 'ac', 'Warm air from corridor AC vents', 'Tower B · Floor 12', 'B-1207', 'in_review', 3,
      'The AC vents in the corridor are blowing warm air.'),
    r('r_3', 'c_reem', 'f_reem_tb', 'ac', 'Corridor AC still not working', 'Tower B · Floor 9', 'B-910', 'new', 6,
      'Reported last week, still not fixed.'),
    r('r_4', 'c_palm', 'f_palm_l2', 'lifts', 'Lift 2 stopping between floors', 'Tower 2', 'T2-1503', 'in_progress', 2,
      'The lift stopped between floors 6 and 7 for about a minute.'),
    r('r_5', 'c_palm', 'f_palm_l2', 'lifts', 'Lift 2 doors closing too fast', 'Tower 2', 'T2-0801', 'new', 5,
      'The doors close very quickly. Elderly residents find it difficult.'),
    r('r_6', 'c_reem', 'f_reem_pool', 'pool', 'Pool water looks cloudy', 'Swimming pool', 'A-302', 'resolved', 12,
      'The water was cloudy on Saturday morning.'),
    r('r_7', 'c_noor', 'f_noor_park', 'landscaping', 'Broken sprinkler flooding the path', 'Community park', 'V-14', 'new', 1,
      'A sprinkler near the benches is broken and the path is flooded.'),
    r('r_8', 'c_noor', 'f_noor_north', 'pest', 'Ants near villa entrance', 'North villa cluster', 'V-03', 'in_review', 4,
      'Lots of ants near the front gate of several villas.'),
    r('r_9', 'c_reem', 'f_reem_park', 'security', 'Parking barrier not opening', 'Basement parking', 'A-1101', 'in_progress', 2,
      'The barrier did not open with my access card this morning.'),
    r('r_10', 'c_palm', 'f_palm_vpark', 'cleaning', 'Litter in visitor parking', 'Visitor parking', 'T1-0405', 'resolved', 9,
      'Rubbish has been left near the visitor parking spaces.'),
    r('r_11', 'c_reem', 'f_reem_play', 'other', 'Swing chain is loose', "Children's playground", 'A-0807', 'new', 0,
      'One of the swing chains looks loose. Please check before children use it.'),
    r('r_12', 'c_noor', 'f_noor_gate', 'security', 'Visitor gate intercom not working', 'Main gate', 'V-22', 'new', 3,
      'Visitors cannot call our villa from the gate.'),
  ];

  const a = (id, communityId, category, title, body, status, extra = {}) => ({
    id, communityId, category, title, body, status, safetyReviewed: false,
    createdBy: 'u_coordinator', createdAt: now, updatedAt: now, ...extra,
  });

  const announcements = [
    a('a_1', 'c_reem', 'maintenance', 'Pool closed for pump replacement',
      'The swimming pool will be closed tomorrow from 8:00 to 12:00 while the pump is replaced. Thank you for your patience.',
      'published', { approvedBy: 'u_manager', publishedBy: 'u_manager', publishedAt: daysAgo(0, 8) }),
    a('a_2', 'c_reem', 'event', 'Family movie night at the majlis',
      'Join your neighbours for a family movie night at the community majlis this Friday at 7:30 pm. Snacks provided.',
      'pending'),
    a('a_3', 'c_palm', 'safety', 'Fire alarm testing in Tower 1',
      'Fire alarms in Tower 1 will be tested on Thursday between 10:00 and 11:00. You do not need to leave the building during the test.',
      'pending', { safetyReviewed: true }),
    a('a_4', 'c_noor', 'general', 'New waste collection schedule',
      'From next week, household waste will be collected every day at 7:00. Please place bags in the bins by 6:30.',
      'approved', { approvedBy: 'u_admin' }),
    a('a_5', 'c_palm', 'maintenance', 'Lift 2 safety inspection',
      'Lift 2 in Tower 2 will be out of service for its annual safety inspection. Please use Lift 1.',
      'draft'),
  ];

  const construction = [
    { id: 'p_1', communityId: 'c_reem', name: 'Tower C construction', contractor: 'Gulf Coast Builders (sample)', progress: 64,
      status: 'in_progress', startDate: localDate(-240), endDate: localDate(180),
      residentUpdate: 'Structural work is complete up to floor 18. Noisy work only takes place between 8:00 and 18:00.', createdAt: now },
    { id: 'p_2', communityId: 'c_palm', name: 'Main lobby renovation', contractor: 'Interiors Plus (sample)', progress: 30,
      status: 'on_hold', startDate: localDate(-60), endDate: localDate(90),
      residentUpdate: 'Work is paused while new materials are delivered. The lobby remains open.', createdAt: now },
    { id: 'p_3', communityId: 'c_noor', name: 'New shaded play area', contractor: 'Green Oasis Landscaping (sample)', progress: 85,
      status: 'in_progress', startDate: localDate(-45), endDate: localDate(14),
      residentUpdate: 'Shade sails are installed. Play equipment will be fitted next week.', createdAt: now },
    { id: 'p_4', communityId: 'c_noor', name: 'Perimeter wall repainting', contractor: '', progress: 0,
      status: 'planned', startDate: localDate(30), endDate: localDate(60), residentUpdate: '', createdAt: now },
  ];

  const fin = (id, communityId, category, budget, spent, status, sharedWithResidents) => ({
    id, communityId, year, category, budget, spent, status, sharedWithResidents,
    approvedBy: status === 'approved' ? 'u_admin' : null, createdAt: now,
  });

  const finances = [
    fin('b_1', 'c_reem', 'maintenance_fund', 1200000, 640000, 'approved', true),
    fin('b_2', 'c_reem', 'security', 850000, 410000, 'approved', true),
    fin('b_3', 'c_reem', 'cleaning', 420000, 230000, 'approved', false),
    fin('b_4', 'c_reem', 'utilities', 600000, 350000, 'draft', false),
    fin('b_5', 'c_reem', 'reserve', 300000, 0, 'approved', true),
    fin('b_6', 'c_palm', 'maintenance_fund', 900000, 520000, 'approved', true),
    fin('b_7', 'c_palm', 'security', 600000, 300000, 'approved', false),
    fin('b_8', 'c_palm', 'landscaping', 150000, 90000, 'draft', false),
    fin('b_9', 'c_noor', 'maintenance_fund', 380000, 120000, 'approved', true),
    fin('b_10', 'c_noor', 'landscaping', 220000, 140000, 'approved', false),
    fin('b_11', 'c_noor', 'events', 60000, 25000, 'draft', false),
  ];

  return {
    version: 1,
    users,
    communities,
    facilities,
    maintenance,
    reports,
    announcements,
    construction,
    finances,
    dismissedGroups: [],
    audit: [],
  };
}
