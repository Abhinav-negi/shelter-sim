// Overlaid indoor-air curves for 2-4 designs (F4.md condition 4: "overlay
// the indoor curves" — outdoor is per-design/per-location and would be up
// to 4 more lines, so it's left out; each design's own Studio page already
// shows its indoor-vs-outdoor pair). Colours reuse the thermal tokens
// (design system: reserved for temperature data, which this is) — the
// baseline (first) design gets the neutral `ink` token, the rest a distinct
// thermal hue each, so the baseline reads as "the one everything else is
// measured against", not a ranking.
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtHour, kToC } from '../../results/format';
import type { ResultJson } from '../../results/types';

export interface OverlayDesign {
  id: string;
  name: string;
  result: ResultJson;
}

const SERIES_COLORS = ['var(--ink)', 'var(--thermal-hottest)', 'var(--thermal-coldest)', 'var(--thermal-warm)'];

type Point = { hour: number } & Record<string, number>;

function seriesColor(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length] ?? 'var(--ink)';
}

/** A custom tooltip content, same reasoning as TemperatureChart.tsx's
 * ChartTooltip: recharts' own `formatter`/`labelFormatter` generics fight
 * `exactOptionalPropertyTypes`, a plain content component doesn't. */
function ChartTooltip({
  active,
  payload,
  designs,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload: Point }>;
  designs: OverlayDesign[];
}) {
  if (!active || !payload?.length) return null;
  const hour = payload[0]?.payload.hour;
  if (hour === undefined) return null;
  return (
    <div className="border border-hairline bg-paper px-3 py-2 text-xs shadow-none">
      <p className="text-ink-muted">{fmtHour(hour)}</p>
      {designs.map((d, i) => {
        const entry = payload.find((p) => p.dataKey === d.id);
        if (entry?.value === undefined) return null;
        return (
          <p key={d.id} className="font-mono text-ink">
            <span style={{ color: seriesColor(i) }}>■</span> {d.name} {entry.value.toFixed(1)}°C
          </p>
        );
      })}
    </div>
  );
}

/** Zips by index rather than resampling — every design here ran the engine's
 * fixed 1-day/300s-step preview (API.md §4), so the series are already the
 * same length in practice. Truncates to the shortest just in case. */
function buildSeries(designs: OverlayDesign[]): Point[] {
  const length = Math.min(...designs.map((d) => d.result.time.length));
  const points: Point[] = [];
  for (let i = 0; i < length; i++) {
    const point: Point = { hour: designs[0]!.result.time[i]! / 3600 };
    for (const d of designs) {
      point[d.id] = Number(kToC(d.result.temperatures.indoorAir[i] ?? 0).toFixed(2));
    }
    points.push(point);
  }
  return points;
}

export function OverlayChart({ designs }: { designs: OverlayDesign[] }) {
  const data = buildSeries(designs);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        {designs.map((d, i) => (
          <span key={d.id} className="flex items-center gap-1.5">
            <span aria-hidden style={{ color: seriesColor(i) }}>
              ■
            </span>
            {d.name}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--hairline)" vertical={false} />
          <XAxis
            dataKey="hour"
            type="number"
            domain={[0, 24]}
            ticks={[0, 6, 12, 18, 24]}
            tickFormatter={fmtHour}
            tickLine={false}
            axisLine={{ stroke: 'var(--hairline)' }}
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
            tickFormatter={(v: number) => `${v}°`}
          />
          <Tooltip content={<ChartTooltip designs={designs} />} />
          {designs.map((d, i) => (
            <Line
              key={d.id}
              dataKey={d.id}
              stroke={seriesColor(i)}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
