# sonder

> **sonder** · *n.* the realization that each random passer-by is living a life
> as vivid and complex as your own — populated with their own ambitions, their
> own friends and routines and worries and inherited madness — an epic story
> that goes on, invisibly, all around you.

A crowd in the dusk. A thousand strangers, drifting. You can take in the whole
of them at once and know none of them — or you can stop, choose one, and learn
a single true thing about a life that was always there, going on without you.

Then you let them go, and they dissolve back into the crowd.

## what it is

sonder is a small, quiet room built around one feeling: the quiet lurch of
remembering that you are not the main character.

That the woman who just passed you has a father in a hospital bed. That the man
at the bus stop is in love for the first time in years and can't tell anyone.
That every lit window at dusk is the centre of someone's entire world.

You already know this. You just rarely *feel* it.

The piece doesn't argue the point — it stages it. The crowd is too large to
hold. Your attention is a single thread. Each person you notice is already
whole, and your noticing is the only thing that ever brings them into the
light: a glance, a fragment, and then the street again. Meeting them is exactly
as much as you will ever get.

It is meant to be small, and slow, and a little sad. Not an answer to anything.
A place to stand for a minute and feel the size of the world honestly.

## on attention

There is nothing to finish here. No goal, no score, no one you're meant to
reach. You cannot meet everyone — that isn't a limitation, it's the whole
point. The crowd outlasts your patience the way a real one does.

Notice who you notice. Let the rest stay strangers.

They go on either way.

---

<sub>**Live:** [sonder-ecp.pages.dev](https://sonder-ecp.pages.dev) — a Vite + three.js front. The strangers come from a small private engine (a Cloudflare Worker) the front asks for one finished life at a time.</sub>

<sub>**Local:** `npm install && npm run dev`. Point `VITE_SOUL_API` at the engine (see `.env.example`); absent it, the front falls back to `http://localhost:8787`.</sub>

<sub>**Deploy:** `VITE_SOUL_API=<worker-url> npm run build`, then `npx wrangler pages deploy dist`. The engine is deployed separately.</sub>
