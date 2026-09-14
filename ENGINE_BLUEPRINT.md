# ENGINE BLUEPRINT
## How the Passive Shelter Thermal Simulator Actually Works

**Audience:** the whole team, including everyone with a CS/IT background and no physics coursework.
**Scope:** the *engine* — the thing that turns a description of a building into a temperature curve. Not the UI, not the deck, not the schedule.
**Status:** this document supersedes `../BLUEPRINT.md` Parts 1–8 for engine work. Where the two disagree, this one is right — the defects found in `../AUDIT.md` have been corrected here.

---

## TABLE OF CONTENTS

- [0. Read this first — the whole engine in one page](#0)
- [1. The one law everything is built on](#1)
- [2. The master reduction: everything is just numbers](#2)
- [3. The mental model: it's a circuit, and a graph](#3)
- [4. The eleven energy pathways](#4)
- [5. The physics, in dependency order](#5)
  - [5.1 Units, and the one bug that will cost you a day](#5-1)
  - [5.2 Air density at altitude — do this first](#5-2)
  - [5.3 Where is the sun?](#5-3)
  - [5.4 How much sun hits each surface?](#5-4)
  - [5.5 ⭐ Conduction through walls — the heart of the engine](#5-5)
  - [5.6 What happens on the outside face of a wall](#5-6)
  - [5.7 What happens on the inside face of a wall](#5-7)
  - [5.8 Windows](#5-8)
  - [5.9 Air leakage](#5-9)
  - [5.10 The floor and the ground](#5-10)
  - [5.11 Free heat from inside](#5-11)
  - [5.12 The air node — the equation that draws the output curve](#5-12)
  - [5.13 Optional extensions (PCM, Trombe, water)](#5)
- [6. The solver: turning physics into `Ax = b`](#6)
- [7. The self-check that proves the engine isn't lying](#7)
- [8. From engine output to the four deliverables](#8)
- [9. The binding cut list — what we deliberately do not build](#9)
- [10. How we know it's right, without ANSYS](#10)
- [11. Build order](#11)

---

<a name="0"></a>
# 0. READ THIS FIRST — THE WHOLE ENGINE IN ONE PAGE

If you read nothing else, read this.

**The problem, in one sentence:** A box sits in the sun in Ladakh. During the day the sun pumps heat in faster than the box leaks it out, so it warms up. After sunset there is no sun, the box keeps leaking, and it goes cold. DRDO wants a tool that predicts how cold, for any design you type in, so you can pick the design that stays warm.

**The engine, in one sentence:** We chop the building into a few hundred little chunks, each with a temperature, wire them together like a circuit, and step that circuit forward one minute at a time for three days.

**The engine, as a type signature:**

```ts
simulate(geometry, materials, windows, weather, operation): TimeSeries
```

That is the entire backend. **One pure function.** No database, no state, no I/O, no side effects. Same inputs always give the same outputs. It runs unchanged in a browser Web Worker and in a Node process, because it is just arithmetic on arrays.

**Why this is a CS problem and not a physics problem:**

| What it looks like | What it actually is in code |
|---|---|
| "Mud brick vs. granite vs. steel sheet" | A row in a lookup table. 5 numbers. There is no `if (material === 'mudBrick')` anywhere. |
| "The shelter's shape and orientation" | An array of surface objects. Rotating the building = adding 30 to a field. |
| "Ladakh's climate" | Four arrays of 8760 floats. Swap the arrays, you get Jaisalmer. |
| "Heat flows through the wall" | A graph. Nodes have temperatures, edges have conductances. |
| "Solve the thermal model" | Build a matrix `A`, factorize it once, then `solve(A, b)` in a loop 1,440 times. |
| "Thermal mass" | The denominator of a division. Bigger denominator = slower change. |

**Runtime:** ~20 ms for a 3-day simulation. ANSYS takes hours. **That 500,000× speed gap is the entire product** — it is what turns "simulate the design you already picked" into "search 2,000 designs and tell me which one to build."

**The three things that decide whether the engine is credible:**

1. **Walls must be sliced through their thickness.** A wall modelled as one lump responds instantly. A real 300 mm wall delays heat by ~7.6 hours. That delay is *the entire mechanism* by which a passive shelter survives the night. Get this wrong and nothing else matters. → [§5.5](#5-5)
2. **Surfaces radiate heat to the cold night sky.** On a clear Ladakh night the sky behaves like a −44 °C surface. Every roof and wall is bleeding heat into it all night. Teams forget this term and then predict comfortable nights that don't exist. → [§5.6](#5-6)
3. **Altitude changes the air.** At 3,500 m the air is 65% as dense as at sea level. Every term involving air mass or air movement has to know that. → [§5.2](#5-2)

---

<a name="1"></a>
# 1. THE ONE LAW EVERYTHING IS BUILT ON

There is exactly one physical law in this project. Everything else is bookkeeping.

**Conservation of energy.** Heat is not created or destroyed; it only moves and accumulates. For any chunk of stuff:

```
(rate energy accumulates) = (rate energy comes in) − (rate energy goes out)
```

A chunk of mass `m` with specific heat `c` stores energy `U = m·c·T`. Substituting and rearranging:

```
        Q_in − Q_out
dT/dt = ─────────────
            m · c
```

**In plain English:** *how fast this chunk's temperature changes* equals *the net heat arriving* divided by *how much heat it takes to warm this chunk by one degree*.

Read the two halves separately, because they mean different things:

- **The numerator (`Q_in − Q_out`) decides whether the temperature moves, and in which direction.** Positive → warming. Negative → cooling. Zero → steady.
- **The denominator (`m·c`, called *thermal capacitance*) decides how fast.** Small denominator → violent swings. Large denominator → sluggish, damped, delayed.

That denominator is the whole story of this project:

- A **tin shed** has almost no mass. `m·c` is tiny, so `dT/dt` is huge. It heats fast in the morning and is freezing an hour after sunset. It basically tracks the outdoor air.
- A **thick rammed-earth or stone wall** has enormous mass. `m·c` is large, so `dT/dt` is small. It warms slowly all day and gives that heat back slowly all night. It *lags* the outdoor air.

Now re-read what DRDO wrote: *"temperatures inside the shelters found suitable during day hours... but approach nearly the ambient atmospheric temperature after sunset."*

Translated into our equation: **existing shelters have too little `m·c` and too much `Q_out`.** That's the whole problem statement, in symbols.

## 1.1 The three required deliverables are three views of one equation

DRDO asks for three outputs. We are not building three features — we are building **one solver and rendering its state three ways.**

| DRDO deliverable | Which part of `dT/dt = (Q_in − Q_out)/(m·c)` |
|---|---|
| 1. Predict shelter inside temperature | The solution `T(t)` — the curve itself |
| 2. Predict thermal energy from solar radiation | The `Q_in` term, integrated over time |
| 3. Heat flow details vs. ΔT over a period | The `Q_out` term, broken out by pathway |

Say this out loud in the pitch. It reframes three vague asks as one well-defined piece of software.

## 1.2 Why this is not a CFD problem

ANSYS Fluent solves for the *velocity and temperature field of the air* — thousands of cells, Navier–Stokes, turbulence models, hours per run.

We don't need that. We need **the average air temperature of the room**: one number per timestep.

**The justification, which judges will ask for:** in a small, unconditioned room with no high-velocity air jets, the air is **well mixed**, and its bulk mean temperature is what determines both occupant comfort and heat exchange with the walls. This "single well-mixed air node" assumption is the basis of EnergyPlus, TRNSYS, ISO 13790, and ISO 52016. It is not a shortcut we invented — it is the international standard method, and it has been for forty years.

- **What we give up:** vertical stratification (warm ceiling / cold floor), draught patterns, local cold spots.
- **What we get:** ~20 ms instead of ~4 hours — which is the only reason the comparative analysis DRDO explicitly asked for is possible at all.

## 1.3 The two ways this project can fail

**Failure A — too simple, and physically wrong.** The specific trap: modelling each wall as a single lump. A lump responds *instantly*; real thick walls do not. Without thermal lag and damping, the model cannot answer DRDO's question at all. Fixed by [§5.5](#5-5).

**Failure B — too complex, and never ships.** We are a 6-person CS team with a month. The cut list in [§9](#9) is binding.

---

<a name="2"></a>
# 2. THE MASTER REDUCTION: EVERYTHING IS JUST NUMBERS

This section is why the project is tractable for a CS team. Every physical thing in the problem collapses into a small fixed-size record. **There are no special cases and no per-material code paths — one code path plus a lookup table.**

## 2.1 A material is 5 numbers

Every solid building material — mud brick, granite, EPS foam, steel sheet, straw bale, timber — is completely described, for our purposes, by five numbers:

```ts
type Material = {
  k:      number;  // thermal conductivity      W/(m·K)   how easily heat flows through it
  rho:    number;  // density                   kg/m³     how much stuff is packed in
  c:      number;  // specific heat capacity    J/(kg·K)  energy to warm 1 kg by 1 K
  alphaS: number;  // solar absorptivity        0–1       fraction of sunlight it soaks up
  eps:    number;  // thermal emissivity        0–1       how strongly it radiates infrared
};
```

Three derived numbers fall out, and each one has a job:

```
Thermal diffusivity        a = k / (ρ·c)        [m²/s]
   → how fast a heat disturbance travels through the material. Controls TIME LAG.

Volumetric heat capacity   Cv = ρ·c             [J/(m³·K)]
   → thermal mass per cubic metre. Controls DAMPING.

Thermal effusivity         e = sqrt(k·ρ·c)      [J/(m²·K·s^0.5)]
   → how readily it swaps heat with whatever touches it.
```

**This directly answers DRDO's "suitable materials and thermal mass storage material" requirement.** A good passive wall wants **low `k` on the outside** (insulate — stop heat escaping) and **high `ρ·c` on the inside** (store — hold heat and release it at night). That is a *composite multi-material wall*, exactly the phrase in the problem statement, and our engine handles it for free because a wall is just a list of materials.

## 2.2 A window is 4 numbers

Glass is different from a wall in exactly one way: it lets sunlight straight through.

```ts
type Window = {
  U:     number;  // heat transfer coefficient   W/(m²·K)  conduction loss through the glass
  SHGC:  number;  // solar heat gain coefficient 0–1       fraction of sunlight let through
  tauVis:number;  // visible transmittance       0–1       cosmetic only, for the UI
  b0:    number;  // incidence angle modifier    –         how transmission drops at glancing sun
};
```

Single glazing, double glazing, low-E, polycarbonate sheet: one code path, different numbers.

## 2.3 Geometry is a list of surfaces

```ts
type Surface = {
  area:     number;                                  // m²
  tilt:     number;                                  // deg: 0 = flat facing up, 90 = vertical
  azimuth:  number;                                  // deg: 0 = South, −90 = East, +90 = West, ±180 = North
  layers:   Array<{ material: Material; thickness: number }>;  // outside → inside
  boundary: 'exterior' | 'ground' | 'adiabatic';
};
```

**Shape, size, and orientation — all three words DRDO used — reduce to this one array.** A cube, a faceted dome, an A-frame, a half-buried bunker: all just different surface lists. Rotating the building 30° means adding 30 to every `azimuth`. Scaling it up means scaling `area` and room volume. No new code.

## 2.4 Climate is four arrays

```ts
type Weather = {
  T_amb:   Float64Array;  // dry-bulb air temperature      K
  GHI:     Float64Array;  // global horizontal irradiance  W/m²
  v_wind:  Float64Array;  // wind speed                    m/s
  LW_down: Float64Array;  // downward longwave radiation   W/m²  (optional, but valuable)
  RH:      Float64Array;  // relative humidity             %     (for the condensation check)
};
```

**This is why the tool is not Ladakh-specific.** Ladakh *is* just a particular set of numbers in these arrays. Swap them and you have Siachen, Jaisalmer, or Chennai. **Ladakh ships as a preset, not as hardcoded logic.** The problem statement explicitly asks that the model work for "other climatic region shelters as well" — this design satisfies that requirement by construction, at zero extra effort. Say so.

## 2.5 Therefore

```ts
simulate(geometry, materials, windows, weather, operation): TimeSeries
```

Pure function. No state, no side effects, no I/O. That is what makes it testable, portable, runnable in a Web Worker, and cheap enough to call 2,000 times for the optimiser.

**Freeze this signature on day one and never change it.**

---

<a name="3"></a>
# 3. THE MENTAL MODEL: IT'S A CIRCUIT, AND IT'S A GRAPH

## 3.1 The circuit analogy — this is exact, not a metaphor

Heat flow obeys the same mathematics as current flow. If you have ever done RC circuits, you already know this entire engine.

| Thermal quantity | Electrical equivalent |
|---|---|
| Temperature `T` [K] | Voltage `V` |
| Heat flow `Q` [W] | Current `I` |
| Thermal resistance `R` [m²K/W] | Resistance `R` |
| Thermal capacitance `C` [J/K] | Capacitance `C` |
| `Q = ΔT / R` | Ohm's law, `I = ΔV / R` |
| `C · dT/dt = ΣQ` | `C · dV/dt = ΣI` |

Everything transfers: resistances in series add; in parallel they combine reciprocally; a capacitor charges through a resistor with a time constant `τ = RC`.

**A thick insulated wall is literally an RC low-pass filter**, and the outdoor temperature swing is the input signal. The wall attenuates the high-frequency content (the daily swing) and delays the phase. That is not an analogy — it is the same differential equation, and we exploit it in [§5.5](#5-5) to get an exact answer we can test against.

## 3.2 The graph

The shelter is a graph. Nodes hold temperature and heat. Edges conduct heat between them.

```
NODE TYPES
──────────

[1] AIR NODE                  × 1
    The indoor air. This is the number the user actually cares about.

[2] WALL NODES                × ~10–20 per opaque surface
    Each wall/roof/floor is sliced through its thickness into a 1-D chain.
    THIS IS WHAT PRODUCES THERMAL LAG. It is the reason the engine works.

[3] SURFACE NODES
    The first and last node of each wall chain. They carry the boundary conditions
    (sun, wind, sky on the outside; room air and radiation on the inside).

[4] GROUND NODE               × 1
    Deep soil temperature. A fixed boundary, not something we solve for.

[5] STORAGE NODES             × 0..N   (optional)
    Water drums, PCM panels, Trombe wall air gap.

[6] AMBIENT / SKY NODES
    Read straight from the weather arrays. Boundaries, not unknowns.
```

Typical total: **100–250 nodes.** That is small. A dense matrix of that size is nothing for a modern CPU.

## 3.3 The flow graph — where heat actually goes

```
                          ☀ SOLAR (shortwave)
                                │
              ┌─────────────────┼──────────────────┐
              │                 │                  │
              ▼                 ▼                  ▼
       absorbed on        transmitted        bounced off the
       opaque exterior    through glazing    ground (albedo —
       surface                 │             huge on snow)
              │                │
              │                ▼
              │        ┌──────────────────┐
              │        │ interior surfaces│
              │        │  (floor / mass)  │
              │        └────────┬─────────┘
              ▼                 │
    ╔═══════════════════╗       │
    ║ EXTERIOR SURFACE  ║       │
    ║      NODE         ║       │
    ╚═════════╤═════════╝       │
      ▲   ▲   │ conduction      │
      │   │   │ (1-D chain      │
   wind │  │   │  through       │
  convection  │  thickness)     │
          │   ▼                 │
   infrared radiation           │
   to the COLD SKY              │
              ▼                 │
    ╔═══════════════════╗       │
    ║ INTERIOR SURFACE  ║◄──────┘
    ║      NODE         ║
    ╚═════════╤═════════╝
              │ convection + infrared exchange with other surfaces
              ▼
    ╔═══════════════════╗       ┌──── air leakage ◄── outdoor air
    ║    AIR NODE       ║◄──────┤
    ║      T_in         ║◄──────┼──── internal gains (people, stove, animals)
    ╚═══════════════════╝◄──────┼──── window conduction ◄── outdoor air
              │                 └──── auxiliary heating
              ▼
      [THE OUTPUT CURVE]

    Floor chain, bottom node ──── conduction ───► GROUND NODE
```

---

<a name="4"></a>
# 4. THE ELEVEN ENERGY PATHWAYS

Every `Q` term in the engine. **There are exactly eleven. Implement these eleven correctly and the model is complete.**

| # | Pathway | Direction | Dominant when |
|---|---|---|---|
| **Q1** | Solar absorbed on opaque exterior surfaces | IN | Daytime, clear sky |
| **Q2** | Solar transmitted through glazing | IN | Daytime, south-facing glass |
| **Q3** | Convection, exterior surface ↔ outdoor air | mostly OUT | Windy |
| **Q4** | Infrared radiation, exterior surface ↔ sky | **OUT, always** | Clear night ← *the one teams forget* |
| **Q5** | Conduction through the opaque envelope | both ways | Always |
| **Q6** | Convection, interior surface ↔ indoor air | both ways | Always |
| **Q7** | Infrared radiation between interior surfaces | redistributes | Always |
| **Q8** | Conduction through glazing | mostly OUT | Night, large windows |
| **Q9** | Air leakage / ventilation | mostly OUT | Leaky building, windy |
| **Q10** | Conduction to ground through the floor | mostly OUT | Always, slowly |
| **Q11** | Internal gains (people, stove, appliances, livestock) | IN | Occupied hours |

**Q4 is the one that decides whether your model is credible.** At 3,500 m with 300+ cloud-free days a year, the effective sky temperature sits 20–30 K *below* the air temperature. Every exterior surface radiates into that cold sink all night long. A model without Q4 predicts comfortable Ladakh nights that do not exist — and DRDO's DIHAR lab is headquartered in Leh. They will notice.

**Internal vs. boundary-crossing — remember this for [§7](#7):** Q5, Q6, and Q7 move heat *around inside* the system. They never cross the system boundary. The other eight do. Getting this distinction wrong is the single easiest way to break the energy-balance self-check.

---

<a name="5"></a>
# 5. THE PHYSICS, IN DEPENDENCY ORDER

Each subsection depends only on the ones before it. Build them in this order and nothing is ever blocked.

Every equation below is followed by **"In plain English"** — the formula is for whoever writes the code, the English is so everyone else can review the logic.

<a name="5-1"></a>
## 5.1 Units, and the one bug that will cost you a day

```ts
const SIGMA   = 5.670374419e-8;  // Stefan–Boltzmann     W/(m²·K⁴)
const G_SC    = 1367;            // solar constant       W/m²
const C_P_AIR = 1005;            // specific heat of air J/(kg·K)
const R_AIR   = 287.05;          // gas constant, dry air J/(kg·K)
const T0      = 273.15;          // Celsius → Kelvin offset
```

**Rule: everything inside the engine is Kelvin, metres, seconds, watts, joules. No exceptions.**

Enforce it with branded types so the compiler catches violations:

```ts
type Kelvin  = number & { readonly __brand: 'K' };
type Celsius = number & { readonly __brand: 'C' };
const toK = (c: Celsius): Kelvin => (c + T0) as Kelvin;
```

**Why this matters and why it isn't over-engineering:** radiation goes as `T⁴`. Feed it 0 °C by mistake instead of 273.15 K and you get `0` instead of `5.6e9`. The heat loss silently vanishes, the plot still looks like a plausible curve, and you lose a day finding it. Prevent it at the type level instead.

**The one place the rule bends:** the JSON API boundary and the UI speak **Celsius**, because humans do. Conversion happens in exactly two functions, at the seam, and nowhere else. Write those two functions on day one and never convert anywhere else in the codebase.

<a name="5-2"></a>
## 5.2 Air density at altitude — do this before anything else

Standard building simulation quietly assumes sea-level air. Leh is at 3,500 m, where air is about **65% as dense**. Every term involving the mass or movement of air scales with density.

**Barometric formula (standard atmosphere), then the ideal gas law:**

```
p(h)  = 101325 · (1 − 2.25577e-5 · h)^5.25588        [Pa],  h in metres
ρ_air = p / (R_air · T)                              [kg/m³]
```

**In plain English:** air gets thinner as you go up. Work out the pressure at this altitude, then convert pressure and temperature into a density.

**Worked check for Leh (h = 3500 m, T = 263 K = −10 °C):**

```
p     = 101325 · (0.92105)^5.25588 = 101325 · 0.64914  ≈ 65,784 Pa
ρ_air = 65784 / (287.05 · 263)                          ≈ 0.871 kg/m³
sea level, same temperature:                            ≈ 1.342 kg/m³   → 65%
```

**Implement `airDensity(altitude, temperature)` once as a shared utility, and use it in all four places it belongs:**

1. The air node's heat capacity — thinner air holds less heat.
2. Air leakage mass flow — thinner air carries away less heat per m³ exchanged. *(Get this wrong and you overstate infiltration losses by a third.)*
3. **The exterior convection coefficient.** ← mandatory, see [§5.6](#5-6)
4. **The interior convection coefficient.** ← mandatory, see [§5.7](#5-7)

> **Correction vs. `../BLUEPRINT.md`:** the old document made items 3 and 4 optional refinements. They are not optional. Convection is heat carried away *by air*, so thinner air carries less — a judge from a high-altitude lab will ask about exactly this, and "it's optional in our model" is not an answer. The correction is two lines of code. See `../AUDIT.md` finding F-5.

<a name="5-3"></a>
## 5.3 Where is the sun?

Pure astronomy. Deterministic, no data source needed, same answer forever. Reference: Duffie & Beckman, *Solar Engineering of Thermal Processes*.

You need, for every timestep, two angles: how high the sun is, and which compass direction it's in.

```
Day angle:          B  = 360·(n − 81)/364                     n = day of year
Equation of time:   E  = 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)     [minutes]
Solar time:         t_sol = t_local + 4·(L_st − L_loc) + E     [minutes]
Hour angle:         ω  = 15·(t_sol_hours − 12)                 [deg]  (negative = morning)
Declination:        δ  = 23.45·sin(360·(284 + n)/365)          [deg]

Solar altitude:     sin(α) = sin(φ)·sin(δ) + cos(φ)·cos(δ)·cos(ω)
Solar azimuth:      from the standard cos/atan2 form, measured from South
Incidence angle on a surface with tilt β and azimuth γ:
                    cos(θ) = sin(δ)sin(φ)cos(β) − sin(δ)cos(φ)sin(β)cos(γ)
                           + cos(δ)cos(φ)cos(β)cos(ω) + cos(δ)sin(φ)sin(β)cos(γ)cos(ω)
                           + cos(δ)sin(β)sin(γ)sin(ω)
```

**In plain English:** the Earth's tilt and its position in its orbit set how high the sun climbs today (`δ`); the time of day sets which way it's pointing (`ω`); your latitude ties it together. `cos(θ)` at the end answers the only question we actually care about: *how square-on is the sun to this particular wall right now?* Straight on = 1, edge-on = 0.

**This is what makes orientation matter.** A south wall in Ladakh in December gets a high `cos(θ)` all day because the winter sun is low and comes from the south — which is exactly why passive solar design says "put the glass on the south wall." The engine discovers this on its own rather than being told.

**Self-check (build this as your first unit test):** Leh (34.15° N, 77.58° E), 21 December, solar noon → solar altitude ≈ **32.4°**, incidence angle on a vertical south wall ≈ **32.4°** from normal, declination ≈ **−23.45°**. If your code reproduces these, the solar module is correct.

<a name="5-4"></a>
## 5.4 How much sun hits each surface?

Weather data gives you one number: **GHI** — total sunlight landing on a flat horizontal patch of ground. You need the sunlight landing on a *tilted, oriented* wall. Two steps.

### Step 1 — Split GHI into beam and diffuse

Sunlight arrives two ways: **beam** (straight from the sun's disc, casts sharp shadows) and **diffuse** (scattered by the whole sky dome, no shadow). A wall facing away from the sun still receives diffuse light.

Use the **Erbs correlation**, which infers the split from the clearness index `k_t`:

```
k_t = GHI / (G_sc · cos(θ_z))               ← how clear is it, 0 (overcast) to ~0.8 (crystal clear)

k_t ≤ 0.22 :  DHI/GHI = 1.0 − 0.09·k_t
0.22–0.80  :  DHI/GHI = 0.9511 − 0.1604·k_t + 4.388·k_t² − 16.638·k_t³ + 12.336·k_t⁴
k_t > 0.80 :  DHI/GHI = 0.165

DNI = (GHI − DHI) / cos(θ_z)
```

**In plain English:** compare the sunlight you actually measured against the theoretical maximum for a perfectly clear sky. Close to the maximum → mostly beam. Far below → clouds scattered it, mostly diffuse. Ladakh sits at the clear end almost every day, so beam dominates — which is why orientation matters so much there and so little in, say, monsoon Kerala.

### Step 2 — Project onto the tilted surface (transposition)

```
I_T = I_beam + I_diffuse + I_reflected

I_beam      = DNI · cos(θ)                              ← from §5.3
I_diffuse   = DHI · (1 + cos β)/2                       ← how much sky the surface sees
I_reflected = GHI · ρ_ground · (1 − cos β)/2            ← bounced off the ground
```

**In plain English:** add up three sources — the direct beam (scaled by how square-on it hits), the share of the sky dome the surface can see, and whatever bounces up off the ground in front of it.

### ⚠ The Ladakh-specific detail: ground albedo

`ρ_ground` is the fraction of light the ground bounces back.

| Ground surface | ρ_ground |
|---|---|
| Dry soil, rock, gravel | 0.15 – 0.25 |
| Dry grass | 0.20 |
| **Fresh snow** | **0.80 – 0.90** |
| Old / dirty snow | 0.45 – 0.70 |

**Snow quadruples the reflected term.** A south-facing wall above a snowfield in a Ladakh winter can receive substantially more total irradiance than the same wall in summer, because the low winter sun hits it near square-on *and* the snow throws a second helping of light up at it from below. This is a real, region-specific effect, it is a single number in the model, and it is a strong "we studied the region" detail for the pitch. Make `ρ_ground` a user input with a snow preset.

<a name="5-5"></a>
## 5.5 ⭐ CONDUCTION THROUGH WALLS — THE HEART OF THE ENGINE

**This is the most important section in this document.** Get it right and the project works. Get it wrong and everything downstream is decoration.

### 5.5.1 The governing equation

Heat conduction follows **Fourier's law** — heat flows from hot to cold, at a rate set by the material and the steepness of the temperature difference:

```
q = −k · dT/dx           [W/m²]
```

Combine that with conservation of energy in one dimension and you get the **transient heat equation**:

```
∂T/∂t = a · ∂²T/∂x²          where a = k/(ρ·c)  is thermal diffusivity
```

**In plain English:** *a point in the wall heats up when it is colder than the average of its two neighbours, and cools when it is hotter.* The constant `a` sets how fast that evening-out propagates. That's it. That's the whole equation. It is the same maths as heat spreading through a metal bar, or a blur filter running over an image.

### 5.5.2 Why 1-D through the thickness is enough

Heat flows through a wall mostly *perpendicular* to its face, because that's the direction the temperature difference points (warm inside, cold outside), and because a wall is thin compared to how wide and tall it is. Sideways flow matters only at corners and edges — we handle those with a single lumped correction factor, not 3-D geometry.

This assumption is standard in ISO 13786, ISO 52016, EnergyPlus, and TRNSYS. **Don't apologise for it in the PPT — cite it.**

### 5.5.3 Slicing the wall (discretisation)

Take a wall: `[350 mm rammed earth, 100 mm EPS foam, 20 mm plaster]`. Slice each layer into thin control volumes of thickness `Δx`, and put a node at the centre of each.

```
  OUTSIDE                                                     INSIDE
     │                                                            │
     │  ┌───┬───┬───┬───┬───┬───┐ ┌──┬──┬──┐ ┌──┬──┐              │
 wind│  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ │7 │8 │9 │ │10│11│         room │
 ───►│  │   │   │   │   │   │   │ │  │  │  │ │  │  │  ◄─── air    │
 sky │  └───┴───┴───┴───┴───┴───┘ └──┴──┴──┘ └──┴──┘              │
     │      rammed earth 350mm     EPS 100mm   plaster
     │      (heavy: STORES heat)  (light: BLOCKS  20mm
     │                              heat)
     ●                                                            ●
  exterior                                                   interior
  surface node                                            surface node
```

Each node is a little box of material with one temperature. Heat flows between adjacent boxes. **A wall is a linked list.**

**How thin should the slices be?** Thin enough to resolve how far a *daily* heat wave actually penetrates the material. That distance is:

```
d = sqrt( a · P / π )        where P = 86400 s (one day)
```

**Worked example, dense concrete** (`k = 1.75`, `ρ = 2400`, `c = 880`):

```
a = 1.75 / (2400 · 880) = 8.29e-7 m²/s
d = sqrt(8.29e-7 · 86400 / π) = sqrt(0.0228) = 0.151 m ≈ 15 cm
```

**Rule:** at least **5 nodes per penetration depth** → `Δx ≤ 3 cm` for concrete. For insulation the depth is larger but the layer is thin and stores almost nothing, so 3–5 nodes is plenty.

**Practical default:** `Δx_target = 0.02 m`, with `N_layer = clamp(round(thickness / 0.02), 3, 20)`. Expose it as an advanced setting so you can run the mesh-independence test in [§10](#10).

### 5.5.4 The node equations

**An ordinary interior node `j`** (both neighbours in the same material):

```
ρ·c·Δx · dT_j/dt = (k/Δx)·(T_{j−1} − T_j) + (k/Δx)·(T_{j+1} − T_j)
```

**In plain English:** this slice's temperature changes based on how much hotter or colder its two neighbours are. Exactly the discrete form of "average of your neighbours" from §5.5.1.

**A node where two materials meet.** Take half a control volume of capacitance from each side, and connect them with a **series** conductance:

```
Capacitance:  C_j  = ρ_A·c_A·(Δx_A/2) + ρ_B·c_B·(Δx_B/2)
Conductance:  U_AB = 1 / ( Δx_A/(2·k_A) + Δx_B/(2·k_B) )      [W/(m²·K)]
```

> **⚠ Do not average the conductivities arithmetically.** Resistances in series add; conductances do not. Across an earth/EPS interface `k` differs by a factor of 25, and arithmetic averaging there produces a large, completely silent error. This is the classic bug in hand-rolled conduction solvers — write a unit test for it.

**The exterior surface node** — half a control volume, plus every boundary flux hitting the outside face:

```
ρ·c·(Δx/2)·dT_1/dt =   α_s · I_T                                    ← absorbed sunlight   (Q1)
                     + h_o · (T_amb − T_1)                          ← wind convection     (Q3)
                     + F_sky · h_r,sky · (T_sky − T_1)              ← radiation to sky    (Q4)
                     + (1 − F_sky) · h_r,gnd · (T_gnd − T_1)        ← radiation to ground (Q4)
                     + (k/Δx) · (T_2 − T_1)                         ← conduction inward   (Q5)
```

> **Correction vs. `../BLUEPRINT.md`:** the sky view factor `F_sky` was defined in the old document but then omitted from this equation. A vertical wall sees only half the sky and half the ground, so applying the full sky loss to a wall overstates its night-time cooling. Both radiation terms belong here. See [§5.6](#5-6).

**The interior surface node** — half a control volume, plus every flux hitting the inside face:

```
ρ·c·(Δx/2)·dT_N/dt =   h_i · (T_in − T_N)             ← convection to room air   (Q6)
                     + h_r · (T_star − T_N)           ← radiation to other surfaces (Q7)
                     + S_solar,N                      ← sunlight landing here    (Q2)
                     + (k/Δx) · (T_{N−1} − T_N)       ← conduction               (Q5)
```

**The floor's bottom node** connects to the ground node instead of to ambient — see [§5.10](#5-10).

### 5.5.5 What this buys us: thermal lag and damping

**This slicing is the only reason the engine can reproduce the phenomenon DRDO describes.** For a wall of thickness `x` driven by a daily sinusoidal outdoor temperature:

```
Penetration depth:  d = sqrt(2a / ω)      where ω = 2π/P = 7.272e-5 rad/s

Decrement factor:   f = e^(−x/d)          ← how much the swing gets damped
Time lag:           φ = x / (d · ω)       ← how long heat takes to cross
```

**Worked example, a 300 mm dense concrete wall:**

```
a = 8.29e-7 m²/s
d = sqrt(2 · 8.29e-7 / 7.272e-5) = sqrt(0.02280) = 0.151 m

f = e^(−0.30 / 0.151) = e^(−1.987) = 0.137    → only 14% of the outdoor swing gets through
φ = 1.987 / 7.272e-5  = 27,320 s = 7.6 hours  → the peak arrives 7.6 hours late
```

**Read that in plain English:** solar heat absorbed by the outside of that wall at **1 PM** arrives inside the room at about **8:30 PM** — precisely when the shelter is cooling down and needs it most.

**That is passive solar design expressed as one number, and it is the entire answer to DRDO's problem statement.** A shelter with heavy walls doesn't need to *generate* night heat; it needs to *delay* day heat until night. Our engine can show this. A single-lump model mathematically cannot.

This is also your **best validation test** ([§10](#10)), because it has a closed-form analytical answer your numerical model must reproduce. No ANSYS licence required.

<a name="5-6"></a>
## 5.6 What happens on the outside face of a wall

### 5.6.1 Convection to the wind

```
h_o = (2.8 + 3.0 · v_wind) · (ρ_local / ρ_sea)^0.8       [W/(m²·K)]
```

**In plain English:** wind strips heat off a surface. Faster wind, more heat stripped. And thinner air strips less, because there is less air to carry the heat away — hence the altitude factor.

**At Leh:** `(0.65)^0.8 = 0.71` → exterior convection is about **29% weaker** than the same wind at sea level. This is a real effect and a good answer to a hostile question.

> **Watch out:** the very common formula `h = 5.7 + 3.8·v` (McAdams) is a **combined** convective *plus* radiative coefficient. We model radiation explicitly and separately below, so using McAdams here would double-count it. Use the convective-only form above.

### 5.6.2 ⭐ Infrared radiation to the sky — the term that decides the night

Every surface constantly radiates infrared into the sky. The sky is **not** at air temperature — on a clear night it behaves like a much colder body. This loss runs all night and never switches off, which is why it dominates the Ladakh night-time energy balance.

**Best case — you have measured downward longwave** (`ALLSKY_SFC_LW_DWN` from NASA POWER):

```
T_sky = (LW_down / σ)^0.25          [K]
```

**Fallback — estimate from air temperature** (Swinbank, clear sky):

```
T_sky = 0.0552 · T_amb^1.5          [K],  T_amb in K
```

**Worked check, clear Ladakh night at `T_amb` = 258 K (−15 °C):**

```
T_sky = 0.0552 · 258^1.5 = 0.0552 · 4144 = 228.7 K = −44.4 °C
```

**The sky behaves as a −44 °C sink. That is a 29 K driving temperature difference, present all night, every night.** No model that omits this can predict Ladakh correctly. This is kill-shot question K-01 in `../CHALLENGE.md`, and this section is your answer.

**Linearising it for the solver.** The true law is `Q = ε·σ·(T_s⁴ − T_sky⁴)` — nonlinear, which would wreck our nice linear matrix. So we linearise around the current temperature:

```
h_r,sky = 4 · ε · σ · T̄³         where T̄ = (T_s + T_sky)/2, taken from the PREVIOUS timestep
Q_4     = h_r,sky · (T_sky − T_s)
```

**In plain English:** instead of the exact fourth-power law, we compute an equivalent "radiation conductance" using last timestep's temperatures, and treat radiation as ordinary conduction to the sky for this step. Because temperatures move only fractions of a degree in 60 seconds, the error is well under 1%.

**Sky view factor — a wall doesn't see the whole sky:**

```
F_sky = (1 + cos β) / 2        → roof (β=0): F_sky = 1.0
                                 vertical wall (β=90°): F_sky = 0.5
```

**This is why roofs lose the most heat at night, and why roof insulation is usually the single highest-value intervention.** Your optimiser should discover that on its own — and when it does, that's a strong demo moment, because it's a conclusion, not a hardcoded rule.

<a name="5-7"></a>
## 5.7 What happens on the inside face of a wall

### 5.7.1 Convection to the room air

Indoors there is no wind, only buoyancy — warm air rises. So **the direction of heat flow changes the answer**:

| Surface, and which way heat is flowing | `h_i` at sea level [W/(m²·K)] |
|---|---|
| Vertical wall | 3.08 |
| Horizontal, heat flowing **up** (warm floor → cool ceiling) | 4.04 |
| Horizontal, heat flowing **down** (warm ceiling → cool floor) | 0.95 |

```
h_i = h_i,table · (ρ_local / ρ_sea)^0.5
```

**In plain English:** a warm floor heats the room well, because the warm air it creates rises and mixes. A warm ceiling barely heats the room at all, because warm air is already at the top and has nowhere to go — nothing stirs. The 4× difference between those two rows is real physics, not a fudge factor.

**At Leh:** `(0.65)^0.5 = 0.81` → interior convection about **19% weaker** than at sea level.

**Design consequence the tool can surface on its own:** *floor-based thermal mass beats ceiling-based thermal mass* in a direct-gain shelter. Pick `h_i` per surface per timestep from `sign(T_surface − T_in)`.

### 5.7.2 Infrared exchange between interior surfaces

Interior surfaces also radiate at each other — a sunlit warm floor radiates to a cold north wall. Doing this rigorously needs an N×N view-factor matrix. We don't.

**Use a "star node".** Connect every interior surface to one fictitious radiant node that has no heat capacity, using area-weighted conductances:

```
h_r ≈ 4 · ε · σ · T̄³ ≈ 5.0 W/(m²·K)     for ε ≈ 0.9, T̄ ≈ 290 K
```

**In plain English:** instead of tracking every surface-to-surface pair (O(N²) links), every surface talks to one shared hub (O(N) links). Heat still gets redistributed from warm surfaces to cold ones, which is the effect that matters. This is the approach ISO 13790's 5R1C method uses.

> **Reconciling two numbers you'll see in the old docs:** `../BLUEPRINT.md` gives both a direction-dependent table (3.08/4.04/0.95) *and* a single combined value of 8.3 without saying which to use. They are not in conflict — 3.08 (convection) + 5.0 (radiation) ≈ 8.1, so 8.3 is just the two folded together. **Decision: use the direction-dependent table plus the separate star node.** The combined 8.3 is acceptable only as a day-one placeholder to get something running, and it throws away the floor-vs-ceiling asymmetry, which is one of the tool's better design insights. See `../AUDIT.md` minors.

### 5.7.3 Where does the sunlight through the window land?

Sunlight coming through a window lands *somewhere*, and it matters enormously where.

```
Phase 1:  60% → the floor,  40% → area-weighted over all other interior surfaces
Phase 2:  project the actual sun patch geometrically onto the floor
```

**Why this is not a detail:** if you (incorrectly) dump transmitted solar straight into the *air* node, the room spikes to 30 °C at noon and is freezing by 8 PM — the classic direct-gain failure. Deposit it on a *massive floor* instead, and the floor absorbs it, stores it, and releases it slowly all night.

**Modelling this correctly is what lets the tool demonstrate the value of thermal mass** — which is precisely what DRDO asked about. Same building, same sun, same window: the only difference is where the energy is allowed to land.

<a name="5-8"></a>
## 5.8 Windows

Glass has negligible heat capacity, so treat it as a pure resistance plus a light valve. No node chain.

**Conduction out:**

```
Q_8 = U_glass · A_glass · (T_amb − T_in)          [W]
```

**Sunlight in, with an angle correction:**

```
IAM(θ) = 1 − b₀ · (1/cos θ − 1)      clamped to [0,1],   b₀ ≈ 0.05 for double glazing
Q_2    = A_glass · SHGC · IAM(θ) · I_T            [W]
```

**In plain English:** glass transmits well when the sun hits it head-on, and poorly at a glancing angle (think of how a window looks mirror-like when you view it from the side). `IAM` captures that fall-off. Skip it and you overpredict window gains, especially early and late in the day.

### 5.8.1 ⭐ Night insulation — the cheapest big win in the model

Ladakhi and GERES-designed passive buildings routinely close **insulated shutters or heavy quilted curtains** at sunset. It's the highest benefit-to-cost intervention available, and it's trivial to model as a schedule:

```
U_effective(t) = closed(t) ? 1/(1/U_glass + R_shutter) : U_glass

R_shutter ≈ 0.3 – 0.5 m²K/W   for a quilted or EPS-cored shutter
```

**Worked effect:** single glazing `U = 5.8` → with an `R = 0.4` shutter → `U_eff = 1/(0.172 + 0.4) = 1.75 W/(m²·K)`.

**A 70% cut in window losses, for a few hundred rupees of material.** When the optimiser ranks this above triple glazing on cost-effectiveness, that is both a headline pitch result and a genuinely deployable recommendation. Represent it as a boolean hourly schedule (default: closed 18:00–07:00), user-editable.

<a name="5-9"></a>
## 5.9 Air leakage

Cold air leaks in through cracks, gaps, and around doors, and has to be heated from outdoor temperature to indoor temperature.

```
ṁ   = ρ_air(altitude, T) · V_room · ACH / 3600     [kg/s]
Q_9 = ṁ · c_p,air · (T_amb − T_in)                 [W]
```

`ACH` = air changes per hour: how many times the room's entire air volume is replaced each hour.

| Building condition | ACH |
|---|---|
| Very leaky (old tent, gappy timber, unsealed door) | 2.0 – 4.0 |
| Typical uninsulated masonry shelter | 1.0 – 2.0 |
| Sealed / retrofitted | 0.4 – 0.8 |
| Airtight with mechanical ventilation | 0.2 – 0.4 |

**Why this deserves top billing in the recommendations:** air leakage is frequently the *largest single* night-time loss in a real shelter, and by far the cheapest to fix. Weatherstripping, a door gasket, an unheated airlock vestibule — almost free. If the tool's headline output is *"seal the envelope before you spend a rupee on insulation,"* that is a real, actionable, deployable finding, and exactly the kind of practical result DRDO cares about.

### 5.9.1 Leakage must respond to opening size

```
ACH_total = ACH_envelope(construction quality)  +  C_leak · (A_openings / V_room)

C_leak ≈ 0.6 m/h for ordinary framed openings   ← CALIBRATION KNOB, expose it
```

**In plain English:** a bigger window or door is not just a bigger hole for heat to conduct through — it's a longer crack for air to leak through. Base leakiness comes from how well the building is built; extra leakage scales with how much opening you cut into it.

> **Correction vs. `../BLUEPRINT.md`:** the old document made ACH a static lookup keyed only to "building condition," completely independent of window size. That breaks the tool's most important demo. Sweeping the window area *should* produce a curve with a clear optimum — small windows let in too little sun, big windows lose too much — but if the loss side never responds to opening size, that optimum may never appear, and question K-05 ("I make the window bigger; does it get better or worse?") has no clean answer. `C_leak` is a tuning knob: the exact value is empirical, so expose it and calibrate it, don't bury it. See `../AUDIT.md` finding F-6.

### 5.9.2 ⚠ SAFETY CONSTRAINT — a hard minimum ventilation rate

Ladakhi shelters are heated by **bukhari** stoves burning dung, wood, or kerosene. If the tool recommends sealing a shelter without maintaining combustion air and exhaust, **it is recommending a carbon monoxide hazard.**

```
ACH_min = 0.35                             (occupied, no combustion appliance)
ACH_min = 0.35 + combustion allowance      (any unvented combustion appliance present)
```

**This is a hard floor in the optimiser and a visible warning in the UI — not a footnote.** The optimiser must never return a design below it, no matter how good the thermal score.

**Put this on a slide.** A defence-adjacent panel evaluating shelters for personnel will notice that you thought about occupant safety. Most teams will not have.

<a name="5-10"></a>
## 5.10 The floor and the ground

The floor conducts heat into the soil. Deep soil is thermally very stable, sitting near the **annual mean air temperature** of the site — roughly 5–7 °C for Leh.

**Read that again:** in midwinter, with the air at −20 °C, the ground is at +6 °C. **The ground is a heat source, not a heat sink.** This is precisely why semi-buried and earth-bermed shelters perform so well at altitude, and your tool should be able to demonstrate it. That's a genuinely non-obvious result to show a judge.

**Kusuda–Achenbach soil temperature at depth `z`:**

```
T_g(z,t) = T_mean − A_s · exp(−z·sqrt(π/(a_soil·P)))
                  · cos( 2π/P · ( t − t₀ − (z/2)·sqrt(P/(π·a_soil)) ) )
```

with `T_mean` = annual mean air temperature, `A_s` = annual swing amplitude, `P` = 365 days, `a_soil ≈ 5e-7 m²/s`, `t₀` = day of minimum surface temperature.

**In plain English:** the same damping-and-delay maths as §5.5.5, applied to a yearly cycle instead of a daily one, going down into the earth instead of through a wall. Go deep enough and the seasonal swing disappears entirely, leaving just the annual average.

**Phase 1 simplification:** hold the ground node at a constant `T_mean` and connect the floor's bottom node through a fixed slab-plus-soil resistance (ISO 13370 simplified). Upgrade to the full Kusuda form in Phase 2 — the seasonal variation matters for annual studies and much less for a single design day.

<a name="5-11"></a>
## 5.11 Free heat from inside

Heat generated inside the shelter. Minor in an office model; **very significant in a small Ladakhi shelter.**

| Source | Sensible heat [W] |
|---|---|
| Adult, seated / light activity | 70 – 100 |
| Adult, active work | 150 – 200 |
| Bukhari stove (dung/wood), burning | 1500 – 4000 |
| Kerosene heater | 1000 – 2500 |
| Cooking (while in use) | 500 – 1500 |
| Lighting (LED, small shelter) | 10 – 40 |
| **Livestock, traditional ground-floor byre** | **300 – 800 per animal** |

That last row is not a joke. Traditional Ladakhi houses stable animals on the ground floor directly under the living space, where they function as a distributed biological heater. It is a genuine vernacular passive strategy. Include it as a toggleable gain — it shows you studied the region rather than just its coordinates, and reviewers notice that.

Represent all of these as an hourly schedule array so occupancy patterns can be modelled.

<a name="5-12"></a>
## 5.12 The air node — the equation that draws the output curve

Everything above exists to feed this one equation. This is the number the user sees.

```
C_air,eff · dT_in/dt =   Σ_i [ h_i · A_i · (T_surf,i − T_in) ]   ← Q6, from every interior surface
                       + ṁ · c_p · (T_amb − T_in)                ← Q9, air leakage
                       + Σ_w [ U_w · A_w · (T_amb − T_in) ]      ← Q8, windows
                       + Q_internal(t)                           ← Q11, people/stove/animals
                       + Q_aux(t)                                ← auxiliary heating
                       + f_air · Q_solar,transmitted             ← small direct-to-air fraction
```

**In plain English:** the room air warms or cools depending on whether the surfaces around it are warmer or colder than it is, how much cold outdoor air is leaking in, how much heat is escaping through the glass, and how much heat people and stoves are adding. Sum those up, divide by how much heat the room holds, and you get the rate the temperature is moving.

**Effective air capacitance:**

```
C_air,eff = ρ_air · V_room · c_p,air · M          with M = 3 to 5, default 4
```

**Why the multiplier `M` exists and is not a fudge:** the bare air in a room has a laughably small heat capacity — a room's worth of air holds about as much heat as a small bucket of water. But furniture, bedding, clothing, stored grain, and thin interior finishes all respond within minutes and effectively move *with* the air. Leaving them out makes the system numerically stiff and produces an unrealistically twitchy temperature curve that no real building exhibits. `M = 4` is standard practice; expose it as an advanced parameter and document it.

## 5.13 Optional extensions (build only if the core is green)

**Phase Change Material (PCM).** A material that melts at a chosen temperature, absorbing huge energy at nearly constant temperature, then releasing it on freezing. Model with the **apparent heat capacity** method:

```
c_eff(T) =  c_solid                              T < T_melt_start
            c_base + L_f/(T_end − T_start)       T_start ≤ T ≤ T_end
            c_liquid                             T > T_melt_end
```

Typical paraffin: `L_f ≈ 200,000 J/kg` over a 3 K melting range → effective `c` spikes to ~68,000 J/(kg·K), roughly **35× normal**. On the output chart this visibly flattens the night-time curve, which reads beautifully on a demo screen.

**In plain English:** while the material is melting, pouring heat in doesn't raise its temperature — it just melts more of it. So it acts like a thermal battery that only charges and discharges in a narrow temperature band. Pick that band to be room temperature and it fights every swing.

This makes `C` temperature-dependent, so the system becomes nonlinear — use 2–3 fixed-point iterations per timestep. **It also affects the energy-balance check** ([§7](#7)) and the matrix refactorization schedule ([§6](#6)), so it cannot be bolted on silently at the end.

> **PCM must be scheduled and owned, or explicitly cut.** It is named in the problem statement, so silently dropping it is a visible gap. `../AUDIT.md` finding F-4 found it present in the physics but absent from the delivery plan entirely. Decide, in writing.

**Trombe wall.** A south-facing massive wall behind glazing, with an air gap. Needs a **second air node** for the gap plus optional vents to the room. GERES has retrofitted thousands of Ladakhi buildings with these, so it is directly relevant to the sponsor and worth having as a preset.

**Water thermal storage.** Water's `c = 4186 J/(kg·K)` — about 5× concrete per kilogram, ~2× per litre of volume. Drums of water sitting in the sun patch are the cheapest thermal mass available anywhere on Earth. Model as one well-mixed lumped node with a surface conductance to the room. Easy to implement, high demo value, genuinely deployable.

---

<a name="6"></a>
# 6. THE SOLVER: TURNING PHYSICS INTO `Ax = b`

Everything in [§5](#5) was one equation per node. Now we solve them all together.

## 6.1 Assembling the system

Put every node temperature into one vector `T` (length `N`, typically 100–250). Every equation in §5 is linear in `T` once radiation is linearised. So the entire building is:

```
C · dT/dt = K · T + f(t)
```

- **`C`** — diagonal matrix of node heat capacities `[J/K]`. *"How much heat each chunk holds."*
- **`K`** — conductance matrix `[W/K]`, symmetric and sparse. *"Who is connected to whom, and how well."*
- **`f(t)`** — forcing vector `[W]`. *"Heat injected from outside the system this timestep"* — absorbed sunlight, internal gains, and terms tied to fixed boundaries like ambient air.

**In plain English:** `C` is the graph's node weights, `K` is the adjacency matrix with edge weights, and `f` is the external input. If you've written a graph algorithm, you've built this shape before.

**The shape of `K` matters, a lot.** Each wall contributes a **tridiagonal block** — every node talks only to its two neighbours in the chain. Then the air node couples to *every* wall's interior surface node. The result is a **block-tridiagonal matrix with one dense row and one dense column** — an **"arrow" matrix**:

```
      ┌ ▨▨            ▪ ┐   ▨ = wall 1, tridiagonal block
      │ ▨▨▨           ▪ │   ▪ = coupling to the air node
      │  ▨▨▨          ▪ │
      │   ▨▨          ▪ │
      │     ▩▩        ▪ │   ▩ = wall 2 block
  K = │     ▩▩▩       ▪ │
      │      ▩▩▩      ▪ │
      │       ▩▩      ▪ │
      │         ⋱     ⋮ │
      └ ▪▪▪▪ ▪▪▪▪ ⋯   ▣ ┘   ▣ = the air node's row/column (dense)
```

**That sparsity is not a curiosity — it is the performance budget.** See §6.4.

## 6.2 Stepping forward in time — implicit, non-negotiable

**Explicit (forward Euler)** — the obvious approach. Compute the rates from what you know now, take a step:

```
T^{n+1} = T^n + Δt · C⁻¹ · (K·T^n + f^n)
```

Dead simple, no matrix solve. **And it will explode.** Stability requires the Fourier number `Fo = a·Δt/Δx² ≤ 0.5` at *every single node*. Worked case: a user types a 5 mm EPS insulation layer (`a = 1.29e-6 m²/s`, `Δx = 0.005 m`):

```
Δt_max = 0.5 · (0.005)² / 1.29e-6 = 9.7 seconds
```

**A user typing a perfectly reasonable 5 mm layer would blow up your simulation into NaNs.**

**Implicit (backward Euler)** — solve for the future state using the future state:

```
(C/Δt − K) · T^{n+1} = (C/Δt) · T^n + f^{n+1}
```

**Unconditionally stable.** No input a user can type will make it diverge. Cost: one linear solve per timestep.

**Decision: backward Euler. Non-negotiable.**

The reasoning is engineering risk, not just accuracy. An unconditionally stable scheme *cannot be broken by user input*. A conditionally stable one can, and debugging a NaN cascade at 2 AM in demo week is the worst possible use of your remaining time.

*Optional later upgrade:* Crank–Nicolson (`θ = 0.5`) is second-order accurate in time. Implement `θ` as a parameter so switching is one line — but keep `θ = 1` (backward Euler) as the default, because Crank–Nicolson can oscillate on stiff problems.

## 6.3 ⭐ The refactorization schedule — the fix that makes the product possible

> **This section corrects the single most serious defect in `../BLUEPRINT.md` (`../AUDIT.md` finding F-1).**

Here is the tension. Solving `A·x = b` has two costs:

| Operation | Cost | When |
|---|---|---|
| **Factorize** `A` into `LU` | O(N³) dense — expensive | Whenever `A` changes |
| **Substitute** to get `x` from `LU` | O(N²) dense — cheap | Every timestep |

So the winning move is obvious: **factorize once, substitute 1,440 times.**

**The problem:** `A = C/Δt − K`, and `K` is *not* constant. Three coefficients inside it change every timestep:

1. `h_o` — exterior convection, scales with the hourly wind speed ([§5.6.1](#5-6))
2. `h_r,sky` — sky radiation, relinearised around last step's temperature ([§5.6.2](#5-6))
3. `h_i` — interior convection, flips value with heat-flow direction ([§5.7.1](#5-7))

All three sit in the **matrix**, not the forcing vector. So a naive implementation refactorizes every step: **~20 seconds per simulation instead of 50 ms — a 400× miss.** A 100-variant comparison sweep would take half an hour instead of seconds, which kills the one feature that justifies building this instead of using ANSYS.

**Why you can't just move them to `f(t)`:** the surface nodes have tiny heat capacity (`ρ·c·Δx/2`), so treating their large boundary coefficients explicitly reintroduces exactly the stability problem we adopted backward Euler to avoid. They must stay implicit.

### The two-part fix

**Part 1 — Freeze the coefficients per weather-hour.**

Weather data arrives hourly. Wind speed is constant within an hour by definition. `h_r,sky` depends on `T̄³`, and surface temperatures move slowly enough that its variation within an hour is under 1%. `h_i` flips only when a surface crosses the room air temperature, which happens a handful of times a day.

So: **recompute the coefficients and rebuild `A` at hour boundaries only.** A 72-hour run refactorizes **72 times, not 4,320 times.** Handle a mid-hour `h_i` direction flip by letting it wait until the next hour boundary — the error is negligible and the code stays simple.

**Part 2 — Exploit the arrow structure so refactorizing is nearly free.**

Don't use dense LU. Use the structure from §6.1:

```
for each wall block:  Thomas algorithm (tridiagonal solve)     → O(n) per wall
for the air node:     Schur complement over the dense row/col  → O(N)
────────────────────────────────────────────────────────────────────────
total factorization:  O(N)  instead of  O(N³)
```

**In plain English:** rather than treating the building as one big dense matrix, solve each wall independently down its chain (which is just a linked list — a forward sweep and a back sweep), then do one small correction step to account for the fact that all the walls share the same room air. Same answer, vastly less work.

**Resulting budget:**

```
Rebuild + factorize (arrow solver)     ~0.05 ms   × 72 hours  =  ~4 ms
Per-timestep substitution              ~0.01 ms   × 4320 steps = ~13 ms
───────────────────────────────────────────────────────────────────────
One complete 72-hour simulation:                                 ~20 ms
2,000-variant optimiser sweep:         ~40 s single-threaded
                                       ~7 s across 6 Web Workers
```

**This performance IS the product.** ANSYS takes hours per case; we take 20 ms. That is the difference between *"simulate the design you already chose"* and *"search the entire design space and tell you which design to choose."* **This number belongs on a slide.**

> **Sequencing note for the build:** dense LU with hourly refactorization (~400 ms/run) is perfectly fine while you are developing and testing single runs — write it first, it's ~200 lines and easy to verify. But **the arrow solver is required before Compare/Optimise ships**, not an optional Phase 2 nicety. `../BLUEPRINT.md` filed it as optional; that filing is what made the performance claim unreachable.

## 6.4 Linear algebra: write it yourself

`N ≈ 100–250`. That is *small*.

- **Phase 1:** dense LU with partial pivoting. ~200 lines of TypeScript, zero dependencies. Use it to get correct answers first.
- **Phase 2 (required, per §6.3):** the arrow solver — Thomas per wall block plus a Schur complement for the air node.

**Do not reach for a linear algebra library.** Dense LU is a half-day task, keeps the engine dependency-free (which is what lets it run in a browser Web Worker offline), and means the team fully understands its own solver. That last point matters a great deal when a judge asks you to explain it.

## 6.5 Timestep, spin-up, and why the first day is garbage

```
Δt        = 60 s        (300 s also acceptable; expose as a setting)
Spin-up   = 5–7 days    (simulated, then discarded)
Reported  = the final 24 h  (or the full window for multi-day studies)
```

**Why spin-up is mandatory:** at `t = 0` you have to guess the internal temperature of every node inside every wall. You will guess wrong. A 400 mm rammed-earth wall has a time constant measured in **days**. If you initialise everything at 20 °C and plot immediately, the first day's curve shows the walls dumping fictional stored heat into the room, and it looks *great* — comfortable temperatures that are entirely an artefact of your initial guess.

So: run several days, throw them away, report the last one.

> **Correction vs. `../BLUEPRINT.md`:** the old document specified 48–72 hours of spin-up, while *also* stating that heavy walls have day-scale time constants. Those two statements contradict each other: 72 hours under-converges for exactly the high-thermal-mass designs the tool is supposed to be recommending, biasing results against the good answers. See `../AUDIT.md` finding C-10.

**Better still — converge to periodic steady state instead of guessing a fixed spin-up length:**

```
repeat the design day until  max|T_j(day n) − T_j(day n−1)| < 0.05 K  for all nodes
```

**In plain English:** keep replaying the same day until the building stops caring which day it is. Now the result depends only on the design and the weather, never on your initial guess. This is cleaner, more defensible under questioning, and usually converges in 4–8 iterations — cheaper than a fixed 7-day spin-up. **Make this the default; keep fixed spin-up as a fallback for multi-day runs with varying weather.**

**Initialisation:** set wall nodes by linear interpolation between `T_amb(0)` and an assumed `T_in(0)`, then let convergence do the rest.

## 6.6 The nonlinear terms

Three things in the model are not truly linear:

1. Radiation, where `h_r ∝ T̄³`
2. Direction-dependent `h_i`
3. PCM, where `c_eff(T)` depends on temperature

**Strategy — lagged coefficients, with optional iteration:**

```
for each timestep:
    compute h_r, h_i, c_eff  from the PREVIOUS step's temperatures
    assemble f(t)
    solve the linear system
    (optional) repeat 2× using the new temperatures — converges in 2–3 passes
```

**In plain English:** we cheat by using last step's answer to set this step's coefficients. Because 60 seconds isn't long enough for temperatures to move much, the cheat costs well under 1% error. Expose `maxIterations` as a config field so you can *measure* that error and quote the number in the validation document rather than asserting it.

**PCM is the exception:** the capacitance spike is 35×, so single-pass lagging is not good enough. Use 2–3 fixed-point iterations per step whenever PCM is active.

---

<a name="7"></a>
# 7. THE SELF-CHECK THAT PROVES THE ENGINE ISN'T LYING

**Build this on day one.** It is the cheapest credibility you will ever buy, it catches most implementation bugs automatically, and it is the direct answer when a judge asks *"how do you know your model is right?"*

The idea is simple: **energy in, minus energy out, must equal energy stored.** If it doesn't, you have a bug — a term double-counted, a sign flipped, an area wrong, or a capacitance forgotten.

> `../BLUEPRINT.md` asserted this test but never pinned down its definition — which three separate reviewers independently flagged as the project's headline credibility number being unverifiable. The precise definition below closes that gap (`../AUDIT.md` convergent finding #1). **Implement exactly this.**

## 7.1 Define the system boundary first

The control volume is **everything inside and including the envelope.** This is the part people get wrong.

**Pathways that CROSS the boundary — these count:**

```
Q1  solar absorbed on exterior surfaces      IN
Q2  solar transmitted through glazing        IN
Q3  exterior convection to ambient           both ways
Q4  exterior infrared to sky and ground      both ways
Q8  window conduction                        both ways
Q9  air leakage                              both ways
Q10 ground conduction through the floor      both ways
Q11 internal gains                           IN
Qaux auxiliary heating                       IN
```

**Pathways that DO NOT cross the boundary — these must be EXCLUDED:**

```
Q5  conduction inside the walls          ← internal transfer
Q6  interior surface ↔ room air          ← internal transfer
Q7  interior surface ↔ interior surface  ← internal redistribution
```

**In plain English:** money moving between your own pockets is not income. Q5, Q6, and Q7 shuffle heat around inside the building; they never enter or leave it. Counting them inflates both sides of the ledger and can mask a real error.

## 7.2 The residual, exactly

Over a reporting window `[t₀, t₁]`, accumulating at every timestep:

```
E_in  = Δt · Σ_steps Σ_{p ∈ BOUNDARY}  max(Q_p, 0)          [J]
E_out = Δt · Σ_steps Σ_{p ∈ BOUNDARY}  max(−Q_p, 0)         [J]
```

Stored energy, summed over **every node that has heat capacity** (all wall nodes, the air node, all storage nodes):

```
Normal materials:   ΔE_stored = Σ_j  C_j · ( T_j(t₁) − T_j(t₀) )              [J]

With PCM active:    ΔE_stored = Σ_j  m_j · ( h_j(T_j(t₁)) − h_j(T_j(t₀)) )    [J]
                    where h_j(T) = ∫ c_eff(T) dT   is the enthalpy function
```

**Why PCM needs the enthalpy form:** when `c` is temperature-dependent, `C·ΔT` is simply wrong — most of the energy went into melting, not into raising temperature. Using `C·ΔT` there would make the residual blow up and you'd chase a phantom bug in the solver. **Integrate `c_eff` and store the enthalpy function alongside the PCM material definition.**

**The residual:**

```
                | E_in − E_out − ΔE_stored |
residual  =  ─────────────────────────────────        dimensionless
                    max( E_in , E_out )
```

**Normalisation:** divide by whichever of `E_in`/`E_out` is larger. Do **not** divide by `E_in` alone — a night-only window, or a heavily shaded run, can have `E_in ≈ 0`, and the residual would divide by nearly zero and report a catastrophic failure on a perfectly correct model. `E_out` is guaranteed non-zero in any real run because Q4 never stops.

**Units and threshold — stated once, so the code and the UI agree:**

```
Numerator and denominator both in joules → residual is DIMENSIONLESS.
PASS THRESHOLD: residual < 0.001  ( = 0.1% )
UI displays it as a percentage: residual × 100, e.g. "0.02%"  → PASS
```

> `../BLUEPRINT.md` stated the threshold as `< 0.001` in the physics section while the UI mockup displayed `0.02%` — a 1000× dimensional mismatch in the project's own headline credibility number. `0.001` dimensionless **is** `0.1%`, and `0.02%` is a comfortable pass. Fixed here.

## 7.3 Where this check lives

Three places, all three required:

1. **An assertion in the test suite** — every validation case fails if the residual exceeds threshold.
2. **A dev-mode console log**, per run, so you notice regressions the moment you introduce them.
3. **A "model integrity" badge in the UI**, showing the live percentage.

That third one is worth more than it costs. Most teams cannot answer "how do you know it's right?" with anything but "we checked it." You can point at a number on screen that would have caught the error.

---

<a name="8"></a>
# 8. FROM ENGINE OUTPUT TO THE FOUR DELIVERABLES

One solver, four renderings of its state.

## Output 1 — Predicted inside temperature

Straight from the air node. Plot `T_in(t)` against `T_amb(t)` on one chart.

**KPIs:** min / max / mean indoor temperature, hours within the comfort band, and — the headline number — **minimum night temperature**.

**What the user is looking for:** how far the indoor curve sits above the outdoor curve at 5 AM, and how flat it is. That gap *is* the value of the design.

## Output 2 — Thermal energy generated from solar radiation

```
E_solar,captured = Σ_t Δt · ( Q1(t) + Q2(t) )         [J] → display in kWh
```

Break it down by surface, so the user can see the south wall doing the work and the north wall contributing nothing. Report daily totals and a peak-hour rate.

## Output 3 — Heat flow details vs. ΔT over a period

For each timestep, emit every pathway as a signed watt value, plus `ΔT = T_in − T_amb`. Render as a stacked area chart over 24 hours — gains above the axis, losses below.

**This is the diagnostic view, and it's where the tool earns its keep:** it shows *which* loss dominates, so the user knows what to fix first. Usually the answer at night is air leakage and roof radiation, not wall conduction — which is the opposite of most people's intuition and immediately actionable.

> **Include Q7 (interior radiation) in the breakdown.** `../BLUEPRINT.md` omitted it from the output list — precisely the class of silently dropped term that §7 exists to catch. Show it as a redistribution band, clearly marked as internal, not as a gain or a loss.

## Output 4 (our addition) — The Design Recommender

**This is the entire reason to build this instead of using ANSYS**, and in `../BLUEPRINT.md` it existed only as two button labels in an ASCII mockup, with no data contract, no performance budget, and no assigned owner (`../AUDIT.md` finding F-3). Specified here.

### 8.1 The sweep contract

```ts
type SweepRequest = {
  base:   SimulationRequest;              // the design to vary from
  axes:   Array<{
    path:   string;                       // e.g. "walls[0].layers[1].thickness"
    values: Array<number | string>;       // e.g. [0.05, 0.10, 0.15, 0.20]
  }>;
  objective:   'auxHeatingKWh';           // see §8.2
  constraints: {
    achMin:      number;                  // HARD SAFETY FLOOR, default 0.35 — see §5.9.2
    budgetINR?:  number;
    maxWallThickness?: number;
  };
};

type SweepResult = {
  runs: Array<{
    overrides: Record<string, number | string>;
    kpis:      KPIs;
    feasible:  boolean;                   // false if any constraint violated
    rank:      number;
  }>;
  best:     SweepResult['runs'][number];
  baseline: SweepResult['runs'][number];  // for "X% better than what you have now"
};
```

**Performance budget:** a full-factorial sweep of ≤ 2,000 variants must complete in **under 15 seconds** across 6 Web Workers. This falls out of §6.3 and is the reason §6.3's fix is mandatory rather than nice-to-have.

### 8.2 One ranking metric, chosen deliberately

**Primary objective: auxiliary heating energy required to hold the shelter at ≥ 18 °C over the design period, in kWh. Lower is better.**

Why this one:
- **Single number**, so designs can actually be ranked — no arguing about weights.
- **Physically meaningful**, and it maps directly to fuel consumed, rupees spent, and CO₂ emitted.
- **It is literally the problem statement's objective:** *"minimize the energy utilisation for thermal comfort maintenance."*

**Tiebreak (within 5%):** free-running comfort hours — how long the shelter stays comfortable with the heater completely off.

**Cost is a constraint, not a second objective.** A budget cap in `constraints`, not a term in the score.

> **Why not a Pareto front:** `../BLUEPRINT.md` emitted 14 KPIs with no stated primary metric, while separately specifying a multi-objective Pareto optimiser — those two are mutually exclusive, and neither answers "so which one should I build?" (`../AUDIT.md` finding C-14). Pick one metric, state it, defend it. A Pareto front is a fine *secondary* view for an expert user; it is not a recommendation.

### 8.3 The screen the whole tool exists to produce

The session must not end at charts. It ends at a **buildable recommendation**:

```
┌──────────────────────────────────────────────────────────────┐
│  BUILD THIS                                                  │
│                                                              │
│  Walls   400 mm rammed earth + 100 mm EPS (outside)          │
│  Roof    150 mm EPS  ← highest-value single change           │
│  Glazing 4.2 m² double, SOUTH facing                         │
│  Nights  Close insulated shutters 18:00–07:00                │
│  Sealing Weatherstrip to 0.6 ACH  (floor: 0.35, safety)      │
│                                                              │
│  Coldest night indoors      +4.1 °C   (baseline: −11.3 °C)   │
│  Aux heat to hold 18 °C     3.2 kWh/day  (baseline: 11.7)    │
│  → 73% less fuel than the shelter you have now               │
│                                                              │
│  Model integrity: 0.02%   ✓ energy balance verified          │
└──────────────────────────────────────────────────────────────┘
```

Every number on that card comes from the sweep, not from a hand-authored preset.

---

<a name="9"></a>
# 9. THE BINDING CUT LIST

We explicitly **do not** build:

- CFD / Navier–Stokes / turbulence modelling
- Ray-traced or view-factor-exact shading between buildings
- Multi-zone airflow networks (single zone; optional 2-zone only for a Trombe wall)
- HVAC equipment modelling (auxiliary heat is an ideal wattage, nothing more)
- Moisture transport through materials (a surface condensation *check* only — and only if humidity is actually in the data contract)
- 3-D FEA meshing
- User accounts, authentication, databases
- Native mobile apps

**Rule: anything not in the eleven pathways of [§4](#4) requires a written justification and a team vote before a single line is written.**

**Put this list on a slide.** Stating your limits proactively reads as engineering maturity. Having them extracted from you under questioning reads as an oversight. `../AUDIT.md` finding C-20 flagged that this list exists in the docs but never reaches the deck — fix that.

---

<a name="10"></a>
# 10. HOW WE KNOW IT'S RIGHT, WITHOUT ANSYS

**Ground rule: never claim a validation you have not run.** `../BLUEPRINT.md` contained a rehearsed PPT line — *"we match ANSYS"* — that no procedure in the plan actually produces. Two independent reviewers flagged it, one calling it "the single most dangerous sentence in my slice" (`../AUDIT.md` finding F-2). **Delete that claim. Lead with the tests below, which are real, free, and already arithmetically verified.**

### Test 1 — Steady state

Freeze the weather (constant `T_amb`, no sun, no gains), run to equilibrium. Compare against the hand-calculated `U·A·ΔT`.

**Tests:** conductance assembly, area bookkeeping, series resistance handling.
**Pass:** within 0.1%.

### Test 2 — ⭐ Sinusoidal wave through a wall (the important one)

Drive one wall with a pure sinusoidal exterior temperature of 24-hour period. Measure the amplitude ratio and the phase delay at the interior face. Compare against the closed-form semi-infinite solution from [§5.5.5](#5-5):

```
300 mm dense concrete →  decrement f = 0.137,  lag φ = 7.6 hours
```

**Tests:** transient conduction, discretisation, thermal mass — the mechanism the entire project rests on.
**Pass:** within 5% on both numbers.

**This is your headline credibility artefact.** It is an *analytical* answer, not another simulation — so it is genuinely independent ground truth, it costs nothing, it needs no licence, and it directly answers kill-shot K-03 (*"why isn't your night curve just exponential decay?"*). The answer: because distributed wall capacitance produces a *delayed* peak, and here is the closed-form solution our solver reproduces to within 5%.

### Test 3 — Composite wall U-value

A multi-layer wall with very different conductivities (earth / EPS / plaster). Compare the steady-state U-value against `1/ΣR` computed by hand.

**Tests:** the layer-interface handling — specifically the harmonic-vs-arithmetic conductance trap in [§5.5.4](#5-5).
**Pass:** within 0.1%.

### Test 4 — Energy balance

The residual from [§7](#7), on every one of the above.
**Pass:** < 0.1%.

### Test 5 — Mesh independence

Halve `Δx` and confirm the answer stops moving.
**Pass:** < 0.5% change on minimum night temperature.

### Test 6 — Solar geometry

Sun position at Leh on 21 December vs. published ephemeris values ([§5.3](#5-3)).
**Pass:** within 0.5°.

### Stretch — one EnergyPlus reference case

EnergyPlus is **free and open source.** Model one simple shelter in both, run the same weather, report the deviation as a number.

**Only after this run exists may anyone say "we match a reference tool" — and then the sentence must include the actual percentage.** Schedule it early, not in the final week: the validation document is the project's competitive advantage, and `../AUDIT.md` finding F-7 flagged that leaving it until week 4 is a high risk the plan's own risk register already identified.

---

<a name="11"></a>
# 11. BUILD ORDER

Strictly dependency-ordered. Each step is testable the moment it lands.

```
 1. types.ts + constants.ts          Freeze the contract. Nothing starts until this is done.
 2. airDensity()                     Everything downstream needs it. Ten lines.
 3. Solar geometry                   Self-contained, pure maths, testable against ephemeris.
 4. Irradiance decomposition + transposition   Needs 3.
 5. ⭐ Wall meshing + conduction matrix        THE CORE. Test 2 and Test 3 gate this.
 6. Dense LU solver + backward Euler  First end-to-end run. Ugly numbers are fine here.
 7. Energy balance check              Build it NOW, not later. It finds bugs in 5 and 6.
 8. Exterior boundary conditions      Convection + sky radiation. Night behaviour appears.
 9. Interior boundary conditions      Convection + star node + solar distribution.
10. Air node                          FIRST REAL TEMPERATURE CURVE. Demo-able slice.
11. Windows, leakage, ground, gains   The remaining pathways. Test 4 after each one.
12. Periodic steady-state convergence Replaces fixed spin-up.
13. Arrow solver (Thomas + Schur)     Required before 14 — see §6.3.
14. Sweep engine + recommender        The product's actual differentiator.
15. PCM / Trombe / water storage      Only if 1–14 are green. Otherwise cut in writing.
```

**Get to step 10 fast.** A working temperature curve — even an inaccurate one — is worth more than a perfect solar module, because it makes the project demonstrable and every later step becomes an improvement you can *see*.

## The three things to watch

1. **The mesh and conduction (step 5) is the whole project.** Budget real time for it. Test 2 is the gate, and it is objective — either the decrement is 0.137 ± 5% or it isn't.
2. **Step 7 before step 8.** Building the energy-balance check before the boundary conditions means every subsequent pathway is verified as it lands, instead of debugging eleven interacting terms at once at the end.
3. **Step 13 is not optional.** It was filed as optional in the old blueprint, and that single filing is what made the performance claim — and therefore the entire comparison feature — unreachable.

---

## Document provenance

Distilled from `../BLUEPRINT.md` (Parts 1–9), `../TECH.md`, `../DRDO_Shelter_Thermal_Simulation_Analysis.md`, and `../Ladakh_Passive_Shelter_Problem_Statement.md`, with defects corrected per `../AUDIT.md` and the acceptance criteria in `../CHALLENGE.md`.

**Corrections applied here that differ from `../BLUEPRINT.md`:**

| # | Fix | Where | Audit ref |
|---|---|---|---|
| 1 | Refactorize per weather-hour + arrow solver required, not "factorize once" | [§6.3](#6) | F-1 |
| 2 | Energy-balance residual fully defined: boundary terms only, enthalpy under PCM, normalisation, units, threshold | [§7](#7) | convergent #1 |
| 3 | "We match ANSYS" claim removed; analytical tests lead | [§10](#10) | F-2 |
| 4 | Sweep contract, performance budget, and single ranking metric specified | [§8](#8) | F-3, C-14 |
| 5 | Altitude correction mandatory in **both** convection coefficients | [§5.6](#5-6), [§5.7](#5-7) | F-5 |
| 6 | Air leakage coupled to opening area | [§5.9.1](#5-9) | F-6 |
| 7 | Spin-up replaced with periodic steady-state convergence | [§6.5](#6) | C-10 |
| 8 | Sky view factor `F_sky` restored to the exterior node equation | [§5.5.4](#5-5) | C-02 minor |
| 9 | Interior convection scheme reconciled (direction table + star node) | [§5.7](#5-7) | minors |
| 10 | Q7 added to the heat-flow output breakdown | [§8](#8) | minors |
| 11 | Kelvin/Celsius boundary defined at exactly two functions | [§5.1](#5-1) | minors |
| 12 | "well-stratified" corrected to "well-mixed" in the air-node justification | [§1.2](#1) | minors |
| 13 | PCM given an explicit decide-or-cut gate rather than silent deferral | [§5.13](#5), [§11](#11) | F-4 |

**Still open, and deliberately out of scope for this document:** module ownership, the delivery schedule, the PPT gate ordering, and the frontend spec. Those live in `../TASK.md` and `../TECH.md`.
