// Waves: what each wave sends, and what the banner says when it starts.
// Wave 5 brings the Dusk Warden, wave 6 a swarm, wave 8 the Long Dark,
// wave 9 a siege, and wave 10 the Herald. Past wave 10 the garden does not
// end: endless waves cycle the late waves with more foes each time.
import { WAVES } from './config.js';

/**
 * What wave n sends. Each part is {kind, count, elite}: elite counts are
 * the stronger, golden-ringed versions of that kind.
 */
export function waveComposition(n) {
  if (n === WAVES) {
    return [
      { kind: 'herald', count: 1, elite: 0 },
      { kind: 'wisp', count: 6, elite: 0 },
      { kind: 'moth', count: 2, elite: 0 },
      { kind: 'shade', count: 2, elite: 0 },
      { kind: 'bramble', count: 1, elite: 0 },
    ];
  }
  if (n > WAVES) return endlessComposition(n);
  const table = {
    1: [
      { kind: 'wisp', count: 6, elite: 0 },
    ],
    2: [
      { kind: 'wisp', count: 7, elite: 0 },
      { kind: 'skitter', count: 4, elite: 0 },
    ],
    3: [
      { kind: 'wisp', count: 8, elite: 0 },
      { kind: 'skitter', count: 5, elite: 0 },
      { kind: 'spitter', count: 2, elite: 0 },
    ],
    4: [
      { kind: 'wisp', count: 9, elite: 0 },
      { kind: 'skitter', count: 6, elite: 1 },
      { kind: 'spitter', count: 3, elite: 0 },
      { kind: 'brute', count: 1, elite: 0 },
      { kind: 'splitter', count: 2, elite: 0 },
    ],
    5: [
      { kind: 'warden', count: 1, elite: 0 },
      { kind: 'wisp', count: 8, elite: 0 },
      { kind: 'skitter', count: 5, elite: 0 },
      { kind: 'spitter', count: 2, elite: 0 },
      { kind: 'splitter', count: 2, elite: 0 },
    ],
    6: [
      { kind: 'skitter', count: 14, elite: 1 },
      { kind: 'wisp', count: 6, elite: 0 },
      { kind: 'moth', count: 3, elite: 0 },
      { kind: 'shade', count: 3, elite: 0 },
    ],
    7: [
      { kind: 'wisp', count: 10, elite: 0 },
      { kind: 'skitter', count: 6, elite: 0 },
      { kind: 'spitter', count: 4, elite: 1 },
      { kind: 'brute', count: 3, elite: 1 },
      { kind: 'charger', count: 3, elite: 0 },
      { kind: 'moth', count: 2, elite: 0 },
      { kind: 'splitter', count: 3, elite: 0 },
      { kind: 'shade', count: 2, elite: 0 },
      { kind: 'bramble', count: 2, elite: 0 },
    ],
    8: [
      { kind: 'wisp', count: 9, elite: 0 },
      { kind: 'charger', count: 4, elite: 1 },
      { kind: 'moth', count: 4, elite: 0 },
      { kind: 'spitter', count: 3, elite: 0 },
      { kind: 'brute', count: 2, elite: 0 },
      { kind: 'splitter', count: 2, elite: 0 },
      { kind: 'shade', count: 3, elite: 0 },
      { kind: 'bramble', count: 2, elite: 0 },
    ],
    9: [
      { kind: 'brute', count: 4, elite: 1 },
      { kind: 'spitter', count: 4, elite: 0 },
      { kind: 'moth', count: 3, elite: 1 },
      { kind: 'charger', count: 3, elite: 0 },
      { kind: 'splitter', count: 3, elite: 0 },
      { kind: 'wisp', count: 8, elite: 0 },
      { kind: 'shade', count: 3, elite: 0 },
      { kind: 'bramble', count: 3, elite: 0 },
    ],
  };
  return table[n] || table[1];
}

/** Endless waves: the late waves again, denser every time, a Herald every fifth. */
function endlessComposition(n) {
  const cycle = [7, 8, 9, 10];
  const base = waveComposition(cycle[(n - WAVES - 1) % cycle.length]);
  const extra = 1 + 0.15 * (n - WAVES);
  const out = base
    .filter((p) => p.kind !== 'herald')
    .map((p) => ({ kind: p.kind, count: Math.ceil(p.count * extra), elite: p.elite }));
  if ((n - WAVES) % 5 === 0) out.push({ kind: 'herald', count: 1, elite: 0 });
  return out;
}

export function waveBanner(n) {
  if (n > WAVES) return `Endless Wave ${n} — the dark returns`;
  if (n >= WAVES) return 'Wave 10 — The Gloom Herald';
  if (n === 5) return 'Wave 5 — The Dusk Warden';
  if (n === 6) return 'Wave 6 — The Swarm';
  if (n === 8) return 'Wave 8 — The Long Dark';
  if (n === 9) return 'Wave 9 — The Siege';
  return `Wave ${n}`;
}
