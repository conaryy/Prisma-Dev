import { useDeferredValue } from 'react';
import type { ChecklistItem } from '@/types';

type Props = {
  items: ChecklistItem[];
  query: string;
  onQueryChange: (value: string) => void;
};

function statusLabel(status: ChecklistItem['status']) {
  if (status === 'V') return 'Sesuai';
  if (status === 'M') return 'Major';
  if (status === 'm') return 'Minor';
  if (status === 'X') return 'Tidak Berlaku';
  return 'Belum Terbaca';
}

export function CriteriaTable({ items, query, onQueryChange }: Props) {
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) => {
        const haystack = [
          item.code,
          item.description,
          item.sectionTitle,
          item.categoryTitle,
          item.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : items;

  return (
    <article className="panel">
      <div className="criteria-toolbar">
        <div>
          <h3 className="panel-title">Detail Kriteria</h3>
          <p className="panel-description">
            Cari kode, deskripsi, atau status untuk memeriksa butir audit tertentu.
          </p>
        </div>

        <input
          className="criteria-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Cari kode atau isi kriteria..."
        />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Kriteria</th>
              <th>Evidence</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.code}>
                <td>
                  <strong>{item.code}</strong>
                </td>
                <td>
                  <div>{item.description}</div>
                  <div className="meta-copy">
                    {[item.sectionTitle, item.categoryTitle].filter(Boolean).join(' • ') || '-'}
                  </div>
                </td>
                <td>
                  {item.evidence.length > 0 ? (
                    <ul className="criteria-evidence">
                      {item.evidence.slice(0, 4).map((evidence) => (
                        <li key={`${item.code}-${evidence}`}>{evidence}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="meta-copy">Tidak ada evidence terbaca.</span>
                  )}
                </td>
                <td>
                  <span className={`status-pill ${item.status}`}>{statusLabel(item.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
