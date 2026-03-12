import type { AuditAnalysis } from '@/types';

type Props = {
  analysis: AuditAnalysis;
};

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function AnalysisSummary({ analysis }: Props) {
  const totalFindings = analysis.totals.major + analysis.totals.minor;

  return (
    <div className="content-stack">
      <section className="overview-banner">
        <div>
          <p className="panel-kicker">Ringkasan audit terbaru</p>
          <h3 className="overview-banner-title">{analysis.metadata.branch || 'Cabang belum terdeteksi'}</h3>
          <p className="overview-banner-copy">
            Dokumen terakhir yang dianalisis adalah <strong>{analysis.fileName}</strong>. Nilai penerapan saat ini berada di{' '}
            <strong>{formatPercent(analysis.totals.compliancePercentage)}</strong>.
          </p>
        </div>

        <div className="overview-banner-score">
          <span>Compliance</span>
          <strong>{formatPercent(analysis.totals.compliancePercentage)}</strong>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-label">Target Kriteria</p>
          <p className="metric-value">{analysis.totals.expectedCriteria}</p>
          <p className="metric-note">Total butir pada template audit.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Butir Terdeteksi</p>
          <p className="metric-value">{analysis.totals.detectedCriteria}</p>
          <p className="metric-note">Berhasil diparse dari file Word.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Sesuai</p>
          <p className="metric-value">{analysis.totals.sesuai}</p>
          <p className="metric-note">
            Status <code>V</code> pada checklist.
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Major / Minor</p>
          <p className="metric-value">
            {analysis.totals.major} / {analysis.totals.minor}
          </p>
          <p className="metric-note">
            Temuan <code>M</code> dan <code>m</code>.
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Tidak Berlaku</p>
          <p className="metric-value">{analysis.totals.tidakBerlaku}</p>
          <p className="metric-note">
            Item dengan status <code>X</code>.
          </p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Penerapan</p>
          <p className="metric-value">{formatPercent(analysis.totals.compliancePercentage)}</p>
          <p className="metric-note">
            Rumus: <code>V / (total - X)</code>.
          </p>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Dokumen</p>
              <h3 className="panel-title">Ringkasan Dokumen</h3>
              <p className="panel-description">
                Dashboard membaca hasil upload Word terakhir dan merangkum nilai audit secara otomatis.
              </p>
            </div>
          </div>

          <div className="meta-stack">
            <div className="meta-item">
              <p className="meta-label">Nama File</p>
              <p className="meta-value">{analysis.fileName}</p>
            </div>
            <div className="meta-item">
              <p className="meta-label">Cabang</p>
              <p className="meta-value">{analysis.metadata.branch || '-'}</p>
            </div>
            <div className="meta-item">
              <p className="meta-label">Nomor Dokumen</p>
              <p className="meta-value">{analysis.metadata.documentNumber || '-'}</p>
            </div>
            <div className="meta-item">
              <p className="meta-label">Tanggal Audit</p>
              <p className="meta-value">{analysis.metadata.auditDate || '-'}</p>
            </div>
            <div className="meta-item">
              <p className="meta-label">Terakhir Diproses</p>
              <p className="meta-value">{formatDateTime(analysis.analyzedAt)}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Skor</p>
              <h3 className="panel-title">Skor Audit</h3>
              <p className="panel-description">
                Tingkat penerapan dihitung dari kriteria <code>V</code> dibanding kriteria yang berlaku.
              </p>
            </div>
          </div>

          <div className="progress-stack">
            <div className="progress-row">
            <div className="meta-copy">Persentase penerapan</div>
            <strong>{formatPercent(analysis.totals.compliancePercentage)}</strong>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${Math.min(analysis.totals.compliancePercentage, 100)}%` }}
              />
            </div>
            </div>

            <div className="progress-row">
            <div className="meta-copy">Cakupan parsing dokumen</div>
            <strong>{formatPercent(analysis.totals.completionPercentage)}</strong>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${Math.min(analysis.totals.completionPercentage, 100)}%` }}
              />
            </div>
            </div>
          </div>

          <div className="status-chips">
            <span className="status-chip v">V {analysis.totals.sesuai}</span>
            <span className="status-chip m">M {analysis.totals.major}</span>
            <span className="status-chip minor">m {analysis.totals.minor}</span>
            <span className="status-chip x">X {analysis.totals.tidakBerlaku}</span>
            <span className="status-chip unknown">Unknown {analysis.totals.unknown}</span>
          </div>

          <div className="attention-grid">
            <div className="attention-card">
              <span className="attention-label">Temuan</span>
              <strong>{totalFindings}</strong>
            </div>
            <div className="attention-card">
              <span className="attention-label">Berlaku</span>
              <strong>{analysis.totals.applicableCriteria}</strong>
            </div>
          </div>
        </article>
      </section>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Monitoring</p>
            <h3 className="panel-title">Rekap per Bab</h3>
            <p className="panel-description">
              Bab dengan temuan major atau minor bisa langsung diprioritaskan untuk tindak lanjut.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Bab</th>
                <th>Uraian</th>
                <th>Total</th>
                <th>V</th>
                <th>M</th>
                <th>m</th>
                <th>X</th>
                <th>Penerapan</th>
              </tr>
            </thead>
            <tbody>
              {analysis.sectionSummary.map((section) => (
                <tr key={section.sectionCode}>
                  <td>{section.sectionCode}</td>
                  <td>{section.sectionTitle}</td>
                  <td>{section.total}</td>
                  <td>{section.sesuai}</td>
                  <td>{section.major}</td>
                  <td>{section.minor}</td>
                  <td>{section.tidakBerlaku}</td>
                  <td>{formatPercent(section.percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
