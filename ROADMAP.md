# Roadmap / parked features

## Real per-city eclipse circumstances (parked 2026-07-31)

**Current state:** `index.html` flags a solar/lunar eclipse on Amavasai/Pournami
days using a coarse *global* check — at the exact syzygy (new/full moon), if
the Moon's ecliptic latitude (`moonLat()`) falls within the classical eclipse
limits (±1.6° solar, ±1.2° lunar), the day is flagged as "an eclipse happens
somewhere on Earth." The single time shown is that syzygy instant, labelled
"Tithi ends / eclipse peak" — because for Amavasai/Pournami that boundary and
the syzygy are mathematically the same instant. See `eclipseNear()`,
`tithiStart()`/`tithiEnd`, and the `NN_OCCASIONS` entries for `solareclipse`/
`lunareclipse` (around `index.html` line ~1670 and ~2180).

**What it doesn't do:** confirm the eclipse is actually *visible* from the
selected city, or give real first-contact → maximum → last-contact local
times. The occasion-library text already discloses this and points users to
a dedicated eclipse tracker.

**Reference for what "done properly" looks like:** DrikPanchang
(drikpanchang.com/eclipse/solar-eclipse-date-time-duration.html) shows, per
city:
- **Eclipse Start Time / Maximum Eclipse Time / Eclipse End Time** (local,
  real first/peak/last contact — not just the syzygy instant)
- **Partial Eclipse Duration** and **Maximum Magnitude**
- **Sutak Begins/Ends** — traditional observance window: 12h before eclipse
  start for solar, 9h before for lunar, both ending when the eclipse ends
  (a separate, milder rule exists for children/elderly/sick — begins later)
- Whether the eclipse is visible from that city at all (not shown if not)

**Why it's a bigger lift than anything else added so far:** real contact
times require actual eclipse geometry (Besselian elements / shadow-cone
projection onto the observer's location — see Meeus, *Astronomical
Algorithms*, eclipse chapters), not just Sun/Moon ecliptic longitude at
syzygy. That in turn wants a more precise ephemeris than the current
Schlyter low-precision formulas (`sunPos()`, `moonLon()` in the `<ENGINE>`
block) — Schlyter's is fine for tithi/nakshatra/muhurta-level precision but
wasn't designed for shadow-geometry work. Needs validation against known
historical eclipses (the same approach used to validate `moonLat()` against
2015–2025 real eclipse dates should be repeated for contact-time accuracy).

**If/when this gets picked up:**
1. Decide precision bar — full Besselian-element eclipse geometry (accurate,
   more code) vs. a simplified local-circumstances approximation (less
   accurate near the visibility boundary, much less code).
2. Add per-city visibility check (many eclipses aren't visible from most
   cities — the UI needs to gracefully show "not visible from your city"
   rather than always printing three times).
3. Compute local first/max/last contact times.
4. Sutak begin/end as a fixed 12h/9h offset before eclipse start, ending at
   eclipse end (easy, once real start/end exist).
5. Update the `NN_OCCASIONS` eclipse writeups and the Special Days list
   (`renderSpecialDays()`) to show the new fields instead of the single
   "peak" line.
