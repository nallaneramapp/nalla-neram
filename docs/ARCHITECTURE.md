# நல்ல நேரம் Pro — Backend Architecture

**Stack:** Vercel (hosting + serverless functions) · Clerk (auth) · Supabase (Postgres + row-level security) · Stripe (subscriptions + tax)

> Auth is **Clerk**; Supabase is **database only**. They connect via Clerk's Supabase
> integration — Clerk mints a token Supabase trusts, so RLS is keyed on the **Clerk user id**.

The astrology engine stays **100% client-side** — the panchangam, jathagam maths, chandrashtamam, tara balam and the "today for you" card all run in the browser exactly as they do in the HTML model. The backend does only four things:

1. **Identify the user** — Clerk auth via Google / Apple (OAuth).
2. **Know their subscription status** — a `subscriptions` row kept in sync by Stripe webhooks.
3. **Take payment** — Stripe Checkout (subscription, 7-day trial, Stripe Tax) + a customer portal for manage/cancel.
4. **Persist their data** — family `profiles` and jathagam `enquiries` in Postgres instead of localStorage.

---

## Data flow

### Sign-in
```
Browser ──(Sign in with Google/Apple)──▶ Clerk
        ◀──────── session (JWT) ────────
```
Clerk issues a JWT held in the browser. Every DB read/write and every call to a Vercel function carries it. Supabase is configured to trust Clerk's token, so row-level security (RLS) — keyed on the Clerk user id in the token's `sub` claim — means a user can only ever touch their own rows, enforced by Postgres, not by our code.

### Going Pro
```
Browser ──(JWT)──▶ /api/create-checkout-session
                    ├─ verify JWT → get user id
                    ├─ find or create Stripe customer (store stripe_customer_id)
                    └─ create Checkout Session (price=CA$9.99/yr, trial=7d, tax=auto)
        ◀── { url } ──  redirect to Stripe-hosted checkout
```
The user pays on Stripe's own page (PCI handled by Stripe — no card data ever touches us).

### Entitlement (the important part)
```
Stripe ──(webhook: subscription created/updated/deleted)──▶ /api/stripe-webhook
                    ├─ verify Stripe signature
                    └─ upsert subscriptions(user_id, status, current_period_end)

Browser: nnIsPro()  ──▶ SELECT status FROM subscriptions WHERE user_id = me
                        → 'active' | 'trialing'  ⇒ Pro unlocked
```
**Truth lives on the server.** The browser never decides Pro status on its own — it reads it from a table Stripe keeps honest. This is what makes the paywall real rather than the localStorage demo in the HTML model.

### Manage / cancel
```
Browser ──▶ /api/portal-session ──▶ Stripe Billing Portal (update card, cancel)
```

---

## What replaces the HTML model's stubs

| HTML model (localStorage demo) | Production (this backend) |
|---|---|
| `startTrial()` sets `nnPro` in localStorage | `nnStartCheckout()` → Stripe Checkout |
| `isPro()` reads localStorage | `nnIsPro()` → async read of `subscriptions` |
| `loadProfiles()` / `saveProfiles()` localStorage | `nnProfiles.list/add/remove()` → `profiles` table |
| `submitEnquiry()` stores to localStorage | insert into `enquiries` table + email notify |
| license-key box | removed — entitlement is the subscription |

The gating logic (`proAllow`, `openPaywall`, the chandrashtamam mask, family-plan gate) stays exactly as built — only the *source of truth* for `isPro()` changes from localStorage to the `subscriptions` table.

---

## Free vs Pro is still enforced client-side, and that's fine

The free tier (panchangam, festivals, general chandrashtamam) needs no account and no server. Only the **Pro features** (exact chandrashtamam times, family plan) check `nnIsPro()`. Because the astrology maths is not secret — it's public tradition — there's no value in hiding it server-side. What we protect is the *subscription*, and that's server-truth via Stripe. This keeps the app fast, cheap, and offline-friendly for free users.

## Files
```
backend/
├─ ARCHITECTURE.md              ← this file
├─ README.md                    ← setup runbook (do this in order)
├─ .env.example                 ← required secrets
├─ vercel.json                  ← function + routing config
├─ supabase/
│  └─ schema.sql                ← tables + RLS policies (run in Supabase SQL editor)
├─ api/
│  ├─ create-checkout-session.js
│  ├─ stripe-webhook.js
│  └─ portal-session.js
└─ lib/
   └─ nn-account.js             ← client module (import into the site)
```
