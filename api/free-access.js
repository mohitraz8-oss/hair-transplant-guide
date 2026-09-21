// Free "trial" access for Essential: captures the visitor's name + phone (a
// lead), then creates a paid-status Essential row so the guide unlocks — no
// payment. The lead shows up in the CRM like any buyer. Phone is validated
// server-side so junk/typo numbers are rejected.
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const body = req.body || {};
  const name = (body.name || '').toString().trim().slice(0, 100);

  // Normalize + validate an Indian mobile number.
  let d = (body.phone || '').toString().replace(/\D/g, '');
  if (d.length === 12 && d.slice(0, 2) === '91') d = d.slice(2);
  if (d.length === 11 && d[0] === '0') d = d.slice(1);
  const validPhone =
    /^[6-9]\d{9}$/.test(d) &&        // 10 digits, starts 6-9
    !/^(\d)\1{9}$/.test(d) &&         // not all the same digit
    d !== '1234567890' && d !== '9876543210';
  if (name.length < 2 || !validPhone) return res.status(400).json({ ok: false, error: 'invalid' });

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) return res.status(500).json({ ok: false, error: 'not_configured' });

  const token = crypto.randomBytes(24).toString('hex');
  const orderId = 'free_' + token.slice(0, 16);

  try {
    const r = await fetch(supaUrl + '/rest/v1/purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supaKey,
        Authorization: 'Bearer ' + supaKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        order_id: orderId,
        tier: 'essential',
        status: 'paid',
        amount: 0,
        access_token: token,
        payment_id: 'FREE_TRIAL',
        contact_name: name,
        contact_phone: d,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '(no body)');
      console.error('free-access: insert failed', r.status, t);
      return res.status(500).json({ ok: false, error: 'store_failed' });
    }
    return res.status(200).json({ ok: true, token, tier: 'essential' });
  } catch (e) {
    console.error('free-access: exception', e && e.message);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
};
