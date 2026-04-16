import 'dotenv/config';
import express from 'express';
import { createOrUpdateSubscription, enrollInAutomation } from './beehiiv.js';
import { parseWebinarJamPayload } from './webinarjam.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

function verifySecret(req) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return true;
  const provided = req.get('x-webhook-secret') || req.query.secret;
  return provided === expected;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/webhook/webinarjam', async (req, res) => {
  if (!verifySecret(req)) {
    return res.status(401).json({ error: 'invalid webhook secret' });
  }

  let registrant;
  try {
    registrant = parseWebinarJamPayload(req.body);
  } catch (err) {
    console.warn('[webinarjam] bad payload:', err.message, req.body);
    return res.status(400).json({ error: err.message });
  }

  try {
    const subscription = await createOrUpdateSubscription(registrant);
    const subscriptionId = subscription?.id;

    const journey = await enrollInAutomation({
      email: registrant.email,
      subscriptionId,
    });

    console.log(
      `[webinarjam] ${registrant.email} -> subscription=${subscriptionId} journey=${journey?.id ?? 'ok'}`,
    );

    return res.status(200).json({
      ok: true,
      subscription_id: subscriptionId,
      journey_id: journey?.id,
    });
  } catch (err) {
    console.error('[webinarjam] beehiiv error:', err.status, err.message, err.body);
    return res.status(502).json({
      error: 'beehiiv request failed',
      status: err.status,
      details: err.body,
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'internal error' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`WebinarJam -> Beehiiv bridge listening on :${port}`);
});
