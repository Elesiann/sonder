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

// A city, not a fixed gallery: a fresh crowd every visit, stable within it.
// One random salt per page load — so point i is the same soul while you're
// here (re-clicking isn't a glitch), but a new stranger next time you come,
// the way you never cross the same passer-by twice. The space is vast enough
// that repeats within a visit are effectively nil.
const SESSION = (Math.random() * 0x100000000) >>> 0;
export const seedFor = (i) => (Math.imul(i + 1, 2654435761) ^ SESSION) >>> 0;

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
