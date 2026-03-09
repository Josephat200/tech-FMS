type Point = {
  label: string;
  value: number;
};

type LineFlowChartProps = {
  title: string;
  points: Point[];
  color?: string;
};

type BarFlowChartProps = {
  title: string;
  points: Point[];
  color?: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function LineFlowChart({ title, points, color = 'var(--primary)' }: LineFlowChartProps) {
  const max = Math.max(...points.map((point) => point.value), 1);

  const d = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - (point.value / max) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <article className="card chart-card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="flow-line" aria-label={title}>
        <polyline points={d} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="chart-caption-row">
        {points.map((point) => (
          <div key={point.label}>
            <small>{point.label}</small>
            <strong>{formatCurrency(point.value)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

export function BarFlowChart({ title, points, color = '#0ea5a1' }: BarFlowChartProps) {
  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <article className="card chart-card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div className="bar-flow">
        {points.map((point) => (
          <div key={point.label} className="bar-flow-item">
            <div className="bar-flow-column">
              <div className="bar-flow-fill" style={{ height: `${(point.value / max) * 100}%`, background: color }} />
            </div>
            <small>{point.label}</small>
            <strong>{formatCurrency(point.value)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
