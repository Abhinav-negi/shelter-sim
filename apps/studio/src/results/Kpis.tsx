// The engine KPI list (F3.md condition 4 / PLAN.md §Results): dawn temp,
// min/max indoor, hours below 0°C and 5°C, decrement factor, time lag, aux
// kWh/day, kerosene L/yr — no invented metrics, no others exposed (F3.md
// Rules: "Do not expose every engine variable"). A plain hairline-row list,
// not cards — units always in mono (F3.md Rules).
import type { SimulationKpis } from '@shelter/engine';
import { fmtC, fmt0, fmt1 } from './format';

function KpiRow({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="font-mono text-sm text-ink">
        {value}
        <span className="ml-1 text-xs text-ink-muted">{unit}</span>
      </span>
    </div>
  );
}

export function Kpis({ kpis }: { kpis: SimulationKpis }) {
  return (
    <div>
      <KpiRow label="Dawn temperature (06:00)" value={fmtC(kpis.tempAt0600)} unit="°C" />
      <KpiRow label="Min indoor" value={fmtC(kpis.minIndoorTemp)} unit="°C" />
      <KpiRow label="Max indoor" value={fmtC(kpis.maxIndoorTemp)} unit="°C" />
      <KpiRow label="Hours below 0°C" value={fmt1(kpis.hoursBelowFreezing)} unit="h" />
      <KpiRow label="Hours below 5°C" value={fmt1(kpis.hoursBelow5C)} unit="h" />
      <KpiRow label="Decrement factor" value={kpis.decrementFactor.toFixed(2)} unit="" />
      <KpiRow label="Time lag" value={fmt1(kpis.timeLagHours)} unit="h" />
      <KpiRow label="Auxiliary heat" value={fmt1(kpis.auxEnergyKWhPerDay)} unit="kWh/day" />
      <KpiRow label="Kerosene equivalent" value={fmt0(kpis.keroseneEquivalentLitresPerYear)} unit="L/yr" />
    </div>
  );
}
