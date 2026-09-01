// Tells the frontend whether we're in Razorpay Test Mode (so it can show the test hint).
module.exports = async (req, res) => {
  const key = process.env.RAZORPAY_KEY_ID || '';
  res.status(200).json({
    configured: Boolean(key && process.env.RAZORPAY_KEY_SECRET),
    testMode: key.startsWith('rzp_test_'),
  });
};
