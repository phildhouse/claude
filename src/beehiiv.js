import process from 'node:process';

const BEEHIIV_API_BASE = 'https://api.beehiiv.com/v2';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function beehiivRequest(path, { method = 'POST', body } = {}) {
  const apiKey = requireEnv('BEEHIIV_API_KEY');
  const res = await fetch(`${BEEHIIV_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(
      `Beehiiv ${method} ${path} failed: ${res.status} ${res.statusText} ${text}`,
    );
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

export async function createOrUpdateSubscription({
  email,
  firstName,
  lastName,
  customFields = [],
}) {
  const publicationId = requireEnv('BEEHIIV_PUBLICATION_ID');

  const body = {
    email,
    reactivate_existing: process.env.BEEHIIV_REACTIVATE_EXISTING !== 'false',
    send_welcome_email: process.env.BEEHIIV_SEND_WELCOME_EMAIL === 'true',
    utm_source: process.env.BEEHIIV_UTM_SOURCE || 'webinarjam',
    custom_fields: [
      ...(firstName ? [{ name: 'First Name', value: firstName }] : []),
      ...(lastName ? [{ name: 'Last Name', value: lastName }] : []),
      ...customFields,
    ],
  };

  const response = await beehiivRequest(
    `/publications/${publicationId}/subscriptions`,
    { method: 'POST', body },
  );

  return response?.data ?? response;
}

export async function enrollInAutomation({ email, subscriptionId }) {
  const publicationId = requireEnv('BEEHIIV_PUBLICATION_ID');
  const automationId = requireEnv('BEEHIIV_AUTOMATION_ID');

  const body = subscriptionId
    ? { subscription_id: subscriptionId }
    : { email };

  const response = await beehiivRequest(
    `/publications/${publicationId}/automations/${automationId}/journeys`,
    { method: 'POST', body },
  );

  return response?.data ?? response;
}
