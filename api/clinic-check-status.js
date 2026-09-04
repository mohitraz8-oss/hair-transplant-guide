// Returns all clinic-check submissions for a paid Clinic Check purchase, with
// each one's status and your review comment. The browser only sends its token.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const token = (req.body && req.body.token) || '';
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) return res.status(400).json({ error: 'missing_token' });
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });
  try {
    const pRes = await fetch(supaUrl + '/rest/v1/purchases?select=tier,status&access_token=eq.' + encodeURIComponent(token), { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const pRows = await pRes.json();
    if (!Array.isArray(pRows) || pRows.length === 0 || pRows[0].status !== 'paid' || pRows[0].tier !== 'clinic_check') return res.status(403).json({ error: 'not_eligible' });
    const url = supaUrl + '/rest/v1/clinic_checks?select=clinic,city,clinic_link,note,status,admin_note,created_at&purchase_token=eq.' + encodeURIComponent(token) + '&order=created_at.desc';
    const r = await fetch(url, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const rows = await r.json();
    return res.status(200).json({ ok: true, reviews: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
