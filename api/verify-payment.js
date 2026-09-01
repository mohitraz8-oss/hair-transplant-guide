// Verifies the Razorpay signature using the SECRET key (never exposed to the
// browser). Only a genuine, completed payment produces a matching signature.
// On success we store a random access token in Supabase and return it.
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
  // constant-time compare
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(400).json({ ok: false, error: 'invalid_signature' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  try {
    const r = await fetch(supaUrl + '/rest/v1/purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supaKey,
        Authorization: 'Bearer ' + supaKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ order_id: orderId, payment_id: paymentId, status: 'paid', access_token: token, amount: 29900 }),
    });
    if (!r.ok) return res.status(500).json({ ok: false, error: 'store_failed' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'store_failed' });
  }

  return res.status(200).json({ ok: true, token });
};
