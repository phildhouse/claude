const BEEHIIV_API_BASE = 'https://api.beehiiv.com/v2';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function beehiivRequest(path, { method = 'POST', body, apiKey }) {
  const payload = body ? JSON.stringify(body) : undefined;
  const delays = [0, 500, 1500];
  let lastErr;

  for (const delay of delays) {
    if (delay) await sleep(delay);
    let res;
    try {
      res = await fetch(`${BEEHIIV_API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: payload,
      });
    } catch (networkErr) {
      lastErr = networkErr;
      continue;
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (res.ok) return data;

    const err = new Error(
      `Beehiiv ${method} ${path} failed: ${res.status} ${text.slice(0, 500)}`,
    );
    err.status = res.status;
    err.body = data;
    lastErr = err;

    if (res.status < 500 && res.status !== 429) break;
  }

  throw lastErr;
}

export async function createOrUpdateSubscription({
  env,
  email,
  firstName,
  lastName,
  customFields = [],
}) {
  const body = {
    email,
    reactivate_existing: env.BEEHIIV_REACTIVATE_EXISTING !== 'false',
    send_welcome_email: env.BEEHIIV_SEND_WELCOME_EMAIL === 'true',
    utm_source: env.BEEHIIV_UTM_SOURCE || 'webinarjam',
    custom_fields: [
      ...(firstName ? [{ name: 'First Name', value: firstName }] : []),
      ...(lastName ? [{ name: 'Last Name', value: lastName }] : []),
      ...customFields,
    ],
  };

  const response = await beehiivRequest(
    `/publications/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`,
    { method: 'POST', body, apiKey: env.BEEHIIV_API_KEY },
  );

  return response?.data ?? response;
}

export async function enrollInAutomation({ env, email, subscriptionId }) {
  const body = subscriptionId
    ? { subscription_id: subscriptionId }
    : { email };

  const response = await beehiivRequest(
    `/publications/${env.BEEHIIV_PUBLICATION_ID}/automations/${env.BEEHIIV_AUTOMATION_ID}/journeys`,
    { method: 'POST', body, apiKey: env.BEEHIIV_API_KEY },
  );

  return response?.data ?? response;
}
