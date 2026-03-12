export function formatDate(dateString: string) {
  if (!dateString) {
    return '-';
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function parseIsoDateOnly(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function formatDateIndonesianLong(dateString: string) {
  if (!dateString) {
    return '-';
  }
  const parsedDate = parseIsoDateOnly(dateString) ?? new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }
  return parsedDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateRangeIndonesian(rangeValue: string | null | undefined) {
  if (!rangeValue) {
    return '-';
  }
  const parts = rangeValue
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return '-';
  }
  if (parts.length === 1) {
    return formatDateIndonesianLong(parts[0]);
  }
  return `${formatDateIndonesianLong(parts[0])} - ${formatDateIndonesianLong(parts[1])}`;
}

export function formatDateTime(dateString: string) {
  if (!dateString) {
    return '-';
  }
  const date = new Date(dateString);
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysUntil(dateString: string) {
  const target = new Date(dateString);
  const today = new Date();
  const diff = target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateString: string) {
  return daysUntil(dateString) < 0;
}

export function isDueSoon(dateString: string, days = 7) {
  const diff = daysUntil(dateString);
  return diff >= 0 && diff <= days;
}
