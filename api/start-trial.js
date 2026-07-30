// POST /api/start-trial
// Auth: Clerk session token in the Authorization header (Bearer ...).
// Starts the CARD-LESS free trial for the signed-in user.
//
// Why server-side: the trial end date must be authoritative. If it lived in the
// browser, a user could clear storage and get a fresh trial forever, and it
// wouldn't sync across their devices. Here we write one row and refuse to start
// a second trial for the same user.
//
// No Stripe, no card. When the trial ends the row simply lapses (is_pro() = false)
// until the user subscribes via /api/create-checkout-session.

import { verifyToken } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '30', 10);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Verify the Clerk session token → user id.
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const userId = claims.sub;
    if (!userId) return res.status(401).json({ error: 'Invalid session' });

    // 2. One trial per user. If a row already exists (trialing/active/expired/none),
    //    do not start (or re-start) a trial.
    const { data: existing } = await admin
      .from('subscriptions')
      .select('status,trial_started_at,current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && (existing.trial_started_at || ['trialing', 'active'].includes(existing.status))) {
      return res.status(200).json({ ok: true, already: true, status: existing.status });
    }

    // 3. Start the trial: status 'trialing', ends in TRIAL_DAYS.
    const now = new Date();
    const end = new Date(now.getTime() + TRIAL_DAYS * 86400000);
    const row = {
      user_id: userId,
      status: 'trialing',
      trial_started_at: now.toISOString(),
      current_period_end: end.toISOString(),
      reminder_sent: false,
    };
    // upsert on user_id so a prior 'none' row (e.g. created when making a Stripe
    // customer) is updated rather than duplicated.
    const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;

    return res.status(200).json({ ok: true, status: 'trialing', current_period_end: end.toISOString() });
  } catch (err) {
    console.error('start-trial', err);
    return res.status(500).json({ error: 'Could not start trial' });
  }
}
