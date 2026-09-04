// Stores a paid "Clinic Check" booking. Only someone holding a valid, paid
// clinic_check access token can submit — mirrors submit-estimate.js security.
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = req.body || {};
  const purchaseToken = body.token || '';
  const name   = (body.name   || '').toString().slice(0, 100);
  const phone  = (body.phone  || '').toString().slice(0, 20);
  const city   = (body.city   || '').toString().slice(0, 100);
  const clinic = (body.clinic || '').toString().slice(0, 200);
  const clinic_link = (body.clinic_link || '').toString().slice(0, 300);
  const note   = (body.note   || '').toString().slice(0, 1000);

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!purchaseToken || !name || !phone) return res.status(400).json({ error: 'missing_fields' });
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });

  try {
    const checkUrl = supaUrl + '/rest/v1/purchases?select=tier,status&access_token=eq.' + encodeURIComponent(purchaseToken);
    const checkRes = await fetch(checkUrl, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const rows = await checkRes.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(403).json({ error: 'not_found' });
    const purchase = rows[0];
    if (purchase.status !== 'paid' || purchase.tier !== 'clinic_check') return res.status(403).json({ error: 'not_eligible' });

    const bookingToken = crypto.randomBytes(24).toString('hex');
    const insertRes = await fetch(supaUrl + '/rest/v1/clinic_checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supaKey, Authorization: 'Bearer ' + supaKey, Prefer: 'return=minimal' },
      body: JSON.stringify({ access_token: bookingToken, purchase_token: purchaseToken, name, phone, city, clinic, clinic_link, note, status: 'pending' }),
    });
    if (!insertRes.ok) return res.status(500).json({ error: 'store_failed' });
    return res.status(200).json({ ok: true, bookingToken });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
