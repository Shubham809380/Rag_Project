// ─────────────────────────────────────────────────────────────────────────────
// RBAC — role definitions for the sovereign workbench.
// Roles are configurable. Default seed covers industrial knowledge-work teams.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLES = {
  ADMIN: 'admin',
  ENGINEER: 'engineer',
  MANAGER: 'manager',
  ANALYST: 'analyst',
  INSPECTOR: 'inspector',
  REVIEWER: 'reviewer',
};

export const ROLE_NAMES = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.ENGINEER]: 'Engineer',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.ANALYST]: 'Analyst',
  [ROLES.INSPECTOR]: 'Inspector',
  [ROLES.REVIEWER]: 'Reviewer',
};

// Permission levels for tools/actions.
export const PERM = {
  PUBLIC: 0,       // any authenticated user
  RESTRICTED: 1,   // RBAC-role gated
  PRIVILEGED: 2,   // senior roles
  OWNER: 3,        // document owner or admin
  ADMIN: 4,        // admin only
};

const LEVEL_OF = {
  [ROLES.ADMIN]: PERM.ADMIN,
  [ROLES.MANAGER]: PERM.PRIVILEGED,
  [ROLES.ENGINEER]: PERM.PRIVILEGED,
  [ROLES.REVIEWER]: PERM.PRIVILEGED,
  [ROLES.INSPECTOR]: PERM.RESTRICTED,
  [ROLES.ANALYST]: PERM.RESTRICTED,
};

export function roleLevel(role) {
  return LEVEL_OF[(role || 'analyst').toLowerCase()] ?? PERM.RESTRICTED;
}

export function canReach(user, level) {
  if (!user) return false;
  const has = roleLevel(user.role);
  if (user.isAdmin) return true;
  return has >= level;
}

// Which roles may approve HIGH-risk agent tasks.
export const APPROVER_ROLES = [ROLES.MANAGER, ROLES.ENGINEER, ROLES.REVIEWER, ROLES.ADMIN];

export function canApprove(user) {
  return !!(user && APPROVER_ROLES.includes((user.role || '').toLowerCase()));
}

export function normalizeUser(user) {
  if (!user) return { id: null, email: '', name: '', role: 'analyst', isAdmin: false, level: PERM.RESTRICTED };
  const id = user.id || user.userId || user.sub;
  const role = String(user.role || 'analyst').toLowerCase();
  return {
    id,
    email: user.email || '',
    name: user.name || user.full_name || '',
    role,
    isAdmin: role === ROLES.ADMIN || user.isAdmin === true,
    level: roleLevel(role),
  };
}