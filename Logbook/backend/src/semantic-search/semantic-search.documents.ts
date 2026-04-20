type SearchableEntry = {
  source_type: 'tower' | 'app' | 'teknik';
  source_id: string;
  entry_no: number;
  entry_date: string | Date;
  entry_time: string;
  operation_type: string | null;
  facility: string | null;
  call_sign: string | null;
  description: string | null;
  equipment: string | null;
  frequency_section: string | null;
  incident: string | null;
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate()
  ).padStart(2, '0')}`;
}

export function buildEmbeddingText(entry: SearchableEntry) {
  if (entry.source_type === 'teknik') {
    return [
      'teknik logbook',
      `equipment: ${entry.equipment || ''}`,
      `frequency section: ${entry.frequency_section || ''}`,
      `incident: ${entry.incident || ''}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `${entry.source_type} logbook`,
    `operation type: ${entry.operation_type || ''}`,
    `facility: ${entry.facility || ''}`,
    `call sign: ${entry.call_sign || ''}`,
    `description: ${entry.description || ''}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildResult(entry: SearchableEntry) {
  if (entry.source_type === 'teknik') {
    return {
      sourceType: entry.source_type,
      sourceId: entry.source_id,
      entryNo: entry.entry_no,
      entryDate: formatDate(entry.entry_date),
      entryTime: entry.entry_time,
      title: `Teknik #${entry.entry_no} - ${entry.equipment || 'Tanpa equipment'}`,
      content: entry.incident || '',
      subtitle: [entry.frequency_section, entry.entry_time].filter(Boolean).join(' | '),
    };
  }

  return {
    sourceType: entry.source_type,
    sourceId: entry.source_id,
    entryNo: entry.entry_no,
    entryDate: formatDate(entry.entry_date),
    entryTime: entry.entry_time,
    title: `${entry.source_type.toUpperCase()} #${entry.entry_no} - ${
      entry.operation_type || 'Tanpa operasi'
    }`,
    content: entry.description || '',
    subtitle: [entry.facility, entry.call_sign, entry.entry_time].filter(Boolean).join(' | '),
  };
}
