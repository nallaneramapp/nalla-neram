// GET/POST /api/trial-reminder  — runs daily via Vercel Cron (see vercel.json).
// Sends the "your free trial ends soon" email to trialing members whose trial
// ends within TRIAL_WARN_DAYS and who haven't been reminded yet.
//
// This is the EMAIL half of the 5-day reminder. The in-app banner half is in the
// site (renderTrialBanner) and needs no server.
//
// A "your trial is ending" notice is transactional (tied to a service the user
// started), but we still include an unsubscribe/manage link and honour it.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLERK_SECRET_KEY, RESEND_API_KEY,
//      PUBLIC_SITE_URL, TRIAL_WARN_DAYS (default 5), CRON_SECRET.

import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { Resend } from 'resend';

const admin  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const clerk  = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const WARN   = parseInt(process.env.TRIAL_WARN_DAYS || '5', 10);

export default async function handler(req, res) {
  // Protect the endpoint so only Vercel Cron (or you) can trigger it.
  const secret = (req.headers.authorization || '').replace('Bearer ', '') || req.query.key;
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Email is optional at launch. If Resend isn't configured yet, no-op cleanly
  // (the in-app banner still reminds users). Prevents the daily cron from erroring.
  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ ok: true, skipped: 'RESEND_API_KEY not set — email reminders disabled' });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const now = new Date();
  const cutoff = new Date(now.getTime() + WARN * 86400000);

  // trialing, ending within the window, still in the future, not yet reminded.
  const { data: rows, error } = await admin
    .from('subscriptions')
    .select('user_id,current_period_end,reminder_sent,status')
    .eq('status', 'trialing')
    .eq('reminder_sent', false)
    .gt('current_period_end', now.toISOString())
    .lte('current_period_end', cutoff.toISOString());

  if (error) { console.error('trial-reminder query', error); return res.status(500).json({ error: 'query failed' }); }

  let sent = 0;
  for (const row of rows || []) {
    try {
      const user = await clerk.users.getUser(row.user_id);
      const email = user?.primaryEmailAddress?.emailAddress
        || user?.emailAddresses?.[0]?.emailAddress;
      if (!email) continue;

      const end = new Date(row.current_period_end);
      const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
      const site = process.env.PUBLIC_SITE_URL || '';

      await resend.emails.send({
        from: 'Nalla Neram <nallaneramapp@gmail.com>',   // use your verified sending domain
        to: email,
        subject: `Your Nalla Neram Pro trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
        html: `
          <div style="font-family:system-ui,Arial,sans-serif;color:#3a2410;max-width:520px">
            <h2 style="color:#5c0d0d">Your free Pro trial is ending</h2>
            <p>Vanakkam,</p>
            <p>Your 30-day free trial of <b>Nalla Neram Pro</b> ends in
               <b>${daysLeft} day${daysLeft === 1 ? '' : 's'}</b>
               (on ${end.toDateString()}).</p>
            <p>To keep your Personalized Family Plan, exact chandrashtamam times,
               festival guidance and calendar exports, subscribe to continue —
               it’s a small yearly price and you can cancel anytime.</p>
            <p><a href="${site}/?subscribe=1"
                  style="background:#5c0d0d;color:#f3d98b;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:700">
                  Subscribe to keep Pro</a></p>
            <p style="font-size:12px;color:#8a7250">If you do nothing, your account simply returns to the
               free daily Panchangam — you won’t be charged. Manage your account any time at
               <a href="${site}">${(site || '').replace(/^https?:\/\//, '')}</a>.</p>
          </div>`,
      });

      await admin.from('subscriptions')
        .update({ reminder_sent: true })
        .eq('user_id', row.user_id);
      sent++;
    } catch (e) {
      console.error('trial-reminder send', row.user_id, e);
    }
  }

  return res.status(200).json({ ok: true, candidates: rows?.length || 0, sent });
}
