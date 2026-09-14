import { Router } from 'express';
import { sovereignOptionalAuth, sovereignRequireAuth } from '../security/sovereignAuth.js';
import sovereignController, { sovereignStatusHandler, sovereignAvailabilityHandler } from '../controllers/sovereign.controller.js';

const router = Router();

// Resolve optional sovereign identity for all workbench routes (status/availability).
router.use(sovereignOptionalAuth);

// Public workbench endpoints (system health / availability handshake only).
router.get('/sovereign/status', async (req, res) => sovereignStatusHandler(req, res).catch((e) => res.status(500).json({ error: e.message })));
router.get('/sovereign/availability', async (req, res) => sovereignAvailabilityHandler(req, res).catch((e) => res.status(500).json({ error: e.message })));

// Everything else in the sovereign workbench requires an authenticated session.
// NB: /sovereign/auth/* and /sovereign/admin/users/* are handled by
// sovereignAuth.routes.js (which enforces its own auth/admin gates), so they are
// excluded here to avoid double-gating the login route.
router.use('/sovereign', (req, res, next) => {
  // req.path is relative to the /sovereign mount (e.g. /auth/login, /dashboard)
  const p = req.path || '';
  if (p.startsWith('/auth/') || p.startsWith('/admin/users')) return next();
  return sovereignRequireAuth(req, res, next);
});

sovereignController(router);

export default router;