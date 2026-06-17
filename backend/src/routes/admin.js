const express = require('express');
const { isHostedMode } = require('../services/appMode');
const { requireAccount, requireAdmin } = require('../middleware/requireAccount');
const accountsRepo = require('../repositories/accountsRepo');
const { asyncRoute } = require('../utils/appError');

const router = express.Router();

function hostedOnly(req, res, next) {
  if (!isHostedMode()) return res.status(404).json({ error: 'Not available in local mode' });
  next();
}

router.use(hostedOnly, requireAccount, requireAdmin);

// GET /admin/accounts — list every customer with plan/status/override
router.get('/accounts', asyncRoute(async (req, res) => {
  const accounts = await accountsRepo.listAccounts();
  res.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      email: a.email,
      plan: a.plan,
      status: a.subscription_status,
      override: a.access_override,
      isAdmin: a.is_admin,
      createdAt: a.created_at,
    })),
  });
}));

// POST /admin/accounts/:id/override — { override: null | 'force_allow' | 'force_deny' }
router.post('/accounts/:id/override', asyncRoute(async (req, res) => {
  const { override } = req.body;
  if (![null, 'force_allow', 'force_deny'].includes(override)) {
    return res.status(400).json({ error: "override must be null, 'force_allow', or 'force_deny'" });
  }
  const account = await accountsRepo.setAccessOverride(req.params.id, override);
  res.json({ account: { id: account.id, email: account.email, override: account.access_override } });
}));

module.exports = router;
