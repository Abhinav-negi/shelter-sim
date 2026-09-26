// Heat-flow pathway breakdown, daily kWh (F3.md condition 4). Gain/loss is
// shown by bar direction against a zero reference line, not by colour — the
// thermal scale is reserved for temperature data only (PLAN.md §Design
// system), and this chart is energy, not temperature, so a second diverging
// pair would break that rule. One hue (accent), direct value labels, no
// legend needed (dataviz skill: position already encodes the two states).
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { HEAT_FLOW_KEYS, HEAT_FLOW_LABELS } from './labels';
import type { ResultJson } from './types';

export function HeatFlowChart({ result }: { result: ResultJson }) {
  const totals = result.heatFlows.dailyTotalsKWh;
  const data = HEAT_FLOW_KEYS.map((key) => ({
    key,
    label: HEAT_FLOW_LABELS[key],
    value: Number((totals[key] ?? 0).toFixed(2)),
  }))
    .filter((d) => d.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  if (data.length === 0) {
    return <p className="text-xs text-ink-muted">No heat-flow data in this preview.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
          tickFormatter={(v: number) => `${v}`}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={164}
          tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
        />
        <ReferenceLine x={0} stroke="var(--hairline)" />
        <Bar dataKey="value" fill="var(--accent)" isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.key} fillOpacity={d.value >= 0 ? 1 : 0.55} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            fontSize={11}
            fill="var(--ink-muted)"
            formatter={(v?: unknown) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)} kWh`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
