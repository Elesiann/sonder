# sonder

> *n.* the realization that each passer-by is living a life as vivid and
> complex as your own.

A crowd of points drifting in the dusk. Each one is a stranger. Notice one,
click it, and a sliver of their life surfaces — what they're carrying, what
they haven't told anyone, where they're headed — then dissolves back into the
crowd.

Built with three.js. The personality is almost entirely in the front: the
quiet, the dusk palette, the way the camera turns its attention toward whoever
you noticed.

## Where the souls come from

The lives are **generated**, not stored — a deterministic grammar where each
point's seed grows the same person every time. But that machine doesn't live
here. If you could read a hundred arrays in this repo, the magic would die.

So the generator (grammar + lexicon) is a separate, private service. This repo
is only the face: it asks the engine for a *finished* person and never sees the
machinery.

```
click point i  ->  fetch(`${VITE_SOUL_API}/?seed=…`)  ->  { name, age, summary, secondary }
```

Latency is hidden by prefetching on hover (the life is usually in hand before
the click) and by the card's own unhurried fade-in.

## Run

```sh
npm install
cp .env.example .env.local   # point VITE_SOUL_API at a running sonder-engine
npm run dev
```

You need the engine running (see `sonder-engine`, `wrangler dev` → localhost:8787).

## Knobs

`src/main.js` — `COUNT`, `SPREAD`, `FOG_DENSITY`, the palette, `autoRotateSpeed`,
the raycaster `threshold`. `src/soul.js` — `seedFor` decides whether the crowd
is fixed (same souls every visit) or fresh per session.
