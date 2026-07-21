export function parseServerDate(value: string): Date {
  const timestamp = value.replace(" ", "T");
  const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp);
  return new Date(hasTimeZone ? timestamp : `${timestamp}Z`);
}
