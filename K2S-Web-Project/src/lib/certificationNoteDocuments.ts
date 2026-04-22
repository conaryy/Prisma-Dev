import { apiFetch } from '@/lib/api';

export async function generateCertificationNoteDocument(tableId: string) {
  const response = await apiFetch<{ data: {
    generated: boolean;
    tableId: string;
    filename: string;
    totalItems: number;
    generatedAt: string;
    downloadUrl: string;
  } }>(`/api/certification-note-tables/${tableId}/export-document/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  return response.data;
}
