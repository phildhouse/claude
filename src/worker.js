import { createOrUpdateSubscription, enrollInAutomation } from './beehiiv.js';
import { parseWebinarJamPayload } from './webinarjam.js';

async function readBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return await request.json();
  }
  if (
    ct.includes('application/x-www-form-urlencoded') ||
    ct.includes('multipart/form-data')
  ) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }
  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function verifySecret(request, env) {
  const expected = env.WEBHOOK_SECRET;
  if (!expected) return true;
  const header = request.headers.get('x-webhook-secret');
  const query = new URL(request.url).searchParams.get('secret');
  return header === expected || query === expected;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true });
    }

    if (request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }

    if (!verifySecret(request, env)) {
      return json({ error: 'invalid webhook secret' }, 401);
    }

    let payload;
    try {
      payload = await readBody(request);
    } catch {
      return json({ error: 'invalid body' }, 400);
    }

    let registrant;
    try {
      registrant = parseWebinarJamPayload(payload);
    } catch (err) {
      return json({ error: err.message }, 400);
    }

    const work = (async () => {
      try {
        const subscription = await createOrUpdateSubscription({
          env,
          ...registrant,
        });
        await enrollInAutomation({
          env,
          email: registrant.email,
          subscriptionId: subscription?.id,
        });
        console.log(`ok ${registrant.email} sub=${subscription?.id}`);
      } catch (err) {
        console.error(
          `beehiiv-error ${registrant.email} status=${err.status} msg=${err.message}`,
        );
      }
    })();

    ctx.waitUntil(work);
    return json({ ok: true, queued: true });
  },
};
