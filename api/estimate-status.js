// Lets a customer check their own graft-estimate request by its token —
// shows "pending" until the admin has sent a number.
module.exports = async (req, res) => {
  const token = (req.query && req.query.token) || '';
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) return res.status(400).json({ error: 'no_token' });
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });

  try {
    const url = supaUrl + '/rest/v1/graft_estimates?select=status,estimated_grafts,admin_note&access_token=eq.' + encodeURIComponent(token);
    const r = await fetch(url, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
