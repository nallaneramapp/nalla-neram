/* ============================================================
   nn-account.js — the browser side of accounts, Pro status & family data.
   Loads Clerk (auth) + Supabase (DB). Import once, early, in the site.

   Depends on two globals set in the page before this runs:
     window.NN_CONFIG = {
       clerkPublishableKey: 'pk_...',
       supabaseUrl:  'https://xxxx.supabase.co',
       supabaseAnonKey: 'eyJ...'
     }
   Loads Clerk from its CDN and @supabase/supabase-js (bundle or CDN).
   ============================================================ */

let clerk = null;       // window.Clerk instance
let supa  = null;       // Supabase client (token injected per-call)
let ready = null;       // promise that resolves once Clerk is loaded

/* ---- boot ---------------------------------------------------------------- */
export function nnInit() {
  if (ready) return ready;
  ready = (async () => {
    const cfg = window.NN_CONFIG || {};
    // 1. Clerk (vanilla JS build) — must be served from this instance's Frontend
    // API domain (encoded in the publishable key) so the bundle self-initializes
    // into window.Clerk. A generic CDN URL (e.g. jsdelivr) never sets window.Clerk.
    const frontendApi = atob(cfg.clerkPublishableKey.replace(/^pk_(test|live)_/, '')).replace(/\$$/, '');
    await loadClerkScript(`https://${frontendApi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`, cfg.clerkPublishableKey);
    clerk = window.Clerk;
    await clerk.load();
    // 2. Supabase client (expects the UMD global `supabase` from its CDN bundle)
    supa = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: false },                 // Clerk owns the session
      accessToken: async () => nnToken(),              // Supabase reads Clerk's token
    });
    return true;
  })();
  return ready;
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function loadClerkScript(src, publishableKey) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.setAttribute('data-clerk-publishable-key', publishableKey);
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

/* ---- auth ---------------------------------------------------------------- */
export function nnUser()      { return clerk?.user || null; }
export function nnSignedIn()  { return !!clerk?.user; }
export function nnSignIn()    { return clerk.openSignIn({ afterSignInUrl: location.href }); }
export function nnSignOut()   { return clerk.signOut(); }
export function nnManageAccount() { return clerk.openUserProfile(); }
/* Fresh Clerk token for API calls / Supabase. */
export async function nnToken() { return clerk?.session ? clerk.session.getToken() : null; }
/* Re-render the UI whenever auth changes. */
export function nnOnAuthChange(fn) { return clerk.addListener(() => fn(nnUser())); }

/* ---- Pro entitlement (server truth) ------------------------------------- */
/* Reads the subscriptions table. active|trialing (and not expired) ⇒ Pro. */
export async function nnIsPro() {
  if (!nnSignedIn()) return false;
  const { data, error } = await supa
    .from('subscriptions')
    .select('status,current_period_end')
    .eq('user_id', clerk.user.id)
    .maybeSingle();
  if (error || !data) return false;
  const live = ['active', 'trialing'].includes(data.status);
  const notExpired = !data.current_period_end || new Date(data.current_period_end) > new Date();
  return live && notExpired;
}

/* ---- card-less trial (server-authoritative; see api/start-trial.js) ------ */
export async function nnStartTrial() {
  if (!nnSignedIn()) return nnSignIn();
  const token = await nnToken();
  const r = await fetch('/api/start-trial', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Could not start trial');
  return j;
}
/* Trial/subscription state for the UI: { state: none|trialing|expired|active, daysLeft, end }. */
export async function nnTrialInfo() {
  if (!nnSignedIn()) return { state: 'none', daysLeft: null, end: null };
  const { data, error } = await supa
    .from('subscriptions')
    .select('status,current_period_end')
    .eq('user_id', clerk.user.id)
    .maybeSingle();
  if (error || !data) return { state: 'none', daysLeft: null, end: null };
  const end = data.current_period_end ? new Date(data.current_period_end) : null;
  const notExpired = !end || end > new Date();
  let state = 'none';
  if (data.status === 'trialing') state = notExpired ? 'trialing' : 'expired';
  else if (['active', 'past_due'].includes(data.status)) state = 'active';
  else if (data.status === 'canceled') state = 'expired';
  const daysLeft = (state === 'trialing' && end) ? Math.max(0, Math.ceil((end - Date.now()) / 86400000)) : null;
  return { state, daysLeft, end: end ? end.toISOString() : null };
}

/* ---- payments ------------------------------------------------------------ */
export async function nnStartCheckout() {
  if (!nnSignedIn()) return nnSignIn();               // must be signed in to pay
  const url = await postJSON('/api/create-checkout-session');
  if (url) location.href = url;                        // → Stripe hosted checkout
}
export async function nnOpenBillingPortal() {
  const url = await postJSON('/api/portal-session');
  if (url) location.href = url;
}
async function postJSON(path) {
  const token = await nnToken();
  const r = await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(path, j); alert(j.error || 'Something went wrong'); return null; }
  return j.url;
}

/* ---- family profiles (replaces localStorage loadProfiles/saveProfiles) --- */
export const nnProfiles = {
  async list() {
    if (!nnSignedIn()) return [];
    const { data } = await supa.from('profiles').select('*').order('created_at');
    return (data || []).map(r => (r.mode === 'star')
      ? { id: r.id, name: r.name, mode: 'star', nak: r.nak, rasi: r.rasi }
      : { id: r.id, name: r.name, dv: r.dob, tv: r.tob,
          pn: r.city_label, lat: r.lat, lon: r.lon, tz: r.tz, tzr: r.tz_name });
  },
  async add(p) {
    const row = { user_id: clerk.user.id, name: p.name };
    if (p.mode === 'star') {
      row.mode = 'star'; row.nak = p.nak; row.rasi = p.rasi;
    } else {
      row.mode = 'dob'; row.dob = p.dv; row.tob = p.tv;
      row.city_label = p.pn; row.lat = p.lat; row.lon = p.lon; row.tz = p.tz; row.tz_name = p.tzr;
    }
    const { data } = await supa.from('profiles').insert(row).select().single();
    return data;
  },
  async remove(id) { await supa.from('profiles').delete().eq('id', id); },
};

/* ---- jathagam enquiry (replaces the localStorage stub) ------------------- */
export async function nnSubmitEnquiry(rec) {
  // rec: { ref, name, email, phone, dob, tob, city_label, message, consent }
  const row = { ...rec, user_id: nnSignedIn() ? clerk.user.id : null };
  const { error } = await supa.from('enquiries').insert(row);
  if (error) throw error;
  // Email notification is sent by a Supabase DB webhook / edge function — see README.
  return true;
}

/* ---- feedback widget (replaces the localStorage fallback) ---------------- */
export async function nnSubmitFeedback(rec) {
  // rec: { category, rating, message, email, page, lang }
  const row = { ...rec, user_id: nnSignedIn() ? clerk.user.id : null };
  const { error } = await supa.from('feedback').insert(row);
  if (error) throw error;
  return true;
}
