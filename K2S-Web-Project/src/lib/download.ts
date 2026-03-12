import { resolveApiUrl } from '@/lib/api';

const CONTENT_DISPOSITION_FILENAME_PATTERN =
  /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i;

function resolveFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(CONTENT_DISPOSITION_FILENAME_PATTERN);
  const encodedName = match?.[1];
  const plainName = match?.[2];
  const candidate = encodedName ? decodeURIComponent(encodedName) : plainName;
  return candidate?.trim() || fallback;
}

export async function downloadFromSignedUrl(
  url: string,
  fallbackFilename: string
) {
  const targetUrl = resolveApiUrl(url);
  const response = await fetch(targetUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error('Gagal mengunduh file.');
  }

  const blob = await response.blob();
  const filename = resolveFilename(
    response.headers.get('content-disposition'),
    fallbackFilename
  );
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
