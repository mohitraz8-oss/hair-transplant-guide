// Returns all video-call bookings for a customer, across ALL their paid Video
// Call purchases. The browser sends its list of purchase tokens.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const body = req.body || {};
  let tokens = Array.isArray(body.tokens) ? body.tokens.filter(Boolean).slice(0, 50) : (body.token ? [body.token] : []);
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
      if (!Array.isArray(pRows) || pRows.length === 0 || pRows[0].status !== 'paid' || pRows[0].tier !== 'video_call') continue;
      const r = await fetch(supaUrl + '/rest/v1/video_calls?select=access_token,preferred_time,note,status,meet_link,admin_note,created_at&purchase_token=eq.' + encodeURIComponent(tok) + '&order=created_at.desc', { headers });
      const rows = await r.json();
      if (Array.isArray(rows)) for (const row of rows) { const { access_token, ...rest } = row; all.push({ token: access_token, ...rest }); }
    }
    all.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return res.status(200).json({ ok: true, calls: all });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
