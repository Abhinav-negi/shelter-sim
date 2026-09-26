// Indoor vs outdoor temperature over 24h (F3.md condition 4). Two series,
// thermal colours (design system: the thermal scale is reserved for
// temperature data — PLAN.md §Design system), direct labels instead of a
// legend box (dataviz skill: a single series needs no legend; two are
// still readable as small direct end-labels + an axis-adjacent caption).
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtHour, kToC } from './format';
import type { ResultJson } from './types';

const INDOOR_COLOR = 'var(--thermal-hottest)';
const OUTDOOR_COLOR = 'var(--thermal-coldest)';

interface TooltipPoint {
  hour: number;
  indoor: number;
  outdoor: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TooltipPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="border border-hairline bg-paper px-3 py-2 text-xs shadow-none">
      <p className="text-ink-muted">{fmtHour(point.hour)}</p>
      <p className="font-mono text-ink">
        <span style={{ color: INDOOR_COLOR }}>■</span> Indoor {point.indoor.toFixed(1)}°C
      </p>
      <p className="font-mono text-ink">
        <span style={{ color: OUTDOOR_COLOR }}>■</span> Outdoor {point.outdoor.toFixed(1)}°C
      </p>
    </div>
  );
}

export function TemperatureChart({ result }: { result: ResultJson }) {
  const data: TooltipPoint[] = result.time.map((t, i) => ({
    hour: t / 3600,
    indoor: Number(kToC(result.temperatures.indoorAir[i] ?? 0).toFixed(2)),
    outdoor: Number(kToC(result.temperatures.ambient[i] ?? 0).toFixed(2)),
  }));

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden style={{ color: INDOOR_COLOR }}>
            ■
          </span>
          Indoor air
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden style={{ color: OUTDOOR_COLOR }}>
            ■
          </span>
          Outdoor ambient
        </span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
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
          <ReferenceLine y={0} stroke="var(--ink-muted)" strokeDasharray="3 3" />
          <Tooltip content={<ChartTooltip />} />
          <Line dataKey="outdoor" stroke={OUTDOOR_COLOR} dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line dataKey="indoor" stroke={INDOOR_COLOR} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
