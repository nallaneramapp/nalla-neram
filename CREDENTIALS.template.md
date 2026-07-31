> ⚠️ **Do NOT put real passwords/secrets in the repo.** Copy this file to
> `CREDENTIALS.local.md` (git-ignored) and fill it there, or store it in a password
> manager. **Never commit real values.**

# Ungal Nalla Neram — Credentials Vault (template)

Blank fill-in reference for every account, secret and DNS record this project depends on.
See `docs/MANUAL.md` for what each of these is actually used for.

---

## A) Accounts

| Service | Console URL | Login email/username | Password | 2FA / recovery notes |
|---|---|---|---|---|
| Namecheap (registrar) | https://ap.www.namecheap.com | ____ | ____ | ____ |
| Google account (nallaneramapp@gmail.com) | https://myaccount.google.com | nallaneramapp@gmail.com | ____ | ____ |
| GitHub | https://github.com | ____ | ____ | ____ |
| Vercel | https://vercel.com/dashboard | ____ | ____ | ____ |
| Clerk | https://dashboard.clerk.com | ____ | ____ | ____ |
| Supabase | https://supabase.com/dashboard | ____ | ____ | ____ |
| Stripe | https://dashboard.stripe.com | ____ | ____ | ____ |
| Google Cloud Console | https://console.cloud.google.com | ____ | ____ | ____ |
| Google Search Console | https://search.google.com/search-console | ____ | ____ | ____ |
| Resend | https://resend.com/overview | ____ | ____ | ____ |
| Instagram (@nallaneramapp) | https://instagram.com/nallaneramapp | ____ | ____ | ____ |
| Apple Developer (future) | https://developer.apple.com | ____ | ____ | ____ |

---

## B) Keys & secrets

<!-- The live values already live in Vercel env vars + the Clerk/Supabase/Stripe
     dashboards. This table is your personal offline backup only — keep it out of
     the repo (see the warning at the top of this file). -->

| Name | Where it lives | Value |
|---|---|---|
| Clerk `pk_live_...` | Vercel env `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and hard-coded in `index.html` `NN_CONFIG` | ____ |
| Clerk `sk_live_...` | Vercel env `CLERK_SECRET_KEY` | ____ |
| Supabase URL | Vercel env `SUPABASE_URL`, and `index.html` `NN_CONFIG` | ____ |
| Supabase anon key | Vercel env `SUPABASE_ANON_KEY`, and `index.html` `NN_CONFIG` | ____ |
| Supabase service_role key | Vercel env `SUPABASE_SERVICE_ROLE_KEY` | ____ |
| Stripe secret key | Vercel env `STRIPE_SECRET_KEY` | ____ |
| Stripe webhook secret | Vercel env `STRIPE_WEBHOOK_SECRET` | ____ |
| Stripe price ID | Vercel env `STRIPE_PRICE_ID` | ____ |
| Resend API key | Vercel env `RESEND_API_KEY` | ____ |
| `CRON_SECRET` | Vercel env `CRON_SECRET` | ____ |
| Google OAuth client ID | Clerk Dashboard → SSO connections → Google (custom credentials) | ____ |
| Google OAuth client secret | Clerk Dashboard → SSO connections → Google (custom credentials) | ____ |

---

## C) Key identifiers (safe to record)

| Item | Value |
|---|---|
| GitHub repo URL | https://github.com/nallaneramapp/nalla-neram |
| Vercel project name | ____ |
| Clerk domain | clerk.yournallaneram.com |
| Supabase project ref | apiluaxnapbnynrkhrtj |
| Primary domain | www.yournallaneram.com |
| Support email | nallaneramapp@gmail.com |

---

## D) DNS records (Namecheap)

Recovery reference — the unique per-account values (Clerk's 5 CNAME targets, the Google
Search Console TXT value) aren't recorded here since they aren't readable from the repo;
copy them from Clerk Dashboard → Domains and Google Search Console → domain-property
verification respectively, and fill them in below for your own backup.

| Type | Host | Value |
|---|---|---|
| A | @ | 216.198.79.1 |
| CNAME | www | ____ |
| CNAME | clerk | ____ |
| CNAME | accounts | ____ |
| CNAME | clkmail | ____ |
| CNAME | clk._domainkey | ____ |
| CNAME | clk2._domainkey | ____ |
| TXT | @ | ____ |
