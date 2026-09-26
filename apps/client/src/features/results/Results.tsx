import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Flame,
  Gauge,
  Moon,
  Sun,
  ThermometerSnowflake,
  ThermometerSun,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Options, SimulateResponse } from '@/api';
import { explain, type Severity } from './explain';
import { HeatFlowChart, SolarChart, TemperatureChart } from './charts';

/**
 * PROP CONTRACT — do not change without updating App.tsx's usage.
 * `data` is the full server response for the design last run; `onModify` returns to the
 * wizard (App.tsx switches view back to 'wizard', keeping `data.input` as the wizard value).
 * `options` is the same options catalogue the wizard uses, needed here to resolve ids
 * (location/preset) to human-readable names.
 */
export interface ResultsProps {
  data: SimulateResponse;
  options: Options;
  onModify: () => void;
}

const kelvinToC = (k: number) => k - 273.15;
const fmt1 = (k: number) => {
  const c = kelvinToC(k);
  return (Math.abs(c) < 0.05 ? 0 : c).toFixed(1);
};

const severityClasses: Record<Severity, string> = {
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
};

function KpiCard({
  icon,
  label,
  value,
  unit,
  tooltip,
  hero,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit: string;
  tooltip: string;
  hero?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Card className="cursor-default gap-2 py-4">
          <CardContent className="px-4">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <p
              className={
                hero
                  ? 'mt-1 text-4xl font-semibold tracking-tight'
                  : 'mt-1 text-2xl font-semibold tracking-tight'
              }
            >
              {value}
              <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>
            </p>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function Results({ data, options, onModify }: ResultsProps) {
  const { kpis, input, result } = data;
  const insights = explain(kpis);
  const solarTotal = result.solar.dailyTotalKWh.opaque + result.solar.dailyTotalKWh.glazed;
  const locationName =
    options.locations.find((l) => l.id === input.locationId)?.name ?? input.locationId;
  const presetName = options.presets.find((p) => p.id === input.presetId)?.name ?? input.presetId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
          <p className="text-muted-foreground text-sm">
            {locationName} · {presetName} ·{' '}
            {new Date(input.date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onModify}>
          <ArrowLeft className="size-4" />
          Modify design
        </Button>
      </div>

      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`rounded-lg border px-4 py-2.5 text-sm ${severityClasses[insight.severity]}`}
          >
            {insight.text}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-56 flex-2">
          <KpiCard
            icon={<Moon className="size-4" />}
            label="Night minimum (06:00)"
            value={fmt1(kpis.tempAt0600)}
            unit="°C"
            tooltip="Indoor air temperature at 06:00, the coldest point of a typical Ladakhi night."
            hero
          />
        </div>
        <div className="min-w-27.5 flex-1">
          <KpiCard
            icon={<ThermometerSnowflake className="size-4" />}
            label="Min indoor"
            value={fmt1(kpis.minIndoorTemp)}
            unit="°C"
            tooltip="Lowest indoor air temperature over the simulated day."
          />
        </div>
        <div className="min-w-27.5 flex-1">
          <KpiCard
            icon={<ThermometerSun className="size-4" />}
            label="Max indoor"
            value={fmt1(kpis.maxIndoorTemp)}
            unit="°C"
            tooltip="Highest indoor air temperature over the simulated day."
          />
        </div>
        <div className="min-w-27.5 flex-1">
          <KpiCard
            icon={<Gauge className="size-4" />}
            label="Hours in comfort"
            value={kpis.hoursInComfort.toFixed(0)}
            unit="h"
            tooltip="Hours the indoor air stayed within the comfort band."
          />
        </div>
        <div className="min-w-27.5 flex-1">
          <KpiCard
            icon={<Sun className="size-4" />}
            label="Solar captured"
            value={solarTotal.toFixed(1)}
            unit="kWh"
            tooltip="Total solar energy captured today, opaque surfaces plus glazing combined."
          />
        </div>
        <div className="min-w-27.5 flex-1">
          <KpiCard
            icon={<Flame className="size-4" />}
            label="Aux heat"
            value={kpis.auxEnergyKWhPerDay.toFixed(1)}
            unit="kWh/day"
            tooltip="Auxiliary heating energy needed per day beyond passive gains."
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="temperature">
            <TabsList>
              <TabsTrigger value="temperature">Temperature</TabsTrigger>
              <TabsTrigger value="solar">Solar</TabsTrigger>
              <TabsTrigger value="heatflow">Heat flow</TabsTrigger>
            </TabsList>
            <TabsContent value="temperature" className="pt-4">
              <TemperatureChart result={result} />
            </TabsContent>
            <TabsContent value="solar" className="pt-4">
              <SolarChart result={result} />
            </TabsContent>
            <TabsContent value="heatflow" className="pt-4">
              <HeatFlowChart result={result} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Simulated in {result.meta.wallClockMs} ms · energy balance residual{' '}
        {result.meta.energyBalanceResidual.toExponential(2)}{' '}
        <Badge variant="secondary" className="ml-1">
          {result.meta.timesteps} timesteps
        </Badge>
      </p>
    </div>
  );
}

// Default export exists solely so App.tsx can React.lazy()-load this module (code-splitting
// the charting bundle); the named export above remains the one to import for typing.
export default Results;
