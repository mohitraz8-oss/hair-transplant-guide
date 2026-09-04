// Returns the full guide content ONLY when the caller presents an access token
// that matches a paid purchase. The content itself lives in /lib and is never
// served as a public file. Also returns the tier and purchase date, so the
// frontend knows which extras (WhatsApp access, call request, graft
// estimate) to show, and how many WhatsApp-access days are left.
const guide = require('../lib/guide-content.js');

module.exports = async (req, res) => {
  const token = (req.query && req.query.token) || '';
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) return res.status(401).json({ error: 'no_token' });
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });

  try {
    const url = supaUrl + '/rest/v1/purchases?select=status,tier,created_at,call_requested&status=eq.paid&access_token=eq.' + encodeURIComponent(token);
    const r = await fetch(url, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(403).json({ error: 'not_paid' });
    const row = rows[0];
    const tier = row.tier || 'essential';
    const payload = {
      sections: guide.sections,
      tier,
      purchasedAt: row.created_at,
      callRequested: Boolean(row.call_requested),
    };
    // My Story (clinic, doctors, price) is a Premium+ unlock — never sent to Essential buyers.
    if (tier === 'premium' || tier === 'full') payload.myStory = guide.myStory || null;
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
