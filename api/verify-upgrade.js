// Verifies an upgrade payment and bumps the buyer's tier to the one fixed
// server-side in create-upgrade-order.js. The new tier comes from
// pending_upgrade_tier on the row — never from the browser.
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  const body = req.body || {};
  const token = body.token || '';
  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !orderId || !paymentId || !signature) return res.status(400).json({ ok: false, error: 'missing_fields' });
  if (!keySecret || !supaUrl || !supaKey) return res.status(500).json({ ok: false, error: 'not_configured' });

  const expected = crypto.createHmac('sha256', keySecret).update(orderId + '|' + paymentId).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ ok: false, error: 'invalid_signature' });

  try {
    const lookUrl = supaUrl + '/rest/v1/purchases?select=id,status,pending_upgrade_order,pending_upgrade_tier&access_token=eq.' + encodeURIComponent(token);
    const lookRes = await fetch(lookUrl, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const rows = await lookRes.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(403).json({ ok: false, error: 'not_found' });
    const row = rows[0];
    if (row.status !== 'paid' || row.pending_upgrade_order !== orderId || !row.pending_upgrade_tier) {
      return res.status(409).json({ ok: false, error: 'no_pending_upgrade' });
    }
    const newTier = row.pending_upgrade_tier;
    const patch = await fetch(supaUrl + '/rest/v1/purchases?access_token=eq.' + encodeURIComponent(token), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: supaKey, Authorization: 'Bearer ' + supaKey, Prefer: 'return=minimal' },
      body: JSON.stringify({ tier: newTier, pending_upgrade_order: null, pending_upgrade_tier: null, upgraded_at: new Date().toISOString() }),
    });
    if (!patch.ok) return res.status(500).json({ ok: false, error: 'store_failed' });
    return res.status(200).json({ ok: true, tier: newTier });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
