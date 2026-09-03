// Creates a Razorpay order for one of the 3 fixed packages. The price for
// each tier is set HERE on the server — the browser only ever sends which
// tier was picked (e.g. "premium"), never the amount. This means a person
// can't tamper with the price by editing the page or the request.
//
// TEMPORARY TEST PRICES — ₹1 / ₹2 / ₹3 — for testing the full flow cheaply.
// Real prices to restore later: essential 19900 (₹199), premium 49900 (₹499), full 99900 (₹999).
const TIERS = {
  essential: { amount: 100, label: 'Essential' },
  premium:   { amount: 200, label: 'Premium' },
  full:      { amount: 300, label: 'Full' },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyId || !keySecret || !supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });

  const body = req.body || {};
  const tier = TIERS[body.tier] ? body.tier : 'essential'; // unknown/missing tier safely falls back
  const { amount } = TIERS[tier];

  try {
    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + auth },
      body: JSON.stringify({ amount, currency: 'INR', receipt: tier + '_' + Date.now() }),
    });
    const order = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'razorpay_error' });

    // Record the order + which tier it's for BEFORE payment happens. When the
    // payment is verified later, we look up this row by order_id — so the
    // tier that gets unlocked is whatever was fixed here, never whatever the
    // browser claims after the fact.
    const insertRes = await fetch(supaUrl + '/rest/v1/purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supaKey,
        Authorization: 'Bearer ' + supaKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ order_id: order.id, status: 'created', amount, tier }),
    });
    if (!insertRes.ok) return res.status(500).json({ error: 'store_failed' });

    // keyId is the public key — safe to send to the browser so checkout can open.
    return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, tier });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
