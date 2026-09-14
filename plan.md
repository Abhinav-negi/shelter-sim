# ShelterSim — The Plan, In Plain English

**What this document is:** a complete description of the app we are building, written so that anyone can read it — you do not need to know any physics, and there is not a single equation in here.

**What this document is not:** an explanation of how the physics works. That lives in [`ENGINE_BLUEPRINT.md`](ENGINE_BLUEPRINT.md), which explains the science in full detail. For everything below, you only need to know one thing about it:

> **The physics engine is a box you feed a building description and a day's weather into, and it hands you back the indoor temperature for every minute of that day.**

That's it. That's all the physics you need to read this document.

---

## Table of contents

1. [The problem we are solving](#1-the-problem-we-are-solving)
2. [Who uses this and what they get](#2-who-uses-this-and-what-they-get)
3. [The app, in one picture](#3-the-app-in-one-picture)
4. [The four parts of the app](#4-the-four-parts-of-the-app)
5. [What the user actually does, step by step](#5-what-the-user-actually-does-step-by-step)
6. [The screens, and why each one matters](#6-the-screens-and-why-each-one-matters)
7. [Testing every scenario](#7-testing-every-scenario)
8. [How the AI advice works](#8-how-the-ai-advice-works)
9. [What we deliberately do not build](#9-what-we-deliberately-do-not-build)
10. [Where our numbers come from](#10-where-our-numbers-come-from)
11. [Build order](#11-build-order)
12. [Glossary](#12-glossary)

---

## 1. The problem we are solving

Ladakh is one of the sunniest places on Earth. It gets over 300 cloud-free days a year and nearly eight hours of strong sunshine a day.

It is also brutally cold. Winter nights routinely hit −20 °C, sometimes −30 °C.

Here is the odd thing DRDO noticed, and it is the whole reason this project exists:

> **During the day, shelters in Ladakh are actually quite comfortable.** The sun pours in and warms them up.
> **The moment the sun sets, they collapse to the outside temperature.** All that free heat leaks straight back out.

So people burn kerosene and dung to stay warm through the night — expensive, polluting, and it has to be trucked in over high mountain passes that close for months at a time.

**The fix is not a better heater. The fix is a better building.** A shelter designed for that specific climate — the right materials, the right thickness, the right shape, windows facing the right way — can catch the day's sun, hold onto it, and release it slowly through the night. No fuel required. This is called **passive design**, and it works.

The catch: figuring out *which* design does that, for a *specific* place, is a hard calculation. It depends on the materials, how thick each layer is, which way the building faces, how big the windows are, how well sealed it is, and what the weather actually does at that site.

Today, that calculation is done in software like ANSYS, which:

- costs lakhs of rupees per licence
- needs a powerful workstation
- needs a trained specialist to operate
- takes hours to compute a single design
- needs internet for licence checks

A field engineer at a border post in Ladakh has none of those things.

**ShelterSim is the tool that fits in that gap.** It runs in a web browser, takes about a twentieth of a second per design instead of hours, and tells you in plain language which shelter to build.

### What DRDO explicitly asked for

The official problem statement asks for three outputs. Our app produces all three, and adds a fourth:

| # | What they asked for | What we show |
|---|---|---|
| 1 | Predict the temperature inside the shelter | A graph of indoor vs. outdoor temperature across the day |
| 2 | Predict the heat energy captured from sunlight | How much free solar heat each wall and window collected |
| 3 | Show where the heat flows, and how it relates to the temperature gap | A breakdown of every way heat enters and leaves |
| 4 | *(our addition)* Recommend a better design | A ranked list of improvements with costs and payback time |

Number 4 is not us showing off. The problem statement asks for *"comparative analysis with different materials under the same ambient condition to predict the most efficient combination."* That is a recommendation engine. We are building what was asked for.

---

## 2. Who uses this and what they get

| Who | What they need | What they get from us |
|---|---|---|
| **A DRDO / DIHAR researcher** | To compare shelter designs rigorously and defend the results | Full physics, a validation report, every assumption visible, exportable data |
| **An army / BRO engineer at a post** | To decide what to actually build, with a budget | "Build this. It costs ₹X more and saves ₹Y a year." |
| **A local builder or NGO in Ladakh** | To know whether a cheap local material works as well as an expensive imported one | Side-by-side comparison, filtered to locally available materials |
| **A policy or procurement officer** | Fuel saved, money saved, carbon saved | Those three numbers, computed from the physics, not guessed |

**The common thread: none of them should have to understand heat transfer to use this.** That constraint drives every UI decision below.

---

## 3. The app, in one picture

```
   ┌──────────────────────────────────────────────────────────────┐
   │  THE BROWSER  (what the user sees)                           │
   │                                                              │
   │   Describe your          See it in 3D          Read the      │
   │   shelter          →     and click walls   →   results and   │
   │   (5 simple controls)    to change them        the advice    │
   │                                                              │
   └───────────────────────────┬──────────────────────────────────┘
                               │  internet
                               ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  THE SERVER  (what does the heavy work)                      │
   │                                                              │
   │   ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
   │   │  Weather    │  │  A team of   │  │  Design search   │    │
   │   │  service    │→ │  calculators │→ │  + AI write-up   │    │
   │   │  (NASA)     │  │  (parallel)  │  │                  │    │
   │   └─────────────┘  └──────────────┘  └──────────────────┘    │
   └──────────────────────────────────────────────────────────────┘
```

**The key idea:** the browser is for *showing*, the server is for *computing*. The user's laptop only has to draw a picture; the server does all the arithmetic, and it does many calculations at the same time.

---

## 4. The four parts of the app

### Part 1 — The engine (the calculator)

This is the physics. It is a self-contained piece of code with one job:

> Give it a building and a day of weather. It gives you back the temperature inside, minute by minute, plus a full accounting of where every joule of heat went.

Three properties of it matter for the rest of this document:

- **It is fast.** One full day of simulation takes about 50 milliseconds — a twentieth of a second. ANSYS takes hours for the same question. That gap of roughly half a million times is not a bragging point, it is *the entire product*. It is the difference between "simulate the one design you already chose" and "try two thousand designs and tell me which is best."
- **It is self-contained.** It never touches the network, never touches a database, never remembers anything between calls. Same inputs, same outputs, every time. That means we can safely run many copies of it side by side without them interfering with each other.
- **It runs anywhere.** The exact same code runs on our server *and* inside the user's browser. We wrote it once. This is what makes the offline fallback possible (see Part 4 below).

Everything about how it works is in [`ENGINE_BLUEPRINT.md`](ENGINE_BLUEPRINT.md).

### Part 2 — The server (the coordinator)

The server does four things the engine deliberately refuses to do:

**a) It fetches real weather.** Mostly from **NASA POWER**, which has hourly weather for anywhere on Earth going back to 1981. This matters enormously for [scenarios](#7-testing-every-scenario) — because we have forty-plus years of history, "the coldest day ever recorded at this site" is a real number we can look up, not a guess.

> **One correction we make that most tools skip.** NASA's weather grid squares are about 55 km across. In the Himalaya, a single square can contain a valley floor at 3,000 m and a ridge at 6,500 m. NASA reports a value for the *average* elevation of that square, which can be hundreds of metres off from where your shelter actually is. Air gets colder as you go up — about 6.5 °C per kilometre — so being 500 m off means being about 3 °C wrong. That error is bigger than most of the design improvements we are trying to measure. **So we correct for it automatically, and we show the correction on screen** rather than quietly applying it. Honesty about data quality is a feature.

**b) It runs many simulations at once.** This is the part worth understanding, because it is easy to get wrong.

The engine is a tight loop of arithmetic. It does not wait for anything — no network, no disk. That means the usual web-server trick for handling many users (start one job, go do something else while it waits) buys you *nothing here*, because the job never waits. It just computes, flat out, and blocks everyone behind it.

So instead the server keeps a **pool of independent worker threads**, one per processor core. Each is a separate copy of the engine running on its own core, genuinely at the same time.

```
   Request comes in: "run 18 scenarios for this design"
        │
        ▼
   ┌────────────────── job queue ──────────────────┐
   │  s1  s2  s3  s4  s5  s6 ... s18               │
   └───┬────┬────┬────┬────────────────────────────┘
       ▼    ▼    ▼    ▼
    ┌────┐┌────┐┌────┐┌────┐
    │ W1 ││ W2 ││ W3 ││ W4 │   ← 4 real cores, 4 real simultaneous calculations
    └────┘└────┘└────┘└────┘
       │    │    │    │
       └────┴────┴────┴──► results stream back as each one finishes
```

Eighteen scenarios that would take about a second one after another finish in roughly a quarter of that, and — the part that actually matters — **a second user hitting the site during all this still gets an instant response**, because the main server thread was never busy doing arithmetic.

**c) It streams progress back live.** As each scenario finishes, the server pushes a message to the browser. This is what the loading animation is counting.

**d) It runs the design search and the AI write-up.** Covered in [section 8](#8-how-the-ai-advice-works).

**What the server deliberately does not have: a database.** There are no user accounts, no logins, no saved history on our servers. A simulation run lives in memory for an hour and then evaporates. If you want to keep a design, you download it as a file. Less to build, less to secure, nothing of yours for us to lose.

### Part 3 — The web app (what you see and touch)

A single screen, built around a **3D model of your shelter**.

The design principle here is the one the whole team agreed on: **do not overwhelm the user.** A tool that opens onto forty numeric input boxes is a tool nobody finishes using. So:

- **The first screen has five controls.** Where you are, what kind of shelter, how big, what the walls are made of, how big the windows are. That's it.
- **Everything else is behind an "Advanced" section.** Nothing is taken away — a researcher can still set the ground albedo and the air-change rate. It is just not the first thing you see.
- **You edit the building by clicking on it.** Click the south wall in the 3D view and a small panel opens with a handful of material choices, shown as pictures with a plain sentence each — *"Mud brick: cheap, made locally, good at holding daytime heat."* Not a table of physical constants. The constants are there if you expand the card, along with where we got them from.
- **It responds instantly.** Change a material and the model recolours in about the time it takes to blink, because that quick preview runs right there in your browser rather than making a round trip to the server.

**One technical detail worth stating because it is the source of a lot of trust:** the 3D model you see is built from the *exact same description* the physics engine receives. It is not a decorative illustration drawn alongside the real calculation. If the picture shows a 4 m south wall, the engine is simulating a 4 m south wall. What you see is provably what gets computed.

### Part 4 — The offline fallback

Demo-day Wi-Fi fails. Ladakh has no connectivity at all in many places. So:

**If the server is unreachable, the app keeps working.** The browser carries its own copy of the engine and runs the main scenario locally. You lose the full scenario sweep and the AI advice — those need real compute and a network — but you still get your temperature curve, your heat-flow breakdown, and your 3D model.

And it tells you honestly: *"Offline — showing 1 scenario, AI advice unavailable."* It does not silently pretend to be fully functional.

---

## 5. What the user actually does, step by step

**Step 1 — Say where you are.** Pick a location from a list (Leh, Kargil, Drass, Nubra, plus a contrast city so we can show this is not Ladakh-only software), or drop a pin on a map. We fetch the weather history for that exact spot.

**Step 2 — Describe your shelter.** Three ways in, whichever suits you:

- **Pick a template.** Picture cards: a traditional Ladakhi house, an army barrack, a modern concrete building, a Trombe-wall retrofit. One click and you have a complete starting design. Most people should start here.
- **Fill in the simple form.** Shape, size, roof type, materials. Five controls, sensible defaults on everything.
- **Upload a plan** *(a later addition)*. Photograph or scan a floor plan and we will read the dimensions off it and fill the form in for you — which you then check and correct. This is a convenience, never a requirement, and you always confirm what we extracted before it is used.

Whichever door you come in through, they all produce the same thing: a shelter description the rest of the app understands.

**Step 3 — Look at it and adjust.** Your shelter appears in 3D. Spin it. Click a wall to change what it is made of. Drag a slider to make the windows bigger. The model updates as you go.

**Step 4 — Press Simulate.** And now the nice bit.

### The day/night animation

While the server is working, the 3D scene does not freeze and it does not show a spinner. Instead **it plays out a day.**

The sun rises over your shelter, tracks across the sky, casts moving shadows, sets, and night falls with stars, and then it does it again. It loops until the results are ready.

Two reasons this is in the product and not cut as decoration:

1. **It makes a wait feel like progress.** Watching a shelter stand through a sunrise while a small ring fills in "7 of 18 scenarios done" is a fundamentally different experience from watching a spinner.
2. **It is not fake.** The sun's path in that animation is computed by the same solar-position code the physics engine uses. On 21 December in Leh, the animated sun climbs to the real height the December sun reaches in Leh — low, and in the south. You are watching the actual thing being simulated. It is a demonstration, not a screensaver.

**Step 5 — Read the results.** Temperature graph, solar capture, heat-flow breakdown, and the survival grid across every scenario.

**Step 6 — Read the advice.** A plain-language recommendation of what to change, with what it costs and what it saves.

---

## 6. The screens, and why each one matters

### The temperature graph — *"Will people be warm?"*

Two lines across 24 hours: inside and outside, with the comfortable range shaded. You can overlay up to four designs to compare them directly.

**The single number to look at is the temperature at 6 AM.** Not the average, not the daytime peak — the pre-dawn minimum. That is the coldest moment of the day, the moment that decides whether people had to burn fuel, and it is the number a Ladakh engineer actually cares about. We label it explicitly.

### The solar capture view — *"How much free heat did we get?"*

A bar chart of how much sunlight energy each surface collected, broken out by direction: south, east, west, north, roof.

**This is where orientation stops being an abstraction.** You watch the south-facing bar tower over the north-facing one and it becomes obvious, without anyone explaining it, why passive solar design says to put your glass on the south wall. The chart teaches the principle by itself.

### The heat-flow view — *"Where did the heat go?"*

Two views of the same data:

**A flow-over-time chart.** Heat coming in above the line, heat leaking out below it. The story reads at a glance: a fat block of gain at midday, a fat block of loss all night, and — in a well-designed shelter — the walls quietly giving back stored heat during the small hours.

**A Sankey diagram.** Sunlight and body heat flowing in from the left, splitting into streams: some stored in the walls, some out through the windows, some out through the roof, some carried away by draughts, some radiated to the cold night sky.

**The Sankey is the most persuasive single image in the app.** It answers "where is my heat going?" for someone with no technical background, in one glance, with no explanation needed. You can literally point at the widest outgoing stream and say "that's your problem."

> A small thing about that night-sky stream, because it surprises people: a clear night sky behaves like a surface at roughly −44 °C. Every roof and wall quietly radiates heat straight up into it, all night, whether or not there is any wind. In Ladakh, with 300 cloud-free nights a year, this is one of the largest losses in the whole building — and it is the one that simpler models leave out entirely. We include it. A model without it predicts comfortable Ladakh nights that do not exist, and DRDO's own lab is in Leh. They would know.

### The survival grid — *"Does it hold up on the worst day?"*

A table: one row per scenario, colour-coded green / amber / red by how cold it got inside.

This is the screen that answers the question a procurement officer actually has, which is not "what is the average performance" but **"will this keep people safe on the worst day this place has ever had?"**

### The advice panel — *"So what should I build?"*

A written recommendation, plus a scatter plot of cost against performance so you can see the trade-off and pick your own point on it if you disagree with our ranking.

---

## 7. Testing every scenario

This is the feature that a slow tool simply cannot offer, and it is worth explaining why.

Because one simulation takes about 50 milliseconds, running **eighteen** of them costs about a second of computing — a fraction of that in practice, since they run in parallel across cores. So we do not ask "how does this design do on a typical day?" We ask **"how does this design do on every day that matters?"** and we answer it before the user has finished reading the screen.

Every scenario is pulled from the **real recorded history** of that specific site, not invented:

| Scenario | In plain words |
|---|---|
| **Twelve seasonal days** | One typical day from each month — so we can honestly total up a whole year's fuel |
| **The coldest day on record** | Literally the coldest 24 hours in forty-plus years of records at this location |
| **The hottest day on record** | Because a shelter optimised only for winter can bake in July, and we should catch that |
| **The design winter day** | The cold-but-not-freak day engineers conventionally design to — the 1-in-100 cold day. Standard professional practice, and defensible when a judge asks |
| **The longest sunless stretch** | The longest run of consecutive overcast days ever recorded here, simulated end to end — you watch the shelter bleed heat day after day with no sun to recharge it. **This is the real test of thermal storage.** Anyone can build something that works on a sunny day |
| **The clear cold night** | The coldest night that was *also* cloudless. Counter-intuitively this is worse than the coldest night overall, because clear skies mean maximum heat radiating away upward. This is Ladakh's true worst case, and almost nobody tests for it |

Each returns a full result. The survival grid shows all of them at once.

**Why this is the strongest thing in the pitch:** a tool that takes four hours per run *structurally cannot* answer "what happens during the longest sunless streak on record?" You would need three days of computing. Speed is not a convenience here — it makes a whole category of question askable for the first time.

---

## 8. How the AI advice works

The advice is generated in **two separate stages**, and keeping them separate is the entire reason the advice can be trusted.

### Stage 1 — The search (real physics, no AI)

The computer tries thousands of variations of your design and actually simulates every one:

- insulation thicker or thinner
- insulation on the **inside** face vs. the **outside** face *(this single choice can matter more than the amount)*
- different glazing
- bigger or smaller windows, per direction
- rotating the whole building
- adding thermal mass — a heavy floor, water drums, a Trombe wall
- sealing the building more tightly

Every candidate gets a real simulation. Nothing is estimated or extrapolated.

**One hard rule the search may never break: the building must always be able to breathe.** There is a minimum ventilation rate, and no design that falls below it is ever recommended, no matter how well it scores on temperature. A perfectly sealed shelter with a stove inside is a carbon-monoxide death trap. The most thermally efficient answer would be to seal it completely, so this floor is enforced in code, not left to judgement.

The output is a ranked list, plus a cost-versus-performance chart.

### Stage 2 — The write-up (this is the AI part)

The AI receives your current design's results, the best alternatives the search found, the differences between them, and the material database with its citations. It writes the explanation:

> **Move your insulation to the outside of the wall and add a heavy inner leaf.**
>
> Right now your insulation is on the inside face, which means the thick wall behind it is sitting out in the cold and never gets a chance to store any of the day's sunshine. Flip it: put the insulation outside and the mass inside, and that wall becomes a heat battery — it soaks up warmth all day and gives it back to the room all night.
>
> **Your 6 AM temperature goes from 2.1 °C to 14.2 °C, and you stop needing the stove entirely.**
>
> Extra cost about ₹1.5 lakh. Saves roughly ₹48,000 of kerosene a year. Pays for itself in about three years, and cuts about 1.5 tonnes of CO₂ annually.

**The critical constraint: the AI is not allowed to invent a single number.** Every figure in that paragraph — the 2.1, the 14.2, the ₹48,000, the three years — is read directly from the simulation results. The AI's job is *translation*, turning a table of numbers into a paragraph a human wants to read. It is explicitly not the thing deciding what is good.

We enforce this with an automated check: every number appearing in the AI's text must be findable in the simulation output. If it is not, the text is rejected.

**Why we built it this way.** If you ask an AI directly "what insulation should I use in Ladakh?" you get a plausible-sounding answer drawn from its training data. It might be right. You have no way to check, and when a DRDO panel asks *"how do you know?"*, "the AI said so" is not an answer.

With this design, the answer is: **"We simulated it. Here are the two curves. Here is the energy balance. Here is where the material data came from."** The AI wrote the sentence; the physics made the decision.

**And if the AI is unavailable** — no internet, no API key, service down — the panel still fills in, using a written template driven by the same numbers. Slightly less fluent, exactly as correct. The demo never has a dead panel.

---

## 9. What we deliberately do not build

Being explicit about this is part of the plan, not an admission. Every item below was considered and cut on purpose:

| Not building | Why not |
|---|---|
| Full airflow simulation (CFD) | It computes how air *swirls* around the room. We need the room's average temperature — one number. This is the standard method used by EnergyPlus and the international building-energy standards, and has been for forty years. It buys us a 500,000× speedup for a loss we can name precisely: we do not model warm ceilings and cold floors |
| Room-by-room modelling | One shelter, one room's worth of air. Shelters are small and mostly open |
| Heating equipment models | We model auxiliary heat as "this many watts", not as a specific stove. What DRDO wants to know is how many watts you *need*, which is the same question |
| Damp and mould modelling | We check whether condensation is likely on surfaces, but we do not track moisture moving through walls. Real, and a whole separate project |
| User accounts, logins, saved projects | Nothing to secure, nothing to breach, nothing to lose. Designs download as files |
| A phone app | The web app works on a phone browser |

**The rule we hold ourselves to:** anything not on the original list of heat pathways requires a written justification and a team decision before a line of code gets written. A month is not as long as it feels, and scope creep is the most common way projects like this die.

---

## 10. Where our numbers come from

Every input has a documented, citable source. This is not bureaucracy — it is the difference between an engineering submission and a demo.

| Data | Source |
|---|---|
| Weather (temperature, sun, wind, humidity) | **NASA POWER**, global hourly records from 1981 onward |
| Backup weather | **Open-Meteo**, and pre-downloaded data bundled inside the app so it works with no internet |
| Material properties (conductivity, density, heat capacity) | Published standards — Indian Standards, the ASHRAE Handbook of Fundamentals, manufacturer datasheets. **Every single material in our database carries its citation**, visible in the UI |
| Fuel, cost, and carbon conversions | Published energy content of kerosene and dung, with realistic stove efficiencies. All shown as editable values in an assumptions panel, not buried as magic numbers |
| Solar position | Standard astronomy from Duffie & Beckman, the reference text. Checked against NOAA's public solar calculator |

**Every assumption we make is visible in one panel in the app.** If a judge wants to know what stove efficiency we assumed, it is on screen, and they can change it and watch the numbers move.

### Proving the physics is right

We do not have ANSYS. That turns out not to matter, because there is something better available: **for simple cases, heat transfer has exact mathematical answers.** We check our engine against those.

If we simulate a temperature wave passing through a 200 mm concrete wall and our engine says it arrives 5.1 hours later, damped to 27% of its original size — and the textbook formula says exactly the same — then our engine is not approximately right, it is *right*. That is stronger evidence than matching another piece of software, because the formula cannot itself be buggy.

We run roughly ten such checks, plus a continuous audit that no energy is being created or destroyed anywhere in the model, and we publish all of it in a validation report shipped alongside the app.

**Almost every competing team will demo a chart. Very few will hand the judges a validation report.** That asymmetry costs us nothing but discipline.

---

## 11. Build order

| Phase | What gets built | Done when |
|---|---|---|
| **0** | Project skeleton, shared data definitions | The pieces can talk to each other |
| **1** | **The physics engine** | It reproduces the textbook answers exactly. **Nothing else starts until this passes** |
| **2** | The server: worker pool, weather service, live progress | 20 people can use it at once without slowing each other down |
| **3** | The web app: 3D view, simple controls, charts | Click a wall, change the material, watch everything update |
| **4** | The scenario matrix and survival grid | All eighteen scenarios for Leh finish in under 3 seconds |
| **5** | The design search and AI advice | Every number in the advice traces back to a real simulation |
| **6** | Day/night animation, offline fallback, documentation | Works with the server switched off |
| **7** | *(optional)* Upload a floor plan and read it automatically | It fills the form in and you confirm it |

**Phase 1 is the one that cannot be rushed and cannot be reordered.** If the heat calculation is wrong, every beautiful chart built on top of it is displaying a wrong answer convincingly, which is worse than displaying nothing. So there is a hard stop: the engine must reproduce the known textbook results before anyone builds anything on top of it.

Phases 2 and 3 can be built at the same time by different people, because the data formats between them are agreed and frozen in Phase 0.

---

## 12. Glossary

Every technical term in this document, in one sentence each.

**Thermal mass** — How much heat a material can store. Stone and mud have a lot; a tin sheet has almost none. High mass means the building warms slowly and cools slowly, which is exactly what you want when nights are cold.

**Insulation** — How well a material *blocks* heat from passing through. Foam and straw are good at it; metal is terrible.

*(Those two are different properties, and the difference is the single most important idea in the whole project. A good wall wants insulation on the outside to stop heat escaping, and mass on the inside to store the day's sun. Insulation is the coat; mass is the hot water bottle.)*

**Thermal lag** — The delay between heat arriving at the outside of a wall and reaching the inside. A 300 mm mud wall delays it by around seven hours, which conveniently means the afternoon's sun reaches you around bedtime.

**U-value** — A single number for how leaky a wall is. Lower is better.

**Air changes per hour (ACH)** — How many times an hour the whole room's air is replaced by outside air through cracks and gaps. Too high and you are heating the outdoors; too low and the air gets dangerous, especially with a stove burning.

**Solar gain** — Free heat from sunlight. Through windows, and absorbed by the outside of walls.

**Passive design** — Keeping a building comfortable using only its shape, orientation, and materials — no fuel, no machinery.

**Trombe wall** — A thick dark wall behind a sheet of glass on the south face. Sunlight passes the glass, heats the wall, and the wall releases that heat into the room for hours afterwards. Widely used in Ladakh already, and it works.

**Comfort band** — The temperature range people find acceptable, typically about 18–26 °C. We shade it on every graph.

---

## Where to go next

| You want | Read |
|---|---|
| How the physics works, in full | [`ENGINE_BLUEPRINT.md`](ENGINE_BLUEPRINT.md) |
| The original DRDO problem statement | [`Ladakh_Passive_Shelter_Problem_Statement.md`](../Ladakh_Passive_Shelter_Problem_Statement.md) |
| The complete technical architecture | [`TECH.md`](../TECH.md) |
| The task-by-task build breakdown | [`WORKERS.md`](../WORKERS.md) |
| Known issues found in review | [`AUDIT.md`](../AUDIT.md) |
