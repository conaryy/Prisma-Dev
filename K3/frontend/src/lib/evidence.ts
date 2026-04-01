const STATUS_EVIDENCE_MARKERS = new Set(['V', 'v', 'M', 'm', 'X', 'x']);

export function getDisplayEvidence(entries: string[]) {
  return entries.filter((entry) => {
    const normalizedEntry = entry.trim();
    return normalizedEntry.length > 0 && !STATUS_EVIDENCE_MARKERS.has(normalizedEntry);
  });
}
