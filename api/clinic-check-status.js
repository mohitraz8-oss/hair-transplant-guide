// Returns all clinic-check submissions for a customer, across ALL their paid
// Clinic Check purchases (each clinic review is a separate paid purchase).
// The browser sends the list of its purchase tokens.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = req.body || {};
  let tokens = [];
  if (Array.isArray(body.tokens)) tokens = body.tokens.filter(Boolean).slice(0, 50);
  else if (body.token) tokens = [body.token];
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (tokens.length === 0) return res.status(400).json({ error: 'missing_token' });
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });
  const headers = { apikey: supaKey, Authorization: 'Bearer ' + supaKey };
  try {
    const all = [];
    for (const tok of tokens) {
      const pRes = await fetch(supaUrl + '/rest/v1/purchases?select=tier,status&access_token=eq.' + encodeURIComponent(tok), { headers });
      const pRows = await pRes.json();
      if (!Array.isArray(pRows) || pRows.length === 0 || pRows[0].status !== 'paid' || pRows[0].tier !== 'clinic_check') continue;
      const r = await fetch(supaUrl + '/rest/v1/clinic_checks?select=access_token,clinic,city,clinic_link,note,status,admin_note,created_at&purchase_token=eq.' + encodeURIComponent(tok) + '&order=created_at.desc', { headers });
      const rows = await r.json();
      if (Array.isArray(rows)) for (const row of rows) { const { access_token, ...rest } = row; all.push({ token: access_token, ...rest }); }
    }
    all.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return res.status(200).json({ ok: true, reviews: all });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
