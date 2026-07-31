# Ungal Nalla Neram — Operator's Manual

This is the complete reference for running, operating, and rebuilding **Ungal Nalla Neram**
(உங்கள் நல்ல நேரம்) end to end. It is written from the actual code in this repository —
if something here and the code ever disagree, the code wins; update this file to match.

Live site: **https://www.yournallaneram.com**

---

## 1. Overview

**Ungal Nalla Neram** ("Your Nalla Neram") is a bilingual (Tamil/English) Tamil astrology
and calendar web app. It computes a **daily panchangam** (tithi, nakshatram, Rahu kalam,
Gowri nalla neram, chandrashtamam and more) for the user's own city using the Thirukanitha
(Drik Ganita) calculation method, free of charge, plus a paid **Personalized Family Plan**
with exact chandrashtamam timing and calendar exports for the whole family.

**Who it's for:** Tamil families worldwide (the pricing table covers Canada, US, UK, EU,
Australia, NZ, Singapore, India, UAE, Malaysia, Sri Lanka, South Africa) who want an
accurate, city-specific panchangam instead of a generic one computed for a fixed reference
city.

**One-line value prop:** most panchangam sites tell you *which* nakshatram has
chandrashtamam today — this one tells you *exactly when it starts and ends*, computed for
the city you actually live in.

---

## 2. Architecture

```
                         ┌─────────────────────────────┐
                         │   Browser (index.html)      │
                         │   panchangam / jathagam /    │
                         │   chandrashtamam engine —    │
                         │   100% client-side JS        │
                         └───────────┬─────────────────┘
                                     │
                  ┌──────────────────┼───────────────────┐
                  │                  │                    │
                  ▼                  ▼                    ▼
           ┌─────────────┐   ┌───────────────┐    ┌───────────────┐
           │    Clerk     │   │   Supabase    │    │ Vercel Functions│
           │  (auth, JWT) │   │ (Postgres+RLS)│    │   api/*.js      │
           └──────┬───────┘   └───────┬───────┘    └───────┬───────┘
                  │  JWT trusted by    │                    │
                  │  Supabase (3rd-    │                    ▼
                  │  party auth)       │             ┌───────────────┐
                  │                    │             │    Stripe      │
                  └────────────────────┘             │ (checkout,     │
                                                       │  webhook,      │
                                                       │  billing portal)│
                                                       └───────┬───────┘
                                                               │
                                                       ┌───────▼───────┐
                                                       │    Resend      │
                                                       │ (feedback +    │
                                                       │  trial-reminder│
                                                       │  emails)       │
                                                       └───────────────┘
```

Everything is static + serverless, hosted on **Vercel**:

- `index.html` and `legal.html` are plain static pages — no build step, no framework.
- The **entire astronomy/panchangam/jathagam/chandrashtamam engine runs client-side**,
  inside `index.html`. The backend never computes astrology; it only handles identity,
  entitlement (subscription status) and persistence (family profiles, enquiries, feedback).
- **Clerk** is the identity provider. It issues a JWT to the browser after sign-in.
- **Supabase** is a database only — it is configured to trust Clerk's JWT ("third-party
  auth"), so Postgres Row-Level Security (RLS) can key directly on the Clerk user id
  without Supabase's own auth system being involved.
- **Stripe** handles payment: Checkout for the subscription, a webhook that is the single
  writer of subscription status, and the Billing Portal for self-serve cancel/manage.
- **Resend** sends transactional email (feedback notifications, trial-ending reminders) —
  both are optional and no-op cleanly if unconfigured.
- **Vercel Cron** fires `/api/trial-reminder` once a day.

---

## 3. Tech stack & versions

| Layer | Choice |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — no framework, no build step, no bundler |
| Frontend module | `lib/nn-account.js` — native ES module (`<script type="module">`) |
| Fonts | Google Fonts: Cormorant Garamond, Marcellus, Noto Sans Tamil, Noto Serif Tamil |
| Backend runtime | Node.js **22.x** (`package.json` → `engines.node`), Vercel serverless functions |
| Package type | `"type": "module"` (ESM `import`/`export` throughout `api/`) |
| Auth | `@clerk/backend` ^1.15.0 (server-side JWT verification), Clerk's hosted `clerk-js@5` (browser, loaded from the Clerk Frontend API CDN) |
| Database client | `@supabase/supabase-js` ^2.45.0 |
| Payments | `stripe` ^16.0.0 |
| Email | `resend` ^4.0.0 |
| Database | Supabase (managed Postgres) |
| Hosting | Vercel (static hosting + serverless functions + cron) |
| Analytics | Google Analytics 4 (`gtag.js`, inline in `index.html`/`legal.html`) |

---

## 4. Repository structure

```
nalla-neram/
├─ index.html              The entire site: panchangam/jathagam/chandrashtamam engine,
│                           Pro app UI, SEO meta/OG/JSON-LD, GA4, NN_CONFIG. ~3,850 lines.
├─ legal.html               Terms of Service · Privacy Policy · Refund & Cancellation ·
│                           Astrology Disclaimer.
├─ robots.txt               Allows all crawlers; points to sitemap.xml.
├─ sitemap.xml              Two URLs: / and /legal.html.
├─ og-image.png             1200×630 Open Graph / Twitter share image (branded).
├─ lib/
│  └─ nn-account.js         Browser module: loads Clerk + Supabase, exposes auth,
│                           Pro-entitlement, trial, checkout/portal, family profiles,
│                           enquiry and feedback functions to the rest of index.html.
├─ api/                     Vercel serverless functions (see §10 for full detail)
│  ├─ create-checkout-session.js   POST — starts a Stripe Checkout subscription
│  ├─ portal-session.js            POST — opens the Stripe Billing Portal
│  ├─ start-trial.js               POST — starts the 30-day card-less trial
│  ├─ stripe-webhook.js            POST — Stripe's source-of-truth writer for subscriptions
│  ├─ trial-reminder.js            GET/POST — daily cron: emails trials ending soon
│  ├─ feedback-notify.js           POST — Supabase DB-webhook target: emails new feedback
│  └─ ics.js                       GET/POST — serves .ics calendar files with the right
│                                   headers so iOS Safari's "Add to Calendar" works
├─ supabase/
│  └─ schema.sql            Tables (subscriptions, profiles, enquiries, feedback), RLS
│                           policies, requesting_user_id() and is_pro() helper functions.
├─ vercel.json               Function memory/duration, the "/" → /index.html rewrite,
│                           and the daily trial-reminder cron schedule.
├─ package.json              Dependencies, Node 22.x engine, ESM module type.
├─ .env.example              Every environment variable the backend needs (no real values).
├─ .gitignore
├─ README.md                 Original setup runbook (Supabase → Clerk → Stripe → Vercel).
├─ START-HERE.md              Hand-off notes: what's in the repo, current demo state.
└─ docs/
   ├─ ARCHITECTURE.md         Data-flow diagrams for sign-in, checkout, entitlement.
   ├─ WIRING.md                How the HTML model's localStorage stubs map onto
   │                          lib/nn-account.js (already applied in index.html).
   └─ MANUAL.md                This file.
```

---

## 5. Features

| Feature | Tier | Where it lives |
|---|---|---|
| Daily panchangam (tithi, nakshatram, Rahu kalam, Gowri nalla neram, etc.), for any of 250+ cities worldwide | Free | Client-side engine in `index.html` |
| "Which stars have chandrashtamam today" | Free | Client-side |
| **Exact chandrashtamam start/end times**, to the minute, plus the next 3 windows | Pro | Client-side calc, gated by `isPro()` |
| **Personalized Family Plan** — save each family member's birth details, see their chandrashtamam days | Pro | `profiles` table via `nn-account.js` `nnProfiles` |
| Festivals + occasion detail library (significance, how to worship, associated temples) | Free (list) / Pro (detail modal — `openPaywall('about')` if not Pro) | Client-side |
| **30-day card-less free trial** — no payment method required to start | — | `api/start-trial.js`, server-authoritative |
| Feedback widget (category, star rating, message) | All users, signed in or guest | `feedback` table, optional Resend email via `api/feedback-notify.js` |
| Jathagam (horoscope) consultation enquiry — handled personally, not auto-generated | All users, signed in or guest | `enquiries` table |
| Bilingual Tamil/English toggle throughout | All | `.ta-only` / `.en-only` CSS classes + `curLang()` |
| PDF export | Pro | Browser print (`#calPrint`-styled print stylesheet + `window.print()`), not a server-generated PDF |
| .ics calendar export (festivals, family chandrashtamam days) | Free (single event) / Pro (ranges, per-person) | Built client-side, served through `api/ics.js` when `NN_CONFIG.icsEndpoint` is on so iOS Safari's "Add to Calendar" sheet triggers reliably |
| Trial-ending reminder email | Pro (trialing) | `api/trial-reminder.js`, daily Vercel Cron |

---

## 6. Data model (Supabase / Postgres)

Auth is Clerk, not Supabase Auth — every table's `user_id` is a **Clerk user id** (e.g.
`user_2ab...`), read from the JWT's `sub` claim via the helper function
`public.requesting_user_id()`. RLS policies compare `user_id = public.requesting_user_id()`,
so Postgres — not application code — enforces that a user can only touch their own rows.

### `subscriptions` — one row per user; single source of truth for "is this user Pro?"

| Column | Type | Notes |
|---|---|---|
| `user_id` | `text` (PK) | Clerk user id |
| `stripe_customer_id` | `text`, unique | Set on first checkout or trial start |
| `stripe_subscription_id` | `text`, unique | Set by the Stripe webhook |
| `status` | `text`, default `'none'` | `none \| trialing \| active \| past_due \| canceled` |
| `price_id` | `text` | Stripe Price id charged |
| `current_period_end` | `timestamptz` | End of the current trial or billing period |
| `cancel_at_period_end` | `boolean`, default `false` | Set when the user cancels via the portal |
| `updated_at` | `timestamptz` | Last write |

**RLS:** `select` only, `user_id = requesting_user_id()`. There is **no** insert/update/delete
policy for regular users — all writes happen through the Supabase **service_role** key
(`api/start-trial.js`, `api/create-checkout-session.js`, `api/stripe-webhook.js`), which
bypasses RLS entirely. The browser only ever reads this table.

**`is_pro(uid)` SQL function:** returns true when `status in ('active','trialing')` AND
(`current_period_end` is null OR still in the future). The browser-side equivalent is
`lib/nn-account.js`'s `nnIsPro()`, which runs the same two checks against the row it reads.

### `profiles` — family members' birth details (replaces the old localStorage list)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | `gen_random_uuid()` |
| `user_id` | `text` | Clerk user id |
| `name` | `text` | Required |
| `dob` | `date` | Date of birth |
| `tob` | `time` | Time of birth |
| `city_label` | `text` | e.g. "சென்னை (Chennai)" |
| `lat`, `lon` | `double precision` | Birth-city coordinates |
| `tz` | `double precision` | UTC offset used at birth |
| `tz_name` | `text` | IANA zone, e.g. `Asia/Kolkata` |
| `created_at` | `timestamptz` | default `now()` |

**RLS:** full CRUD, but every policy (`select`/`insert`/`update`/`delete`) requires
`user_id = requesting_user_id()`. No readings are stored — the client recomputes them from
the engine every time, using these birth details as input.

### `enquiries` — jathagam consultation requests

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | |
| `ref` | `text`, unique | e.g. `NN-20260722-K4T9` |
| `user_id` | `text`, nullable | Clerk user id, or null for guests |
| `name`, `email` | `text` | Required |
| `phone`, `dob`, `tob`, `city_label`, `message` | | Optional |
| `consent` | `boolean`, default `false` | |
| `status` | `text`, default `'new'` | `new \| contacted \| closed` |
| `created_at` | `timestamptz` | |

**RLS:** `insert with check (true)` — anyone, signed in or guest, can submit. **No select
policy exists**, so nobody can read enquiries back through the public API; you read them
with the service_role key or the Supabase SQL editor/table view.

### `feedback` — the floating feedback widget

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | |
| `user_id` | `text`, nullable | Clerk user id, or null for guests |
| `category` | `text` | `feature_feedback \| feature_request \| content \| bug \| other` |
| `rating` | `smallint`, nullable | 1–5 |
| `message` | `text` | Required |
| `email` | `text`, nullable | Only if a guest chose to include it |
| `page`, `lang` | `text` | |
| `created_at` | `timestamptz` | |

**RLS:** same pattern as `enquiries` — insert-only for everyone, no public select.

---

## 7. Authentication

- **Provider:** Clerk, production instance. The Frontend API domain is
  `clerk.yournallaneram.com` (a CNAME you point at Clerk — see §11), encoded inside the
  `pk_live_...` publishable key in `index.html`'s `NN_CONFIG`.
- **Sign-in method:** Google only (custom OAuth), configured in the Clerk Dashboard under
  **SSO connections**. Apple was disabled and Facebook has not yet been enabled (see the
  Clerk Dashboard for current state — this is dashboard configuration, not code).
- **Flow (`lib/nn-account.js`):**
  1. `nnInit()` loads the Clerk browser bundle from the Frontend API domain (a generic CDN
     URL won't self-initialize `window.Clerk`), calls `clerk.load()`, then creates a
     Supabase client whose `accessToken` callback returns a fresh Clerk session token
     (`nnToken()` → `clerk.session.getToken()`) on every request.
  2. `nnSignIn()` opens Clerk's hosted sign-in widget (`clerk.openSignIn()`).
  3. On successful sign-in, `nnOnAuthChange()` fires, the site calls `refreshAccountUI()`,
     which re-reads Pro status and reloads family profiles.
- **Trust bridge to Supabase:** Supabase is configured with Clerk as a **third-party auth**
  provider (Supabase Dashboard → Authentication → Third-party Auth → paste Clerk's domain,
  or via Clerk's own Supabase integration). This makes Supabase accept and verify Clerk's
  JWT directly — the token's `sub` claim becomes `auth.jwt() ->> 'sub'` inside Postgres,
  which is exactly what `public.requesting_user_id()` reads. No Supabase Auth users ever
  exist; Supabase is purely a trusting database.
- **Server-side verification:** every `api/*.js` function that needs the caller's identity
  (`create-checkout-session.js`, `portal-session.js`, `start-trial.js`) calls
  `verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY })` from `@clerk/backend`
  on the `Authorization: Bearer <token>` header, and reads the user id from `claims.sub`.

---

## 8. Trial & billing

### The 30-day card-less trial
- Started by `nnStartTrial()` (browser) → `POST /api/start-trial` (server).
- **Server-authoritative:** the trial's end date is computed and stored server-side
  (`current_period_end = now + TRIAL_DAYS days`, default 30, overridable via the
  `TRIAL_DAYS` env var). The browser cannot forge or extend it.
- **One trial per user:** if a `subscriptions` row already has `trial_started_at` set, or
  its status is already `trialing`/`active`, the endpoint returns `{ ok:true, already:true }`
  and does not restart the trial — even if the row was originally created empty (e.g. by
  `create-checkout-session.js` creating a Stripe customer first).
- No card is collected. No Stripe object is created for the trial itself.

### Trial vs paid state
`nnTrialInfo()` (browser) reads the same `subscriptions` row and derives a UI-friendly
state: `none | trialing | expired | active`, plus `daysLeft` when trialing. The gating
functions (`isPro()`, `proAllow`, `openPaywall`, the chandrashtamam exact-time mask, the
family-plan tab) all key off the single boolean `nnIsPro()` — true whenever `status` is
`active` or `trialing` **and** `current_period_end` hasn't passed. This is computed
identically server-side by the SQL `is_pro()` function, so there is one definition of
"Pro" shared by the app and the database.

### Going paid
```
Browser ──(Clerk JWT)──▶ POST /api/create-checkout-session
                          ├─ verify JWT → Clerk user id
                          ├─ find-or-create Stripe customer, remembered as
                          │  subscriptions.stripe_customer_id (metadata: clerk_user_id)
                          └─ create a Stripe Checkout Session
                             (mode: subscription, price: STRIPE_PRICE_ID,
                              automatic_tax: on, consent_collection: ToS required)
        ◀── { url } ── redirect the browser to Stripe-hosted Checkout

Stripe ──(webhook: checkout.session.completed /
           customer.subscription.created|updated|deleted)──▶ POST /api/stripe-webhook
                          ├─ verify the Stripe signature (raw body, STRIPE_WEBHOOK_SECRET)
                          ├─ resolve clerk_user_id from the subscription's (or its
                          │  customer's) metadata
                          └─ upsert subscriptions(user_id, stripe_customer_id,
                             stripe_subscription_id, status, price_id,
                             current_period_end, cancel_at_period_end)
```
The webhook is the **only** writer of paid subscription state — the browser never sets
Pro on its own. Card-less trials are the one exception, written directly by
`api/start-trial.js` under the same table.

Managing/cancelling goes through `POST /api/portal-session`, which opens the Stripe Billing
Portal for the user's existing `stripe_customer_id`; cancellation flows back through the
same webhook.

### Trial-reminder cron
`api/trial-reminder.js` runs daily (see `vercel.json`, schedule `0 14 * * *`). It:
1. Requires a matching `CRON_SECRET` (via `Authorization: Bearer` or `?key=`) if one is set.
2. No-ops with `200 { skipped: ... }` if `RESEND_API_KEY` isn't configured yet.
3. Queries `subscriptions` for `status = 'trialing'`, `reminder_sent = false`, and
   `current_period_end` within `TRIAL_WARN_DAYS` (default 5) of now, still in the future.
4. Looks up each user's email via the Clerk Backend SDK, sends a Resend email, and marks
   `reminder_sent = true` so it's a one-time notice per trial.

---

## 9. Environment variables

All names come from `.env.example` and the `process.env.*` reads inside `api/*.js`. **No
values are recorded here** — see `CREDENTIALS.template.md` for where to keep your own copies.

| Variable | Purpose | Obtained from | Exposure |
|---|---|---|---|
| `PUBLIC_SITE_URL` | Base URL used in Stripe success/cancel/return URLs and email links | Your deployed domain | Server-only (not injected into the browser; the browser's own `NN_CONFIG` is set separately in `index.html`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Clerk Dashboard → API Keys | **Public** — also hard-coded into `index.html`'s `NN_CONFIG.clerkPublishableKey` |
| `CLERK_SECRET_KEY` | Verifies Clerk session JWTs server-side; fetches user records for the trial-reminder email | Clerk Dashboard → API Keys | Server-only |
| `SUPABASE_URL` | Supabase project URL | Supabase → Settings → API | **Public** — also in `NN_CONFIG.supabaseUrl` |
| `SUPABASE_ANON_KEY` | Anon (RLS-restricted) Supabase key used by the browser | Supabase → Settings → API | **Public** — also in `NN_CONFIG.supabaseAnonKey` |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS; used by every `api/*.js` that writes `subscriptions` | Supabase → Settings → API | **Server-only — guard this closely** |
| `STRIPE_SECRET_KEY` | All Stripe API calls (Checkout, Billing Portal, subscription lookups) | Stripe Dashboard → Developers → API keys | Server-only |
| `STRIPE_WEBHOOK_SECRET` | Verifies the Stripe webhook's signature | Stripe Dashboard → Developers → Webhooks → your endpoint | Server-only |
| `STRIPE_PRICE_ID` | The recurring price object charged at checkout | Stripe Dashboard → Product catalog | Server-only |
| `TRIAL_DAYS` | Length of the card-less trial (default 30 if unset) | You choose | Server-only |
| `TRIAL_WARN_DAYS` | Days-before-end the reminder email fires (default 5 if unset) | You choose | Server-only |
| `RESEND_API_KEY` | Sends feedback-notify and trial-reminder emails; both features no-op cleanly if unset | Resend Dashboard → API Keys | Server-only |
| `FEEDBACK_WEBHOOK_SECRET` | Shared secret the Supabase Database Webhook must present to `/api/feedback-notify` | You choose (random string) | Server-only |
| `FEEDBACK_NOTIFY_EMAIL` | Where feedback emails are sent (defaults to `nallaneramapp@gmail.com` if unset) | You choose | Server-only |
| `CRON_SECRET` | Restricts `/api/trial-reminder` to Vercel Cron (or you) | You choose (random string) | Server-only |

---

## 10. Serverless functions & cron

All functions live under `api/` and deploy automatically as individual Vercel serverless
functions (`vercel.json` gives each 1024 MB memory, 10s max duration).

| Route | Method | Auth | What it does |
|---|---|---|---|
| `/api/create-checkout-session` | POST | Clerk JWT (`Authorization: Bearer`) | Finds/creates a Stripe customer for the signed-in user, creates a subscription Checkout Session (`STRIPE_PRICE_ID`, automatic tax, ToS consent required), returns `{ url }` to redirect to |
| `/api/portal-session` | POST | Clerk JWT | Opens a Stripe Billing Portal session for the user's existing Stripe customer, returns `{ url }` |
| `/api/start-trial` | POST | Clerk JWT | Starts the 30-day card-less trial once per user; server sets and owns `current_period_end` |
| `/api/stripe-webhook` | POST | Stripe signature (`stripe-signature` header + `STRIPE_WEBHOOK_SECRET`); raw body (Vercel body-parser disabled) | Listens for `checkout.session.completed`, `customer.subscription.created\|updated\|deleted`; upserts the `subscriptions` row — the sole writer of paid status |
| `/api/trial-reminder` | GET or POST | `CRON_SECRET` (via header or `?key=`) if set | Daily job: emails members whose trial ends within `TRIAL_WARN_DAYS` and haven't been reminded yet |
| `/api/feedback-notify` | POST | `FEEDBACK_WEBHOOK_SECRET` (via header) if set | Called by a Supabase Database Webhook on `insert` to `public.feedback`; emails the submission to `FEEDBACK_NOTIFY_EMAIL` |
| `/api/ics` | GET (primary) / POST (fallback) | None (public) | Echoes a base64-encoded `.ics` payload back with `Content-Type: text/calendar` and `Content-Disposition: inline`, so iOS Safari's native "Add to Calendar" sheet opens reliably; validates the payload starts with `BEGIN:VCALENDAR` and caps size at 200 KB |

**Cron:** `vercel.json` schedules `/api/trial-reminder` for `0 14 * * *` (14:00 UTC, daily).

---

## 11. Deployment

### Normal flow
```
Edit code locally (or via Claude Code)
        │
        ▼
git add / git commit
        │
        ▼
git push origin main
        │
        ▼
Vercel detects the push → builds (no build step needed, it's static +
serverless functions) → deploys automatically to production
```
There is no staging environment configured in this repo — every push to `main` deploys to
production. If you want a safety net, open a PR / push to a different branch first; Vercel
will create a preview deployment for it instead of touching production.

### Domain & DNS (Namecheap)
The apex domain and `www` both point at Vercel; Clerk's Frontend API is served from a
`clerk.` subdomain via CNAME (Clerk's "Deploy production" screen shows the exact 5 CNAME
targets/hosts for your instance — copy them from there, since they're unique per Clerk
project); Google Search Console verification is a TXT record on the apex, shown when you
add the domain as a property.

| Type | Host | Value | Purpose |
|---|---|---|---|
| A | `@` | `216.198.79.1` | Vercel apex domain |
| CNAME | `www` | (Vercel's assigned target, shown in Vercel → Domains) | `www.yournallaneram.com` |
| CNAME | `clerk` | (from Clerk Dashboard → Domains) | Clerk Frontend API (`clerk.yournallaneram.com`) |
| CNAME | `accounts` | (from Clerk Dashboard → Domains) | Clerk Account Portal |
| CNAME | `clkmail` | (from Clerk Dashboard → Domains) | Clerk email sending |
| CNAME | `clk._domainkey` | (from Clerk Dashboard → Domains) | Clerk DKIM |
| CNAME | `clk2._domainkey` | (from Clerk Dashboard → Domains) | Clerk DKIM |
| TXT | `@` (or as shown) | (from Google Search Console → domain property verification) | Search Console ownership |

Vercel → **Domains**: the primary domain is set to `www.yournallaneram.com` with the apex
redirecting to it (matches the canonical URL and `og:url` baked into `index.html`).

### Rollback
Vercel → your project → **Deployments** → find the last-known-good deployment → **⋯ →
Promote to Production**. This is instant and doesn't require a `git revert`, though doing
a proper revert commit afterward keeps `main` consistent with what's live.

---

## 12. Third-party dashboards

| Service | Console URL | What you manage there |
|---|---|---|
| Namecheap | https://ap.www.namecheap.com | Domain registration, DNS records |
| GitHub | https://github.com | Source repo, commit history, pushes trigger deploys |
| Vercel | https://vercel.com/dashboard | Hosting, environment variables, domains, deployments, cron |
| Clerk | https://dashboard.clerk.com | Auth: sign-in providers (Google/Facebook/etc.), domains/CNAMEs, users, sessions |
| Supabase | https://supabase.com/dashboard | Postgres tables, RLS policies, SQL editor, Database Webhooks, API keys |
| Stripe | https://dashboard.stripe.com | Products/prices, Checkout, webhooks, billing portal settings, Tax, payouts |
| Google Cloud Console | https://console.cloud.google.com | OAuth client (Google sign-in credentials used by Clerk), GA4 property admin |
| Google Search Console | https://search.google.com/search-console | Domain property, sitemap submission, indexing requests, search performance |
| Resend | https://resend.com/overview | Sending domain verification, API keys, email logs |
| Instagram | https://instagram.com/nallaneramapp | The `@nallaneramapp` account linked from the site footer/JSON-LD `sameAs` |

---

## 13. SEO

- **Search Console:** a **domain property** (not just a URL-prefix property) verified via
  the DNS TXT record above — this covers `yournallaneram.com`, `www.`, and any future
  subdomain in one property.
- **`sitemap.xml`** (repo root): lists `/` (daily priority, changefreq daily) and
  `/legal.html` (monthly). Submit it once in Search Console → Sitemaps →
  `https://www.yournallaneram.com/sitemap.xml`; Google re-crawls it periodically after that.
- **`robots.txt`** (repo root): allows all crawlers, points to the sitemap.
- **`index.html` `<head>`** carries:
  - `<title>`, `<meta name="description">`, `<link rel="canonical">`, `<meta name="robots"
    content="index, follow, max-image-preview:large">`, `<meta name="keywords">`.
  - Open Graph (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`,
    `og:image` → `og-image.png`, `og:locale` ta_IN / en_US alternate) and Twitter Card
    (`summary_large_image`) tags for rich link previews.
  - A JSON-LD `@graph` with `WebSite`, `Organization` (name "Ungal Nalla Neram", `sameAs`
    the Instagram profile) and `WebApplication` (free + Pro `Offer`) entries, so search
    engines can understand the site as an entity, not just a page.
- **Requesting indexing after a change:** Search Console → **URL Inspection** → paste the
  changed URL → **Request Indexing**. Use sparingly (it's rate-limited); routine content
  changes (daily panchangam) don't need this — only structural changes to `index.html` or
  new pages do.

---

## 14. Operations runbook

**Deploy a change**
1. Edit the file(s).
2. `git add <files>`, `git commit -m "..."`, `git push`.
3. Vercel auto-deploys; watch the deployment in the Vercel dashboard if you want to confirm
   it went green.

**View feedback submissions**
Supabase Dashboard → **Table Editor** → `feedback` table (or SQL Editor:
`select * from public.feedback order by created_at desc;`). If `RESEND_API_KEY` and a
Supabase Database Webhook on `insert` are configured, you also get an email per submission
via `api/feedback-notify.js` — see §14 "turn on email" below for the exact webhook setup.

**View jathagam enquiries**
Same pattern: Supabase Dashboard → Table Editor → `enquiries`, or
`select * from public.enquiries order by created_at desc;`. There's no email notifier for
enquiries in this repo yet (only feedback has one) — add one the same way as
`feedback-notify.js` if you want it, or check the table manually/periodically.

**See who's on trial vs paid**
```sql
select user_id, status, current_period_end, cancel_at_period_end
from public.subscriptions
order by updated_at desc;
```
`status = 'trialing'` with a future `current_period_end` = on the card-less trial.
`status = 'active'` = paying. `status = 'past_due'` or `'canceled'` needs attention.

**Turn on the trial-reminder email**
1. Create a Resend account, verify a sending domain (so `from:` isn't flagged as spam).
2. Add `RESEND_API_KEY` in Vercel → Settings → Environment Variables.
3. Redeploy (env var changes need a redeploy to take effect — see §15).
4. The existing daily cron (`vercel.json`) will pick it up automatically; no code change.

**Turn on feedback-submission email**
1. Same `RESEND_API_KEY` as above (shared by both email features).
2. Set `FEEDBACK_WEBHOOK_SECRET` (any random string) and optionally
   `FEEDBACK_NOTIFY_EMAIL` in Vercel env vars. Redeploy.
3. Supabase Dashboard → Database → **Webhooks** → Create a new hook:
   - Table: `public.feedback`, Events: **Insert**
   - Type: HTTP Request → POST `https://www.yournallaneram.com/api/feedback-notify`
   - HTTP Headers: `Authorization: Bearer <FEEDBACK_WEBHOOK_SECRET>` (same value as the env var)

**Switch from card-less trial to live Stripe billing** (i.e. go live with real charges)
1. Stripe Dashboard: switch from Test mode to **Live mode** (top-left toggle).
2. Re-create the product/price in Live mode (`STRIPE_PRICE_ID` is mode-specific — test and
   live prices are different objects even with the same name/amount).
3. Re-copy the **live** `STRIPE_SECRET_KEY`.
4. Re-add the webhook endpoint in Live mode (`https://www.yournallaneram.com/api/stripe-webhook`,
   same events as before) and copy its **live** `STRIPE_WEBHOOK_SECRET`.
5. Confirm Stripe Tax is on and your origin address is set (Settings → Tax).
6. Update all three `STRIPE_*` env vars in Vercel to the live values, redeploy.
7. Run a real end-to-end test: sign in, start trial or go straight to checkout, pay with a
   real card (or Stripe's live-mode test clock if available), confirm the webhook flips
   `subscriptions.status` correctly.

---

## 15. Troubleshooting

- **iOS "Add to Calendar" doesn't trigger / downloads a broken file.** iOS Safari won't
  reliably download a client-generated `.ics` Blob. The site must call the real
  `/api/ics` endpoint (GET, with the calendar text base64-encoded in `?c=`) so the response
  carries `Content-Type: text/calendar` and `Content-Disposition: inline`. This only
  happens when `window.NN_CONFIG.icsEndpoint === true` in `index.html` — confirm that flag
  is set and that `api/ics.js` is actually deployed (it's a normal function, no special
  config needed).
- **Users can sign in on localhost/preview but not production, or vice versa.** Clerk
  publishable/secret keys are environment-specific (`pk_test_...`/`sk_test_...` vs
  `pk_live_...`/`sk_live_...`). Using a dev key against the production Frontend API domain
  (or a live key locally) will fail sign-in silently or with a domain-mismatch error.
  Double-check `NN_CONFIG.clerkPublishableKey` in `index.html` and `CLERK_SECRET_KEY` in
  Vercel match the same Clerk **instance** (dev vs prod are separate instances in Clerk).
- **Family profiles / Pro status don't load after sign-in, but sign-in itself works.**
  Supabase must be pointed at the **production** Clerk issuer as its third-party auth
  provider — if Supabase's third-party auth is still wired to a dev Clerk instance (or not
  configured at all), every query gets rejected by RLS because `auth.jwt()` won't verify,
  and `requesting_user_id()` returns null. Check Supabase → Authentication → Third-party
  Auth → the Clerk domain entry matches your production Clerk instance's domain.
- **I changed an environment variable in Vercel and nothing changed.** Environment variable
  changes in Vercel do **not** apply to already-running deployments — you must trigger a
  new deployment (a new git push, or Vercel dashboard → Deployments → Redeploy) for it to
  take effect.
- **DNS/SSL just changed and things are broken.** DNS propagation can take anywhere from a
  few minutes to 48 hours depending on the record and resolver caching; Vercel's automatic
  SSL certificate provisioning also needs DNS to be correctly pointed first, and can take a
  few minutes after that to issue. Don't panic-change more records during this window —
  check propagation with a DNS checker before assuming a record is wrong.
- **A webhook (Stripe or Supabase) shows as failing.** Both `stripe-webhook.js` and
  `feedback-notify.js` require their respective secrets (`STRIPE_WEBHOOK_SECRET`,
  `FEEDBACK_WEBHOOK_SECRET`) to match exactly what's configured on the sending side — a
  mismatch fails signature/auth verification and returns 401/400. `feedback-notify.js`
  additionally no-ops (200, does nothing) if `RESEND_API_KEY` isn't set, so a "healthy" 200
  response there doesn't necessarily mean an email was sent — check for the `skipped` field
  in the response.

---

## 16. Legal & compliance

`legal.html` (linked from the site footer) contains four documents, all last updated
July 30, 2026:

- **Terms of Service** — acceptance, description of the Service (Thirukanitha/Drik Ganita
  method, cultural/informational purpose, not scientific fact), accounts (Google sign-in
  only, currently), one subscription per household (up to 6 devices), governing law
  (Ontario/Canada).
- **Privacy Policy** — PIPEDA-consistent, with GDPR/CCPA-CPRA provisions where applicable.
  Documents what's collected (account data via Google sign-in, family birth details,
  optional IP-based location, Stripe payment identifiers, Google Analytics usage data),
  sub-processors (Stripe, Clerk, Supabase, Vercel, Google Analytics, IP-geolocation
  providers), retention, rights, security, children's-data stance, CASL-compliant email
  practice, and cookies (essential + Google Analytics, no advertising trackers).
- **Refund & Cancellation Policy** — the 30-day card-less free trial (no charge, nothing to
  cancel), self-serve cancellation via the billing portal, a 14-day goodwill refund window
  for unintended renewal charges, and the EU/UK 14-day digital-content withdrawal-right
  waiver at checkout.
- **Astrology Disclaimer** — cultural/informational framing, not a substitute for
  professional medical/financial/legal/marital advice, timing may differ by minutes from
  other panchangams.

**Operator entity:** `legal.html` currently describes the operator only as *"a corporation
incorporated in Ontario, Canada"* without naming it — this is a deliberate placeholder.
**Before real payments go live**, this must be replaced with the actual registered
corporation name (and, per the Terms, the full legal name and mailing address should be
available on request at `nallaneramapp@gmail.com`). Have a Canadian lawyer review the whole
document at that point, per `START-HERE.md`'s pre-launch checklist.
