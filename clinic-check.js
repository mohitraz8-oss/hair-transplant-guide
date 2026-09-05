// Clinic Check — one function handles submit, status and delete (action field).
const crypto = require('crypto');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = req.body || {};
  const action = body.action || 'submit';
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });
  const headers = { apikey: supaKey, Authorization: 'Bearer ' + supaKey };

  if (action === 'status') {
    let tokens = Array.isArray(body.tokens) ? body.tokens.filter(Boolean).slice(0, 50) : (body.token ? [body.token] : []);
    if (!tokens.length) return res.status(400).json({ error: 'missing_token' });
    try {
      const all = [];
      for (const tok of tokens) {
        const pRes = await fetch(supaUrl + '/rest/v1/purchases?select=tier,status&access_token=eq.' + encodeURIComponent(tok), { headers });
        const pRows = await pRes.json();
        if (!Array.isArray(pRows) || !pRows.length || pRows[0].status !== 'paid' || pRows[0].tier !== 'clinic_check') continue;
        const r = await fetch(supaUrl + '/rest/v1/clinic_checks?select=access_token,clinic,city,clinic_link,note,status,admin_note,created_at&purchase_token=eq.' + encodeURIComponent(tok) + '&order=created_at.desc', { headers });
        const rows = await r.json();
        if (Array.isArray(rows)) for (const row of rows) { const { access_token, ...rest } = row; all.push({ token: access_token, ...rest }); }
      }
      all.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      return res.status(200).json({ ok: true, reviews: all });
    } catch (e) { return res.status(500).json({ error: 'server_error' }); }
  }

  if (action === 'delete') {
    const bookingToken = body.bookingToken || '';
    let tokens = Array.isArray(body.tokens) ? body.tokens.filter(Boolean).slice(0, 50) : (body.token ? [body.token] : []);
    if (!bookingToken || !tokens.length) return res.status(400).json({ error: 'missing_fields' });
    try {
      const look = await fetch(supaUrl + '/rest/v1/clinic_checks?select=purchase_token&access_token=eq.' + encodeURIComponent(bookingToken), { headers });
      const rows = await look.json();
      if (!Array.isArray(rows) || !rows.length) return res.status(404).json({ error: 'not_found' });
      if (!tokens.includes(rows[0].purchase_token)) return res.status(403).json({ error: 'not_owner' });
      const del = await fetch(supaUrl + '/rest/v1/clinic_checks?access_token=eq.' + encodeURIComponent(bookingToken), { method: 'DELETE', headers: Object.assign({ Prefer: 'return=minimal' }, headers) });
      if (!del.ok) return res.status(500).json({ error: 'delete_failed' });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: 'server_error' }); }
  }

  // submit
  const purchaseToken = body.token || '';
  const name = (body.name || '').toString().slice(0, 100);
  const phone = (body.phone || '').toString().slice(0, 20);
  const city = (body.city || '').toString().slice(0, 100);
  const clinic = (body.clinic || '').toString().slice(0, 200);
  const clinic_link = (body.clinic_link || '').toString().slice(0, 300);
  const note = (body.note || '').toString().slice(0, 1000);
  if (!purchaseToken || !name || !phone) return res.status(400).json({ error: 'missing_fields' });
  try {
    const checkRes = await fetch(supaUrl + '/rest/v1/purchases?select=tier,status&access_token=eq.' + encodeURIComponent(purchaseToken), { headers });
    const rows = await checkRes.json();
    if (!Array.isArray(rows) || !rows.length) return res.status(403).json({ error: 'not_found' });
    if (rows[0].status !== 'paid' || rows[0].tier !== 'clinic_check') return res.status(403).json({ error: 'not_eligible' });
    const bookingToken = crypto.randomBytes(24).toString('hex');
    const insertRes = await fetch(supaUrl + '/rest/v1/clinic_checks', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, headers), body: JSON.stringify({ access_token: bookingToken, purchase_token: purchaseToken, name, phone, city, clinic, clinic_link, note, status: 'pending' }) });
    if (!insertRes.ok) return res.status(500).json({ error: 'store_failed' });
    return res.status(200).json({ ok: true, bookingToken });
  } catch (e) { return res.status(500).json({ error: 'server_error' }); }
};
