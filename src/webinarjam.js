function splitName(full) {
  if (!full) return { firstName: '', lastName: '' };
  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function pickDeep(obj, keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      const hit = pickDeep(obj[k], keys);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

export function parseWebinarJamPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Empty or invalid webhook payload');
  }

  const email = pickDeep(payload, [
    'email',
    'Email',
    'user_email',
    'registrant_email',
    'subscriber_email',
    'attendee_email',
    'lead_email',
  ]);

  if (!email) {
    const keys = Object.keys(payload).slice(0, 30).join(',');
    throw new Error(`Payload is missing an email field. Top-level keys: ${keys}`);
  }

  let firstName =
    pickDeep(payload, ['first_name', 'firstname', 'FirstName', 'first']) || '';
  let lastName =
    pickDeep(payload, ['last_name', 'lastname', 'LastName', 'last']) || '';
  if (!firstName && !lastName) {
    const full = pickDeep(payload, ['name', 'full_name', 'fullname', 'Name']);
    ({ firstName, lastName } = splitName(full));
  }

  const phone = pickDeep(payload, [
    'phone',
    'phone_number',
    'Phone',
    'mobile',
    'telephone',
  ]);
  const webinarId = pickDeep(payload, ['webinar_id', 'webinarId', 'webinar']);
  const webinarName = pickDeep(payload, [
    'webinar_name',
    'webinarName',
    'webinar_title',
  ]);
  const schedule = pickDeep(payload, [
    'schedule',
    'webinar_schedule',
    'scheduled_at',
    'date',
    'datetime',
  ]);
  const timezone = pickDeep(payload, ['timezone', 'time_zone', 'tz']);

  const customFields = [];
  if (phone) customFields.push({ name: 'Phone', value: String(phone) });
  if (webinarId) customFields.push({ name: 'Webinar ID', value: String(webinarId) });
  if (webinarName) customFields.push({ name: 'Webinar', value: String(webinarName) });
  if (schedule)
    customFields.push({ name: 'Webinar Schedule', value: String(schedule) });
  if (timezone) customFields.push({ name: 'Timezone', value: String(timezone) });

  return {
    email: String(email).trim().toLowerCase(),
    firstName: String(firstName),
    lastName: String(lastName),
    customFields,
  };
}
