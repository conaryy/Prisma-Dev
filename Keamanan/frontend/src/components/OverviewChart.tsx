import type { ChartData } from '@/types/dashboard';

type OverviewChartProps = {
  chart: ChartData;
};

const WIDTH = 760;
const HEIGHT = 280;
const PADDING_X = 38;
const PADDING_Y = 28;

function getPointX(index: number, total: number) {
  const innerWidth = WIDTH - PADDING_X * 2;
  if (total === 1) {
    return WIDTH / 2;
  }

  return PADDING_X + (index * innerWidth) / (total - 1);
}

function getPointY(value: number, maxValue: number) {
  const innerHeight = HEIGHT - PADDING_Y * 2;
  return PADDING_Y + innerHeight - (value / maxValue) * innerHeight;
}

function createLine(values: number[], maxValue: number) {
  return values
    .map((value, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${getPointX(index, values.length)} ${getPointY(value, maxValue)}`;
    })
    .join(' ');
}

function createArea(values: number[], maxValue: number) {
  const line = createLine(values, maxValue);
  const lastPointX = getPointX(values.length - 1, values.length);
  const firstPointX = getPointX(0, values.length);
  const floor = HEIGHT - PADDING_Y;

  return `${line} L ${lastPointX} ${floor} L ${firstPointX} ${floor} Z`;
}

export function OverviewChart({ chart }: OverviewChartProps) {
  const maxValue = Math.max(100, ...chart.series.flatMap((item) => item.values));
  const yAxisValues = [0, 25, 50, 75, 100];

  return (
    <div className="chart-card">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Overview Bulanan</p>
          <h2 className="panel-title">{chart.title}</h2>
          <p className="panel-copy">{chart.subtitle}</p>
        </div>
        <div className="chart-legend" aria-label="Legenda chart">
          {chart.series.map((item) => (
            <span key={item.id} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="chart-shell">
        <svg className="chart-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={chart.title}>
          {yAxisValues.map((value) => {
            const y = getPointY(value, maxValue);
            return (
              <g key={value}>
                <line className="chart-grid" x1={PADDING_X} x2={WIDTH - PADDING_X} y1={y} y2={y} />
                <text className="chart-axis-label" x={PADDING_X - 12} y={y + 4} textAnchor="end">
                  {value}
                </text>
              </g>
            );
          })}

          {chart.series.map((item, index) => (
            <g key={item.id}>
              {index === 0 ? <path d={createArea(item.values, maxValue)} fill={`${item.color}18`} /> : null}
              <path d={createLine(item.values, maxValue)} className="chart-line" style={{ stroke: item.color }} />
              {item.values.map((value, pointIndex) => (
                <circle
                  key={`${item.id}-${pointIndex}`}
                  className="chart-point"
                  cx={getPointX(pointIndex, item.values.length)}
                  cy={getPointY(value, maxValue)}
                  r="4.2"
                  style={{ fill: item.color }}
                />
              ))}
            </g>
          ))}

          {chart.labels.map((label, index) => (
            <text
              key={label}
              className="chart-axis-label"
              x={getPointX(index, chart.labels.length)}
              y={HEIGHT - 4}
              textAnchor="middle"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
