// the client side of the soul.
//
// This file asks the private engine for a *finished* person and caches it.
// It contains no lexicon, no grammar — nothing that would spoil the magic if
// you read the source. Only the contract and the network plumbing live here.

const API = import.meta.env.VITE_SOUL_API || "http://localhost:8787";

// presentation labels for the secondary facets — UI, not lexicon.
export const FACETS = [
  { key: "carrying", label: "carrying" },
  { key: "secret", label: "hasn’t told anyone" },
  { key: "heading", label: "headed" },
];

// A fixed crowd: point i is always the same soul, this visit or the next.
// (Knuth multiplicative hash — just so the seeds aren't a naked 0,1,2,3…)
// Want a fresh world every visit instead? Assign a random seed per point at
// init and pass that here; nothing else changes.
export const seedFor = (i) => (Math.imul(i + 1, 2654435761) >>> 0);

const cache = new Map(); // seed -> persona
const inflight = new Map(); // seed -> Promise<persona>

function load(seed) {
  if (cache.has(seed)) return Promise.resolve(cache.get(seed));
  if (inflight.has(seed)) return inflight.get(seed);
  const p = fetch(`${API}/?seed=${seed}`)
    .then((r) => {
      if (!r.ok) throw new Error(`soul ${seed}: ${r.status}`);
      return r.json();
    })
    .then((soul) => {
      cache.set(seed, soul);
      inflight.delete(seed);
      return soul;
    })
    .catch((e) => {
      inflight.delete(seed);
      throw e;
    });
  inflight.set(seed, p);
  return p;
}

// warm the cache for a point the eye is hovering — by the time the click
// lands, the life is usually already in hand (see reveal() in main.js).
export function prefetch(i) {
  if (i >= 0) load(seedFor(i)).catch(() => {});
}

// resolve the person for a point (from cache, in-flight request, or fresh).
export function getSoul(i) {
  return load(seedFor(i));
}
