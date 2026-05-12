/** Stored in API as `eventFormat` (eventFormatCustom when format is `other`). */
export const EVENT_FORMAT_OPTIONS: { id: string; label: string }[] = [
  { id: 'workshop', label: 'Workshop' },
  { id: 'competition', label: 'Competition' },
  { id: 'conference', label: 'Conference' },
  { id: 'training', label: 'Training' },
  { id: 'networking', label: 'Networking' },
  { id: 'trip_outing', label: 'Trip / outing' },
  { id: 'other', label: 'Other' },
];

const LABEL_BY_ID = new Map(EVENT_FORMAT_OPTIONS.map((o) => [o.id, o.label]));

export function eventFormatLabel(
  formatId?: string | null,
  custom?: string | null
): string {
  if (!formatId) return '';
  if (formatId === 'other' && custom?.trim()) return custom.trim();
  return LABEL_BY_ID.get(formatId) || formatId;
}

export function eventFormatShort(formatId?: string | null, custom?: string | null): string {
  const full = eventFormatLabel(formatId, custom);
  if (!full) return '';
  return full.length > 18 ? full.substring(0, 16) + '…' : full;
}
