// Creates a Razorpay order for the fixed price (₹1). The amount is set
// on the server so it can never be tampered with from the browser.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return res.status(500).json({ error: 'not_configured' });

  const amount = 100; // ₹1 in paise. Change here if you ever reprice.

  try {
    const auth = Buffer.from(keyId + ':' + keySecret).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + auth },
      body: JSON.stringify({ amount, currency: 'INR', receipt: 'guide_' + Date.now() }),
    });
    const order = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'razorpay_error' });
    // keyId is the public key — safe to send to the browser so checkout can open.
    return res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
