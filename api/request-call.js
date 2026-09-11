// Lets a Premium or Full buyer share their name + phone so the owner can
// reach out personally (WhatsApp or call) — no personal number is ever
// shown on the public site. Requires their access token, so only someone
// who actually paid can submit.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = req.body || {};
  const token = body.token || '';
  const name = (body.name || '').toString().slice(0, 100);
  const phone = (body.phone || '').toString().slice(0, 20);
  const note = (body.note || '').toString().slice(0, 500);
  const city = (body.city || '').toString().slice(0, 100);
  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });

  // STATUS check — has this buyer already requested the clinic discount?
  if (body.action === 'status') {
    if (!token) return res.status(400).json({ error: 'missing_fields' });
    try {
      const sUrl = supaUrl + '/rest/v1/purchases?select=call_requested,call_note&access_token=eq.' + encodeURIComponent(token);
      const sRes = await fetch(sUrl, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
      const sRows = await sRes.json();
      const sp = Array.isArray(sRows) && sRows[0] ? sRows[0] : null;
      return res.status(200).json({ ok: true, requested: !!(sp && sp.call_requested), note: sp ? (sp.call_note || '') : '' });
    } catch (e) {
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (!token || !name || !phone) return res.status(400).json({ error: 'missing_fields' });

  try {
    // Only Premium/Full, paid purchases can submit — not Essential.
    const checkUrl = supaUrl + '/rest/v1/purchases?select=id,tier,status&access_token=eq.' + encodeURIComponent(token);
    const checkRes = await fetch(checkUrl, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const rows = await checkRes.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(403).json({ error: 'not_found' });
    const purchase = rows[0];
    if (purchase.status !== 'paid' || purchase.tier === 'essential') {
      return res.status(403).json({ error: 'not_eligible' });
    }

    const updateRes = await fetch(supaUrl + '/rest/v1/purchases?access_token=eq.' + encodeURIComponent(token), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supaKey,
        Authorization: 'Bearer ' + supaKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        call_requested: true,
        call_note: note,
        call_requested_at: new Date().toISOString(),
        contact_name: name,
        contact_phone: phone,
        contact_city: city,
      }),
    });
    if (!updateRes.ok) return res.status(500).json({ error: 'store_failed' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
