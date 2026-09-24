import type { SimulationKpis } from '@shelter/engine'

export type Severity = 'good' | 'warn' | 'danger'

export interface Insight {
  severity: Severity
  text: string
}

const kToC = (k: number) => k - 273.15

/**
 * Turns raw KPIs into up to three plain-language sentences a non-expert
 * judge can read in ~10 seconds, each tagged with a severity for colour
 * coding. Pure function (no JSX, no fetch) so it's trivial to eyeball
 * against the Leh fixture without rendering anything.
 *
 * Priority order (most safety-critical first): pre-dawn temperature vs
 * freezing, hours spent below freezing, auxiliary heating need, then the
 * decrement factor (how well the walls buffer the outdoor swing) — this
 * last one is dropped if the other three already fill the 3-sentence quota.
 */
export function explain(kpis: SimulationKpis): Insight[] {
  const insights: Insight[] = []
  const dawnC = kToC(kpis.tempAt0600)

  if (dawnC < 0) {
    insights.push({
      severity: 'danger',
      text: `The coldest point of the night (06:00) drops to ${dawnC.toFixed(1)}°C — below freezing, so the shelter alone won't keep water or occupants safely above 0°C.`,
    })
  } else if (dawnC < 5) {
    insights.push({
      severity: 'warn',
      text: `The coldest point of the night (06:00) is ${dawnC.toFixed(1)}°C — above freezing, but still cold enough that occupants will feel it.`,
    })
  } else {
    insights.push({
      severity: 'good',
      text: `The coldest point of the night (06:00) stays at ${dawnC.toFixed(1)}°C — comfortably above freezing on passive design alone.`,
    })
  }

  if (kpis.hoursBelowFreezing > 0) {
    const hrs = kpis.hoursBelowFreezing
    insights.push({
      severity: hrs > 6 ? 'danger' : 'warn',
      text: `Indoor air spends ${hrs.toFixed(1)} hour${hrs === 1 ? '' : 's'} below freezing over the simulated day.`,
    })
  }

  if (kpis.auxEnergyKWhPerDay > 0) {
    const kerosene = kpis.keroseneEquivalentLitresPerYear
    insights.push({
      severity: 'warn',
      text: `Passive design isn't enough alone: ${kpis.auxEnergyKWhPerDay.toFixed(1)} kWh/day of auxiliary heating is needed${
        kerosene > 0 ? `, about ${Math.round(kerosene)} L of kerosene a year` : ''
      }.`,
    })
  }

  insights.push({
    severity: kpis.decrementFactor < 0.4 ? 'good' : kpis.decrementFactor < 0.7 ? 'warn' : 'danger',
    text: `The walls smooth out ${((1 - kpis.decrementFactor) * 100).toFixed(0)}% of the outdoor temperature swing (decrement factor ${kpis.decrementFactor.toFixed(2)}, lower is better) — ${
      kpis.decrementFactor < 0.4 ? 'strong thermal mass at work' : 'more insulation or mass would help'
    }.`,
  })

  return insights.slice(0, 3)
}
