# IQ Tester — Full Migration & Launch Checklist

**implementation note:** follow the plan first but be flexible to modify the plan to adapt to changes

## Phase 1 — Accounts & Infrastructure Setup
- [x] Create a Cloudflare account (free)
- [x] Create a Stripe account, get test mode API keys (publishable + secret)
- [x] In Stripe Dashboard, create 3 Payment Links for the three tiers ($5 Minimal, $10 Standard, $15 Advanced)
- [x] Set each Payment Link's success redirect URL to `https://yourdomain.com/accept_payment?stripe_session_token={CHECKOUT_SESSION_ID}`
- [x] Register a custom domain or decide on `*.pages.dev` subdomain
- [x] Set up Cloudflare Pages project connected to GitHub repo
- [x] Create a Cloudflare D1 database (`iq-tester-db`)
- [x] Run D1 schema creation:
  ```sql
  CREATE TABLE results (
    id TEXT PRIMARY KEY,
    score INTEGER,
    age INTEGER,
    submit_time INTEGER,
    payment_id TEXT UNIQUE,
    user_name TEXT,
    result_tier INTEGER
  );
  ```
- [x] Set Cloudflare Workers environment variables (encrypted secrets):
  - `STRIPE_API_KEY` — Stripe secret key
  - `TIER1_LINK_ID` — Stripe Payment Link ID for $5 tier
  - `TIER2_LINK_ID` — Stripe Payment Link ID for $10 tier
  - `TIER3_LINK_ID` — Stripe Payment Link ID for $15 tier
  - `TEMP_LINK_LIFETIME_HOURS` — e.g. `24`
  - `ADMIN_CONTACT` — email/contact for error messages
  - `SHARETHIS_ADDIN` — ShareThis script tag (or empty)

## Phase 2 — Restructure Repo for Static Deployment
- [x] Move `src/webroot/` contents to root-level `public/` (or configure Cloudflare Pages build output to `src/webroot`)
- [x] Create a static `payment_options.json` with the 3 Stripe Payment Link URLs, replacing the dynamic server route
- [x] Move `cert_assets/cert_tpl.jpg` into `public/assets/img/` for client-side Canvas cert generation
- [x] Move cert fonts (Lato-Black, Lato-Light, Lato-Regular .ttf) into `public/assets/fonts/`
- [x] Delete Python backend files no longer needed:
  - `src/server.py`
  - `src/start_local.py`
  - `src/bottle_app.py`
  - `src/storage.py`
  - `src/tester.py`
  - `src/util.py`
  - `requirements.txt`

## Phase 3 — Port IQ Scoring to Client-Side JavaScript
- [x] Port `CORRECT_ANSWERS` array (60 values) from `tester.py` to `tester.js`
- [x] Port `SCORE_TO_IQ_MAP` array from `tester.py` to `tester.js`
- [x] Port `get_iq_score(answers, age)` function to `tester.js` (array lookups + age brackets)
- [x] Call `get_iq_score()` after user enters age, embed score in cookie data alongside answers
- [x] **Security consideration:** with scoring client-side, users can inspect `CORRECT_ANSWERS` in JS source. Options:
  - Accept the risk (most IQ test sites do this)
  - Obfuscate the array (minimal deterrent)
  - Keep scoring server-side in the Worker only (users never see score until after payment)

## Phase 4 — Port Certificate Generation to Canvas API
- [x] Create `cert-generator.js` module with `generateCert(certId, userName, score, submitTime)`:
  - Load `cert_tpl.jpg` as a Canvas Image
  - Draw user name centered at y=740 (Lato-Light, ~160px)
  - Draw cert ID formatted `XXXX XXXX XXXX` at (495, 1580) (Lato-Regular, ~55px)
  - Draw score centered at y=1150 (Lato-Black, ~200px)
  - Draw formatted date centered at y=1410 (Lato-Light, ~75px)
- [x] Load `.ttf` fonts via CSS `@font-face` and reference by family name in `ctx.font`
- [x] Export Canvas to downloadable JPEG blob via `canvas.toBlob('image/jpeg')`
- [x] Wire up cert download button in the result view to trigger generation

## Phase 5 — Write Cloudflare Workers (Serverless Functions)

### 5A — `/accept_payment` Worker
- [ ] Create `functions/accept_payment.js`
- [ ] Port logic from `server.py` + `tester.py` `accept_payment()`:
  1. Read `stripe_session_token` from query string
  2. Read `tester_data` from cookie, JSON-parse it
  3. Call Stripe API via fetch: `GET https://api.stripe.com/v1/checkout/sessions/{id}` with `Authorization: Bearer STRIPE_API_KEY`
  4. Validate `status === "complete"` and `payment_status === "paid"`
  5. Check for duplicate payment in D1
  6. Compute score via `get_iq_score(answers, age)`
  7. Generate random 12-digit result ID, verify uniqueness in D1
  8. Insert result row into D1
  9. Redirect to `/result/tier-{tier}/{id}`
- [ ] Bind D1 database to the Worker in `wrangler.toml` or Pages settings

### 5B — `/result/` Worker (dynamic result pages with OG meta)
- [ ] Create `functions/result/[[path]].js`
- [ ] Port logic from `tester.py` `get_result_page()`:
  1. Look up result in D1 by ID
  2. Handle tier-1 expiry (compare `submit_time + TEMP_LINK_LIFETIME_HOURS` vs now)
  3. Build HTML with OG meta tags for social sharing
  4. Tier 1 & 2: render plain score HTML
  5. Tier 3: render cert image tag (pointing at Canvas generation or cached image)
- [ ] Embed `result_template.html` as template string or load from static assets
- [ ] Implement `sanitize_html()` (escape `&`, `<`, `>`)

### 5C — `/cert/` Worker (optional — for OG image support)
- [ ] **Decision point:** social media crawlers need a real image URL for `og:image`. Options:
  - (a) Skip OG cert images (social shares show text-only) → no Worker needed
  - (b) Pre-generate certs at payment time, store in Cloudflare R2 (10GB free) → `/cert/<id>` serves from R2
  - (c) Generate in Worker via Wasm image library (complex, not recommended)

## Phase 6 — Update Frontend JavaScript
- [ ] Ensure `tester_data` cookie has `SameSite=Lax; Path=/` so the Worker can read it after Stripe redirect
- [ ] Keep `load_payment_options()` pointing at the static `payment_options.json` file
- [ ] Fix CSS path in `result_template.html`: change `../../assets/css/main.css` to `/assets/css/main.css` (absolute)
- [ ] Add cert Canvas generation trigger on tier-3 result page
- [ ] Verify the `tester_data` cookie survives the Stripe redirect (cross-origin cookie issues)

## Phase 7 — Cloudflare Configuration & Deployment
- [ ] Create `wrangler.toml` in repo root with D1 binding
- [ ] Configure Pages build output directory
- [ ] Set Functions directory to `functions/`
- [ ] Add all secrets via `wrangler secret put STRIPE_API_KEY` (etc.)
- [ ] Deploy: `npx wrangler pages deploy public/`
- [ ] Configure custom domain in Cloudflare Pages dashboard
- [ ] Set Cloudflare SSL/TLS to Full (strict) if using custom domain

## Phase 8 — Stripe Production Setup
- [ ] Complete Stripe account verification (identity, bank details)
- [ ] Switch from test mode to live mode
- [ ] Create live Payment Links for all 3 tiers with real prices
- [ ] Update `payment_options.json` with live Payment Link URLs
- [ ] Update Worker env vars: replace `sk_test_*` with `sk_live_*`
- [ ] Update `TIER1_LINK_ID`, `TIER2_LINK_ID`, `TIER3_LINK_ID` with live IDs
- [ ] Test a real payment end-to-end, then refund via Stripe Dashboard

## Phase 9 — Testing & Hardening
- [ ] Full flow test: take test → enter age/name → pay with test card `4242 4242 4242 4242` → verify result page → verify score
- [ ] Test tier-1 expiry: set `TEMP_LINK_LIFETIME_HOURS=0`, verify "Result expired" shows
- [ ] Test duplicate payment protection: hit `/accept_payment` twice with same token
- [ ] Test shareable links: open `/result/tier-2/<id>` in incognito
- [ ] Test social sharing OG tags via Facebook Sharing Debugger / Twitter Card Validator
- [ ] Test certificate download (tier 3): compare Canvas output vs original Pillow version
- [ ] Test mobile flow (iPhone + Android)
- [ ] Add error handling in Workers: invalid Stripe sessions, malformed cookies, D1 failures
- [ ] Add `Content-Security-Policy` and security headers via `_headers` file

## Phase 10 — Cleanup & Launch
- [ ] Remove all Python files from repo
- [ ] Remove `src/result_template.html` (content embedded in Worker)
- [ ] Update `README.md` with new architecture and deployment instructions
- [ ] Set up Cloudflare Web Analytics (free) for traffic monitoring
- [ ] Switch Stripe to live mode
- [ ] Launch

---

## Non-Engineering Work

### Score Calibration
- [ ] Verify `CORRECT_ANSWERS` array against the original Raven's Progressive Matrices answer key
- [ ] Verify `SCORE_TO_IQ_MAP` lookup table accuracy — cross-reference with published norms
- [ ] Review age adjustment brackets (current: 30/35/40/45/50/55 cutoffs) against psychometric literature
- [ ] Decide whether age quotients (97/93/88/82/76/70) are appropriately calibrated
- [ ] Consider adding finer age brackets (e.g. 5-year intervals below 30)
- [ ] Test edge cases: all correct (score=140), all wrong (score=60), boundary ages
- [ ] Decide on minimum age limit (currently accepts any integer)
- [ ] Add disclaimer about score being an approximation, not a clinical diagnosis

### Permanent Link & Result Sharing
- [ ] Decide on URL structure for permanent links (current: `/result/tier-N/<12-digit-id>`)
- [ ] Verify 12-digit random IDs provide enough collision resistance at scale
- [ ] Decide result retention policy — how long to keep tier-2/tier-3 results in D1
- [ ] Decide whether to add a "delete my result" feature for privacy
- [ ] Design the social share preview (OG title, description, image)
- [ ] Test that shared links render correctly on Facebook, Twitter, LinkedIn, WhatsApp
- [ ] Consider adding a QR code to certificates for link verification

### Business Model & Pricing
- [ ] Review 3-tier pricing ($5 / $10 / $15) — is this competitive with similar IQ test sites?
- [ ] Research competitor pricing (e.g. IQTest.com, Mensa online tests, BrainMetrix)
- [ ] Consider adding a free tier (show score range only, e.g. "110–120") to drive conversions
- [ ] Consider A/B testing different price points
- [ ] Decide on refund policy and document it
- [ ] Decide whether to offer discount codes / promo links
- [ ] Consider subscription model (unlimited retakes for X/month) vs one-time payment
- [ ] Evaluate adding upsells (detailed report, percentile breakdown, PDF download)

### Legal & Compliance
- [ ] Add Terms of Service page
- [ ] Add Privacy Policy page (required if collecting names, ages, payment data)
- [ ] Add cookie consent banner (required in EU/UK)
- [ ] Ensure GDPR compliance for EU users (right to deletion, data export)
- [ ] Add disclaimer: "This is not a clinically administered IQ test"
- [ ] Review Stripe's requirements for your business category
- [ ] Check if "IQ test" services have any regulatory requirements in your target markets

### Content & UX Polish
- [ ] Proofread all user-facing text (instructions, payment options, result pages)
- [ ] Add a FAQ section
- [ ] Add a contact/support email
- [ ] Improve the payment options page — make the "Most Popular" tier more visually prominent
- [ ] Add testimonials or social proof (number of tests taken, average score, etc.)
- [ ] Consider adding a "retake test" flow
- [ ] Add loading/progress indicators during payment redirect
- [ ] Handle edge case: user closes browser during test and returns later

### Marketing & Growth
- [ ] SEO: add meta description, keywords, structured data (schema.org)
- [ ] SEO: target keywords like "free IQ test online", "Raven's Progressive Matrices test"
- [ ] Set up Google Search Console
- [ ] Create social media profiles for the brand
- [ ] Consider content marketing (blog posts about IQ, cognitive ability, etc.)
- [ ] Plan launch strategy (Product Hunt, Reddit, HackerNews, etc.)
- [ ] Set up email capture for marketing (optional newsletter)
- [ ] Track conversion funnel: visit → start test → finish → pay → share result
