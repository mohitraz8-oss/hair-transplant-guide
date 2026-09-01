# Hair Transplant Starter Guide — Setup

A real, paid digital product: Razorpay payment (verified on the server) + Supabase
records who paid + the 5 sections are delivered only after payment is confirmed.

## What's in this folder
- `index.html`  ............ the website (self-contained; no build step)
- `api/create-order.js` .... creates the ₹299 Razorpay order (server)
- `api/verify-payment.js` .. verifies the payment with your secret key (server)
- `api/content.js` ......... hands over the guide only to people who paid (server)
- `api/config.js` .......... tells the page if it's in test mode
- `lib/guide-content.js` ... the 5 sections (server-only, never public)
- `supabase.sql` ........... the one table to create in Supabase
- `package.json` ........... tells Vercel to use Node 20

## Deploy in 4 parts (do them in order)

### PART 1 — Put the code on GitHub
1. github.com → New repository → name it `hair-transplant-guide` → Create.
2. On the repo page: "uploading an existing file".
3. Drag in EVERYTHING from this folder, keeping the `api` and `lib` folders as folders.
4. Commit.

### PART 2 — Create the Supabase table
1. Open your Supabase project → SQL Editor → New query.
2. Paste the contents of `supabase.sql` → Run. You should see "Success".
3. Project Settings → API. Copy two things for Part 4:
   - Project URL  (looks like https://xxxx.supabase.co)
   - service_role key  (the SECRET one — NOT the anon key)

### PART 3 — Import into Vercel
1. Vercel → Add New → Project → import the `hair-transplant-guide` repo.
2. Framework Preset: Other. Don't change build settings.
3. Before deploying, open Environment Variables and add these 4:

   RAZORPAY_KEY_ID            = your rzp_test_... key id
   RAZORPAY_KEY_SECRET        = your razorpay key secret
   SUPABASE_URL               = your Supabase Project URL
   SUPABASE_SERVICE_ROLE_KEY  = your Supabase service_role key

4. Deploy. You get a link like hair-transplant-guide.vercel.app

### PART 4 — Test a real (test-mode) payment
1. Open your Vercel link. Click Get the Guide → Pay ₹299.
2. Razorpay opens. Use test card:
   Card: 4111 1111 1111 1111   Expiry: any future date   CVV: any 3 digits
   (or test UPI id: success@razorpay)
3. You should see "Payment successful" and the 5 sections unlock.
4. Check Supabase → Table editor → purchases: a new row with status = paid.

If that works, the whole system works.

## Going live (real money) — later
1. Finish Razorpay KYC (Business Category: Education). Takes ~24-48 hrs.
2. In Razorpay, switch to Live Mode → generate LIVE keys.
3. In Vercel, replace RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET with the live ones → redeploy.
Nothing else changes. The test-mode hint disappears automatically on live keys.

## Adding a video later (no redesign needed)
Edit `lib/guide-content.js`. Find a section's `"video"` and fill in:
   "url": "https://.../lesson.mp4", "thumbnail": "https://.../thumb.jpg", "duration": {"en":"3:42","hi":"3:42"}
Commit → Vercel redeploys → that section shows a real Watch button.

## Security reminders
- Never put RAZORPAY_KEY_SECRET or SUPABASE_SERVICE_ROLE_KEY in the code or in index.html.
  They belong ONLY in Vercel's Environment Variables.
- The anon Supabase key is not used here and not needed.
