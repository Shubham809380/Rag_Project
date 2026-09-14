// ─────────────────────────────────────────────────────────────────────────────
// Sovereign workbench — local authentication controller.
// Production, air-gapped login. No cloud, no public signup.
// ─────────────────────────────────────────────────────────────────────────────

import config from '../config/index.js';
import crypto from 'crypto';
import sovereign from '../config/sovereign.js';
import { getSovereignDB } from '../storage/sovereignDB.js';
import { auditService, CATEGORY, SEVERITY } from '../security/audit.js';
import {
  generateSovereignToken,
  setSovereignCookie,
  clearSovereignCookie,
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
  normalizeRole,
  registerFailedLogin,
  resetLoginAttempts,
  isLoginLocked,
} from '../security/sovereignAuth.js';
import { ROLES } from '../security/rbac.js';
import logger from '../utils/logger.js';

const LOG = 'SovereignAuthCtrl';

function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function safeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    employeeId: u.employeeId ?? u.employee_id,
    name: u.fullName ?? u.full_name,
    email: u.email,
    department: u.department,
    role: u.role,
    status: u.status,
    mustChangePassword: !!u.mustChangePassword,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    lastLoginAt: u.last_login_at,
  };
}

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}

// Ensure the configured demo identity has a REAL row in the sovereign SQLite
// users table, so password changes for the demo account are persisted exactly
// like any other account (bcrypt hash stored on disk, verified on next login).
function ensureDemoUserRow(db) {
  const demo = sovereign.demo;
  if (!demo.enabled || !demo.userId) return null;
  const existing = db.getUser(demo.userId);
  if (existing) return existing;
  const created = db.createUser({
    id: demo.userId,
    employeeId: demo.userId,
    fullName: demo.name || 'Demo Inspector',
    email: (demo.email || `${demo.userId}@local`).toLowerCase(),
    department: 'Demo',
    role: normalizeRole(demo.role),
    passwordHash: '',
    mustChangePassword: true,
    createdBy: null,
  });
  logger.info(LOG, 'Demo identity persisted to sovereign DB', { userId: created.id, email: created.email });
  return created;
}

function auditLoginEvent(req, action, user, severity, details) {
  try {
    auditService().record({
      category: CATEGORY.SECURITY,
      action,
      severity,
      user: user ? { id: user.id, email: user.email, name: user.full_name || user.name } : {},
      details,
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (e) {
    logger.warn(LOG, 'Audit record failed', { error: e.message });
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Email and password are required' });
  }

  const lock = isLoginLocked(req, email);
  if (lock.locked) {
    return res.status(429).json({ success: false, code: 'LOCKED', message: 'Too many failed attempts. Please try again later.' });
  }

  const db = getSovereignDB();
  const user = db.getUserByEmail(email);
  if (!user) {
    registerFailedLogin(req, email);
    auditLoginEvent(req, 'login_failed', null, SEVERITY.WARNING, { reason: 'no_user' });
    return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
  }
  if (user.status !== 'active') {
    auditLoginEvent(req, 'login_denied', user, SEVERITY.WARNING, { reason: 'inactive' });
    return res.status(403).json({ success: false, code: 'ACCOUNT_INACTIVE', message: 'This account is inactive. Contact an administrator.' });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    registerFailedLogin(req, email);
    auditLoginEvent(req, 'login_failed', user, SEVERITY.WARNING, { reason: 'bad_password' });
    return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
  }

  resetLoginAttempts(req, email);
  db.updateUserLogin(user.id);
  if (sovereign.auth.sessionRecord) {
    db.recordSession(user.id, clientIp(req), req.headers['user-agent'] || '');
  }
  const token = generateSovereignToken(user);
  setSovereignCookie(res, token);
  auditLoginEvent(req, 'login_success', user, SEVERITY.INFO, {});
  const updated = db.getUser(user.id);
  logger.info(LOG, 'Login success', { userId: user.id });
  res.json({ success: true, user: safeUser(updated) });
}

export async function logout(req, res) {
  const identity = req.sovereignUser;
  const db = getSovereignDB();
  if (identity?.id) {
    try { db.endSession(identity.id); } catch {}
    auditLoginEvent(req, 'logout', identity, SEVERITY.INFO, {});
  }
  clearSovereignCookie(res);
  res.json({ success: true, message: 'Logged out' });
}

export async function me(req, res) {
  const identity = req.sovereignUser;
  if (!identity) {
    return res.status(401).json({ success: false, code: 'SOVEREIGN_AUTH_REQUIRED', message: 'Authentication required' });
  }
  const db = getSovereignDB();
  if (identity.sovereign !== undefined) {
    const user = db.getUser(identity.id);
    if (!user || user.status !== 'active') {
      clearSovereignCookie(res);
      return res.status(401).json({ success: false, code: 'SOVEREIGN_AUTH_REQUIRED', message: 'Authentication required' });
    }
    return res.json({ success: true, user: safeUser(user), mode: 'authenticated' });
  }
  // Demo identity — ensure it maps to a real DB row (persisted password changes).
  let dbUser = db.getUser(identity.id);
  if (!dbUser && sovereign.demo.enabled && identity.id === sovereign.demo.userId) {
    dbUser = ensureDemoUserRow(db);
  }
  if (dbUser) {
    return res.json({ success: true, user: safeUser(dbUser), mode: 'demo' });
  }
  return res.json({ success: true, user: safeUser({ ...identity, full_name: identity.name }), mode: 'demo' });
}

export async function changePassword(req, res) {
  const identity = req.sovereignUser;
  if (!identity) {
    return res.status(401).json({ success: false, code: 'SOVEREIGN_AUTH_REQUIRED', message: 'Authentication required' });
  }
  const db = getSovereignDB();
  let user = db.getUser(identity.id);
  if (!user && sovereign.demo.enabled && identity.id === sovereign.demo.userId) {
    user = ensureDemoUserRow(db);
  }
  if (!user) {
    return res.status(401).json({ success: false, code: 'SOVEREIGN_AUTH_REQUIRED', message: 'Authentication required' });
  }
  const { currentPassword, newPassword } = req.body || {};
  const firstTime = !!user.mustChangePassword;
  if (!firstTime) {
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      auditLoginEvent(req, 'password_change_failed', user, SEVERITY.WARNING, { reason: 'bad_current' });
      return res.status(400).json({ success: false, code: 'BAD_CURRENT', message: 'Current password is incorrect' });
    }
  }
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) {
    return res.status(400).json({ success: false, code: 'POLICY', message: policy.message });
  }
  if (!firstTime && currentPassword === newPassword) {
    return res.status(400).json({ success: false, code: 'SAME_PASSWORD', message: 'New password must differ from current password' });
  }
  // Persist the new hash to the sovereign SQLite database (real storage).
  const hash = await hashPassword(newPassword);
  db.updateUser(user.id, { password_hash: hash, must_change_password: 0 });
  auditLoginEvent(req, 'password_changed', user, SEVERITY.NOTICE, {});
  res.json({ success: true, message: firstTime ? 'Password set' : 'Password updated' });
}

// ── Admin: user management ──────────────────────────────────────────────────

export async function listUsers(req, res) {
  const db = getSovereignDB();
  const { role, status } = req.query || {};
  const users = db.listUsers({ role, status });
  res.json({ success: true, users: users.map(safeUser) });
}

export async function createEmployee(req, res) {
  const { fullName, email, employeeId, department = '', role = ROLES.ANALYST, temporaryPassword } = req.body || {};
  if (!fullName || !email || !employeeId) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'fullName, email and employeeId are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }
  const normRole = normalizeRole(role);
  const db = getSovereignDB();
  if (db.getUserByEmail(email)) {
    return res.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'A user with this email already exists' });
  }
  if (db.getUserByEmployeeId(employeeId)) {
    return res.status(409).json({ success: false, code: 'EMPLOYEE_EXISTS', message: 'A user with this employee ID already exists' });
  }

  // Require a strong temporary password OR generate a random one returned once.
  let password = temporaryPassword;
  let generated = false;
  if (password) {
    const ok = validatePasswordPolicy(password);
    if (!ok.ok) {
      return res.status(400).json({ success: false, code: 'POLICY', message: `Temporary password: ${ok.message}` });
    }
  } else {
    password = randomTemporaryPassword();
    generated = true;
  }

  const hash = await hashPassword(password);
  const created = getSovereignDB().createUser({
    employeeId,
    fullName: fullName.trim(),
    email: email.toLowerCase(),
    department,
    role: normRole,
    passwordHash: hash,
    mustChangePassword: true,
    createdBy: req.sovereignUser?.id || null,
  });
  auditLoginEvent(req, 'employee_created', created, SEVERITY.NOTICE,
    { createdBy: req.sovereignUser?.email, department, role: normRole, generatedPassword: generated });
  logger.info(LOG, 'Employee created', { employeeId, email, role: normRole, createdBy: req.sovereignUser?.email });
  const body = { success: true, user: safeUser(created) };
  if (generated) {
    body.temporaryPassword = password;
    body.mustChangeOnFirstLogin = true;
  }
  res.status(201).json(body);
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const { fullName, email, employeeId, department, role, status } = req.body || {};
  if (id === req.sovereignUser?.id && status === 'inactive') {
    return res.status(400).json({ success: false, code: 'SELF_DEACTIVATE', message: 'You cannot deactivate your own account' });
  }
  const db = getSovereignDB();
  const target = db.getUser(id);
  if (!target) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found' });

  if (email && email.toLowerCase() !== target.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const clash = db.getUserByEmail(email);
    if (clash && clash.id !== id) {
      return res.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'A user with this email already exists' });
    }
  }
  if (employeeId && employeeId !== target.employee_id) {
    const clash = db.getUserByEmployeeId(employeeId);
    if (clash && clash.id !== id) {
      return res.status(409).json({ success: false, code: 'EMPLOYEE_EXISTS', message: 'A user with this employee ID already exists' });
    }
  }

  const patch = {};
  if (fullName !== undefined) patch.full_name = fullName.trim();
  if (email !== undefined) patch.email = email.toLowerCase();
  if (employeeId !== undefined) patch.employee_id = employeeId;
  if (department !== undefined) patch.department = department;
  if (role !== undefined) patch.role = normalizeRole(role);
  if (status !== undefined) patch.status = status === 'active' || status === 'inactive' ? status : undefined;

  const updated = db.updateUser(id, patch);
  auditLoginEvent(req, 'employee_updated', updated, SEVERITY.NOTICE,
    { by: req.sovereignUser?.email, changed: Object.keys(patch) });
  res.json({ success: true, user: safeUser(updated) });
}

export async function resetEmployeePassword(req, res) {
  const { id } = req.params;
  const { newPassword } = req.body || {};
  const db = getSovereignDB();
  const target = db.getUser(id);
  if (!target) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'User not found' });

  let password = newPassword;
  let generated = false;
  if (password) {
    const ok = validatePasswordPolicy(password);
    if (!ok.ok) return res.status(400).json({ success: false, code: 'POLICY', message: ok.message });
  } else {
    password = randomTemporaryPassword();
    generated = true;
  }
  const hash = await hashPassword(password);
  db.updateUser(id, { password_hash: hash, must_change_password: 1 });
  auditLoginEvent(req, 'employee_password_reset', target, SEVERITY.NOTICE,
    { by: req.sovereignUser?.email, generatedPassword: generated });
  const body = { success: true, message: 'Password reset. User must change it on next login.' };
  if (generated) body.temporaryPassword = password;
  res.json(body);
}

function randomTemporaryPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%';
  const bytes = crypto.randomBytes(16);
  let pwd = '';
  for (let i = 0; i < 16; i++) pwd += chars[bytes[i] % chars.length];
  return pwd;
}

// ── Auth status endpoint (login page handshake) ─────────────────────────────

export async function authStatus(req, res) {
  const identity = req.sovereignUser;
  if (identity) {
    const db = getSovereignDB();
    const user = db.getUser(identity.id);
    return res.json({ authenticated: true, user: safeUser(user) });
  }
  res.json({
    authenticated: false,
    demoMode: sovereign.demo.demoModeEnabled && !config.isProduction,
    requireAdminSetup: sovereign.auth.requireBootstrapAdmin,
  });
}

// ── Local self-registration (offline onboarding) ────────────────────────────
// Creates an active ANALYST account locally. Password policy is enforced;
// hash + user live entirely in the sovereign SQLite store. Never sent anywhere.

export async function register(req, res) {
  const { fullName, email, employeeId, department = '', password } = req.body || {};
  if (!fullName || !email || !password) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Full name, email and password are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }
  const normRole = normalizeRole(ROLES.ANALYST);
  const db = getSovereignDB();
  if (db.getUserByEmail(email)) {
    return res.status(409).json({ success: false, code: 'EMAIL_EXISTS', message: 'An account with this email already exists' });
  }
  if (employeeId && db.getUserByEmployeeId(employeeId)) {
    return res.status(409).json({ success: false, code: 'EMPLOYEE_EXISTS', message: 'A user with this employee ID already exists' });
  }
  const pwCheck = validatePasswordPolicy(password);
  if (!pwCheck.ok) {
    return res.status(400).json({ success: false, code: 'POLICY', message: pwCheck.message });
  }

  const hash = await hashPassword(password);
  const created = db.createUser({
    employeeId: employeeId?.trim() || `emp-${Date.now().toString(36)}`,
    fullName: fullName.trim(),
    email: email.toLowerCase(),
    department: department.trim(),
    role: normRole,
    passwordHash: hash,
    mustChangePassword: false,
    createdBy: null,
  });
  auditLoginEvent(req, 'self_registered', created, SEVERITY.NOTICE,
    { role: normRole, department: department.trim() });
  logger.info(LOG, 'Self-registered user', { email, role: normRole });

  const token = generateSovereignToken(created);
  setSovereignCookie(res, token);
  res.status(201).json({ success: true, user: safeUser(created) });
}