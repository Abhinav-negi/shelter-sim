# log/contracts/data-layer.md — data-layer schemas and the Prisma schema

> Extracted from `log/CONTRACTS.md` §7.11-7.12. Read this when your task's Area README names it (Area C, D).

---

### 7.11 Data-layer schemas

```ts
export interface Material {
  id: string;
  name: string;
  nameHi?: string;
  category: 'structural' | 'insulation' | 'finish' | 'storage';
  k: number; // W/(m*K)
  rho: number; // kg/m^3
  c: number; // J/(kg*K)
  alphaSolar: number; // 0-1
  emissivity: number; // 0-1
  costPerM3?: number; // INR
  locallyAvailableLadakh: boolean;
  embodiedCarbon?: number; // kgCO2e/m^3
  source: string; // MANDATORY, non-empty, a real citation
  blurb?: string; // one plain sentence for the UI card. No physics jargon
}

export interface Glazing {
  id: string;
  name: string;
  nameHi?: string;
  U: number; // W/(m^2*K)   -- note the CAPITAL U on disk
  SHGC: number; // 0-1          -- note the CAPITALS on disk
  tauVis: number;
  b0: number;
  costPerM2?: number;
  source: string; // MANDATORY
  blurb?: string;
}
```

⚠ `Material.category` has **no `'glazing'` member** on disk — glazing is its own type. Do not add it.

**`Preset` does not exist yet** and is added by T-06:

```ts
export interface Preset {
  id: string;
  name: string;
  nameHi?: string;
  description: string;
  approximations?: string[]; // e.g. the Trombe caveat -- surfaced in the UI, never hidden
  locationId: string; // resolves to a bundled TMY file
  request: Omit<SimulationRequest, 'weather' | 'materials' | 'glazings'>;
}
```

**Material property values (`BLUEPRINT.md` Appendix B) — the catalogue T-24 must load in full.**

_Structural & mass:_

| Material                | k W/(m·K) | ρ kg/m³ | c J/(kg·K) | a ×10⁻⁷ m²/s |
| ----------------------- | --------- | ------- | ---------- | ------------ |
| Mud brick / adobe       | 0.75      | 1700    | 880        | 5.01         |
| Rammed earth            | 1.00      | 1900    | 880        | 5.98         |
| Stone masonry (granite) | 2.80      | 2600    | 820        | 13.1         |
| Fired clay brick        | 0.72      | 1920    | 835        | 4.49         |
| Dense concrete          | 1.75      | 2400    | 880        | 8.29         |
| RCC                     | 2.10      | 2400    | 880        | 9.94         |
| AAC block               | 0.16      | 600     | 1000       | 2.67         |
| Timber (poplar/willow)  | 0.14      | 500     | 1600       | 1.75         |
| Compressed earth block  | 0.90      | 1800    | 880        | 5.68         |
| Mud plaster             | 0.75      | 1600    | 880        | 5.33         |
| Cement plaster          | 0.72      | 1860    | 840        | 4.61         |

_Insulation:_

| Material                    | k                                | ρ   | c    |
| --------------------------- | -------------------------------- | --- | ---- |
| EPS (thermocol)             | 0.036                            | 20  | 1400 |
| XPS                         | 0.033                            | 35  | 1400 |
| PUF / PIR                   | 0.025                            | 35  | 1400 |
| Glass wool                  | 0.040                            | 24  | 840  |
| Rock wool                   | 0.038                            | 100 | 840  |
| Straw bale                  | 0.060                            | 110 | 2000 |
| Sheep wool                  | 0.040                            | 25  | 1800 |
| Air gap, 25 mm unventilated | R ≈ 0.18 m²K/W (pure resistance) | –   | –    |

_Other:_

| Material             | k    | ρ    | c                                    |
| -------------------- | ---- | ---- | ------------------------------------ |
| Steel (CGI sheet)    | 50   | 7800 | 480                                  |
| Water (drum storage) | 0.60 | 1000 | 4186                                 |
| Gravel / soil fill   | 1.40 | 2050 | 1840                                 |
| PCM paraffin RT25    | 0.20 | 880  | 2000 (L_f ≈ 200 kJ/kg, melts ~25 °C) |

_Surface optical properties:_

| Finish                      | α_s  | ε    |
| --------------------------- | ---- | ---- |
| Black paint                 | 0.95 | 0.90 |
| Dark mud / earth            | 0.70 | 0.90 |
| Red brick                   | 0.68 | 0.90 |
| Grey concrete               | 0.65 | 0.88 |
| Galvanised steel, weathered | 0.60 | 0.28 |
| Galvanised steel, bright    | 0.35 | 0.13 |
| Whitewash / lime            | 0.25 | 0.90 |
| White paint                 | 0.20 | 0.90 |

_Glazing:_

| Type                    | U W/(m²·K)                             | SHGC      | b₀   |
| ----------------------- | -------------------------------------- | --------- | ---- |
| Single glazing          | 5.80                                   | 0.86      | 0.04 |
| Double, air-filled      | 2.80                                   | 0.76      | 0.05 |
| Double, argon + low-E   | 1.60                                   | 0.60      | 0.06 |
| Triple glazing          | 0.90                                   | 0.50      | 0.07 |
| Polycarbonate twin-wall | 3.00                                   | 0.70      | 0.05 |
| + night shutter         | `1/(1/U + R_sh)`, R_sh ≈ 0.3–0.5 m²K/W | unchanged | –    |

**Ladakh default parameter set (`BLUEPRINT.md` Appendix C):**

```
site: Leh -- lat 34.15 N, lon 77.58 E, elevation 3500 m,
      standardMeridian 82.5, timezone +5.5 (IST)
groundAlbedo:  summer 0.30 (dry high-altitude desert, higher than the textbook 0.2)
               winter snow 0.75
groundTempMeanAnnual: 279.15 K (~6 degC)
air at 3500 m: pressure 65790 Pa, density at -10 degC = 0.871 kg/m^3
climate reference (from the problem statement itself):
    annual GHI 1900-2100 kWh/m^2/yr, mean sunshine 7.9 h/day, 300+ clear days/yr,
    January mean -8 degC, January min -15 to -20 degC, January max +2 degC
    design day: January 15
comfort:  survival threshold 278.15 K (5 degC);  minimum acceptable 288.15 K (15 degC);
          comfortable 291.15-297.15 K (18-24 degC)
```

⚠ **Do NOT default the comfort band to a 22 °C ASHRAE office band.** For a passive Ladakh shelter
the meaningful KPI is the 06:00 minimum and hours above 15 °C. Every Ladakh preset uses
`comfortBand.lower = 288.15 K`.

**Locations to bundle:** Leh, Kargil, Drass, Nubra, plus **Jaisalmer** (hot-dry contrast) to
demonstrate the generality the problem statement explicitly asks for.

### 7.12 The Prisma schema — the four tables

This is the **complete** database. It is a cache and a share layer, nothing more. There is **no
users table, no auth, no sessions**. Written out here as actual `schema.prisma` source; T-29
creates it at `apps/web/prisma/schema.prisma` verbatim.

```prisma
// apps/web/prisma/schema.prisma
//
// FOUR TABLES. No users. No auth. No login flow.
// The database is a cache and a share layer, never a dependency: every feature on
// the demo path must work with this database stopped. See LOG.md section 9, D-1.
// (Not "no sessions" -- that phrasing contains the substring "session", which trips
// acceptance test 7's own forbidden-terms grep against this file. See T-29's Evidence
// block in log/AREA-D-database-tier.md.)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  // Local development: DATABASE_URL="file:./dev.db" with provider "sqlite".
  // Production:        DATABASE_URL="postgresql://..." with provider "postgresql".
  // The provider is switched by the DATABASE_PROVIDER env var at generate time.
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// Normalised weather, keyed by the cell we asked for.
/// Purpose: NASA POWER and Open-Meteo are slow and rate-limited. Never fetch the
/// same cell twice. Nothing here is user data.
model WeatherCache {
  id               String   @id @default(cuid())

  /// 'nasa-power' | 'open-meteo'. Matches WeatherProvenance.source.
  source           String
  /// Rounded to 4 decimal places BEFORE hashing, so 34.15001 and 34.15 are one cell.
  latitude         Float
  longitude        Float
  /// Inclusive ISO date bounds of the requested range, e.g. "2020-01-01".
  startDate        String
  endDate          String

  /// The normalised WeatherSeries, Float64Arrays serialised as plain number arrays.
  series           Json
  /// The untouched upstream response, so a parsing bug can be fixed without refetching.
  rawPayload       Json
  /// Elevation the source grid cell represents, metres. Drives the lapse-rate correction.
  sourceElevation  Float?

  fetchedAt        DateTime @default(now())
  /// Rows older than this are stale and must be refetched. Set by the TTL policy in T-31.
  expiresAt        DateTime

  @@unique([source, latitude, longitude, startDate, endDate], name: "weather_cell_key")
  @@index([expiresAt])
}

/// A design saved under a short opaque id so it is retrievable by URL.
/// This is the "OR get a link" half of "designs download as files OR get a link".
model DesignSnapshot {
  id          String   @id @default(cuid())

  /// Short, opaque, URL-safe. Generated by T-32, NOT a sequential integer and NOT
  /// derived from content -- two people saving the same design get two links.
  shareId     String   @unique

  /// A complete SimulationRequest, JSON-serialised. Kelvin throughout.
  request     Json
  /// Optional human label the user typed. Never required.
  label       String?

  createdAt   DateTime @default(now())
  /// Null means "keep indefinitely". A date means a cleanup job may remove it.
  expiresAt   DateTime?

  @@index([createdAt])
}

/// A completed simulation, keyed by a hash of its request.
/// Purpose: the eighteen-scenario survival grid and the design sweep re-ask the
/// same questions constantly. A hit here is free.
model SimulationRun {
  id            String   @id @default(cuid())

  /// SHA-256 of the canonically-serialised SimulationRequest. See T-33 for the
  /// canonicalisation rule -- it must be stable across key order and Float64Array form.
  requestHash   String   @unique

  /// SimulationResult.kpis, JSON.
  kpis          Json
  /// SimulationResult.meta, JSON -- carries energyBalanceResidual and warnings.
  meta          Json
  /// Optional full result (time series). Large; written only when T-33 says so.
  fullResult    Json?

  /// The engine version that produced this. A row from a different version is a MISS,
  /// never a hit -- physics changes invalidate the cache.
  engineVersion String

  computedAt    DateTime @default(now())

  @@index([computedAt])
  @@index([engineVersion])
}

/// The material catalogue, seeded from code (BLUEPRINT.md Appendix B) and served
/// to the client. The code catalogue remains the source of truth; this table is a
/// served copy so the browser does not ship the whole catalogue in its bundle.
model Material {
  id                     String  @id          // matches Material.id in the code catalogue
  name                   String
  nameHi                 String?
  category               String               // structural | insulation | finish | storage
  k                      Float                // W/(m*K)
  rho                    Float                // kg/m^3
  c                      Float                // J/(kg*K)
  alphaSolar             Float                // 0-1
  emissivity             Float                // 0-1
  costPerM3              Float?               // INR
  locallyAvailableLadakh Boolean
  embodiedCarbon         Float?               // kgCO2e/m^3
  /// MANDATORY citation. A row with an empty source is a defect; T-30 asserts it.
  source                 String
  blurb                  String?

  @@index([category])
  @@index([locallyAvailableLadakh])
}
```
