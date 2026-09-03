// Verifies the Razorpay signature using the SECRET key (never exposed to the
// browser). Only a genuine, completed payment produces a matching signature.
// The tier being unlocked comes from the row create-order.js already wrote
// for this order_id — never from anything the browser sends here — so a
// person can't claim a higher tier than what they actually paid for.
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const body = req.body || {};
  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!orderId || !paymentId || !signature) return res.status(400).json({ ok: false, error: 'missing_fields' });
  if (!keySecret || !supaUrl || !supaKey) return res.status(500).json({ ok: false, error: 'not_configured' });

  const expected = crypto.createHmac('sha256', keySecret).update(orderId + '|' + paymentId).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(400).json({ ok: false, error: 'invalid_signature' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  try {
    // Update the row that create-order.js already created for this order_id.
    const r = await fetch(supaUrl + '/rest/v1/purchases?order_id=eq.' + encodeURIComponent(orderId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supaKey,
        Authorization: 'Bearer ' + supaKey,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ payment_id: paymentId, status: 'paid', access_token: token }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '(no body)');
      console.error('verify-payment: Supabase PATCH failed', r.status, errText, 'orderId=', orderId);
      return res.status(500).json({ ok: false, error: 'store_failed', detail: errText });
    }
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      console.error('verify-payment: no matching row for orderId=', orderId);
      return res.status(500).json({ ok: false, error: 'order_not_found' });
    }
    const tier = rows[0].tier || 'essential';
    return res.status(200).json({ ok: true, token, tier });
  } catch (e) {
    console.error('verify-payment: exception', e && e.message, e && e.stack);
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(e && e.message) });
  }
};
