// POST /api/portal-session
// Auth: Clerk session token (Bearer).
// Returns: { url } — Stripe Billing Portal where the user can update their card,
// see invoices, or cancel. Cancellation flows back via the webhook.

import Stripe from 'stripe';
import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const { sub: userId } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });

    const { data: row } = await admin
      .from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
    if (!row?.stripe_customer_id) return res.status(400).json({ error: 'No subscription found' });

    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${process.env.PUBLIC_SITE_URL}/?account=1`,
    });
    return res.status(200).json({ url: portal.url });
  } catch (err) {
    console.error('portal-session', err);
    return res.status(500).json({ error: 'Could not open billing portal' });
  }
}
