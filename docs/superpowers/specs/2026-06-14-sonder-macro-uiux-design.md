# Sonder — Macro UI/UX pass (design)

Date: 2026-06-14
Status: approved (direction), pending implementation plan

## Problem

The details are polished (bloom, depth-of-field, palette, generative sound, reveal
animation), but the **macro** still reads as a tech demo: a contained oval of points
floating in a dark void, and you reach in from the outside to click dots. Two concrete
complaints:

1. **Wasted space** — the crowd is an oval in the center; the rest of the frame is empty.
2. **Nothing to do / explore** — you look at a static cloud and click. You never *enter* it.

The goal is more **modernity at the macro level** — making the piece feel like a place you
are inside, not an object you look at — without breaking the premise or adding clutter.

## Premise guardrails (non-negotiable)

- **Ephemeral, no return, no collection.** In a city of millions you don't see the same
  stranger twice. No saved/favorited souls, no history, no "your people" ledger, no revisit.
- **Restraint.** Any new UI must be *about the people*, not about the interface. No HUD
  bloat, no menus, no game mechanics.
- **Engine untouched.** The private engine, the `grow(seed)` contract, and `soul.js`
  (`getSoul`/`seedFor`) do not change. The front never learns a soul's archetype/traits
  ahead of the click; text still arrives from the worker on reveal. No engine lexicon
  leaks into the public front.

## Approved direction

### 1. Full-bleed immersion (replaces the centered oval)
Points fill the whole frame and bleed past the edges. The crowd is distributed in a large
volume with real **depth**: some points pass close to the camera (larger, softly defocused),
others recede into the distance (tiny, faint). You are *inside* a field that continues
beyond what the viewport shows — not looking at a clump.

### 2. Free navigation (this is the "explore")
The camera stops being purely on rails. You move **through** the crowd — drift forward and
look around. "Exploring" becomes literally walking among strangers and choosing who to stop
for. Calm and contemplative, never a flight sim.

- Default control proposal: mouse moves the gaze/heading; a gentle forward drift carries you,
  with scroll (or hold) to advance deeper. Movement is slow and damped. **(open — see below)**

### 3. Slow contemplative current
Points are not static and not random jitter. Each drifts with a gentle sense of *going
somewhere* — a calm current with variety in **path** (some wander, some cross, some pause),
all within a slow speed band. Motion deliberately makes **no claim** about who a person is
(no "fast = urgent type"): the whole point of sonder is that you can't read an inner life
from the outside, and tying motion to traits would both contradict the theme and require
coupling the front to the private engine.

### 4. Noticing someone
On reveal: the whole world recedes and blurs (extend the existing shader depth-of-field), the
chosen soul warms into an amber glow (existing notice sprite), and an **editorial column**
slides in from one side with the text. The rest of the crowd keeps drifting, indifferent.

### 5. The reading column — "quiet editorial"
Replaces the centered popup card. Set in Spectral:
- a small uppercase label ("um estranho" / equivalent),
- the name + age large,
- a one-line portrait in italic,
- the three facets (what they carry / what they've told no one / where they're headed) as a
  calm paragraph stack with generous air.

Anchored to a side, over a soft gradient scrim; the blurred world stays visible behind it.

### 6. Frame labels
A thin typographic layer turns the negative space into deliberate composition (gallery-label
feel): the word **SONDER**, and a quiet count of the crowd around you (e.g. "2.431 vidas ao
seu redor"). This is **scale, not score** — it reinforces how many pass unnoticed, never a
tally of who you've collected.

## Open decisions (to settle in the plan)

1. **Navigation controls** — exact scheme (forward drift + mouse-look + scroll-to-advance vs
   drag-to-pan). Pick the calmest option that works on trackpad and touch.
2. **Field extent** — finite-but-large (you can reach an edge) vs the field re-seeding far
   points as you move (feels endless). The ~2400 souls are a fixed set; leaning finite-large.
3. **Column side & responsive behavior** — which side, and how it collapses on narrow/mobile.
4. **Mobile/touch navigation** — how "move through the crowd" maps to touch.

## Out of scope

- Persistence, accounts, sharing, collections, revisiting.
- Any change to the engine, the worker contract, or `soul.js`.
- New libraries beyond what's already in (`postprocessing`, `tone`). No GSAP, no r3f.

## Verification

- `npm run dev` + worker: enter the crowd, move through it, stop a point → world recedes,
  soul glows, editorial column reads cleanly; the current keeps flowing behind.
- Reload twice → different crowd (session salt already exists).
- `npm run build` compiles; bundle size sane.
- Worker contract unchanged (`curl` identical).
- Atomic commits per milestone, only after green. Push only when asked.
