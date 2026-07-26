// Seeded PRNG — single instance, created once, reset only on reload()
// Uses a simple mulberry32 PRNG for determinism (§10 #1, #2, #4)

export class Randomizer {
  constructor(seed) {
    this.seed = seed;
    this._state = seed;
  }

  reset(newSeed) {
    this.seed = newSeed;
    this._state = newSeed;
  }

  // mulberry32 — returns a float in [0, 1)
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Draw an integer in [min, max] inclusive
  intInRange(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Draw a float in [min, max]
  floatInRange(min, max) {
    return this.next() * (max - min) + min;
  }
}
