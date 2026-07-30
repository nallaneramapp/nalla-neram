// POST /api/feedback-notify
// Called by a Supabase Database Webhook on INSERT to public.feedback — emails
// you the submission right away, instead of you having to check the table.
//
// Setup (Supabase dashboard):
//   Database → Webhooks → Create a new hook
//     Table: public.feedback   Events: Insert
//     Type: HTTP Request → POST https://<your-domain>/api/feedback-notify
//     HTTP Headers: Authorization: Bearer <FEEDBACK_WEBHOOK_SECRET>
//
// Safe no-op until email is configured: if RESEND_API_KEY isn't set, this
// just returns 200 without sending anything, so a misconfigured webhook
// never shows as failing in Supabase.
//
// Env: RESEND_API_KEY, FEEDBACK_WEBHOOK_SECRET, FEEDBACK_NOTIFY_EMAIL
//      (defaults to nallaneramapp@gmail.com), PUBLIC_SITE_URL.

import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Only the Supabase webhook (or you) can trigger this.
  const secret = (req.headers.authorization || '').replace('Bearer ', '');
  if (process.env.FEEDBACK_WEBHOOK_SECRET && secret !== process.env.FEEDBACK_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Email is optional at launch. No-ops cleanly so the webhook never errors.
  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ ok: true, skipped: 'RESEND_API_KEY not set — feedback emails disabled' });
  }

  try {
    const row = req.body?.record || {};
    const {
      category = 'other', rating, message = '', email, page, lang, created_at,
    } = row;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const to = process.env.FEEDBACK_NOTIFY_EMAIL || 'nallaneramapp@gmail.com';
    const site = process.env.PUBLIC_SITE_URL || '';
    const stars = rating ? '★'.repeat(rating) + '☆'.repeat(5 - rating) : '(no rating)';

    await resend.emails.send({
      from: 'Nalla Neram <nallaneramapp@gmail.com>',   // use your verified sending domain
      to,
      subject: `New feedback: ${category}${rating ? ` (${stars})` : ''}`,
      html: `
        <div style="font-family:system-ui,Arial,sans-serif;color:#3a2410;max-width:560px">
          <h2 style="color:#5c0d0d">New feedback received</h2>
          <p><b>Category:</b> ${category}<br>
             <b>Rating:</b> ${stars}<br>
             <b>From:</b> ${email || '(anonymous)'}<br>
             <b>Page:</b> ${page || '—'} · <b>Lang:</b> ${lang || '—'}<br>
             <b>When:</b> ${created_at || new Date().toISOString()}</p>
          <blockquote style="border-left:3px solid #d9b64a;margin:0;padding:8px 14px;background:#fdf8ee">
            ${String(message).replace(/</g, '&lt;')}
          </blockquote>
          <p style="font-size:12px;color:#8a7250">Full history: Supabase → Table Editor → feedback.
             ${site ? `Site: <a href="${site}">${site.replace(/^https?:\/\//, '')}</a>` : ''}</p>
        </div>`,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('feedback-notify', err);
    return res.status(500).json({ error: 'Could not send notification' });
  }
}
