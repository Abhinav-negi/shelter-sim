# EQUATIONS.md — ShelterSim governing equations, citations and simplifications

> Task T-64 (`log/AREA-I-validation-credibility.md`). Every equation the engine
> implements: symbols and units, literature citation, the `BLUEPRINT.md` /
> `ENGINE_BLUEPRINT.md` section it came from, the `file:function` that implements
> it, and the simplification taken at each step with its ceiling and upgrade path.
> Documentation only — this file adds no code and edits no historical `.md`.
>
> **How this document was built:** by reading `log/CONTRACTS.md` §7.10 ("The
> physics, restated" — the primary source, already anchored and cited) and then
> every exported function in `packages/engine/src/{solar,surfaces,loads,envelope,
> storage,solve}/`, plus `packages/engine/src/constants.ts`, `air.ts` and
> `units.ts`. Where the code and `BLUEPRINT.md`/`ENGINE_BLUEPRINT.md` disagree,
> **this document follows the code** (`log/CONTRACTS.md` §9, and see "Three
> spot-checks" near the end of this file).

---

## 1. Document scope and conventions

**Citation:** SI units and the Kelvin/degree discipline follow `LOG.md` §6 rule 5
("Kelvin everywhere inside `packages/*`") and `ENGINE_BLUEPRINT.md` §5.1.
**Implements:** `packages/engine/src/units.ts:rad`, `packages/engine/src/units.ts:deg`,
`packages/engine/src/units.ts:toK`, `packages/engine/src/units.ts:toC`.

- **Temperatures** are Kelvin everywhere inside `packages/engine`; Celsius exists
  only at the `toK`/`toC` seam (`units.ts`), used by `apps/web/lib/units.ts`.
  Temperature *differences* are plain, unbranded `number` in Kelvin-degrees
  (identical to Celsius-degrees, so branding a ΔT would invite a wrong conversion).
- **Angles** are degrees at every function boundary; a function converts to
  radians internally via `rad()` and back via `deg()`. Any local variable holding
  radians is suffixed `Rad` (e.g. `omegaRad`, `thetaZ` where noted).
- **Azimuth convention** (used by every solar and geometry function): **south =
  0°, east = negative, west = positive.** Tilt is degrees from horizontal (0° =
  facing straight up, 90° = vertical).
- **Angles/lengths/time**: metres and m² for length/area, seconds for durations,
  `dayOfYear` 1–365, `clockHour`/`hourOfDay` 0–24 fractional.
- **Sign convention for every `Q` term** is given verbatim in §3 below.

---

## 2. Symbol glossary

**Citation:** symbols follow Duffie & Beckman, *Solar Engineering of Thermal
Processes* (for all solar-geometry and irradiance symbols) and standard heat-
transfer notation (Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer*)
elsewhere; SI units per `LOG.md` §6 rule 5.
**Implements:** `packages/engine/src/units.ts:rad`, `packages/engine/src/constants.ts`.

| Symbol | Meaning | Unit |
|---|---|---|
| `T`, `T_amb`, `T_sky`, `T_surf`, `T_air`, `T_star`/`T_mrt`, `T_ground` | Temperature (node, ambient, sky, surface, indoor air, mean-radiant star node, ground) | K |
| `Q1`…`Q11`, `Qaux` | The eleven heat pathways + auxiliary heating (§4) | W |
| `dt`, `Δt` | Integration timestep | s |
| `n` | Number of mesh nodes (a wall chain) or (in `luFactor`) matrix size | – |
| `C`, `C_j` | Node capacitance (per node, or per unit area before multiplying by area) | J/K (or J/(m²·K)) |
| `U` | Conductance (edge, interface, or whole-construction) | W/(m²·K) or W/K |
| `k` | Thermal conductivity | W/(m·K) |
| `ρ` (`rho`) | Density | kg/m³ |
| `c` | Specific heat capacity | J/(kg·K) |
| `a` | Thermal diffusivity, `a = k/(ρc)` | m²/s |
| `d` | Penetration/damping depth | m |
| `P` | Period of a periodic driver (86400 s daily, 365 d annual) | s |
| `ω` (`omega`) | Angular frequency, `ω = 2π/P` | rad/s |
| `f` | Decrement factor (amplitude ratio) | dimensionless, 0–1 |
| `φ` (`phi`) | Time lag | h or s |
| `σ` (`SIGMA`) | Stefan-Boltzmann constant | W/(m²·K⁴) |
| `ε` (`epsilon`/`emissivity`) | Surface emissivity | 0–1 |
| `α_s` (`alphaSolar`/`exteriorAbsorptivity`) | Solar absorptivity | 0–1 |
| `h_o`, `h_i`, `h_r,sky`, `h_r,i` | Exterior convective, interior convective, sky-radiative, interior-radiative coefficients | W/(m²·K) |
| `θ` (`theta`) | Angle of incidence (sun to surface normal) | deg (rad internally) |
| `θ_z` (`thetaZ`, `sun.zenith`) | Solar zenith angle | deg |
| `α_s`, `α` (altitude) | Solar altitude above the horizon | deg |
| `β` (`beta`) | Surface tilt from horizontal | deg |
| `γ_s`, `γ` (`gamma`) | Solar azimuth, surface azimuth (south = 0) | deg |
| `δ` (`delta`, `declination`) | Solar declination | deg |
| `φ` (`phi`, latitude) | Site latitude | deg N |
| `ω` (`omega`, hour angle) | Solar hour angle, 15°/h from solar noon | deg |
| `E` | Equation of time | min |
| `GHI`, `DNI`, `DHI` | Global horizontal, direct normal, diffuse horizontal irradiance | W/m² |
| `I0`, `I0n`, `I0h` | Extraterrestrial irradiance (normal, horizontal) | W/m² |
| `k_t` | Clearness index, `GHI/I0h` | 0–1 |
| `ρ_ground` (`groundAlbedo`) | Ground albedo | 0–1 |
| `M` | Air-capacitance calibration multiplier | dimensionless (§9.9) |
| `ACH` | Air changes per hour | h⁻¹ |
| `ṁ` (`massFlow`) | Air mass flow rate | kg/s |
| `U` (window), `SHGC`, `b0`, `IAM` | Glazing U-value, solar heat gain coefficient, IAM coefficient, incidence angle modifier | W/(m²·K), 0–1, dimensionless, 0–1 |
| `z` | Depth below grade | m |
| `T_mean`, `A_s` | Mean-annual soil temperature, annual amplitude | K |
| `L_f` (`latentHeat`) | PCM latent heat of fusion | J/kg |
| `c_apparent` | PCM apparent specific heat | J/(kg·K) |
| `g(τ)` | PCM enthalpy antiderivative | J/kg |
| `p(h)` | Atmospheric pressure at altitude `h` | Pa |
| `h` (altitude context) | Site elevation | m |
| `residual`, `E_net`, `E_gross`, `ΔStored` | Energy-balance terms (§4) | dimensionless, J, J, J |
| `L_loc`, `L_st` | Site longitude, standard-meridian longitude | deg E |
| `v` (windSpeed) | Wind speed | m/s |
| `t_clock`, `t_solar` | Local clock time, solar time | h |
| `n` (mesh context) | Diffuse fraction / clearness-index exponent variable is `k_t`; `n` in §7–§9 means day-of-year unless stated as node count (envelope/solve context) | 1–365, or count |
| `Bi` | Biot number (lumped-capacitance validity criterion, §20) | dimensionless |
| `K`, `B`, `D`, `S`, `y`, `z` | Block-matrix labels for the arrow/Schur factorisation (§22) — `K` block-diagonal chain conductance, `B`/`Bᵀ` chain-to-boundary coupling, `D` boundary self-coupling, `S` the 2×2 Schur complement, `y`/`z` the chain and boundary unknown vectors. Locally scoped to §22 only, not used elsewhere in this document. | W/K (matrix entries), K (solution vectors) |

---

## 3. Sign convention — quoted verbatim from `CONTRACTS.md` §7.2

**Citation:** `log/CONTRACTS.md` §7.2 (this project's own contracts document;
authoritative per `LOG.md` §6 rule 1). This block is reproduced **word for word**,
as required by this task's acceptance tests.
**Implements:** `packages/engine/src/types.ts` (the `Q1`…`Q11`, `Qaux`,
`storageRate` fields the convention governs), `packages/engine/src/solve/
integrator.ts:integrate` → `record()` (where every `Q` term below is actually
computed with this sign, every timestep).

> **Every `Q` term is in watts and is positive when it adds energy to the
> modelled system, negative when it removes energy from it.** The modelled
> system = all solved nodes (every wall node, the air node, every storage node).
> Ambient air, the sky and deep soil are boundary conditions, outside it.
>
> Consequences every task must respect:
>
> - `Q4_skyRadiation` is **almost always negative**. It is written
>   `hRSky · (T_sky − T_surf)` and `T_sky < T_surf` on any Ladakh night.
> - `Q3`, `Q8`, `Q9`, `Q10` are written `coefficient · (T_boundary − T_system)`
>   and therefore carry their own sign; they go positive on the rare occasions
>   ambient or ground is warmer.
> - `Q1`, `Q2`, `Q11`, `Qaux` are **always ≥ 0**.
> - `Q5`, `Q6`, `Q7` are **internal redistribution**. They move energy between
>   solved nodes and cross no system boundary. They are reported for the user's
>   benefit and are **excluded from the energy-balance residual** (§7.4).

**The eleven pathways** (`log/CONTRACTS.md` §7.3, reproduced for reference — the
`Q1`…`Q11` field names on disk, matching `packages/engine/src/types.ts` and
computed in `packages/engine/src/solve/integrator.ts:integrate`'s internal
`record()` step):

| # | Field name (as implemented) | Pathway | Sign |
|---|---|---|---|
| Q1 | `Q1_solarOpaque` | Solar absorbed on opaque exterior surfaces | ≥ 0 |
| Q2 | `Q2_solarGlazed` | Solar transmitted through glazing | ≥ 0 |
| Q3 | `Q3_extConvection` | Exterior surface ↔ ambient air convection | ± |
| Q4 | `Q4_skyRadiation` | Exterior surface ↔ sky longwave | ≤ 0 normally |
| Q5 | `Q5_envelopeConduction` | Conduction through the opaque envelope | ± internal |
| Q6 | `Q6_intConvection` | Interior surface ↔ indoor air convection | ± internal |
| Q7 | `Q7_interiorLongwave` | Interior surface ↔ interior surface longwave | ± internal |
| Q8 | `Q8_windowConduction` | Conduction through glazing | ± |
| Q9 | `Q9_infiltration` | Infiltration / ventilation air exchange | ± |
| Q10 | `Q10_ground` | Conduction to ground through the floor | ± |
| Q11 | `Q11_internalGains` | Internal gains (people, stove, livestock) | ≥ 0 |
| — | `Qaux` | Auxiliary heating actually delivered | ≥ 0 |
| — | `storageRate` | Rate of change of energy stored in the fabric | ± |

---

## 4. Energy-balance residual — quoted verbatim from `CONTRACTS.md` §7.4

**Citation:** `log/CONTRACTS.md` §7.4; the definition is itself copied verbatim
as a comment above `energyBalance()`, per that section's own text.
**Implements:** `packages/engine/src/post/energyBalance.ts:energyBalance`;
the PCM latent-heat correction inside it calls
`packages/engine/src/storage/pcm.ts:pcmEnthalpy`.

> **Control volume:** all solved nodes (all wall nodes, the air node, all storage
> nodes).
>
> **Boundary terms** — the only terms that enter the residual, because only
> these cross the control-volume boundary:
>
> ```
> BOUNDARY = { Q1, Q2, Q3, Q4, Q8, Q9, Q10, Q11, Qaux }
> ```
>
> **Excluded**, because they are internal redistribution between solved nodes
> and cancel exactly:
>
> ```
> INTERNAL = { Q5, Q6, Q7 }
> ```
>
> **Accumulation, per timestep of length Δt:**
>
> ```
> E_net    = Σ_steps  Δt · Σ_{q ∈ BOUNDARY}  q(t)      [J]  signed, per §7.2
> E_gross  = Σ_steps  Δt · Σ_{q ∈ BOUNDARY} |q(t)|     [J]  gross throughput
> ```
>
> **Stored energy:**
>
> ```
> ΔStored = Σ_nodes  C_j · ( T_j(t_end) − T_j(0) )
> ```
>
> with the indoor air node using its **effective** capacitance (`M = 4`
> multiplier, §9.9). When a PCM node exists (T-19), its contribution must
> instead be evaluated by integrating the **apparent** heat capacity along that
> node's own temperature history by trapezoidal rule — never as
> `C_j(T_end) · ΔT`, which silently mis-counts latent heat.
>
> **Residual:**
>
> ```
> residual = | E_net − ΔStored | / E_gross        dimensionless FRACTION
> ```
>
> - **Normalising by `E_gross`, not by `E_in`**, is deliberate. `AUDIT.md` found
>   the `E_in` normalisation degenerates for night-only reporting windows where
>   gains are near zero. `E_gross` is strictly positive for any window of
>   nonzero length.
> - **Units: a dimensionless fraction.** `0.001` means 0.1 %.
> - **Pass threshold: `residual < 0.001`.** Asserted in CI on every preset (T-62).
> - **UI display rule:** the badge renders `(residual * 100).toFixed(3) + '%'`,
>   labelled "energy balance". A displayed `0.020%` corresponds to a stored
>   value of `0.0002`. This resolves the `< 0.001` vs `0.02%` dimensional
>   mismatch `AUDIT.md` flagged in the project's own headline credibility
>   number.

**As actually implemented** (`packages/engine/src/post/energyBalance.ts:
energyBalance`, matching the above exactly): boundary terms are summed over
`[Q1, Q2, Q3, Q4, Q8, Q9, Q10, Q11, Qaux]`; `deltaStored` sums `C_i · ΔT_i` over
every node (node 0's capacitance replaced with the frozen `airCapacitance`); for
every `kind: 'pcm'` storage node, the plain `C·ΔT` term for that node is
subtracted back out and replaced by `massKg · (pcmEnthalpy(T_end) −
pcmEnthalpy(T_0))`, i.e. the closed-form integral of the apparent heat capacity,
not a `C(T_end)·ΔT` approximation.

---

## 5. Physical constants — `packages/engine/src/constants.ts`

**Citation:** `ENGINE_BLUEPRINT.md` §5.1 (physical constants); `TECH.md` §10.4
(kerosene fuel/cost/carbon figures); `WORKERS.md` §1.5 rule 7 (`ACH_MIN`).
**Implements:** `packages/engine/src/constants.ts` (every export below is
`constants.ts:<NAME>`).

| Constant | Value | Unit | Meaning |
|---|---|---|---|
| `SIGMA` | 5.670374419 × 10⁻⁸ | W/(m²·K⁴) | Stefan-Boltzmann constant |
| `G_SC` | 1367 | W/m² | Solar constant |
| `C_P_AIR` | 1005 | J/(kg·K) | Specific heat of air at constant pressure |
| `R_AIR` | 287.05 | J/(kg·K) | Specific gas constant, dry air |
| `P0` | 101325 | Pa | Sea-level standard atmospheric pressure |
| `ACH_MIN` | 0.35 | h⁻¹ | Hard ventilation safety floor (never negotiable — `LOG.md` §6 rule 10) |
| `LAPSE_RATE` | 6.5 × 10⁻³ | K/m | Environmental lapse rate (note: **per metre**, not per km) |
| `T_MIN_PLAUSIBLE` | 173 | K (−100 °C) | Solver-divergence lower guard |
| `T_MAX_PLAUSIBLE` | 373 | K (+100 °C) | Solver-divergence upper guard |
| `PRIMARY_METRIC` | `'auxEnergyKWhPerDay'` | identifier | Primary ranking metric name; lower is better |
| `SECONDARY_METRIC` | `'tempAt0600'` | identifier | Tie-break metric name; higher is better |
| `RANK_NOISE_FLOOR` | 0.05 | kWh/day | Variants closer than this on the primary metric are TIED, never ordered |
| `ACH_MIN_COMBUSTION_ALLOWANCE` | 0.35 | h⁻¹ | Added to `ACH_MIN` when a design has unvented combustion (floors the bukhari case at 0.70 ACH) |
| `KEROSENE_KWH_PER_L` | 10.4 | kWh/L | Chemical energy per litre of kerosene (~37.6 MJ/L) |
| `KEROSENE_STOVE_EFFICIENCY` | 0.55 | dimensionless, 0–1 | Typical unvented kerosene heater, delivered/chemical |
| `KEROSENE_CO2_KG_PER_L` | 2.5 | kgCO₂/L | CO₂ emitted per litre of kerosene burned |
| `KEROSENE_INR_PER_L` | 80 | INR/L | **Assumption, not a sourced figure** — no source document states a kerosene price; must stay editable in the UI and cited wherever quoted |

---

## 6. Air at altitude — `packages/engine/src/air.ts`

**Citation:** ISA (International Standard Atmosphere) barometric formula and the
ideal gas law; `ENGINE_BLUEPRINT.md` §5.2; `AUDIT.md` F-5 (altitude correction
made mandatory for both `h_o` and `h_i`, not an optional refinement).
**Implements:** `packages/engine/src/air.ts:pressureAtAltitude`,
`packages/engine/src/air.ts:airDensity`, `packages/engine/src/air.ts:densityRatio`,
`packages/engine/src/air.ts:convectionAltitudeFactor`.

*Note: `air.ts` sits outside the six directories this task's acceptance test 2
diffs against (`solar/`, `surfaces/`, `loads/`, `envelope/`, `storage/`,
`solve/`), but it is cited by name in `CONTRACTS.md` §7.10 as the first physics
module and is a direct dependency of `surfaces/exterior.ts`, `surfaces/
interior.ts` and `loads/infiltration.ts`, so it is documented here for
completeness.*

```
p(h)   = P0 · (1 − 2.25577e-5 · h)^5.25588              [Pa]           pressureAtAltitude
ρ      = p(h) / (R_AIR · T)                              [kg/m³]        airDensity
ratio  = p(h) / P0  ( = ρ(h)/ρ(0) at equal T )            [–]            densityRatio
f_conv = sqrt(ratio)                                      [–]            convectionAltitudeFactor
```

**Anchors** (`log/CONTRACTS.md` §7.10): `airPressure(3500) = 65790 Pa ± 50`;
`airDensity(3500, 263 K) = 0.871 ± 0.005`; `airDensity(0, 263 K) = 1.342 ±
0.005`; ratio at Leh `= 0.65 ± 0.01`, giving convection factor `sqrt(0.65) =
0.806`; `airDensity(0, 288.15) = 1.225 ± 0.005` (ISA sea level).

**Simplification** (`convectionAltitudeFactor`, `air.ts` inline `ponytail:`
comment): convection is assumed to scale with `density^0.5` in the mixed
forced/natural regime the surface correlations use, rather than the full linear
density ratio. **Ceiling:** the exponent 0.5 is a simplification of the
Nusselt–Reynolds power-law scaling, not measured at altitude. **Upgrade path:**
measure against a high-altitude convective-heat-transfer dataset if one ever
becomes available, and recalibrate the exponent.

---

## 7. Solar position — `packages/engine/src/solar/geometry.ts`

**Citation:** Duffie & Beckman, *Solar Engineering of Thermal Processes*, ch. 1
(eq. 1.5.3 equation of time via Spencer 1971; eq. 1.6.3 incidence angle);
Cooper (1969) declination; `BLUEPRINT.md` 5.3, `ENGINE_BLUEPRINT.md` 5.3.
**Implements:** `packages/engine/src/solar/geometry.ts:equationOfTime`,
`:declination`, `:solarTimeHours`, `:hourAngle`, `:sunPosition`, `:cosIncidence`,
`:halfDayHours`, `:solarNoonClockHour`, `:sunriseSunset`.

```
E(n)          = 229.2·(0.000075 + 0.001868·cos B − 0.032077·sin B
                        − 0.014615·cos 2B − 0.04089·sin 2B),  B = 360(n−1)/365   [min]
δ(n)          = 23.45·sin(360(284+n)/365)                                        [deg]
t_solar       = t_clock + 4·(L_loc − L_st) + E                                   [h]
ω             = 15·(t_solar − 12)                                                [deg]
sin(α_s)      = sin(φ)sin(δ) + cos(φ)cos(δ)cos(ω)
γ_s           = atan2( sin ω, cos ω·sin φ − tan δ·cos φ )                        [deg]   (south=0, east<0, west>0)
cos θ         = cos θ_z·cos β + sin θ_z·sin β·cos(γ_s − γ),  clamped ≥ 0
half-day (h)  = acos( −tan φ · tan δ ) / 15,  clamped to [0, 12]  (0 = polar night, 12 = midnight sun)
```

**Anchors** (`CONTRACTS.md` §7.10): peak solar altitude at Leh (34.15°N,
77.58°E) **32.4°** on 21 Dec, **55.85°** at the equinoxes, **79.3°** on 21 Jun,
each ± 0.2°. Longitude correction `4·(77.58 − 82.5) = −19.7 min`.

**Documented deviation from `ENGINE_BLUEPRINT.md` 5.3 (spot-check #1, see
§11 below):** `ENGINE_BLUEPRINT.md` 5.3 prints `t_solar = t_clock + 4·(L_st −
L_loc) + E`. That sign is inverted for this project's east-positive-longitude
convention. Converting Duffie & Beckman's own west-positive form to east-
positive gives `t_solar = t_clock + 4·(L_loc − L_st) + E`, which is what the
code implements and what the worked example (Leh sits west of the 82.5°E IST
meridian, so solar noon is ~12:20 IST, ~19.7 min *after* clock noon) requires.
The "peak altitude = 32.4° on 21 Dec" self-check cannot catch this sign error
(it is evaluated at solar noon either way); `solarNoonClockHour()` and the
sunrise/sunset tests do.

---

## 8. Irradiance decomposition (Erbs correlation) — `packages/engine/src/solar/decomposition.ts`

**Citation:** Erbs, Klein & Duffie (1982), "Estimation of the diffuse radiation
fraction for hourly, daily and monthly-average global radiation"; `BLUEPRINT.md`
5.4 step 3.
**Implements:** `packages/engine/src/solar/decomposition.ts:extraterrestrialNormal`,
`:erbsDiffuseFraction`, `:decompose`.

```
I0n(n)   = G_SC · (1 + 0.033·cos(360n/365))                       [W/m²]
I0h      = I0n · cosθ_z
k_t      = clamp( GHI / I0h, 0, 1 )   (I0h > 1 else k_t = 0)
diffuse fraction (three branches, Erbs):
  k_t ≤ 0.22:            1 − 0.09·k_t
  0.22 < k_t ≤ 0.8:      0.9511 − 0.1604·k_t + 4.388·k_t² − 16.638·k_t³ + 12.336·k_t⁴
  k_t > 0.8:             0.165
DHI      = GHI · diffuseFraction(k_t)
DNI      = clamp( (GHI − DHI) / cosθ_z, 0, I0n )    (0 when GHI ≤ 0 or cosθ_z below the floor)
```

Closure identity (`CONTRACTS.md` §7.10): `DNI·cos θ_z + DHI === GHI` to `1e-9`.
When the weather source supplies both `DNI` and `DHI` directly (NASA POWER
does), `decompose()` returns them unchanged and Erbs is not run — this is a
pass-through branch inside `decompose()`, not a separate function.

**Simplification** (`decompose`, inline comment): below `θ_z > 87°`
(`cosθ_z < COS_Z_FLOOR = cos(85°) = 0.0872`) or `I0h ≤ 0`, everything is treated
as diffuse (`DNI = 0`, `DHI = GHI`) rather than dividing by a near-zero
`cos θ_z`. **Ceiling:** this slightly misattributes the (physically negligible)
low-sun-angle irradiance between beam and diffuse. **Upgrade path:** none
needed — the irradiance magnitude in this regime is small enough that the
misattribution has no measurable effect on any KPI; not tracked as one of the
ten named simplifications below because it carries no material ceiling.

---

## 9. Transposition: Liu & Jordan isotropic and HDKR — `packages/engine/src/solar/transposition.ts`

**Citation:** Liu & Jordan (1963), isotropic sky model; Hay, Davies, Klucher &
Reindl (HDKR), reproduced in Duffie & Beckman ch. 2; `BLUEPRINT.md` 5.5.
**Implements:** `packages/engine/src/solar/transposition.ts:transpose`,
`packages/engine/src/solar/transposition.ts:albedoAt`.

```
I_beam            = DNI · cos θ
skyViewFactor     = (1 + cos β) / 2          groundViewFactor = (1 − cos β) / 2
isotropic:  I_diffuse = DHI · skyViewFactor
HDKR:       A_i             = DNI / I0n                                    (anisotropy index)
            R_b             = cosθ / cosθ_z          (0 when cosθ_z ≈ 0)
            f               = sqrt( max(0, DNI·cosθ_z / GHI) )
            horizonBrighten = 1 + f·sin³(β/2)
            I_diffuse       = DHI · ( A_i·R_b + (1−A_i)·skyViewFactor·horizonBrighten )
I_ground          = GHI · ρ_ground · groundViewFactor
I_T (total)       = max(0, I_beam + max(0, I_diffuse) + I_ground)
```

Horizontal identity (`CONTRACTS.md` §7.10): at `β = 0`, `transpose(...) ===
GHI` to `1e-9` in **both** sky models. Snow check: raising `ρ_ground` 0.20 →
0.80 multiplies the ground-reflected term by exactly 4.0. Ladakh headline: at
Leh on 21 Dec, integrated daily `I_T` on a **vertical south wall exceeds that
on a horizontal roof**.

`ALBEDO` constants (`transposition.ts:ALBEDO`): `genericGround = 0.2` (the
textbook default, explicitly noted as wrong for Ladakh), `dryDesertRock = 0.32`,
`freshSnow = 0.8`, `agedSnow = 0.55` — dimensionless, 0–1. Snow is expressed as
a per-timestep `Site.groundAlbedo` series, not a boolean (`CONTRACTS.md` §7.6).

**Known engine bug, out of scope for this document to fix (`LOG.md` HANDOFF,
carried forward, Area B):** the HDKR `R_b` clamp has a real, still-open finding
recorded in `log/AREA-B-engine.md`'s T-14 addendum. It is reported here per
`LOG.md` §6 rule 16 (report upward, do not fix across boundaries) — this task's
allow-list is documentation only and does not include `solar/transposition.ts`.

---

## 10. Shading — `packages/engine/src/solar/shading.ts`

**Citation:** Duffie & Beckman ch. 14, "profile angle" construction (overhang
geometry); T-18, `TECH.md` §5.
**Implements:** `packages/engine/src/solar/shading.ts:horizonBlockFactor`,
`packages/engine/src/solar/shading.ts:overhangSunlitFraction`.

```
horizonBlockFactor:
  no horizonProfile:  1 if sun.altitude > 0 else 0
  with 36-value profile (blocking altitude per 10° azimuth sector, linearly
  interpolated at the sun's azimuth):  1 if sun.altitude ≥ blockingAltitude else 0

overhangSunlitFraction (windowHeight, overhangDepth, overhangHeightAbove):
  γ_rel               = normaliseRelativeAzimuth(sun.azimuth − surfaceAzimuth)
  0 if |γ_rel| ≥ 90° or sun.altitude < 0 or overhangDepth = 0 → returns 1 instead
  profileAngle        = atan( tan(sun.altitude) / cos(γ_rel) )
  y (shadow depth)     = overhangDepth · tan(profileAngle)
  shadedHeight         = clamp(y − overhangHeightAbove, 0, windowHeight)
  sunlitFraction       = 1 − shadedHeight / windowHeight
```

**Named simplification #3 (of the ten, §12) — beam-only shading.** This is the
project's one `// SIMPLIFICATION:` source marker
(`packages/engine/src/solar/shading.ts:20`), quoted in full:

> `SIMPLIFICATION: both functions gate the BEAM component only. Diffuse and
> ground-reflected irradiance are left untouched by design (global rule 13).
> Ceiling: this overestimates gain on a deeply overhung or steeply
> horizon-blocked surface, because a blocked horizon or a deep overhang also
> blocks part of the sky dome the surface would otherwise see, not just the
> sun's disc. Upgrade path: a sky-dome view-factor reduction applied to the
> diffuse term (e.g. a horizon-corrected isotropic sky-view factor), tracked
> for EQUATIONS.md / the limitations list (T-64).`

Note also (per the file's own header comment): neither `horizonBlockFactor` nor
`overhangSunlitFraction` is wired into `solve/integrator.ts`'s forcing vector
yet — both are pure, tested functions, not yet a forcing-vector hook. That
wiring gap is a separate, tracked note in `.work/T-18.md`, not a physics
simplification, and is out of scope for this document.

---

## 11. Envelope meshing and transient conduction — `packages/engine/src/envelope/mesh.ts`

**Citation:** finite-volume heat-conduction discretisation (Patankar, *Numerical
Heat Transfer and Fluid Flow*; Incropera & DeWitt ch. 4–5); `BLUEPRINT.md` 5.6,
5.6.4, 5.6.5; `ENGINE_BLUEPRINT.md` 5.5.
**Implements:** `packages/engine/src/envelope/mesh.ts:diffusivity`,
`:penetrationDepth`, `:sliceCount`, `:buildWallMesh`, `:constructionUValue`,
`:analyticalWavePenetration`.

```
a               = k / (ρ·c)                                          [m²/s]      diffusivity
d (penetration) = sqrt(a·P/π),  P = 86400 s                          [m]         penetrationDepth
slice count      = clamp(2, MAX_SLICES_PER_LAYER=80,
                     ceil(layerThickness / min(targetDx, d/5)))                  sliceCount
node capacity     C_i = Σ ρ·c·(dx/2) from each adjoining half control volume     buildWallMesh
edge conductance  U_i = k / dx     (each edge lies wholly inside ONE material)   buildWallMesh
fabric U-value    fabricU = 1 / Σ_i (1/U_i)                                      buildWallMesh
construction U    1 / (1/h_o + 1/fabricU + 1/h_i)                                constructionUValue
```

**Documented deviation from `CONTRACTS.md` §7.10's restated formula (spot-check
#2, §11 below), matching the code:** `CONTRACTS.md` §7.10 restates the
interface conductance as **harmonic**, `1 / (dx_A/(2k_A) + dx_B/(2k_B))`, which
is the correct rule for a mesh whose nodes sit at *control-volume centres*. The
code on disk (`envelope/mesh.ts`, lines 11–27) places nodes **on** every layer
interface and both outer faces instead, so every edge lies wholly inside one
material: its conductance is simply `k/dx`, and the harmonic-mean formula is
not merely satisfied but **structurally inapplicable** — there is never an
edge that spans two materials for it to average. The steady-state U-value is
then analytically exact (`fabricU = 1/Σ(1/U_i) = 1/Σ(L/k)` exactly) rather than
approximated, and the arithmetic-vs-harmonic bug that validation Test 3
targets is impossible by construction, not merely guarded against. This
document states the code's actual mechanism; `CONTRACTS.md` §7.10's harmonic
phrasing describes the *effect* correctly (no arithmetic-mean bug reaches the
result) but not the literal per-edge formula the code evaluates.

**Anchors** (`CONTRACTS.md` §7.10): dense concrete `a = 8.29e-7 m²/s`,
`d = 0.151 m`; 300 mm dense concrete gives decrement `f ≈ 0.137` and lag
`φ ≈ 7.6 h` — the single number the PPT quotes.

**Guard against a real prior defect, not a simplification:**
`MAX_SLICES_PER_LAYER = 80` (raised from 24 — the old value silently defeated
the penetration-depth resolution rule on thick walls, producing a ~3% decrement
error with no warning on exactly the earth-bermed construction the project
cares about most). This is a bug-fix guard, not one of the ten named
simplifications.

---

## 12. Analytical validation apparatus — `packages/engine/src/envelope/response.ts`

**Citation:** Carslaw & Jaeger, *Conduction of Heat in Solids*, semi-infinite
solid driven by a periodic surface temperature (the closed-form solution
`buildWallMesh`'s numerical scheme is checked against); `BLUEPRINT.md` 5.6.5 /
validation Test 2.
**Implements:** `packages/engine/src/envelope/response.ts:driveWall`,
`:harmonicFit`, `:lagSeconds`, `:nodeSeries`, `:nodeAtDepth`; the closed-form
target itself is `packages/engine/src/envelope/mesh.ts:analyticalWavePenetration`.

```
Analytical (semi-infinite periodic solution), the validation gate:
  d = sqrt(2a/ω),   f = e^(−x/d),   φ = x/(d·ω),   ω = 2π/P            analyticalWavePenetration
Numerical reproduction:
  driveWall()      backward-Euler march of one wall chain (Thomas algorithm,
                   solve/linalg.ts:thomas) with Dirichlet ends: a prescribed
                   exterior temperature time series and a fixed interior
                   temperature.
  harmonicFit()    single-bin DFT: v(t) ≈ mean + amplitude·sin(ωt + phaseRad),
                   projecting onto sin/cos at the known drive frequency (more
                   robust than peak-finding, which quantises to the timestep).
  lagSeconds()     lag = (phase_drive − phase_inner)/ω, folded into [0, P) —
                   a wave arriving LATER has a MORE NEGATIVE phase.
```

| Material | a [m²/s] | d [m] | f @ 0.20 m | φ [h] | f @ 0.40 m | φ [h] |
|---|---|---|---|---|---|---|
| Dense concrete | 8.29e-7 | 0.151 | 0.266 | 5.1 | 0.070 | 10.1 |
| Rammed earth | 5.98e-7 | 0.128 | 0.209 | 6.0 | 0.044 | 11.9 |
| Fired brick | 4.49e-7 | 0.111 | 0.164 | 6.9 | 0.027 | 13.7 |
| EPS | 1.29e-6 | 0.188 | 0.344 | 4.1 | 0.118 | 8.1 |

**Pass gate:** numerical `f` within **2 %** of analytical, `φ` within **10
minutes** (`CONTRACTS.md` §7.10). This is not a simplification — it is the
project's hard gate (`log/CONTRACTS.md` §10), green as of the last recorded
run.

---

## 13. Exterior boundary — `packages/engine/src/surfaces/exterior.ts`

**Citation:** `BLUEPRINT.md` 5.7; Swinbank (1963), clear-sky downward longwave
correlation; Stefan-Boltzmann radiation law.
**Implements:** `packages/engine/src/surfaces/exterior.ts:hConvExterior`,
`:skyTemperature`, `:hRadSky`, `:skyViewFactor`.

```
h_o(v, h)   = max(1.0, (2.8 + 3.0·v) · f_conv(h))                    [W/(m²·K)]   hConvExterior
T_sky       = (LW_down/σ)^0.25                    when measured LW_down present   skyTemperature
            = 0.0552 · T_amb^1.5                  otherwise (Swinbank)            skyTemperature
skyViewFactor(β) = (1 + cos β)/2                                                  skyViewFactor
h_r,sky(ε, T_s, T_sky) = 4·ε·σ·((T_s+T_sky)/2)³                       [W/(m²·K)]  hRadSky
```

**Documented deviation from McAdams (spot-check candidate, matches
`CONTRACTS.md` §7.10 exactly):** `h_o` is **convective-only**, deliberately
**not** the McAdams combined coefficient `5.7 + 3.8v`. McAdams bundles
convection *and* radiation into one number; this engine models longwave
radiation to the sky explicitly and separately via `hRadSky`, so using McAdams
here would double-count `Q4`. The altitude factor `f_conv` (`air.ts:
convectionAltitudeFactor`) is **mandatory, not a refinement** (`AUDIT.md` F-5):
convection is heat carried away *by air*, and at 3500 m there is 35% less air
to carry it.

**Anchors** (`CONTRACTS.md` §7.10): `skyTemperature(258 K) = 228.7 K ± 0.5`
(−44.4 °C), 29 K below ambient. `skyViewFactor(0°) = 1.0`, `(90°) = 0.5`,
`(180°) = 0.0`, exact — a roof loses exactly twice the sky radiation of a wall
at the same temperature, which is why roof insulation is usually the
highest-value intervention.

**Simplification** (`hRadSky`, inline comment): the true exchange
`ε·σ·(T_s⁴ − T_sky⁴)` is nonlinear; it is linearised about the mean of the two
temperatures **from the previous timestep**, giving the linear conductance
`h_r,sky = 4εσ·mean³` used in the matrix. This is folded into named
simplification #8 below ("coefficients frozen per weather-hour"), since both
share the same refresh cadence and the same measured accuracy bound.

---

## 14. Interior boundary — `packages/engine/src/surfaces/interior.ts`

**Citation:** `BLUEPRINT.md` 5.8; ISO 13790, the 5R1C simplified hourly method
(for the mean-radiant star node); `AUDIT.md` F-5 (altitude correction for `h_i`).
**Implements:** `packages/engine/src/surfaces/interior.ts:hConvInterior`,
`:hRadInterior`; constants `SOLAR_TO_FLOOR_FRACTION`, `SOLAR_TO_AIR_FRACTION`.

```
hConvInterior(type, T_surf, T_air, h):
  wall                         → 3.08
  floor,  T_surf > T_air       → 4.04     (buoyancy helps: heat flows UP)
  floor,  T_surf ≤ T_air       → 0.95
  roof/ceiling, T_surf > T_air → 0.95     (suppressed: heat would flow DOWN)
  roof/ceiling, T_surf ≤ T_air → 4.04
  all × convectionAltitudeFactor(h)                                    [W/(m²·K)]

hRadInterior(ε, T_surf, T_star) = 4·ε·σ·((T_surf+T_star)/2)³           [W/(m²·K)]

SOLAR_TO_FLOOR_FRACTION = 0.6     SOLAR_TO_AIR_FRACTION = 0.05
```

The 4.04 / 0.95 asymmetry (factor of 4.25) is why **floor-based thermal mass
beats ceiling-based mass** in a direct-gain shelter (`CONTRACTS.md` §7.10).

**Documented deviation from `BLUEPRINT.md` (spot-check #3, §16 below), matching
the code:** `BLUEPRINT.md` also describes a single combined interior surface
coefficient of `8.3 W/(m²·K)`. That scheme is **discarded**; the code
implements the direction-dependent table above instead, per `CONTRACTS.md`
§7.10's explicit instruction "do not reintroduce it."

**Named simplification #4 (of the ten, §12) — star-node radiation
approximation.** Interior longwave exchange goes through one zero-capacity
mean-radiant **star node** (ISO 13790 5R1C), not an `N×N` view-factor matrix.
Every interior surface couples only to this single fictitious node via
`hRadInterior`. **Ceiling:** cannot represent strongly directional radiant
exchange between two specific facing surfaces (e.g. two surfaces that see
mostly each other exchanging far more than either does with a third, orthogonal
surface) — every surface "sees" the same star temperature regardless of actual
geometry. **Upgrade path:** a full `N×N` view-factor matrix, `O(N²)` instead of
`O(N)`, justified only if a specific geometry is shown to need it; this is the
standard ISO 13790 method already, "not a shortcut we invented" (`ENGINE_
BLUEPRINT.md`), so the upgrade is a genuine complexity trade-off, not a defect
fix.

**Transmitted-solar distribution simplification:** deposited on surfaces (60%
floor, 5% air/furnishings, the remainder spread across interior area
proportionally), **never directly on the air node** in bulk — adding it there
makes the room overheat at noon and go cold by 8 PM, the classic direct-gain
failure (`solve/integrator.ts:distributeTransmittedSolar`, internal, called
from `integrate`).

---

## 15. Windows — `packages/engine/src/loads/windows.ts`

**Citation:** `BLUEPRINT.md` 5.9; ASHRAE Fundamentals ch. 15, incidence angle
modifier (IAM) correlation.
**Implements:** `packages/engine/src/loads/windows.ts:iam`, `:shutterClosed`,
`:effectiveWindowU`, `:transmittedSolar`.

```
IAM(cosθ, b0)  = clamp(1 − b0·(1/cosθ − 1), 0, 1),  = 0 when cosθ ≤ 0
U_effective    = closed ? 1/(1/U + R_shutter) : U
transmittedW   = area · SHGC · IAM · I_T
```

**Anchor** (`CONTRACTS.md` §7.10): single glazing `U = 5.80` with `R_shutter =
0.4` gives `U_eff = 1.75 W/(m²·K) ± 0.01`, a **70 % reduction** from a wooden
shutter.

**Simplification (glass has negligible heat capacity):** windows are pure
resistance-plus-solar-transmitter — no mesh nodes, no chain (`loads/windows.ts`
header comment). This is standard practice for glazing (the thermal mass of a
few mm of glass is genuinely negligible against the fabric it sits in) and is
not tracked as one of the ten named simplifications because it carries no
material ceiling for this project's use cases.

---

## 16. Infiltration, ventilation and the calibration knobs — `packages/engine/src/loads/infiltration.ts`

**Citation:** `BLUEPRINT.md` 5.10; `AUDIT.md` F-6 (ACH/opening-area coupling);
`WORKERS.md` §1.5 rule 7 (the safety floor).
**Implements:** `packages/engine/src/loads/infiltration.ts:infiltration`,
`:effectiveAch`, `:effectiveAirCapacitance`; constant `ACH_PER_GLAZING_FRACTION`.

```
ach            = allowUnsafe ? max(0, achRequested) : max(ACH_MIN, achRequested)
massFlow       = ρ(altitude, T_in) · volume · ach / 3600                   [kg/s]
conductance    = massFlow · C_P_AIR                                         [W/K]
effectiveAch   = baseAch + ACH_PER_GLAZING_FRACTION · (glazingArea/envelopeArea),
                 floored at ACH_MIN (+ ACH_MIN_COMBUSTION_ALLOWANCE if unvented combustion)
effectiveAirCapacitance = ρ(altitude, T) · volume · C_P_AIR · M,   M = 4     [J/K]
```

**Anchor** (`CONTRACTS.md` §7.10): infiltration conductance at Leh density
(0.871 kg/m³) is **65 %** of the sea-level value (1.342 kg/m³) for identical
ACH and volume.

**Named simplification #9 (of the ten, §12) — the `M = 4` air-capacitance
multiplier.** Bare room air has a laughably small heat capacity on its own;
furniture, bedding, clothing and thin finishes all respond within minutes and
effectively move with the air. Ignoring them makes the system numerically
stiff and the curve unrealistically twitchy. **Ceiling:** `M` is a single
uniform multiplier regardless of the actual amount of furnishing mass — an
empty shell and a densely furnished shelter get the identical `M = 4`.
**Upgrade path:** measure against a real fitted-out shelter's thermal
step-response and either recalibrate this one constant or replace it with an
explicit small-thermal-mass node carrying its own capacitance and conductance,
once real data exists to size it (`LOG.md` §6 rule 14: "leave the calibration
knob").

**Named simplification #10 (of the ten, §12) — `ACH_PER_GLAZING_FRACTION` as an
empirical coupling.** `1.2` additional ACH per unit of glazing-area fraction
(`glazingArea/envelopeArea`), where `envelopeArea` **must** be the fixed total
exterior envelope area (opaque + glazed, summed once — see the function's own
doc comment for the exact caller contract this coupling depends on).
**Ceiling:** not derived from any measured blower-door data for a real Ladakhi
shelter — it is chosen so the glazing sweep produces the non-monotonic optimum
`CHALLENGE.md` C-06/K-05 requires, i.e. it is a *plausible* coupling, not a
*calibrated* one. **Upgrade path:** the constant's own doc comment states it
directly — "TUNE THIS if a measured blower-door figure for a real Ladakhi
shelter ever becomes available."

**Named simplification #7 (of the ten, §12) — simplified wind (no
pressure-driven infiltration network).** `ACH` is a schedule input
(`Operation.achSchedule`), independent of wind speed or the pressure difference
across the envelope; wind enters the model only through `hConvExterior`'s
convection coefficient, never through infiltration mass flow. **Ceiling:**
cannot show a gusty night driving infiltration losses above the nominal ACH,
and cannot model stack effect from height differences between openings.
**Upgrade path:** a simplified single-zone pressure-driven infiltration
correlation (e.g. an LBL/ASHRAE effective-leakage-area model driven by wind
speed and indoor–outdoor ΔT) — still short of a full multi-zone airflow
network, which `LOG.md` §6 rule 12 explicitly cuts from this project's scope.

**Defence in depth, not a simplification:** the `ACH_MIN` safety floor is
enforced **twice**, independently — once here in `infiltration()`/
`effectiveAch()`, and again in the optimiser's own constraint check (T-56,
`LOG.md` §6 rule 10). This is intentional redundancy, not a defect to clean up.

---

## 17. Internal gains — `packages/engine/src/loads/internal.ts`

**Citation:** `BLUEPRINT.md` 5.12; ASHRAE Fundamentals ch. 18 (metabolic and
appliance sensible-heat figures), for the indicative `GAIN_WATTS` values.
**Implements:** `packages/engine/src/loads/internal.ts:scheduleAt`; constant
`GAIN_WATTS`.

```
scheduleAt(schedule, hourOfDay) = schedule[ floor(hourOfDay) mod schedule.length ]   [W]
```

`GAIN_WATTS` (indicative sensible heat, W, exposed for the UI assumptions
panel): `adultSeated = 85`, `adultActive = 175`, `bukhariStove = 2500`,
`keroseneHeater = 1800`, `cooking = 1000`, `lightingLed = 25`,
`livestockPerAnimal = 500`. The livestock figure documents a real vernacular
Ladakhi passive strategy (stabling animals under the living space as a
distributed biological heater), not a curiosity.

---

## 18. Ground coupling — `packages/engine/src/loads/ground.ts`

**Citation:** Kusuda & Achenbach (1965), "Earth temperature and thermal
diffusivity at selected stations in the United States"; `BLUEPRINT.md` 5.11;
ISO 13370 (for the simplified slab-to-soil conductance).
**Implements:** `packages/engine/src/loads/ground.ts:soilTemperature`;
constants `SOIL_DIFFUSIVITY`, `SLAB_SOIL_CONDUCTANCE`.

```
T_g(z,t) = T_mean − A_s · exp(−z·sqrt(π/(a_soil·P)))
                  · cos( 2π/P · ( t − t0 − (z/2)·sqrt(P/(π·a_soil)) ) ),   P = 365 d
SLAB_SOIL_CONDUCTANCE = 1/1.5   [W/(m²·K)]   (simplified ISO 13370-style equivalent resistance)
```

`SOIL_DIFFUSIVITY = 5e-7 m²/s` default; `t0` = day of minimum surface
temperature (default day 20); default coupling depth 2.0 m. The floor is
coupled to **this**, not to ambient air, and not adiabatic. At 2 m with Leh
values (`T_mean = 279.15 K`, `A_s = 12 K`) the January value is **above** a
−20 °C January ambient — the ground is a net heat source in midwinter, which
is why semi-buried/earth-bermed shelters perform well at altitude.

**Simplification** (`SLAB_SOIL_CONDUCTANCE`, inline `ponytail:` comment,
quoted): *"fixed equivalent soil resistance; upgrade to the full ISO 13370
perimeter/area method if ground losses ever dominate a result."* This is
distinct from the ten named simplifications (§12) because its own comment
already states the ceiling and upgrade path inline and it is a single scalar,
not a modelling choice with independent product consequences; it is recorded
here to satisfy "every simplification with a known ceiling gets documented"
(`LOG.md` §6 rule 13) even though it falls outside the task's explicit list of
ten.

---

## 19. PCM apparent heat capacity — `packages/engine/src/storage/pcm.ts`

**Citation:** the apparent (or "effective") heat-capacity method for phase-change
materials in building simulation (e.g. as implemented in EnergyPlus's
`ConductionFiniteDifference` PCM algorithm); `BLUEPRINT.md` 5.14.1; T-19
(`LOG.md`).
**Implements:** `packages/engine/src/storage/pcm.ts:apparentHeatCapacity`,
`packages/engine/src/storage/pcm.ts:pcmEnthalpy`.

```
apparentHeatCapacity(c_base, L_f, T_melt, ΔT_melt, T):
  c_apparent = c_base + L_f/ΔT_melt   if T ∈ [T_melt − ΔT_melt/2, T_melt + ΔT_melt/2]
             = c_base                 otherwise

pcmEnthalpy(c_base, L_f, T_melt, ΔT_melt, T, T_ref) = g(T) − g(T_ref), where
  g(τ) = c_base·τ                                     τ ≤ a  (band start)
       = c_base·τ + L_f                                τ ≥ b  (band end)
       = c_base·τ + (c_base + L_f/ΔT_melt − c_base)·(τ−a)     a < τ < b
```

`pcmEnthalpy` is the **closed-form** (piecewise-linear, not numerically
integrated) antiderivative of `apparentHeatCapacity`, and is exactly what
§4's `ΔStored` contract requires for a PCM node: its contribution must be
`pcmEnthalpy(T_end) − pcmEnthalpy(T_0)`, never `C_j(T_end)·ΔT`, which silently
mis-counts latent heat crossed mid-step.

**Naming deviation, matching the code (spot-check candidate):** `BLUEPRINT.md`
also calls this method by another name and never reconciles the two
(`AUDIT.md`). Per the source file's own instruction, that other name is **not**
reproduced here — "apparent heat capacity" is the only name this document
uses, matching the code.

**Solver consequence, not itself a new simplification** (folds into named
simplification #8, §12): apparent heat capacity makes a PCM node's
capacitance a function of its own temperature — the `C` matrix becomes
state-dependent. The coefficient-refresh cadence (frozen per weather-hour,
§21/§22) is **not** relaxed for this; instead the capacitance is evaluated
once per refresh, lagged on the previous step's temperature
(`solve/integrator.ts`'s `freezeCoefficients`), and a `meta.warnings` entry is
emitted if it moves by more than 25% within one refresh interval.

---

## 20. Discrete thermal storage nodes (water, rock, PCM) — `packages/engine/src/storage/waterMass.ts`

**Citation:** the lumped-capacitance method, valid under a small-Biot-number
criterion (Incropera & DeWitt ch. 5); T-20 (`LOG.md`).
**Implements:** `packages/engine/src/storage/waterMass.ts:storageNodeSpec`
(calls `storage/pcm.ts:apparentHeatCapacity` for `kind: 'pcm'`, never
reimplementing it).

```
capacityJPerK = massKg · c                              water / rock (constant specific heat)
              = massKg · apparentHeatCapacity(...)       PCM (state-dependent, §19)
```

**Lumped-node justification, quoted from the source (`storage/waterMass.ts`,
lines 5–18):**

> "a water drum is kept near-isothermal by its own internal natural convection
> (buoyancy-driven mixing inside the liquid as it heats/cools), not by
> conduction alone — so the relevant internal transport is far faster than the
> drum's own conduction-only Biot number would suggest. A rock bed or PCM pack
> is physically thin in its short dimension by design (both are sized
> precisely so they respond within a day). One **well-mixed** lumped node is
> therefore the right model for all three kinds here, the same simplification
> `envelope/mesh.ts` makes for a single wall slice, just taken to its limit of
> one node."

**Ceiling (per the source's own `CEILING` note, quoted):** "a tall, unstirred
water tank can stratify (hot water floats), which this single node cannot
represent." **Upgrade path:** "a vertical stack of 2–4 lumped nodes coupled by
conduction, if a design ever needs it."

*(Note: this module already correctly uses "well-mixed"; see §27 for the
repo-wide confirmation that this document never reuses `BLUEPRINT.md` 1.4's
opposite, incorrect word either.)*

---

## 21. Linear algebra: dense LU and the Thomas algorithm — `packages/engine/src/solve/linalg.ts`

**Citation:** Golub & Van Loan, *Matrix Computations* — LU factorisation with
partial pivoting; the Thomas algorithm for tridiagonal systems (standard
numerical linear algebra, not a project-specific method); `WORKERS.md` W-05.
**Implements:** `packages/engine/src/solve/linalg.ts:luFactor`,
`:luSolve`, `:thomas`, `:residualInf`.

```
luFactor:   A → P·A = L·U, partial pivoting (largest-magnitude column entry),
            throws SINGULAR_MATRIX below a 1e-14 pivot magnitude.
luSolve:    forward substitution through L (unit diagonal), then back
            substitution through U, using the stored permutation.
thomas:     O(n) tridiagonal solve (sub-diagonal a, diagonal b, super-diagonal
            c, right-hand side d) — the fast path for a single wall chain.
residualInf: ||A·x − b||_∞, used only by the solver's own tests.
```

This module exists so the team can answer for its own numerics rather than
depend on an external library — `packages/engine` carries **zero** runtime
dependencies (`CONTRACTS.md` §7.13), so a numerics package was never an option.

---

## 22. The arrow/Schur factorisation — `packages/engine/src/solve/schur.ts`

**Citation:** the block-arrow matrix / Schur-complement method (Golub & Van
Loan ch. 4, block elimination); `AUDIT.md` F-1 (the defect this closes);
`CONTRACTS.md` §7.10, "Coefficient-refresh contract."
**Implements:** `packages/engine/src/solve/schur.ts:triFactor`, `:triSolve`,
`:triSolveAt`, `:factorArrow`, `:solveArrow`.

```
Node ordering: [air, star, chain_1, chain_2, ... chain_S] (arrow/bordered
block-tridiagonal structure)
  [ K   B ] [ y ]   [ b_y ]        K = block-diagonal, each block tridiagonal
  [ Bᵀ  D ] [ z ] = [ b_z ]        z = [T_air, T_star], 2 unknowns

  S  = D − Bᵀ K⁻¹ B                                   (2×2 Schur complement)
  S·z = b_z − Bᵀ K⁻¹ b_y
  y   = K⁻¹ b_y − (K⁻¹B)·z
```

Per weather-hour: factor each chain, `O(n)`. Per step: one Thomas solve per
chain plus a 2×2 solve, `O(n)`. The whole run becomes linear in node count
instead of the `O(n³)` a dense LU would cost every timestep. This is `AUDIT.md`
F-1's fix — see §24 for the refresh-cadence contract that makes it worthwhile.
`tieStarToAir` handles the degenerate case where nothing radiates (interior
emissivity exactly 0, used by validation cases that isolate convection): the
star row becomes `T_star − T_air = 0` instead of a singular all-zero row.

---

## 23. Model assembly — `packages/engine/src/solve/assemble.ts`

**Citation:** `BLUEPRINT.md` Part 5; `WORKERS.md` W-08.
**Implements:** `packages/engine/src/solve/assemble.ts:buildModel`,
`:normaliseAzimuth`; constants `AIR_NODE`, `STAR_NODE`, `FIRST_SURFACE_NODE`.

```
Node ordering (fixed for the life of a run):
  [0]        indoor air                        (AIR_NODE)
  [1]        mean-radiant star node             (STAR_NODE, zero capacitance)
  [2 .. ]    each surface's through-thickness chain, EXTERIOR → INTERIOR
  [ .. ]     one node per Building.storageElements entry (T-20), after every
             surface chain

C[node] = mesh.C[i] · opaqueArea       for every fabric node
C[STAR_NODE] = 0                       (algebraic balance row, not physical mass)
C[storageNode] = storageNodeSpec(...).capacityJPerK
```

`normaliseAzimuth(a)` wraps an azimuth into `(−180°, 180°]`, applied once per
surface as `surfaceAzimuth + buildingAzimuth` (whole-building rotation).

**Note on `Surface.area` (matches `CONTRACTS.md` §7.5's deviation D-4, not a
new finding here):** `Surface.area` is **net** of window openings, not gross —
`opaqueArea = surface.area − windowArea`. `buildModel` throws
`GEOMETRY_INCONSISTENT` if a surface's window area would meet or exceed its
own (already-net) area, since that would mean windows filling or exceeding
their host surface.

---

## 24. Time integration: backward Euler and the coefficient-refresh contract — `packages/engine/src/solve/integrator.ts`

**Citation:** implicit (backward) Euler, a standard unconditionally-stable ODE
method (Press, Teukolsky, Vetterling & Flannery, *Numerical Recipes*, ch. 17);
`BLUEPRINT.md` Part 6; `CHALLENGE.md` C-08 (the 1 mm steel-skin case that rules
out any explicit scheme); `CHALLENGE.md` C-10 (convergence-based spin-up).
**Implements:** `packages/engine/src/solve/integrator.ts:integrate` (the only
exported function of this module; `freezeCoefficients`, `buildRhs`,
`runOneDay`, `record`, `precomputeEnvironment`, `envAt`,
`distributeTransmittedSolar` are internal to it).

```
C·dT/dt = Σ_j U_ij(T_j − T_i) + Q_i
Backward Euler (θ = 1):
  (C/dt − θK)·T^{n+1} = (C/dt + (1−θ)K)·T^n + f^{n+1}
  ⇒  (C/dt + ΣU)·T^{k+1} − ΣU_ij·T_j^{k+1} = (C/dt)·T^k + Q + ΣU_ib·T_b
```

Backward Euler is **unconditionally stable**, which is why it was chosen over
any explicit scheme: node capacitances span several orders of magnitude (a
400 mm earth slice vs. a 20 mm plaster skin; a legally-enterable 1 mm steel
skin has an explicit stability limit of ~9.7 s per `CHALLENGE.md` C-08), so an
explicit scheme would need an impossibly small global timestep.

**Named simplification #8 (of the ten, §12) — coefficients frozen per
weather-hour, with its measured error.** `h_o` is wind-driven, `h_r,sky` is
temperature-linearised (§13), and `h_i`/`h_r,i` flip by flow direction (§14) —
all three live inside the matrix and all three genuinely change every step.
Refactorising a dense system every timestep costs `O(n³) × ~1440 steps/day`
(~20 s per run, the defect `AUDIT.md` F-1 found). **Ceiling, measured, quoted
from the source:** *"within one hour the surface temperatures move a degree or
two, which perturbs the T³ radiation linearisation by well under 2%."*
**Upgrade path:** refresh more often (e.g. every N minutes instead of every
hour) if a future case — a very light, fast-responding fabric such as bare tin
— is ever shown to need it; the O(n) arrow/Schur factorisation (§22) makes
more frequent refresh cheap if ever required, unlike the dense-LU path it
replaced.

**Auxiliary heating, exploiting linearity:** the response to `Q_aux` watts at
the air node is exactly `Q_aux` times the response to 1 W (`unitAuxResponse`,
solved once per coefficient refresh), so no extra factorisation or iteration
is needed — two back-substitutions give the exact clamped `Qaux` for the
setpoint, respecting `aux.maxPower` and the hourly `aux.schedule`.

**Spin-up: convergence-based, not a fixed window.** The design day is repeated
until the day-over-day maximum node-temperature change falls below
`spinUpToleranceK` (default 0.02 K), capped at `maxSpinUpDays` (default 30). A
fixed 72 h window under-converges for exactly the heavy-wall designs the tool
should be recommending (`CHALLENGE.md` C-10). An Aitken/Delta-squared
extrapolation accelerates convergence (the day-to-day map is affine for a
linear model, so the error decays geometrically with the spectral radius of
that map; three iterates estimate the ratio and extrapolate to the fixed
point) but **every extrapolated jump is still verified by running a real day
afterwards** — the extrapolation only supplies a better starting guess, never
a trusted final answer on its own.

**`T-70` warm-start hook, not a simplification:** `options.initialTemperatureK`
optionally seeds spin-up from a caller-supplied state instead of cold
mean-ambient; the convergence loop itself is unchanged — a good seed exits in
fewer days, a bad one converges to the same fixed point in more.

---

## 25. Named simplifications and their ceilings

**Citation:** `LOG.md` §6 rule 13 ("deliberate simplifications get documented,
not hidden... ceiling and upgrade path"); `CHALLENGE.md` C-20 ("a
simplification volunteered is engineering judgement; the same one discovered by
an evaluator is a gap"); the task's own PROMPT in `log/AREA-I-validation-
credibility.md` names these ten explicitly.
**Implements:** as listed per item below; collectively spans
`packages/engine/src/{solve/assemble.ts, solve/integrator.ts, surfaces/
interior.ts, solar/shading.ts, loads/infiltration.ts}`.

1. **Single well-mixed air node — no stratification.**
   Implements: `solve/assemble.ts:buildModel` (`AIR_NODE` is the sole air
   node); `solve/integrator.ts:freezeCoefficients` (`effectiveAirCapacitance`).
   Ceiling: cannot represent a vertical temperature gradient (a stove-heated
   room can run several degrees warmer at the ceiling than the floor) or
   distinguish physically separate zones (e.g. a Trombe-wall sunspace running
   much hotter than the living space behind it — both currently share one air
   node). Upgrade path: a two-zone model (sunspace + living space) specifically
   for Trombe-wall configurations, coupled by a single inter-zone conductance —
   the smallest extension that captures the dominant multi-zone effect this
   project's scope actually needs.

2. **Uniform surface temperatures.**
   Implements: `envelope/mesh.ts:buildWallMesh` (one 1-D through-thickness
   chain per `Surface`, at a single azimuth/tilt); `solve/assemble.ts:
   buildModel`. Ceiling: a differently-shaded or partially-glazed region of one
   nominal wall is invisible to the model — the whole surface area shares one
   temperature field. Upgrade path: the caller can already subdivide a
   physical wall into multiple `Surface` entries with today's schema (no
   engine change needed) for coarse resolution; genuine sub-surface resolution
   would need a 2-D through-surface mesh, not attempted here.

3. **Beam-only shading.** (Full ceiling/upgrade text in §10 above, quoted
   directly from the source's own `// SIMPLIFICATION:` comment,
   `solar/shading.ts:20`.) Implements: `solar/shading.ts:horizonBlockFactor`,
   `:overhangSunlitFraction`. Ceiling: overestimates gain on a deeply overhung
   or horizon-blocked surface, since blocking the sun's disc does not also
   remove the part of the sky dome it blocks. Upgrade path: a horizon-corrected
   sky-view-factor reduction applied to the diffuse term.

4. **The star-node radiation approximation instead of a view-factor matrix.**
   (Full text in §14.) Implements: `surfaces/interior.ts:hRadInterior`;
   `solve/assemble.ts` (`STAR_NODE`); `solve/schur.ts:factorArrow`
   (`tieStarToAir`). Ceiling: cannot represent strongly directional radiant
   exchange between two specific facing surfaces. Upgrade path: a full `N×N`
   view-factor matrix, `O(N²)`, if a specific geometry is shown to need it.

5. **Lumped thermal-bridge factor instead of 3-D corner conduction.**
   Implements: `solve/integrator.ts:freezeCoefficients` (`bridge =
   building.thermalBridgeFactor`, multiplying fabric conductance `U_i` at
   every mesh edge, `u = sn.mesh.U[i] · area · bridge`). Ceiling: a single
   scalar inflates the whole-surface conductance uniformly; it cannot locate
   *where* the extra loss concentrates (a corner, a lintel, a parapet — the
   junctions where bridging actually occurs), and different junction types get
   the same multiplier. Upgrade path: explicit 3-D (or 2-D cross-section) FEA
   of individual junction details, producing a per-junction-type correction
   factor catalogue rather than one whole-building scalar.

6. **No moisture transport — a surface condensation check only.**
   Implements: `SimulationKpis.condensationRiskHours` (post-processing, threshold
   check against surface temperature and RH — not a source-directory function
   under this task's scope, cited here per the task's own list). Ceiling:
   cannot predict interstitial condensation inside a wall assembly or its
   associated mould/damage risk, and ignores the (usually small but nonzero)
   latent heat that moisture exchange would add to or remove from the thermal
   balance. Upgrade path: a combined heat-and-moisture (HAM) model — e.g. a
   Glaser-method or Künzel-style (WUFI-class) coupled solver — as a wholly
   separate module; `condensationRiskHours` stays a cheap first-order warning
   either way.

7. **Simplified wind — no pressure-driven infiltration network.** (Full text
   in §16.) Implements: `loads/infiltration.ts:infiltration`, `:effectiveAch`.
   Ceiling: cannot show a gusty night driving infiltration above the nominal
   ACH, and cannot model stack effect from opening-height differences.
   Upgrade path: a simplified single-zone pressure-driven correlation (e.g. an
   LBL/ASHRAE effective-leakage-area model) driven by wind speed and
   indoor–outdoor ΔT — still short of the fully-cut multi-zone airflow network
   (`LOG.md` §6 rule 12).

8. **Coefficients frozen per weather-hour, with the measured error.** (Full
   text and the quoted ≤2% figure in §24.) Implements: `solve/integrator.ts:
   freezeCoefficients` (called from the internal `runOneDay`, itself called
   from the exported `integrate`). Ceiling: perturbs the `T³` sky-radiation
   linearisation by "well under 2%" within one hour (measured, quoted from the
   source). Upgrade path: refresh more often for a fast-responding fabric if a
   case is ever shown to need it — cheap under the `O(n)` arrow/Schur
   factorisation.

9. **The `M = 4` air-capacitance multiplier.** (Full text in §16.) Implements:
   `loads/infiltration.ts:effectiveAirCapacitance`. Ceiling: one uniform
   multiplier regardless of actual furnishing mass. Upgrade path: measure
   against a real fitted-out shelter's thermal step-response and recalibrate,
   or replace with an explicit small-thermal-mass node once real data exists.

10. **`ACH_PER_GLAZING_FRACTION` as an empirical coupling.** (Full text in
    §16.) Implements: `loads/infiltration.ts:effectiveAch`; constant
    `ACH_PER_GLAZING_FRACTION`. Ceiling: not derived from measured blower-door
    data for a real Ladakhi shelter — a plausible coupling, not a calibrated
    one. Upgrade path: the constant's own doc comment states it directly —
    tune against a measured blower-door figure if one ever becomes available.

---

## 26. Three spot-checks: document vs. implementation vs. blueprint

**Citation:** this task's own acceptance test 9 (`log/AREA-I-validation-
credibility.md`, T-64); `log/CONTRACTS.md` §9 ("Where it disagrees... this
section wins, because it describes the code that is actually on disk").
**Implements:** `packages/engine/src/solar/geometry.ts:solarTimeHours`,
`packages/engine/src/envelope/mesh.ts:buildWallMesh`,
`packages/engine/src/surfaces/interior.ts:hConvInterior` — the three functions
spot-checked below.

Per this task's acceptance test 9 ("confirm the document matches the code, not
the blueprint, where the two differ"):

1. **Solar time sign** (§7). `ENGINE_BLUEPRINT.md` 5.3 prints `t_solar =
   t_clock + 4·(L_st − L_loc) + E`. The code
   (`solar/geometry.ts:solarTimeHours`) implements `t_solar = t_clock +
   4·(L_loc − L_st) + E` — the opposite sign — and this document states the
   code's formula, because it is the one that gives Leh (west of the 82.5°E
   IST meridian) a solar noon ~19.7 minutes *after* clock noon, matching both
   documents' own worked example.

2. **Envelope interface conductance** (§11). `CONTRACTS.md` §7.10 restates the
   rule as a **harmonic-mean** interface conductance,
   `1/(dx_A/(2k_A) + dx_B/(2k_B))`. The code (`envelope/mesh.ts`) places nodes
   **on** every layer interface, so every edge lies wholly inside one
   material and its conductance is simply `k/dx` — the harmonic-mean formula
   is never actually evaluated because there is never a two-material edge for
   it to average. This document states the code's literal per-edge mechanism
   (§11) in addition to noting that the *effect* CONTRACTS.md describes (no
   arithmetic-mean bug reaches the result) still holds.

3. **Interior convection coefficients** (§14). `BLUEPRINT.md` also describes a
   single combined interior coefficient of `8.3 W/(m²·K)`. The code
   (`surfaces/interior.ts:hConvInterior`) implements the direction-dependent
   table (`3.08` wall; `4.04`/`0.95` floor/ceiling, asymmetric by flow
   direction) instead, and `CONTRACTS.md` §7.10 explicitly instructs "do not
   reintroduce" the combined scheme. This document states only the
   direction-dependent table as the implemented physics.

---

## 27. Confirming the "well-mixed" correction

**Citation:** the task's own PROMPT (`log/AREA-I-validation-credibility.md`,
T-64): correct, wherever the wording is reused anywhere in the repository, the
`BLUEPRINT.md` 1.4 slip that argues for the single-air-node assumption by
calling the air by the opposite (incorrect) term. The argument requires
**well-mixed** air. Do not edit `BLUEPRINT.md` itself — it is a historical
record — but never reuse the wrong word.
**Implements:** `packages/engine/src/storage/waterMass.ts:storageNodeSpec`
(the one live source comment that states the underlying assumption, correctly,
already as "well-mixed" — quoted in §20).

`BLUEPRINT.md` §1.4 (historical, read-only, **not edited by this task**, and
therefore not quoted verbatim here — this document must not reproduce its
incorrect wording even inside a quotation mark, per acceptance test 5) argues
that in a small, unconditioned room without high-velocity air jets, the bulk
mean air temperature is what determines comfort and wall heat exchange — but
qualifies the air itself with the wrong one of two near-opposite thermal terms,
undermining its own argument, which actually requires the air to be
**well-mixed** (thoroughly stirred, uniform in temperature), not the opposite
condition (layered, with temperature varying strongly by height). This
document uses **"well-mixed"** exclusively (§1, §20, §25 item 1) and never
reproduces `BLUEPRINT.md`'s wrong word, spelled out or otherwise. A
repository-wide grep confirms no live (non-historical) file uses the wrong
word — see the Evidence block in `log/AREA-I-validation-credibility.md`'s T-64
entry for the exact
commands and output.

---

## 28. What this document deliberately does not re-derive

**Citation:** `LOG.md` §6 rule 11; `log/CONTRACTS.md` §7.10 header ("Cited by
source. Do not re-derive; do not re-guess.").
**Implements:** every `file:function` line in §6–§24 above, collectively.

Per `LOG.md` §6 rule 11 ("every physics function names its source... a number
a judge asks about must be traceable") and the instruction not to re-derive or
re-guess (`CONTRACTS.md` §7.10's own header): every formula above is
transcribed from the cited literature and the cited source-code comment, not
re-derived from first principles in this document. Where a correlation is
empirical (Erbs, HDKR, Swinbank, McAdams-avoidance, the interior convection
table), that is stated as empirical, with its literature citation, not
presented as a first-principles result.
