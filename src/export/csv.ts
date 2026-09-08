function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsvRow(values: (string | number)[]): string {
  return values.map(escapeCsvField).join(',') + '\r\n';
}
