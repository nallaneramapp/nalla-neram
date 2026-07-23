// POST /api/create-checkout-session
// Auth: Clerk session token in the Authorization header (Bearer ...).
// Returns: { url } — redirect the browser here to pay.
//
// Creates (or reuses) a Stripe customer for the signed-in Clerk user, then opens
// a subscription Checkout Session: CA$9.99/yr, 7-day free trial, Stripe Tax on.

import Stripe from 'stripe';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// Service-role client writes the subscriptions row (bypasses RLS). Server-only key.
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Verify the Clerk session token → get the user id.
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not signed in' });

    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const userId = claims.sub;
    const email = claims.email || claims.email_address || undefined;
    if (!userId) return res.status(401).json({ error: 'Invalid session' });

    // 2. Find or create the Stripe customer, remembering it against the user.
    const { data: subRow } = await admin
      .from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();

    let customerId = subRow?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { clerk_user_id: userId },   // ← how the webhook maps back to us
      });
      customerId = customer.id;
      await admin.from('subscriptions')
        .upsert({ user_id: userId, stripe_customer_id: customerId, status: 'none' });
    }

    // 3. Create the subscription Checkout Session.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { clerk_user_id: userId },
      },
      // TEMP: disabled for sandbox testing — Stripe rejects automatic_tax until
      // a valid head office address is set under Settings → Tax. RE-ENABLE this
      // before real/live launch (needs a valid origin address set first — see
      // README, and reinstate consent_collection above at the same time):
      // automatic_tax: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      allow_promotion_codes: true,
      // TEMP: disabled for sandbox testing — Stripe rejects consent_collection
      // until a Terms of Service URL is set under Settings → Public details,
      // which requires filling out full business profile info. RE-ENABLE this
      // before real/live launch (needs a Terms URL set first — see README):
      // consent_collection: { terms_of_service: 'required' },
      // The price is charged in the customer's local currency. Configure the
      // Stripe Price with multi-currency amounts that MATCH the site's NN_PRICES
      // table (charm .99 per currency) so advertised price === charged price.
      success_url: `${process.env.PUBLIC_SITE_URL}/?checkout=success`,
      cancel_url: `${process.env.PUBLIC_SITE_URL}/?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session', err);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
}
