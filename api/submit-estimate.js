// Accepts a photo + name/phone from a Premium/Full buyer, uploads the photo
// to Supabase Storage, and creates a pending graft-estimate request. Only
// people who hold a valid, paid Premium/Full access token can submit.
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = req.body || {};
  const purchaseToken = body.token || '';
  const name = (body.name || '').toString().slice(0, 100);
  const phone = (body.phone || '').toString().slice(0, 20);
  const photoBase64 = body.photoBase64 || '';
  const mimeType = (body.mimeType || 'image/jpeg').toString();

  const supaUrl = process.env.SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!purchaseToken || !name || !phone || !photoBase64) return res.status(400).json({ error: 'missing_fields' });
  if (!supaUrl || !supaKey) return res.status(500).json({ error: 'not_configured' });
  // Keep uploads reasonable — ~8MB base64 ceiling (~6MB actual image).
  if (photoBase64.length > 8_000_000) return res.status(413).json({ error: 'photo_too_large' });

  try {
    // Only a paid Premium/Full buyer can submit.
    const checkUrl = supaUrl + '/rest/v1/purchases?select=tier,status&access_token=eq.' + encodeURIComponent(purchaseToken);
    const checkRes = await fetch(checkUrl, { headers: { apikey: supaKey, Authorization: 'Bearer ' + supaKey } });
    const rows = await checkRes.json();
    if (!Array.isArray(rows) || rows.length === 0) return res.status(403).json({ error: 'not_found' });
    const purchase = rows[0];
    if (purchase.status !== 'paid' || purchase.tier === 'essential') {
      return res.status(403).json({ error: 'not_eligible' });
    }

    // Upload the photo to Storage.
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const path = crypto.randomBytes(16).toString('hex') + '.' + ext;
    const buffer = Buffer.from(photoBase64, 'base64');
    const uploadRes = await fetch(supaUrl + '/storage/v1/object/graft-photos/' + path, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + supaKey,
        'Content-Type': mimeType,
      },
      body: buffer,
    });
    if (!uploadRes.ok) return res.status(500).json({ error: 'upload_failed' });
    const photoUrl = supaUrl + '/storage/v1/object/public/graft-photos/' + path;

    // Create the estimate request with its own access token (separate from
    // the purchase token) so the customer can bookmark and check it later.
    const estimateToken = crypto.randomBytes(24).toString('hex');
    const insertRes = await fetch(supaUrl + '/rest/v1/graft_estimates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supaKey,
        Authorization: 'Bearer ' + supaKey,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ access_token: estimateToken, name, phone, photo_url: photoUrl, tier: purchase.tier, status: 'pending' }),
    });
    if (!insertRes.ok) return res.status(500).json({ error: 'store_failed' });

    return res.status(200).json({ ok: true, estimateToken });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
