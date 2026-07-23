// POST /api/stripe-webhook
// Stripe calls this on every subscription change. It is the ONLY writer of
// subscription status — the browser never sets Pro itself.
//
// Configure in Stripe dashboard → Developers → Webhooks → add endpoint:
//   https://<your-domain>/api/stripe-webhook
//   events: checkout.session.completed, customer.subscription.created,
//           customer.subscription.updated, customer.subscription.deleted
// Copy the signing secret into STRIPE_WEBHOOK_SECRET.

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Stripe needs the RAW body to verify the signature — disable Vercel's parser.
export const config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(Buffer.from(data)));
    req.on('error', reject);
  });
}

// Map a Stripe subscription id → our user, then upsert its status.
async function syncSubscription(subId) {
  const sub = await stripe.subscriptions.retrieve(subId);
  const userId = sub.metadata?.clerk_user_id;
  if (!userId) {
    // Fall back to the customer's metadata if the sub had none.
    const cust = await stripe.customers.retrieve(sub.customer);
    if (cust && !cust.deleted && cust.metadata?.clerk_user_id) {
      return upsert(cust.metadata.clerk_user_id, sub);
    }
    console.warn('webhook: no clerk_user_id for subscription', subId);
    return;
  }
  return upsert(userId, sub);
}

async function upsert(userId, sub) {
  await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    status: sub.status,                                  // trialing|active|past_due|canceled...
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let event;
  try {
    const raw = await readRaw(req);
    event = stripe.webhooks.constructEvent(
      raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('webhook signature failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.subscription) await syncSubscription(s.subscription);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object.id);
        break;
      }
      default: break; // ignore the rest
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook handler error', err);
    return res.status(500).json({ error: 'handler failed' });
  }
}
