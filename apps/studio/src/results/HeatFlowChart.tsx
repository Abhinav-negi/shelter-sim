// Heat-flow pathway breakdown, daily kWh (F3.md condition 4). Gain/loss is
// shown by bar direction against a zero reference line, not by colour — the
// thermal scale is reserved for temperature data only (PLAN.md §Design
// system), and this chart is energy, not temperature, so a second diverging
// pair would break that rule. One hue (accent), direct value labels, no
// legend needed (dataviz skill: position already encodes the two states).
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { HEAT_FLOW_KEYS, HEAT_FLOW_LABELS } from './labels';
import type { ResultJson } from './types';

/** recharts' built-in `position="right"` anchors beyond the bar's tip in the
 * VALUE's own direction -- for a negative bar that's further left (past the
 * tip), which collided with the y-axis category label for a large-magnitude
 * negative bar (F3.md condition 6 visual QA). An SVG rect's `x`/`width` are
 * always non-negative, so `x + width` is always the bar's true screen-right
 * edge (the tip for a positive bar, the zero line for a negative one) --
 * anchoring there is deterministic and never overlaps the axis labels.
 * `any`: recharts' content-prop typing is a large, awkward union (Label's
 * Props vs LabelList's Props disagree on `viewBox`) -- this is the standard
 * recharts custom-label escape hatch, not a real type hole (every field is
 * coerced with Number() below before use). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ValueLabel(props: any) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);
  const v = Number(props.value);
  return (
    <text x={x + width + 6} y={y + height / 2} dy={4} fontSize={11} fill="var(--ink-muted)" textAnchor="start">
      {`${v >= 0 ? '+' : ''}${v.toFixed(1)} kWh`}
    </text>
  );
}

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
          <LabelList dataKey="value" content={ValueLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
