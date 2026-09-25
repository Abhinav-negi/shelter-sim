// apps/studio-server/test/weather.resolve.test.ts — condition 2 (fetch a
// full reference year, Open-Meteo falling back to NASA POWER, normalised,
// groundTempMeanAnnual/standardMeridian/groundAlbedo) and the Rules line
// ("never invent weather values ... no fallback to a preset site"), all
// against recorded fixtures. No Mongo connected in this file (mongoose's
// default connection is untouched), so every call exercises the
// skip-the-cache path -- see weather.cache.test.ts for the connected case.

import { describe, expect, it, vi } from 'vitest';
import { UpstreamUnavailableError } from '../src/weather/errors.js';
import { resolveCustomWeather } from '../src/weather/resolve.js';
import type { CustomLocation } from '../src/weather/resolve.js';
import { jsonResponse, loadFixture } from './helpers/fetch.js';

const OPEN_METEO_FIXTURE = loadFixture('open-meteo-shimla-2023.json');
const NASA_FIXTURE = loadFixture('nasa-power-shimla-3day.json');

const SHIMLA: CustomLocation = { kind: 'custom', name: 'Shimla', lat: 31.10442, lon: 77.16662, elevation: 2073 };

function meanOf(arr: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i]!;
  return sum / arr.length;
}

describe('resolveCustomWeather', () => {
  it('Open-Meteo success: groundAlbedo=0.2, standardMeridian=utc_offset_seconds/3600*15, groundTempMeanAnnual=annual mean', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain('archive-api.open-meteo.com');
      expect(String(url)).toContain('timezone=auto'); // condition 2 gotcha: the frozen builder issues no timezone param
      return jsonResponse(OPEN_METEO_FIXTURE);
    }) as unknown as typeof fetch;

    const result = await resolveCustomWeather(SHIMLA, fetchImpl);

    expect(result.provenance.source).toBe('open-meteo');
    expect(result.provenance.year).toBe(2023);
    expect(result.site.groundAlbedo).toBe(0.2);
    // fixture's utc_offset_seconds is 19800 (IST, +5:30) -> 5.5 * 15 = 82.5 deg
    expect(result.site.standardMeridian).toBeCloseTo(82.5, 9);
    expect(result.site.groundTempMeanAnnual).toBeCloseTo(meanOf(result.weather.T_amb), 9);
    expect(result.weather.provenance.source).toBe('open-meteo');
  });

  it('falls back to NASA POWER when the Open-Meteo archive call fails', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).includes('archive-api.open-meteo.com')) return jsonResponse({}, false, 500);
      return jsonResponse(NASA_FIXTURE);
    }) as unknown as typeof fetch;

    const result = await resolveCustomWeather(SHIMLA, fetchImpl);

    expect(result.provenance.source).toBe('nasa-power');
    // nearest 15deg meridian to 77.16662 -> round(77.16662/15)*15 = 75
    expect(result.site.standardMeridian).toBe(75);
    expect(result.site.groundAlbedo).toBe(0.2);
  });

  it('both sources failing throws UpstreamUnavailableError -- never invents a value or falls back to a preset', async () => {
    const fetchImpl = (async () => jsonResponse({}, false, 500)) as unknown as typeof fetch;
    await expect(resolveCustomWeather(SHIMLA, fetchImpl)).rejects.toBeInstanceOf(UpstreamUnavailableError);
  });
});
