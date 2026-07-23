# Wiring the HTML model to the backend

The gating **logic** in `NallaNeram-Pro-v18.html` stays. Only the source of truth
for Pro status and family data changes. Do this in Claude Code.

### 0. Load the config + module (in `<head>`, before the app script)
```html
<script>window.NN_CONFIG = {
  clerkPublishableKey: 'pk_live_...',
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'eyJ...'
};</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script type="module">
  import * as NN from '/lib/nn-account.js';
  window.NN = NN;               // expose to the app's non-module script
  NN.nnInit().then(() => { NN.nnOnAuthChange(()=>refreshAccountUI()); refreshAccountUI(); });
</script>
```

### 1. `isPro()` — becomes server truth
The app calls `isPro()` in several places (chandrashtamam mask, family gate,
`applyProState`). Make them read a cached async value:
```js
let _pro = false;
async function refreshAccountUI(){
  _pro = await window.NN.nnIsPro();
  applyProState(); refreshCurrent(); renderChandraOverview();
  if (window.NN.nnSignedIn()) { renderProfiles(); enhanceProfiles(); }
}
function isPro(){ return _pro; }          // replaces the localStorage version
```

### 2. `startTrial()` → real checkout
```js
function startTrial(){ window.NN.nnStartCheckout(); }   // was localStorage demo
```
On return from Stripe (`?checkout=success`), `refreshAccountUI()` picks up the new
`trialing` status. Add a "Manage subscription" button → `window.NN.nnOpenBillingPortal()`.

### 3. Family profiles → Supabase (async)
Replace the localStorage helpers. `loadProfiles()` is used synchronously by the
engine, so cache the list and re-render after load:
```js
let _profiles = [];
function loadProfiles(){ return _profiles; }            // engine reads the cache
async function reloadProfiles(){ _profiles = await window.NN.nnProfiles.list(); renderProfiles(); enhanceProfiles(); }
// addProfile(): after building `p`, call window.NN.nnProfiles.add(p).then(reloadProfiles)
// delProfile(i): window.NN.nnProfiles.remove(_profiles[i].id).then(reloadProfiles)
```

### 4. Enquiry → Supabase
In `submitEnquiry()`, after building `rec`, replace the localStorage write with:
```js
window.NN.nnSubmitEnquiry({
  ref, name, email, phone: v('ePhone'), dob: dob, tob: tob,
  city_label: place, message: v('eMsg'), consent: true
}).then(()=>{ /* show the existing success box */ });
```

### 5. Sign-in entry points
- Add a **Sign in** button (top bar) → `window.NN.nnSignIn()`.
- The family-plan tab should prompt sign-in if `!nnSignedIn()` before showing the form.
- `Go Pro` / paywall CTA: if signed out, `nnSignIn()`; if signed in, `nnStartCheckout()`.

### 6. Remove the license-key box
Entitlement is the subscription now — delete the `#keyBox` / `licActivate()` path.

That's the whole change surface. The panchangam, jathagam maths, chandrashtamam,
tara balam and the "today for you" card are untouched.
