const UK_TZ = { timeZone: 'Europe/London' };

export function toUKDatetimeLocal(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    ...UK_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find(p => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
