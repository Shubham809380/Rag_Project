// ─────────────────────────────────────────────────────────────────────────────
// Sovereign local authentication.
//
// Covers PRODUCTION local (air-gapped) authentication for the sovereign
// workbench. Uses the sovereign SQLite `users` table, bcrypt password hashing,
// and JWT in an httpOnly cookie. No cloud, no Google OAuth, no public signup.
//
// DEMO_MODE: the legacy header-based identity (x-sovereign-role / x-sovereign-user)
// is STRICTLY limited to non-production, DEMO_MODE=auto/test development. It is
// never reachable in production regardless of headers supplied by a client.
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/index.js';
import sovereign from '../config/sovereign.js';
import { getSovereignDB } from '../storage/sovereignDB.js';
import { auditService, CATEGORY, SEVERITY } from './audit.js';
import { ROLES, PERM, canReach } from './rbac.js';
import logger from '../utils/logger.js';

const LOG = 'SovereignAuth';

export const VALID_ROLES = Object.values(ROLES);

// ── JWT token helpers ───────────────────────────────────────────────────────

export function generateSovereignToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.full_name || user.name, role: user.role, sovereign: true },
    sovereign.auth.jwtSecret,
    { expiresIn: sovereign.auth.jwtExpiresIn }
  );
}

export function verifySovereignToken(token) {
  try {
    const decoded = jwt.verify(token, sovereign.auth.jwtSecret);
    if (!decoded.sovereign) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function setSovereignCookie(res, token) {
  res.cookie(sovereign.auth.cookieName, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'lax' : 'lax',
    maxAge: sovereign.auth.cookieMaxAgeMs,
    path: '/',
  });
}

export function clearSovereignCookie(res) {
  res.cookie(sovereign.auth.cookieName, '', {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'lax' : 'lax',
    maxAge: 0,
    path: '/',
  });
}

export function getSovereignCookie(req) {
  return req.cookies?.[sovereign.auth.cookieName];
}

// ── Password policy / hashing ───────────────────────────────────────────────

export function validatePasswordPolicy(password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, message: 'Password is required' };
  }
  const min = sovereign.auth.minPasswordLength;
  if (password.length < min) {
    return { ok: false, message: `Password must be at least ${min} characters` };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, message: 'Password must include letters' };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, message: 'Password must include at least one number' };
  }
  return { ok: true };
}

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(password, hash);
}

// ── Role validation ─────────────────────────────────────────────────────────

export function normalizeRole(role) {
  const r = String(role || ROLES.ANALYST).toLowerCase();
  return VALID_ROLES.includes(r) ? r : ROLES.ANALYST;
}

// ── Bootstrap: create the initial admin from environment variables ─────────

export function ensureBootstrapAdmin() {
  const db = getSovereignDB();
  const existingAdmin = db.listUsers({ role: ROLES.ADMIN, status: 'active' });
  if (existingAdmin.length > 0) return existingAdmin[0];

  const adminEmail = sovereign.auth.bootstrapAdminEmail;
  if (!adminEmail) {
    if (sovereign.auth.requireBootstrapAdmin) {
      logger.warn(LOG, 'SOVEREIGN_REQUIRE_ADMIN_BOOTSTRAP=true but SOVEREIGN_ADMIN_EMAIL is not set — no admin user exists');
    }
    return null;
  }

  const existing = db.getUserByEmail(adminEmail);
  if (existing) return existing;

  const password = sovereign.auth.bootstrapAdminPassword;
  return hashPassword(password || crypto.randomBytes(24).toString('hex')).then((hash) => {
    const user = db.createUser({
      employeeId: 'ADMIN-0001',
      fullName: sovereign.auth.bootstrapAdminName,
      email: adminEmail,
      department: 'Administration',
      role: ROLES.ADMIN,
      passwordHash: hash,
      mustChangePassword: !!password,
      createdBy: 'bootstrap',
    });
    auditService().record({
      category: CATEGORY.SECURITY,
      action: 'admin_bootstrap',
      severity: password ? SEVERITY.NOTICE : SEVERITY.WARNING,
      user: { id: user.id, email: user.email, name: user.full_name },
      details: { source: password ? 'env_password' : 'random_password', createdAt: user.created_at },
    });
    logger.info(LOG, 'Bootstrap admin user created', { email: user.email, source: password ? 'env_password' : 'random_password' });
    return user;
  });
}

// ── Login rate limiting (in-memory, per email + IP) ─────────────────────────

const attemptStore = new Map();
// Upper bound on the attempt table — rotating email:ip keys must not exhaust
// process memory. When exceeded, oldest-recorded entries are evicted first.
const ATTEMPT_STORE_MAX = 10000;

function keyFor(req, email) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  return `${String(email).toLowerCase()}:${ip}`;
}

function evictIfNeeded() {
  if (attemptStore.size < ATTEMPT_STORE_MAX) return;
  const oldest = Array.from(attemptStore.keys()).slice(0, Math.ceil(ATTEMPT_STORE_MAX * 0.25));
  for (const k of oldest) attemptStore.delete(k);
}

export function getLoginAttempts(req, email) {
  const rec = attemptStore.get(keyFor(req, email));
  return rec || { count: 0, lockUntil: 0 };
}

export function registerFailedLogin(req, email) {
  const k = keyFor(req, email);
  const rec = attemptStore.get(k) || { count: 0, lockUntil: 0 };
  rec.count += 1;
  if (rec.count >= sovereign.auth.maxLoginAttempts) {
    rec.lockUntil = Date.now() + sovereign.auth.lockoutMs;
    rec.count = 0;
    logger.warn(LOG, 'Login lockout triggered', { key: k, lockMs: sovereign.auth.lockoutMs });
  }
  attemptStore.set(k, rec);
  evictIfNeeded();
  return rec;
}

export function resetLoginAttempts(req, email) {
  attemptStore.delete(keyFor(req, email));
}

export function isLoginLocked(req, email) {
  const rec = getLoginAttempts(req, email);
  if (rec.lockUntil && rec.lockUntil > Date.now()) {
    return { locked: true, retryAfterMs: rec.lockUntil - Date.now() };
  }
  if (rec.lockUntil && rec.lockUntil <= Date.now()) {
    attemptStore.delete(keyFor(req, email));
  }
  return { locked: false };
}

// ── Middleware ──────────────────────────────────────────────────────────────

// Resolve acting identity for sovereign routes. Priority:
//   1. Valid sovereign JWT cookie (production path).
//   2. In production the demo/header identities are never reachable.
//   3. Non-production ONLY: when DEMO_MODE=true/auto is explicitly configured:
//        a. header-based local-dev shortcut (x-sovereign-role / x-sovereign-user)
//        b. fixed demo user (requires BOTH DEMO_MODE and SOVEREIGN_DEMO_USER_ID)
//   4. null (anonymous; caller enforces as needed).
export function sovereignIdentity(req) {
  const token = getSovereignCookie(req) || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const decoded = verifySovereignToken(token);
    if (decoded) {
      return {
        sovereign: true,
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
        isAdmin: decoded.role === ROLES.ADMIN,
      };
    }
  }

  if (config.isProduction) {
    // Production never falls back to demo/header identities.
    return null;
  }

  // Demo identities activate ONLY with an explicit DEMO_MODE=true/auto flag.
  if (sovereign.demo.demoModeEnabled) {
    // Explicit per-request header identity (local-dev shortcut).
    if (req.headers['x-sovereign-role'] || req.headers['x-sovereign-user']) {
      return demoHeaderIdentity(req);
    }
    // Fixed demo user — development convenience. Requires BOTH DEMO_MODE and
    // SOVEREIGN_DEMO_USER_ID; it never activates merely because env vars exist.
    if (sovereign.demo.enabled) {
      return {
        id: sovereign.demo.userId,
        email: sovereign.demo.email || `${sovereign.demo.userId}@local`,
        name: sovereign.demo.name,
        role: normalizeRole(sovereign.demo.role),
        isAdmin: sovereign.demo.role === ROLES.ADMIN,
      };
    }
  }

  return null;
}

// Legacy local-dev shortcut, gated by DEMO_MODE=true/auto + non-production.
function demoHeaderIdentity(req) {
  const role = normalizeRole(req.headers['x-sovereign-role'] || ROLES.INSPECTOR);
  const user = (req.headers['x-sovereign-user'] || 'local-operator').toString().slice(0, 80);
  return { id: user, email: `${user}@local.workbench`, name: user, role, isAdmin: role === ROLES.ADMIN };
}

// Enforce authenticated sovereign session (JWT or demo identity when enabled).
export function sovereignRequireAuth(req, res, next) {
  const identity = sovereignIdentity(req);
  if (!identity) {
    return res.status(401).json({ success: false, code: 'SOVEREIGN_AUTH_REQUIRED', message: 'Sovereign authentication required' });
  }
  req.sovereignUser = identity;
  next();
}

export function sovereignOptionalAuth(req, res, next) {
  req.sovereignUser = sovereignIdentity(req) || undefined;
  next();
}

// Enforce admin role among sovereign identities.
export function sovereignAdminOnly(req, res, next) {
  if (!req.sovereignUser?.isAdmin) {
    return res.status(403).json({ success: false, code: 'SOVEREIGN_ADMIN_REQUIRED', message: 'Administrator access required' });
  }
  next();
}

// Enforce a minimum RBAC privilege level among sovereign identities.
// PERM levels: 0=PUBLIC, 1=RESTRICTED, 2=PRIVILEGED, 3=OWNER, 4=ADMIN.
// This is the server-side gate that backs the frontend menu hiding — bypassing
// the frontend never bypasses this check.
export function sovereignRoleAtLeast(level) {
  return (req, res, next) => {
    if (!canReach(req.sovereignUser, level)) {
      return res.status(403).json({ success: false, code: 'SOVEREIGN_FORBIDDEN', message: `This operation requires privilege level ${level} (at least ${level === PERM.ADMIN ? 'admin' : level === PERM.PRIVILEGED ? 'manager/engineer/reviewer' : 'privileged'}).` });
    }
    next();
  };
}

// Redirect identity for /api/sovereign/* legacy routes that currently fall back
// to the header-based dev identity. In production this MUST yield null.
export function resolveSovereignUser(req) {
  return sovereignIdentity(req);
}