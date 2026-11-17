// Relics: one-of-three blessings offered free at the Lantern Rest after
// every cleared wave. Each relic is taken once per run and bends the run in
// a different direction, so two runs with different relics play differently.
// The draft is drawn from what the keeper does not own yet; when all twelve
// are owned, no draft is offered. Applying a relic lives in world.js, which
// owns the state; this file only describes the relics and draws the draft.
export const RELICS = [
  {
    id: 'nova', name: 'Ember Nova', color: '#ffb347',
    desc: 'Slain foes burst, scorching nearby shadows for 20.',
    flavor: 'The light fights back.',
  },
  {
    id: 'twin', name: 'Twin Flame', color: '#ffd166',
    desc: 'Every shot fires one extra bolt.',
    flavor: 'One lantern, two flames.',
  },
  {
    id: 'frost', name: 'Frostbite Embers', color: '#9fd8ff',
    desc: 'Bolts chill foes, slowing them 35% for 1.2 s.',
    flavor: 'Winter remembers the garden.',
  },
  {
    id: 'vampire', name: 'Bloodlight', color: '#ff6b81',
    desc: 'Kills inside your light restore 2 HP.',
    flavor: 'The light drinks, then gives.',
  },
  {
    id: 'ricochet', name: 'Ricochet Embers', color: '#c9a7ff',
    desc: 'Bolts bounce to a second foe once.',
    flavor: 'No shadow hides twice.',
  },
  {
    id: 'thorns', name: 'Thorned Lantern', color: '#7ee787',
    desc: 'Foes that touch you take 12 damage.',
    flavor: 'The garden has teeth.',
  },
  {
    id: 'greed', name: 'Gilded Shards', color: '#f2c94c',
    desc: 'Every kill drops one extra sunshard.',
    flavor: 'The dark pays for its keep.',
  },
  {
    id: 'swift', name: 'Swift Step', color: '#8ef1d4',
    desc: 'Dash recharges 40% faster.',
    flavor: 'Run like the dawn is coming.',
  },
  {
    id: 'magnet', name: 'Shard Magnet', color: '#ffd166',
    desc: 'Shards and hearts fly to you from twice as far.',
    flavor: 'The garden leans toward its keeper.',
  },
  {
    id: 'second-wind', name: 'Second Dawn', color: '#fff3c4',
    desc: 'The first killing blow instead leaves you at half health and scatters nearby foes.',
    flavor: 'The light refuses to die once.',
  },
  {
    id: 'overcharge', name: 'Overcharge Ember', color: '#ff9f43',
    desc: 'Every 6th shot is a heavy ember: triple damage, piercing two foes.',
    flavor: 'Six small lights, one great one.',
  },
  {
    id: 'halo', name: 'Halo of Embers', color: '#ff7ab8',
    desc: 'Foes standing in your light burn for 2 damage every second.',
    flavor: 'Stand close. It hurts them more.',
  },
];

/** Pick three distinct relics the keeper does not own yet, or fewer if fewer remain. */
export function draftRelics(random, owned) {
  const pool = RELICS.filter((r) => !owned[r.id]);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

export function relicById(id) {
  return RELICS.find((r) => r.id === id);
}
