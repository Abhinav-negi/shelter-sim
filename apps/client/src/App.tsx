import { lazy, Suspense, useEffect, useState } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { getOptions, simulate, type DesignInput, type Options, type SimulateResponse } from '@/api'
import { Header } from '@/components/Header'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Wizard } from '@/features/wizard/Wizard'
import { STEPS } from '@/features/wizard/Stepper'

// Lazy-loaded: Results pulls in recharts, which is the bulk of the JS bundle. Splitting it
// out means the wizard-only path (most visits before the first "Run") never downloads it.
const Results = lazy(() => import('@/features/results/Results'))

function ResultsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}

const DESIGN_STORAGE_KEY = 'sheltersim.design'

function loadStoredDesign(): DesignInput | null {
  try {
    const raw = localStorage.getItem(DESIGN_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DesignInput) : null
  } catch {
    return null
  }
}

function storeDesign(design: DesignInput) {
  try {
    localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(design))
  } catch {
    // storage unavailable — design just won't survive a reload
  }
}

type View = 'wizard' | 'results'

export default function App() {
  const [options, setOptions] = useState<Options | null>(null)
  const [optionsError, setOptionsError] = useState(false)
  const [design, setDesign] = useState<DesignInput | null>(null)
  const [view, setView] = useState<View>('wizard')
  const [result, setResult] = useState<SimulateResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  // Which wizard step to open on: 0 (Location) on first run, Review after "Modify design" so
  // the just-reviewed design and its Edit links are right there instead of three Next clicks away.
  const [wizardStep, setWizardStep] = useState(0)

  const loadOptions = () => {
    setOptionsError(false)
    setOptions(null)
    getOptions()
      .then((opts) => {
        setOptions(opts)
        setDesign((current) => current ?? loadStoredDesign() ?? opts.defaults)
      })
      .catch(() => setOptionsError(true))
  }

  useEffect(loadOptions, [])

  const handleChange = (next: DesignInput) => {
    setDesign(next)
    storeDesign(next)
  }

  const handleRun = () => {
    if (!design) return
    setRunning(true)
    setRunError(null)
    simulate(design)
      .then((res) => {
        setResult(res)
        setView('results')
      })
      .catch((err: unknown) => {
        setRunError(err instanceof Error ? err.message : 'Simulation failed.')
      })
      .finally(() => setRunning(false))
  }

  return (
    <div className="bg-background text-foreground min-h-svh">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {optionsError ? (
          <div className="mx-auto mt-16 max-w-md">
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Server offline</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  ShelterSim couldn't reach the server. Start it with{' '}
                  <code className="bg-muted rounded px-1 py-0.5">npm run dev</code> from the
                  repo root, then retry.
                </p>
                <button
                  onClick={loadOptions}
                  className="border-input hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium"
                >
                  <RotateCw className="size-3.5" />
                  Retry
                </button>
              </AlertDescription>
            </Alert>
          </div>
        ) : !options || !design ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <section className="mb-6">
              <p className="text-muted-foreground max-w-2xl text-balance">
                Predict how warm your shelter stays through a Ladakh winter night — in seconds.
              </p>
            </section>

            {view === 'wizard' ? (
              <Wizard
                options={options}
                value={design}
                onChange={handleChange}
                onRun={handleRun}
                running={running}
                error={runError}
                initialStep={wizardStep}
              />
            ) : (
              result && (
                <Suspense fallback={<ResultsSkeleton />}>
                  <Results
                    data={result}
                    options={options}
                    onModify={() => {
                      setWizardStep(STEPS.length - 1)
                      setView('wizard')
                    }}
                  />
                </Suspense>
              )
            )}
          </>
        )}
      </main>
    </div>
  )
}
