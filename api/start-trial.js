// POST /api/start-trial
// Auth: Clerk session token in the Authorization header (Bearer ...).
// Starts the card-less free trial by writing a 'trialing' row directly —
// no Stripe involved. Service-role only, like stripe-webhook.js, so the
// browser never sets its own Pro status.
//
// One trial per account: rejected if the user already has a subscriptions
// row with a status other than 'none' (i.e. already trialed, subscribed,
// or churned). Keep TRIAL_DAYS in sync with NN_CONFIG.trialDays in index.html.

import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

const TRIAL_DAYS = 30;
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not signed in' });

    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const userId = claims.sub;
    if (!userId) return res.status(401).json({ error: 'Invalid session' });

    const { data: existing } = await admin
      .from('subscriptions').select('status').eq('user_id', userId).maybeSingle();
    if (existing && existing.status !== 'none') {
      return res.status(409).json({ error: 'Trial already used or already subscribed' });
    }

    const end = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
    await admin.from('subscriptions').upsert({
      user_id: userId,
      status: 'trialing',
      current_period_end: end,
      updated_at: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, daysLeft: TRIAL_DAYS, end });
  } catch (err) {
    console.error('start-trial', err);
    return res.status(500).json({ error: 'Could not start trial' });
  }
}
