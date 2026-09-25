import { Loader2, Mountain, Pencil, Play } from 'lucide-react';
import type { DesignInput, MaterialOption, Options } from '@/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export const LENGTH_RANGE = { min: 2, max: 30, step: 0.5 };
export const WIDTH_RANGE = { min: 2, max: 30, step: 0.5 };
export const HEIGHT_RANGE = { min: 2, max: 6, step: 0.1 };
export const WWR_RANGE = { min: 0, max: 0.9, step: 0.05 };

const MATERIAL_CATEGORIES: { id: MaterialOption['category']; label: string }[] = [
  { id: 'structural', label: 'Structural' },
  { id: 'insulation', label: 'Insulation' },
  { id: 'finish', label: 'Finish' },
  { id: 'storage', label: 'Storage' },
];

const KEEP_PRESET = '__keep_preset__';

const FACADES: { key: 'S' | 'E' | 'W' | 'N'; label: string }[] = [
  { key: 'S', label: 'South' },
  { key: 'E', label: 'East' },
  { key: 'W', label: 'West' },
  { key: 'N', label: 'North' },
];

interface StepProps {
  options: Options;
  value: DesignInput;
  onChange: (value: DesignInput) => void;
}

// ---------- Step 1: Location ----------

export function Step1Location({ options, value, onChange }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium">Site</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.locations.map((loc) => {
            const selected = value.locationId === loc.id;
            return (
              <button
                key={loc.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...value, locationId: loc.id })}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-colors',
                  selected
                    ? 'border-primary bg-accent ring-1 ring-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                <div className="flex items-center gap-2">
                  <Mountain
                    className={cn(
                      'size-4 shrink-0',
                      selected ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span className="font-medium">{loc.name}</span>
                </div>
                <div className="text-muted-foreground text-xs">
                  {loc.elevation.toLocaleString()} m elevation · {loc.latitude.toFixed(2)},{' '}
                  {loc.longitude.toFixed(2)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="design-date">Design date</Label>
        <Input
          id="design-date"
          type="date"
          min="2023-01-01"
          max="2023-12-31"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        />
        <p className="text-muted-foreground text-xs">
          Pick a cold winter day to test survival — 15 Jan is typical.
        </p>
      </div>
    </div>
  );
}

// ---------- Step 2: Shelter ----------

export function Step2Shelter({ options, value, onChange }: StepProps) {
  const floorArea = value.lengthM * value.widthM;
  const volume = floorArea * value.heightM;
  const occupancy = options.occupancyPresets.find((o) => o.id === value.occupancyPresetId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium">Shelter type</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.presets.map((preset) => {
            const selected = value.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...value, presetId: preset.id })}
                className={cn(
                  'flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-colors',
                  selected
                    ? 'border-primary bg-accent ring-1 ring-primary'
                    : 'border-border hover:bg-muted',
                )}
              >
                <span className="font-medium">{preset.name}</span>
                <span className="text-muted-foreground line-clamp-3 text-xs">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <DimensionField
          id="length"
          label="Length (S/N wall run)"
          unit="m"
          range={LENGTH_RANGE}
          value={value.lengthM}
          onValueChange={(n) => onChange({ ...value, lengthM: n })}
        />
        <DimensionField
          id="width"
          label="Width (E/W wall run)"
          unit="m"
          range={WIDTH_RANGE}
          value={value.widthM}
          onValueChange={(n) => onChange({ ...value, widthM: n })}
        />
        <DimensionField
          id="height"
          label="Height"
          unit="m"
          range={HEIGHT_RANGE}
          value={value.heightM}
          onValueChange={(n) => onChange({ ...value, heightM: n })}
        />
      </div>

      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Floor area </span>
          <span className="font-medium">{floorArea.toFixed(1)} m²</span>
        </div>
        <div>
          <span className="text-muted-foreground">Volume </span>
          <span className="font-medium">{volume.toFixed(1)} m³</span>
        </div>
      </div>

      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="occupancy">Occupancy</Label>
        <Select
          value={value.occupancyPresetId}
          onValueChange={(v) => onChange({ ...value, occupancyPresetId: v })}
        >
          <SelectTrigger id="occupancy" className="w-full">
            <SelectValue placeholder="Choose occupancy" />
          </SelectTrigger>
          <SelectContent>
            {options.occupancyPresets.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {occupancy && <p className="text-muted-foreground text-xs">{occupancy.blurb}</p>}
      </div>
    </div>
  );
}

function DimensionField({
  id,
  label,
  unit,
  range,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  unit: string;
  range: { min: number; max: number; step: number };
  value: number;
  onValueChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.min(range.max, Math.max(range.min, n));
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} ({unit})
      </Label>
      <div className="flex items-center gap-3">
        <Slider
          id={id}
          min={range.min}
          max={range.max}
          step={range.step}
          value={[value]}
          onValueChange={([n]) => onValueChange(clamp(n))}
          className="flex-1"
        />
        <Input
          type="number"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onValueChange(clamp(n));
          }}
          className="w-20"
          aria-label={`${label} value`}
        />
      </div>
    </div>
  );
}

// ---------- Step 3: Envelope ----------

function MaterialSelect({
  id,
  label,
  materials,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  materials: MaterialOption[];
  value: string | null;
  onValueChange: (v: string | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? KEEP_PRESET}
        onValueChange={(v) => onValueChange(v === KEEP_PRESET ? null : v)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={KEEP_PRESET}>Keep preset construction (recommended)</SelectItem>
          <SelectSeparator />
          {MATERIAL_CATEGORIES.map((cat) => {
            const items = materials.filter((m) => m.category === cat.id);
            if (items.length === 0) return null;
            return (
              <SelectGroup key={cat.id}>
                <SelectLabel>{cat.label}</SelectLabel>
                {items.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex w-full items-center justify-between gap-2">
                      {m.name}
                      <Badge variant="outline" className="shrink-0">
                        {m.conductivity.toFixed(2)} W/m·K
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Step3Envelope({ options, value, onChange }: StepProps) {
  const glazing = options.glazings.find((g) => g.id === value.glazingId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <MaterialSelect
          id="wall-material"
          label="Wall material"
          materials={options.materials}
          value={value.wallMaterialId}
          onValueChange={(v) => onChange({ ...value, wallMaterialId: v })}
        />
        <MaterialSelect
          id="roof-material"
          label="Roof material"
          materials={options.materials}
          value={value.roofMaterialId}
          onValueChange={(v) => onChange({ ...value, roofMaterialId: v })}
        />
        <MaterialSelect
          id="floor-material"
          label="Floor material"
          materials={options.materials}
          value={value.floorMaterialId}
          onValueChange={(v) => onChange({ ...value, floorMaterialId: v })}
        />
      </div>

      <div className="max-w-sm space-y-1.5">
        <Label htmlFor="glazing">Glazing</Label>
        <Select value={value.glazingId} onValueChange={(v) => onChange({ ...value, glazingId: v })}>
          <SelectTrigger id="glazing" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.glazings.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {glazing && (
          <div className="flex gap-1.5">
            <Badge variant="outline">U {glazing.U} W/m²·K</Badge>
            <Badge variant="outline">SHGC {glazing.SHGC}</Badge>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium">Window-to-wall ratio</h3>
        <p className="text-muted-foreground mb-3 text-xs">
          South-facing glass captures winter sun in Ladakh.
        </p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
          {FACADES.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`wwr-${key}`}>
                {label} ({Math.round(value.windowWwr[key] * 100)}%)
              </Label>
              <Slider
                id={`wwr-${key}`}
                min={WWR_RANGE.min * 100}
                max={WWR_RANGE.max * 100}
                step={WWR_RANGE.step * 100}
                value={[Math.round(value.windowWwr[key] * 100)]}
                onValueChange={([n]) =>
                  onChange({ ...value, windowWwr: { ...value.windowWwr, [key]: n / 100 } })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="night-shutters"
          checked={value.nightShutters}
          onCheckedChange={(checked) => onChange({ ...value, nightShutters: checked })}
        />
        <Label htmlFor="night-shutters" className="flex-col items-start gap-0.5">
          Night shutters
          <span className="text-muted-foreground text-xs font-normal">
            Closes windows 20:00–06:00 to cut heat loss overnight.
          </span>
        </Label>
      </div>
    </div>
  );
}

// ---------- Step 4: Review ----------

function findName<T extends { id: string; name: string }>(list: T[], id: string | null): string {
  if (!id) return 'Preset construction';
  return list.find((x) => x.id === id)?.name ?? id;
}

interface Step4Props extends StepProps {
  onEdit: (step: number) => void;
  onRun: () => void;
  running: boolean;
  error: string | null;
}

export function Step4Review({ options, value, onEdit, onRun, running, error }: Step4Props) {
  const location = options.locations.find((l) => l.id === value.locationId);
  const preset = options.presets.find((p) => p.id === value.presetId);
  const occupancy = options.occupancyPresets.find((o) => o.id === value.occupancyPresetId);
  const glazing = options.glazings.find((g) => g.id === value.glazingId);

  const groups: { step: number; title: string; rows: [string, string][] }[] = [
    {
      step: 0,
      title: 'Location',
      rows: [
        ['Site', location?.name ?? value.locationId],
        ['Design date', value.date],
      ],
    },
    {
      step: 1,
      title: 'Shelter',
      rows: [
        ['Preset', preset?.name ?? value.presetId],
        ['Dimensions', `${value.lengthM} × ${value.widthM} × ${value.heightM} m`],
        ['Occupancy', occupancy?.name ?? value.occupancyPresetId],
      ],
    },
    {
      step: 2,
      title: 'Envelope',
      rows: [
        ['Wall', findName(options.materials, value.wallMaterialId)],
        ['Roof', findName(options.materials, value.roofMaterialId)],
        ['Floor', findName(options.materials, value.floorMaterialId)],
        ['Glazing', glazing?.name ?? value.glazingId],
        [
          'Window-to-wall',
          `S ${Math.round(value.windowWwr.S * 100)}% · E ${Math.round(value.windowWwr.E * 100)}% · W ${Math.round(value.windowWwr.W * 100)}% · N ${Math.round(value.windowWwr.N * 100)}%`,
        ],
        ['Night shutters', value.nightShutters ? 'Closed 20:00–06:00' : 'Off'],
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.title} className="rounded-lg border p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">{g.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => onEdit(g.step)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {g.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 sm:justify-start">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not run simulation</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Button onClick={onRun} disabled={running} size="lg" className="w-full sm:w-auto">
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {running ? 'Simulating…' : 'Run simulation'}
        </Button>
        <p className="text-muted-foreground text-xs">Runs on the server in under a second.</p>
      </div>
    </div>
  );
}
