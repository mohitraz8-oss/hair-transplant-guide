// Lets a customer delete one of their own clinic-check submissions.
// They send the list of their purchase tokens + the booking's token; we only
// delete if that booking actually belongs to one of their purchases.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = req.body || {};
  const bookingToken = body.bookingToken || '';
  let tokens = Array.isArray(body.tokens) ? body.tokens.filter(Boolean).slice(0, 50) : (body.token ? [body.token] : []);
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!bookingToken || tokens.length === 0) return res.status(400).json({ error: 'missing_fields' });
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });
  const headers = { apikey: supaKey, Authorization: 'Bearer ' + supaKey };
  try {
    const look = await fetch(supaUrl + '/rest/v1/clinic_checks?select=purchase_token&access_token=eq.' + encodeURIComponent(bookingToken), { headers });
    const rows = await look.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'not_found' });
    if (!tokens.includes(rows[0].purchase_token)) return res.status(403).json({ error: 'not_owner' });
    const del = await fetch(supaUrl + '/rest/v1/clinic_checks?access_token=eq.' + encodeURIComponent(bookingToken), { method: 'DELETE', headers: Object.assign({ Prefer: 'return=minimal' }, headers) });
    if (!del.ok) return res.status(500).json({ error: 'delete_failed' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
