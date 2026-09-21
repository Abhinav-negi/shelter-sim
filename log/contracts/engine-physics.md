# log/contracts/engine-physics.md — the residual definition and the physics equations

> Extracted from `log/CONTRACTS.md` §7.4 and §7.10. Read this when your task's Area README names it (Area B, G).

---

### 7.4 The energy-balance residual — exact definition

This definition is copied verbatim as a comment above the implementation in
`packages/engine/src/post/energyBalance.ts`, and that implementation is **done and green**.

**Control volume:** all solved nodes (all wall nodes, the air node, all storage nodes).

**Boundary terms** — the only terms that enter the residual, because only these cross the
control-volume boundary:

```
BOUNDARY = { Q1, Q2, Q3, Q4, Q8, Q9, Q10, Q11, Qaux }
```

**Excluded**, because they are internal redistribution between solved nodes and cancel exactly:

```
INTERNAL = { Q5, Q6, Q7 }
```

**Accumulation, per timestep of length Δt:**

```
E_net    = Σ_steps  Δt · Σ_{q ∈ BOUNDARY}  q(t)      [J]  signed, per §7.2
E_gross  = Σ_steps  Δt · Σ_{q ∈ BOUNDARY} |q(t)|     [J]  gross throughput
```

**Stored energy:**

```
ΔStored = Σ_nodes  C_j · ( T_j(t_end) − T_j(0) )
```

with the indoor air node using its **effective** capacitance (`M = 4` multiplier, §7.10).
When a PCM node exists (T-19), its contribution must instead be evaluated by integrating the
**apparent** heat capacity along that node's own temperature history by trapezoidal rule —
never as `C_j(T_end) · ΔT`, which silently mis-counts latent heat.

**Residual:**

```
residual = | E_net − ΔStored | / E_gross        dimensionless FRACTION
```

- **Normalising by `E_gross`, not by `E_in`**, is deliberate. `AUDIT.md` found the `E_in`
  normalisation degenerates for night-only reporting windows where gains are near zero. `E_gross`
  is strictly positive for any window of nonzero length.
- **Units: a dimensionless fraction.** `0.001` means 0.1 %.
- **Pass threshold: `residual < 0.001`.** Asserted in CI on every preset (T-62).
- **UI display rule:** the badge renders `(residual * 100).toFixed(3) + '%'`, labelled
  "energy balance". A displayed `0.020%` corresponds to a stored value of `0.0002`. This resolves
  the `< 0.001` vs `0.02%` dimensional mismatch `AUDIT.md` flagged in the project's own headline
  credibility number.

### 7.10 The physics, restated — every equation a task needs

Cited by source. Do not re-derive; do not re-guess.

**Air at altitude** (`air.ts`, done) — ISA barometric + ideal gas, `BLUEPRINT.md` 5.2:

```
p(h)  = P0 * (1 - 2.25577e-5 * h)^5.25588              [Pa]
rho   = p / (R_AIR * T)                                 [kg/m^3]
convectionAltitudeFactor(h) = sqrt( rho(h) / rho(0) )   [dimensionless]
```

Anchors: `airPressure(3500) = 65790 Pa ± 50`; `airDensity(3500, 263 K) = 0.871 ± 0.005`;
`airDensity(0, 263 K) = 1.342 ± 0.005`; ratio at Leh `= 0.65 ± 0.01`, so the convection factor is
`sqrt(0.65) = 0.806`. `airDensity(0, 288.15) = 1.225 ± 0.005` (ISA sea level).

**Solar position** (`solar/geometry.ts`, done) — `BLUEPRINT.md` 5.3. Declination, equation of time,
solar time `t_solar = t_clock + 4*(L_loc - L_st) + E`, altitude
`sin(alpha_s) = sin(phi)sin(delta) + cos(phi)cos(delta)cos(omega)`, azimuth with **south = 0, east
negative, west positive**, incidence
`cos(theta) = cos(theta_z)cos(beta) + sin(theta_z)sin(beta)cos(gamma_s - gamma)`, clamped at 0.
Anchors at Leh (34.15 °N, 77.58 °E): peak solar altitude **32.4°** on 21 Dec, **55.85°** at the
equinoxes, **79.3°** on 21 Jun, each ± 0.2°. Longitude correction `4*(77.58 - 82.5) = -19.7 min`.

**Irradiance decomposition** (`solar/decomposition.ts`, done) — Erbs, `BLUEPRINT.md` 5.4.
`I0 = G_SC * (1 + 0.033*cos(360n/365)) * cos(theta_z)`; `k_t = GHI/I0` clamped to `[0,1]`;
three-branch Erbs diffuse fraction; `DHI = GHI*ratio`, `DNI = (GHI - DHI)/cos(theta_z)`.
When the source supplies both DNI and DHI (NASA POWER does) they are used unchanged and Erbs is not
run. Guard: for `theta_z > 87°` or `I0 <= 0`, return `{ghi, dni: 0, dhi: ghi}`.
Closure identity: `DNI*cos(theta_z) + DHI === GHI` to 1e-9.

**Transposition** (`solar/transposition.ts`, done) — Liu & Jordan isotropic and HDKR,
`BLUEPRINT.md` 5.5:

```
I_beam    = DNI * cos(theta)
I_diffuse = DHI * (1 + cos(beta))/2                      [isotropic]
I_ground  = GHI * rho_ground * (1 - cos(beta))/2
```

Horizontal identity: at `beta = 0`, `transpose(...) === GHI` to 1e-9 in **both** sky models.
Snow check: raising `rho_ground` 0.20 → 0.80 multiplies the ground-reflected term by exactly 4.0.
The Ladakh headline: at Leh on 21 Dec, integrated daily `I_T` on a **vertical south wall exceeds
that on a horizontal roof**.

**Exterior boundary** (`surfaces/exterior.ts`, done) — `BLUEPRINT.md` 5.7:

```
hConvExterior(v, h) = max(1.0, (2.8 + 3.0*v) * convectionAltitudeFactor(h))   [W/(m^2*K)]
skyTemperature(T_amb, LW_down) = (LW_down/SIGMA)^0.25   when measured LW is present
                               = 0.0552 * T_amb^1.5     otherwise (Swinbank)
skyViewFactor(tilt) = (1 + cos(tilt))/2
hRadSky(eps, T_surf, T_sky) = 4 * eps * SIGMA * ((T_surf+T_sky)/2)^3
```

**Convective-only, NOT McAdams `5.7 + 3.8v`** — McAdams is a _combined_ convective+radiative
coefficient and would double-count Q4, which is modelled explicitly.
The altitude factor is **mandatory, not a refinement** (`AUDIT.md` F-5): convection is heat carried
away _by air_, and at 3,500 m there is 35 % less air to carry it.
Anchor: `skyTemperature(258 K) = 228.7 K ± 0.5` (−44.4 °C), which is **29 K below ambient**.
`skyViewFactor(0) = 1.0`, `(90) = 0.5`, `(180) = 0.0`, exact. A roof therefore loses exactly twice
the sky radiation of a wall at the same temperature — which is why roof insulation is usually the
highest-value intervention.

**Interior boundary** (`surfaces/interior.ts`, done) — `BLUEPRINT.md` 5.8:

```
hConvInterior: wall                      -> 3.08
               floor, warmer than air    -> 4.04   (buoyancy helps: heat flows UP)
               floor, cooler than air    -> 0.95
               roof/ceiling, warmer      -> 0.95   (suppressed: heat would flow DOWN)
               roof/ceiling, cooler      -> 4.04
all multiplied by convectionAltitudeFactor(elevation)
hRadInterior(eps, T_surf, T_star) = 4 * eps * SIGMA * ((T_surf+T_star)/2)^3
SOLAR_TO_FLOOR_FRACTION = 0.6      SOLAR_TO_AIR_FRACTION = 0.05
```

The 4.04 / 0.95 asymmetry (a factor of 4.25) is why **floor-based thermal mass beats ceiling-based
mass** in a direct-gain shelter. The single combined `8.3 W/(m^2*K)` scheme that also appears in
`BLUEPRINT.md` is **discarded**; do not reintroduce it. Interior longwave goes through one
zero-capacity **mean-radiant star node** (ISO 13790 5R1C) — O(N), not an O(N²) view-factor matrix.
Transmitted solar is deposited on surfaces, **never on the air node**: adding it to the air makes
the room overheat at noon and go cold by 8 PM, the classic direct-gain failure.

**Envelope meshing** (`envelope/mesh.ts`, done) — `BLUEPRINT.md` 5.6:

```
diffusivity        a = k / (rho * c)                     [m^2/s]
penetration depth  d = sqrt(a * P / pi),   P = 86400 s
node capacity      capacityPerArea = rho * c * dx        [J/(m^2*K)]  (boundary nodes get HALF)
interface conductance, HARMONIC:  1 / ( dx_A/(2*k_A) + dx_B/(2*k_B) )
```

**Harmonic, not arithmetic.** Arithmetic averaging at a layer interface is the most common silent
bug in this kind of code and is exactly what validation Test 3 catches.
Anchors: dense concrete `a = 8.29e-7`, `d = 0.151 m`; 300 mm dense concrete gives decrement
`f ≈ 0.137` and lag `phi ≈ 7.6 h` — **this is the single number the PPT quotes.**

**Analytical decrement and lag** (semi-infinite periodic solution), the gate:

```
d = sqrt(2a/omega),    f = e^(-x/d),    phi = x/(d*omega),    omega = 2*pi/P
```

| Material       | a [m²/s] | d [m] | f @ 0.20 m | φ [h] | f @ 0.40 m | φ [h] |
| -------------- | -------- | ----- | ---------- | ----- | ---------- | ----- |
| Dense concrete | 8.29e-7  | 0.151 | 0.266      | 5.1   | 0.070      | 10.1  |
| Rammed earth   | 5.98e-7  | 0.128 | 0.209      | 6.0   | 0.044      | 11.9  |
| Fired brick    | 4.49e-7  | 0.111 | 0.164      | 6.9   | 0.027      | 13.7  |
| EPS            | 1.29e-6  | 0.188 | 0.344      | 4.1   | 0.118      | 8.1   |

Pass: numerical `f` within **2 %** of analytical, `phi` within **10 minutes**.

**Windows** (`loads/windows.ts`, done) — `BLUEPRINT.md` 5.9:

```
IAM(cos_theta, b0)  = clamp(1 - b0*(1/cos_theta - 1), 0, 1),  = 0 when cos_theta <= 0
U_effective         = closed ? 1/(1/U + R_shutter) : U
transmittedSolarW   = area * SHGC * IAM * I_T
```

Headline anchor: single glazing `U = 5.80` with `R_shutter = 0.4` gives
`U_eff = 1.75 W/(m^2*K) ± 0.01` — a **70 % reduction** from a wooden shutter.

**Infiltration** (`loads/infiltration.ts`, done) — `BLUEPRINT.md` 5.10:

```
ach       = max(ACH_MIN, achRequested)     unless allowUnsafeVentilation
massFlow  = rho(elevation, T_in) * volume * ach / 3600           [kg/s]
conductance = massFlow * C_P_AIR                                 [W/K]
effectiveAirCapacitance = rho * volume * C_P_AIR * M,   M = 4
```

`M = 4` is a **calibration knob**: bare room air has a laughably small heat capacity, and furniture,
bedding, clothing and thin finishes all respond within minutes and effectively move with the air.
Ignoring them makes the system stiff and the curve unrealistically twitchy. `M = 4` is defensible
standard practice; the comment saying so must stay.
Altitude check: infiltration conductance at Leh density (0.871) is **65 %** of the sea-level value
(1.342) for identical ACH and volume.

**Ground** (`loads/ground.ts`, done) — Kusuda–Achenbach, `BLUEPRINT.md` 5.11:

```
T_g(z,t) = T_mean - A_s * exp(-z*sqrt(pi/(a_soil*P)))
                  * cos( 2*pi/P * ( t - t0 - (z/2)*sqrt(P/(pi*a_soil)) ) ),   P = 365 d
```

`a_soil` default `5e-7 m^2/s`, `t0` = day of minimum surface temperature (default day 20),
default depth 2.0 m. The floor is coupled to **this**, not to ambient air, and not adiabatic.
At 2 m with Leh values (`T_mean = 279.15 K`, `A_s = 12 K`) the January value is **above** a −20 °C
January ambient — the ground is a net heat _source_ in midwinter.

**The numerical method** (`solve/`, done) — `BLUEPRINT.md` Part 6:

```
C * dT/dt = K*T + f(t)
(C/dt - theta*K) * T^{n+1} = (C/dt + (1-theta)*K) * T^n + f^{n+1},    theta = 1
```

Backward Euler, **unconditionally stable** — the only acceptable choice given that a user will
legally enter a 1 mm steel skin whose explicit stability limit is ~9.7 s (`CHALLENGE.md` C-08).

**Coefficient-refresh contract (closes `AUDIT.md` F-1 — already implemented).** `h_o` is
wind-driven, `h_r,sky` is temperature-linearised and `h_i` flips by flow direction — all three live
_inside_ the matrix and all three change every step. Refactorising a dense LU every step is ~400×
over budget. **Therefore: time-varying coefficients are FROZEN PER WEATHER-HOUR and the matrix is
refactorised only when they are refreshed.** Everything that varies faster — solar, internal gains,
ambient temperature, the schedules — lives in the forcing vector `f(t)`, which is rebuilt **every**
timestep. The factorisation itself is an **arrow/Schur** structure (`solve/schur.ts`): per-wall
tridiagonal chains plus a dense coupling to the air and star nodes, so it is O(N) rather than O(N³).

**Spin-up is convergence-based, not a fixed 72 h.** Repeat the design day until the day-over-day
maximum node temperature change is below `spinUpToleranceK` (default 0.02 K), cap at
`maxSpinUpDays` (default 30), emit a `meta.warnings` entry if the cap is hit, and report the actual
count in `meta.spinUpDaysUsed`. A fixed 72 h window **under-converges for exactly the heavy-wall
designs the tool should be recommending** — `CHALLENGE.md` C-10.
