# நல்ல நேரம் Pro — hand-off to Claude Code

This folder is the complete, deploy-ready project. The front-end is **done**; what
remains is account setup + deploy (needs your credentials).

## What's here
```
index.html            ← the whole site (panchangam engine + Pro app, bilingual)
legal.html            ← Terms · Privacy · Refunds · Disclaimer (fill the [brackets])
lib/nn-account.js     ← browser: Clerk auth, Pro status, profiles, checkout
api/                  ← Vercel serverless functions (Stripe checkout, webhook, portal)
supabase/schema.sql   ← run once in Supabase (tables + row-level security)
vercel.json  package.json  .env.example
README.md             ← THE RUNBOOK — do it in order
docs/ARCHITECTURE.md  ← how it all fits together
docs/WIRING.md        ← reference; the wiring is already applied in index.html
```

## Current state
- Runs as-is (open `index.html`) as a **demo**: free panchangam + festivals work fully,
  Pro unlocks locally so it's previewable. `window.NN_CONFIG.enabled` is `false`.
- Flip to real accounts/billing by setting `enabled: true` + your public keys in the
  `<head>` config block, then deploying with the secret keys in Vercel env vars.

## Do this (see README.md for detail)
1. **Supabase** → run `supabase/schema.sql`.
2. **Clerk** → enable Google + Apple; connect Clerk↔Supabase.
3. **Stripe** → create the CA$9.99/yr price with multi-currency amounts that **match
   the `NN_PRICES` table in index.html** (US $6.99, £5.99, €6.99, …); enable Stripe Tax;
   add the webhook; activate the billing portal.
4. **Vercel** → import repo, add all `.env.example` vars, deploy, point domain.
5. In `index.html`, set `NN_CONFIG.enabled: true` + paste the 3 public keys.

## Before launch — your two responsibilities
- **Legal:** have a Canadian lawyer review `legal.html` and fill every `[bracketed]` field
  (company name, address, business number, emails, dates).
- **Tax:** you are the merchant of record (Stripe). Stripe Tax calculates; you register
  and remit where you cross thresholds.
