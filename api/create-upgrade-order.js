// Creates a Razorpay order to UPGRADE an existing paid purchase to a higher
// guide tier — the buyer pays only the DIFFERENCE. The amount is computed here
// on the server; the browser only sends its access token and the target tier.
//
// TIER_AMOUNT must stay in sync with create-order.js.
// Real launch amounts (paise): essential 29900, premium 69900, full 149900.
const TIER_AMOUNT = { essential: 100, premium: 200, full: 300 }; // TEST prices
const RANK = { essential: 1, premium: 2, full: 3 };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyId || !keySecret || !supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });

  const body = req.body || {};
  const token = body.token || '';
  const target = body.target || '';
  if (!token || !RANK[target]) return res.status(400).json({ error: 'bad_request' });

  try {
    const lookUrl = supaUrl + '/rest/v1/purchases?select=id,tier,status&access_token=eq.' + encodeURIComponent(token);
    const lookRes = await fetch(lookUrl, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const rows = await lookRes.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(403).json({ error: 'not_found' });
    const current = rows[0].tier || 'essential';
    if (rows[0].status !== 'paid' || !RANK[current]) return res.status(403).json({ error: 'not_eligible' });
    if (RANK[target] <= RANK[current]) return res.status(400).json({ error: 'not_higher' });

    const amount = TIER_AMOUNT[target] - TIER_AMOUNT[current];
    if (!(amount > 0)) return res.status(400).json({ error: 'bad_amount' });

    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + auth },
      body: JSON.stringify({ amount, currency: 'INR', receipt: 'upg_' + target + '_' + Date.now() }),
    });
    const order = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'razorpay_error' });

    // Record the intended upgrade ON the buyer's own row, so verify-upgrade can
    // only apply the tier fixed here — never one the browser claims later.
    const patch = await fetch(supaUrl + '/rest/v1/purchases?access_token=eq.' + encodeURIComponent(token), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: supaKey, Authorization: 'Bearer ' + supaKey, Prefer: 'return=minimal' },
      body: JSON.stringify({ pending_upgrade_order: order.id, pending_upgrade_tier: target }),
    });
    if (!patch.ok) return res.status(500).json({ error: 'store_failed' });

    return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId, target });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
