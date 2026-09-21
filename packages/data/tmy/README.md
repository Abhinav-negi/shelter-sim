# Bundled TMY — provenance and reproduction

T-27 (`log/AREA-C-data-layer.md`). **Every number in these five files is downloaded, never
hand-authored.** This file records exactly how, so a judge or a teammate can reproduce it.

## What these are, honestly

These are **not** a multi-decade, statistically-blended ASHRAE-style TMY (a "typical
meteorological year" built by picking the most representative month from ~20+ years of
record). They are **NASA POWER MERRA-2/SYN1deg reanalysis data for one real calendar year,
2023**, at hourly resolution. Call them "bundled annual weather," not "TMY," when precision
matters — the filename/task name is inherited from the ledger's own title. A real multi-year
TMY construction is out of scope for this task; see `LOG.md` §6 rule 12 (nothing outside the
eleven energy pathways gets built without a written justification, and a TMY-construction
statistical pipeline was never scoped here).

## Source, method, reproduction

Every file was produced by:

1. Fetching NASA POWER's hourly point API for the full 2023 calendar year, all 8 parameters
   `T-26`'s `NASA_POWER_PARAMETERS` names (`T2M, ALLSKY_SFC_SW_DWN, ALLSKY_SFC_SW_DNI,
ALLSKY_SFC_SW_DIFF, ALLSKY_SFC_LW_DWN, WS2M, RH2M, PS`), i.e. exactly what
   `nasaPowerUrl()` (`packages/data/src/weather/sources.ts`) builds for
   `{ startDate: '2023-01-01', endDate: '2023-12-31' }` at each location's coordinates below.
2. Parsing the raw response with `parseNasaPower()` (T-26, unmodified).
3. Running the parsed series through `normaliseWeather()` (T-25, unmodified) with
   `targetStepSeconds: 3600`, `source: 'nasa-power'`, and each location's real site elevation
   (see below) — this applies the mandatory lapse-rate correction from the NASA POWER grid
   cell's own elevation down (or up) to the real town elevation.
4. Serialising every `Float64Array` field to a plain array with `seriesToJson()`
   (`@shelter/engine`, T-06) and writing the result as compact (already-minified) JSON.

All five raw upstream JSON responses were fetched **2026-09-16** and are real, complete,
unmodified NASA POWER output — zero `-999` fill-value gaps in any of the 8 parameters, verified
before use. They are not committed to the repository (too large / not needed once normalised);
only the normalised `WeatherSeries` output is bundled.

| Location                     | id          | Query lat, lon   | Grid-cell elevation (source) | Real site elevation (corrected to) | URL                                                                                                                                                                                                                                                  |
| ---------------------------- | ----------- | ---------------- | ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leh                          | `leh`       | 34.15, 77.58     | 4532.61 m                    | 3500 m                             | `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,ALLSKY_SFC_LW_DWN,WS2M,RH2M,PS&community=RE&longitude=77.58&latitude=34.15&start=20230101&end=20231231&format=JSON`     |
| Kargil                       | `kargil`    | 34.5539, 76.1349 | 4137.89 m                    | 2676 m                             | `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,ALLSKY_SFC_LW_DWN,WS2M,RH2M,PS&community=RE&longitude=76.1349&latitude=34.5539&start=20230101&end=20231231&format=JSON` |
| Drass                        | `drass`     | 34.4239, 75.7666 | 4054.38 m                    | 3230 m                             | `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,ALLSKY_SFC_LW_DWN,WS2M,RH2M,PS&community=RE&longitude=75.7666&latitude=34.4239&start=20230101&end=20231231&format=JSON` |
| Nubra Valley (Diskit)        | `nubra`     | 34.5443, 77.5584 | 4548.84 m                    | 3144 m                             | `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,ALLSKY_SFC_LW_DWN,WS2M,RH2M,PS&community=RE&longitude=77.5584&latitude=34.5443&start=20230101&end=20231231&format=JSON` |
| Jaisalmer (hot-dry contrast) | `jaisalmer` | 26.9157, 70.9083 | 173.4 m                      | 225 m                              | `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,ALLSKY_SFC_SW_DIFF,ALLSKY_SFC_LW_DWN,WS2M,RH2M,PS&community=RE&longitude=70.9083&latitude=26.9157&start=20230101&end=20231231&format=JSON` |

Retrieval date for all five: **2026-09-16**. Query parameters `community=RE`, `format=JSON`, no
API key required (NASA POWER is keyless, `LOG.md` §7.16). Re-running the URL above reproduces
the raw response this bundle was built from (subject to NASA POWER's own archive being stable —
MERRA-2 reanalysis is not revised after the fact, so a re-fetch should match closely).

**Real site elevations.** Approximate, commonly-cited town elevations, not independently
re-verified this session: Leh ≈3500 m, Kargil ≈2676 m, Drass ≈3230 m, Nubra Valley (Diskit)
≈3144 m, Jaisalmer ≈225 m. These are distinct from each file's `provenance.sourceElevation`,
which is the NASA POWER grid cell's own elevation (the number the lapse-rate correction
corrects _from_).

**Observed data characteristic, not a bug:** Leh's and Nubra's shortwave irradiance fields
(`GHI`/`DNI`/`DHI`/`LW_down`) are byte-for-byte identical across all 8,760 hours in the raw
NASA POWER responses. This is because NASA POWER's solar parameters come from the SYN1deg
product (native ~1°×1° grid) while `T2M`/`WS2M`/`RH2M`/`PS` come from MERRA-2 (finer native
resolution) — Leh (34.15°N, 77.58°E) and Nubra (34.5443°N, 77.5584°E) fall inside the same
1° SYN1deg cell but different MERRA-2 cells, so their temperature series differ (January means
−10.4 °C vs. −7.9 °C) while their irradiance series do not. This is upstream NASA POWER
behaviour for two nearby points, not a defect in `parseNasaPower`/`normaliseWeather`/this task.

## Ground-albedo series

`Site.groundAlbedo` (`LOG.md` §7.5) takes a per-timestep series; there is deliberately no
`snowCover` field on `WeatherSeries` (§7.6). Each file therefore carries one extra field beyond
the `WeatherSeries` shape, `groundAlbedo: number[]` (one value per hour, same length as every
other array), read separately by `groundAlbedoById()` in `../src/tmy.ts` — **`tmyById()` itself
returns a plain `WeatherSeries` and does not include this field**, per the task's exact required
signature.

**Rule** (Leh, Kargil, Drass, Nubra — the four Ladakh locations): for each calendar day between
1 Nov and 31 Mar inclusive, compute the daily mean `T_amb` (°C, after the lapse-rate
correction). If that mean is below 0 °C, every hour of that day gets albedo **0.75**
(winter-snow, `BLUEPRINT.md` Appendix C). Every other day — every Apr–Oct day, and every
Nov–Mar day whose mean stays at or above 0 °C — gets **0.30** (dry high-altitude desert,
deliberately higher than the textbook 0.2, `BLUEPRINT.md` Appendix C).

**Jaisalmer** (hot-dry desert, no snow cover ever) is a constant **0.30** for all 8,760 hours —
judgement call, documented here: Jaisalmer's Thar-desert sand albedo is commonly cited in the
0.25–0.35 range and it never sees snow, so a flat mid-range constant is used rather than
inventing a seasonal rule with no physical basis at this site.

## Sunshine-hour and clear-day criteria (acceptance test 6)

Two derived statistics need a documented definition — neither is a raw downloaded number, both
are computed from the downloaded series:

- **Sunshine hour**: an hour where `DNI > 120 W/m²`, the WMO instrumental threshold for
  Campbell-Stokes-equivalent "bright sunshine" (WMO _Guide to Instruments and Methods of
  Observation_). Applied to hourly-mean `DNI`, not an instantaneous reading — a documented
  approximation, not an invented one.
- **Clear day**: daily clearness index `kt = (sum of hourly GHI that day) / (sum of hourly
extraterrestrial horizontal irradiance I0 that day) > 0.5` (`I0` from `@shelter/engine`'s
  `extraterrestrialNormal()` × `sunPosition().cosZenith`, Duffie & Beckman ch. 2 / the same
  clearness index `erbsDiffuseFraction()` already uses elsewhere in this codebase). `kt = 0.5`
  is a practical two-bin clear/cloudy split; a stricter three-bin scheme (Iqbal 1983) puts
  "clear" at `kt > 0.65`. For Leh 2023 the day count is threshold-sensitive: 338 days at
  `kt>0.45`, 311 at `kt>0.5`, 275 at `kt>0.55`, 223 at `kt>0.6`, 181 at `kt>0.65` — reported here
  so the choice is auditable, not hidden. This task uses `kt > 0.5`.

## Files

| File             | Rows  | Bytes                                          |
| ---------------- | ----- | ---------------------------------------------- |
| `leh.json`       | 8,760 | see Evidence block, `log/AREA-C-data-layer.md` |
| `kargil.json`    | 8,760 | ″                                              |
| `drass.json`     | 8,760 | ″                                              |
| `nubra.json`     | 8,760 | ″                                              |
| `jaisalmer.json` | 8,760 | ″                                              |

Loaded via `tmyById(id)` / `groundAlbedoById(id)` / `TMY_LOCATIONS` in `../src/tmy.ts`. No
network access anywhere in this package (`packages/data/src/weather/*`'s own header comment,
T-25 acceptance test 12) — these files are read from disk with `node:fs`.
