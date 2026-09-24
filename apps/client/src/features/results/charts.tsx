import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { ResultJson } from '@/api'
import { HEAT_FLOW_KEYS, HEAT_FLOW_LABELS, surfaceLabel } from './labels'

const kToC = (k: number) => k - 273.15
const fmtHour = (h: number) => `${String(Math.round(h)).padStart(2, '0')}:00`

// ---------- Temperature ----------

const tempConfig = {
  indoor: { label: 'Indoor air', color: 'var(--chart-1)' },
  ambient: { label: 'Outdoor ambient', color: 'var(--chart-3)' },
  sky: { label: 'Sky', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

export function TemperatureChart({ result }: { result: ResultJson }) {
  const data = result.time.map((t, i) => ({
    hour: t / 3600,
    indoor: Number(kToC(result.temperatures.indoorAir[i]!).toFixed(2)),
    ambient: Number(kToC(result.temperatures.ambient[i]!).toFixed(2)),
    sky: Number(kToC(result.temperatures.sky[i]!).toFixed(2)),
  }))

  return (
    <ChartContainer config={tempConfig} className="aspect-auto h-72 w-full">
      <LineChart data={data} margin={{ left: 20, right: 16, top: 12, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="hour"
          type="number"
          domain={[0, 24]}
          ticks={[0, 6, 12, 18, 24]}
          tickFormatter={fmtHour}
          tickLine={false}
          axisLine={false}
          fontSize={12}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          fontSize={12}
          tickFormatter={(v: number) => `${v}°`}
          label={{ value: '°C', position: 'insideTopLeft', offset: 0, fontSize: 12 }}
        />
        <ReferenceLine
          y={0}
          stroke="var(--destructive)"
          strokeDasharray="4 4"
          label={{ value: 'Freezing', position: 'insideTopRight', fill: 'var(--destructive)', fontSize: 11 }}
        />
        <ReferenceLine
          x={6}
          stroke="var(--muted-foreground)"
          strokeDasharray="2 2"
          label={{ value: '06:00', position: 'top', fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              labelFormatter={(_, tooltipPayload) =>
                fmtHour(Number(tooltipPayload?.[0]?.payload?.hour ?? NaN))
              }
            />
          }
        />
        <Line dataKey="sky" stroke="var(--color-sky)" strokeDasharray="3 3" dot={false} strokeWidth={1.5} />
        <Line dataKey="ambient" stroke="var(--color-ambient)" dot={false} strokeWidth={2} />
        <Line dataKey="indoor" stroke="var(--color-indoor)" dot={false} strokeWidth={2.5} />
      </LineChart>
    </ChartContainer>
  )
}

// ---------- Solar ----------

const solarConfig = {
  kwh: { label: 'Captured', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function SolarChart({ result }: { result: ResultJson }) {
  const { opaque, glazed, bySurface } = result.solar.dailyTotalKWh
  const data = Object.entries(bySurface)
    .map(([id, kwh]) => ({ id, label: surfaceLabel(id), kwh: Number(kwh.toFixed(2)) }))
    .sort((a, b) => b.kwh - a.kwh)
  const top = data[0]
  const total = opaque + glazed

  return (
    <div className="space-y-4">
      <ChartContainer config={solarConfig} className="aspect-auto h-64 w-full">
        <BarChart data={data} margin={{ left: 4, right: 16, top: 12, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            fontSize={12}
            label={{ value: 'kWh/day', angle: -90, position: 'insideLeft', fontSize: 12 }}
          />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="kwh" fill="var(--color-kwh)" radius={4} isAnimationActive={false} />
        </BarChart>
      </ChartContainer>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Opaque surfaces (walls/roof)</p>
          <p className="text-xl font-semibold">{opaque.toFixed(1)} kWh</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Through glazing (windows)</p>
          <p className="text-xl font-semibold">{glazed.toFixed(1)} kWh</p>
        </div>
      </div>
      {top && total > 0 && (
        <p className="text-muted-foreground text-sm">
          {top.label} captured the most solar energy today — {top.kwh.toFixed(1)} kWh (
          {((top.kwh / total) * 100).toFixed(0)}% of the day's total).
        </p>
      )}
    </div>
  )
}

// ---------- Heat flow ----------

const heatFlowConfig = {
  value: { label: 'Daily total', color: 'var(--chart-1)' },
  gain: { label: 'Gain', color: 'var(--gain)' },
  loss: { label: 'Loss', color: 'var(--loss)' },
} satisfies ChartConfig

export function HeatFlowChart({ result }: { result: ResultJson }) {
  const totals = result.heatFlows.dailyTotalsKWh
  const data = HEAT_FLOW_KEYS.map((key) => ({
    key,
    label: HEAT_FLOW_LABELS[key],
    value: Number((totals[key] ?? 0).toFixed(2)),
  }))
    .filter((d) => d.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))

  return (
    <div className="space-y-2">
      <ChartContainer
        config={heatFlowConfig}
        className="aspect-auto w-full"
        style={{ height: Math.max(240, data.length * 34) }}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 96, top: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            label={{ value: 'kWh/day (+ gain, − loss)', position: 'insideBottom', offset: -4, fontSize: 11 }}
          />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={168} fontSize={12} />
          <ReferenceLine x={0} stroke="var(--border)" />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <Bar dataKey="value" radius={4} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.value >= 0 ? 'var(--gain)' : 'var(--loss)'} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              fontSize={11}
              fill="var(--muted-foreground)"
              formatter={(v?: unknown) => `${Math.round(Number(v))} kWh`}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="text-muted-foreground flex items-center justify-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs" style={{ backgroundColor: 'var(--gain)' }} />
          Gain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs" style={{ backgroundColor: 'var(--loss)' }} />
          Loss
        </span>
      </div>
    </div>
  )
}
