function splitName(full) {
  if (!full) return { firstName: '', lastName: '' };
  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function parseWebinarJamPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Empty or invalid webhook payload');
  }

  const email = payload.email || payload.user_email || payload.registrant_email;
  if (!email) throw new Error('Payload is missing an email field');

  let firstName = payload.first_name || payload.firstname || '';
  let lastName = payload.last_name || payload.lastname || '';
  if (!firstName && !lastName) {
    ({ firstName, lastName } = splitName(payload.name || payload.full_name));
  }

  const customFields = [];
  if (payload.phone || payload.phone_number) {
    customFields.push({
      name: 'Phone',
      value: String(payload.phone || payload.phone_number),
    });
  }
  if (payload.webinar_id) {
    customFields.push({ name: 'Webinar ID', value: String(payload.webinar_id) });
  }
  if (payload.webinar_name) {
    customFields.push({ name: 'Webinar', value: String(payload.webinar_name) });
  }
  if (payload.schedule) {
    customFields.push({ name: 'Webinar Schedule', value: String(payload.schedule) });
  }
  if (payload.timezone) {
    customFields.push({ name: 'Timezone', value: String(payload.timezone) });
  }

  return {
    email: String(email).trim().toLowerCase(),
    firstName,
    lastName,
    customFields,
  };
}
