# நல்ல நேரம் Pro — Setup Runbook

Stack: **Vercel** (host + functions) · **Clerk** (auth) · **Supabase** (DB) · **Stripe** (pay).
Do these in order. Steps marked 🔑 need an account only you can create.
Total: about an evening. You need no server — everything here is serverless + managed.

---

## 1. 🔑 Supabase (database) — 10 min
1. Create a project at supabase.com. Note the **Project URL** and **anon** + **service_role** keys (Settings → API).
2. SQL Editor → paste `supabase/schema.sql` → **Run**. This creates the tables + row-level security.
3. Keep the service_role key secret — it bypasses RLS and lives only in Vercel env vars.

## 2. 🔑 Clerk (auth) — 15 min
1. Create an app at clerk.com. Note the **Publishable key** and **Secret key** (API Keys).
2. Enable sign-in methods: **Google** (free, instant) and **Apple**.
   - Apple needs an **Apple Developer account ($99/yr)**, a Services ID and a key. If that
     stalls you, launch with Google alone and add Apple later — no code change needed.
3. Connect Clerk to Supabase so RLS works:
   - In Clerk → **Integrations → Supabase**, follow "Connect", OR
   - In Supabase → Authentication → **Third-party Auth** → add Clerk (paste Clerk's domain).
   - This makes Clerk's token carry `sub` = the Clerk user id, which the RLS policies read.

## 3. 🔑 Stripe (payments) — 20 min
1. Create/att your Stripe account. **You are the merchant of record** — see Tax below.
2. Product catalog → add product **"Nalla Neram Pro"** → recurring price **CA$9.99 / year** →
   copy the **price id** (`price_...`) into `STRIPE_PRICE_ID`.
3. Developers → API keys → copy the **secret key**.
4. **Enable Stripe Tax:** Settings → Tax → set your **origin address** (Ontario) and turn it on.
   The checkout function already sends `automatic_tax: { enabled: true }`.
5. Webhook: Developers → Webhooks → **Add endpoint** →
   URL `https://<your-domain>/api/stripe-webhook`, events:
   `checkout.session.completed`, `customer.subscription.created/updated/deleted`.
   Copy the **signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
6. Billing Portal: Settings → Billing → Customer portal → **Activate** (used by `/api/portal-session`).

## 4. 🔑 Vercel (deploy) — 15 min
1. Put this `backend/` content and your `index.html` (the built site) in one repo:
   ```
   index.html            ← the site (v18 + WIRING.md changes)
   lib/nn-account.js
   api/create-checkout-session.js
   api/stripe-webhook.js
   api/portal-session.js
   vercel.json  package.json
   ```
2. Import the repo at vercel.com. Framework preset: **Other**.
3. Add every variable from `.env.example` under Settings → Environment Variables.
4. Deploy. Point your domain (Vercel → Domains). Set `PUBLIC_SITE_URL` to it.

## 5. Wire the front-end
Follow `WIRING.md` — swap `isPro()`, `startTrial()`, profile storage and the enquiry
call to use `lib/nn-account.js`. Add a Sign-in button. Remove the license-key box.

## 6. Enquiry email notification (optional but recommended)
So you hear about jathagam consultation requests immediately:
- Supabase → Database → **Webhooks** → on insert to `enquiries`, call an edge function or
  a service like Resend to email you. (Or a daily digest — your call.)

---

## Test checklist (use Stripe **test mode** first)
- [ ] Sign in with Google, then Apple.
- [ ] Family profile saves and reloads after refresh (it's in Postgres now).
- [ ] "Go Pro" → Stripe test checkout (card `4242 4242 4242 4242`) → returns → Pro unlocks.
- [ ] Chandrashtamam exact times + family plan now visible; free tier still works signed-out.
- [ ] Cancel in the billing portal → within seconds the webhook flips status → Pro locks at period end.
- [ ] Submit a jathagam enquiry → row appears in the `enquiries` table.
- [ ] Switch Stripe to **live** mode and repeat keys.

## The two things to keep in mind
- **Tax is on you (Stripe = merchant of record).** Stripe Tax *calculates* correctly, but you
  must *register and remit* where you cross thresholds (EU VAT, UK, Australia/Singapore GST,
  US state sales tax, etc.). Low volume at first is fine; revisit with an accountant as you grow.
- **Never expose** `SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY` or
  `STRIPE_WEBHOOK_SECRET` in the browser. They belong only in Vercel env vars. The only
  browser-safe values are the Clerk publishable key and the Supabase URL + anon key.
