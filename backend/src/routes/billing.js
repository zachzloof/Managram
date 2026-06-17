const express = require('express');
const Stripe = require('stripe');
const { isHostedMode } = require('../services/appMode');
const { requireAccount } = require('../middleware/requireAccount');
const accountsRepo = require('../repositories/accountsRepo');

const router = express.Router();

function hostedOnly(req, res, next) {
  if (!isHostedMode()) return res.status(404).json({ error: 'Not available in local mode' });
  next();
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function getAppUrl() {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
}

// POST /billing/checkout — start (or resume) a subscription. Card required
// up front, 7-day trial, auto-converts unless canceled.
router.post('/checkout', hostedOnly, requireAccount, async (req, res) => {
  try {
    const stripe = getStripe();
    let account = await accountsRepo.getAccountById(req.accountId);

    if (!account.stripe_customer_id) {
      const customer = await stripe.customers.create({ email: account.email });
      account = await accountsRepo.updateAccount(account.id, { stripe_customer_id: customer.id });
    }

    const priceId = req.body.plan === 'annual' ? process.env.STRIPE_PRICE_ID_ANNUAL : process.env.STRIPE_PRICE_ID_MONTHLY;
    if (!priceId) return res.status(500).json({ error: 'Stripe price ID not configured' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: account.stripe_customer_id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
      },
      payment_method_collection: 'always',
      success_url: `${getAppUrl()}/settings?billing=success`,
      cancel_url: `${getAppUrl()}/settings?billing=canceled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Billing] checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /billing/portal — Stripe Customer Portal for self-serve plan/cancel management
router.get('/portal', hostedOnly, requireAccount, async (req, res) => {
  try {
    const stripe = getStripe();
    const account = await accountsRepo.getAccountById(req.accountId);
    if (!account.stripe_customer_id) return res.status(400).json({ error: 'No billing account yet — start checkout first' });

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: `${getAppUrl()}/settings`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[Billing] portal error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook handler — mounted directly on `app` in index.js (not on
// this router) at /billing/webhook, with express.raw() ahead of the global
// express.json() middleware, so the signature can be verified against the
// untouched raw body. Exported separately rather than as a router route so
// it can be wired in before body parsing without affecting /checkout, /portal.
async function webhookHandler(req, res) {
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Billing] webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Respond fast; Stripe retries on slow/ambiguous responses.
  res.json({ received: true });

  try {
    const customerId = event.data.object.customer;
    const account = customerId ? await accountsRepo.getAccountByStripeCustomerId(customerId) : null;
    if (!account) return;

    const isNew = await accountsRepo.recordBillingEventOnce(event.id, event.type, account.id, event.data.object);
    if (!isNew) return; // already processed this exact event — Stripe redelivered it

    switch (event.type) {
      case 'checkout.session.completed': {
        const subscriptionId = event.data.object.subscription;
        await accountsRepo.updateAccount(account.id, { stripe_subscription_id: subscriptionId, subscription_status: 'active' });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Mirror Stripe's own status — never compute it independently.
        await accountsRepo.updateAccount(account.id, { subscription_status: event.data.object.status });
        break;
      }
      case 'invoice.payment_failed': {
        await accountsRepo.updateAccount(account.id, { subscription_status: 'past_due' });
        break;
      }
    }
  } catch (err) {
    console.error('[Billing] webhook handling error:', err.message);
  }
}

module.exports = { router, webhookHandler };
