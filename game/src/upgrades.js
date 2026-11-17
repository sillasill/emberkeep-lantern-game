// The Lantern Rest's shop: eight upgrades bought with sunshards between
// waves. Each upgrade's cost grows every time it is bought, up to its max.
// Applying an upgrade lives here too, so world.js only decides whether the
// purchase is legal; the numbers are all in this file.

/** Shop upgrades between waves. cost grows each time one is bought. */
export const UPGRADES = [
  { id: 'damage', key: '1', name: 'Ember Damage', desc: '+4 bolt damage', base: 6, growth: 1.5, max: 8 },
  { id: 'rate',   key: '2', name: 'Quick Hands',  desc: '+15% fire rate',  base: 8, growth: 1.5, max: 6 },
  { id: 'speed',  key: '3', name: 'Swift Boots',  desc: '+12% move speed', base: 4, growth: 1.4, max: 5 },
  { id: 'light',  key: '4', name: 'Bright Lantern', desc: '+32 light radius', base: 6, growth: 1.5, max: 6 },
  { id: 'heart',  key: '5', name: 'Heartwood',    desc: '+25 max HP, heal 25', base: 7, growth: 1.5, max: 6 },
  { id: 'pierce', key: '6', name: 'Piercing Embers', desc: 'bolts pierce +1 foe', base: 12, growth: 1.6, max: 2 },
  { id: 'multi',  key: '7', name: 'Twin Bolts',    desc: '+1 bolt per shot',   base: 14, growth: 1.7, max: 2 },
  { id: 'regen',  key: '8', name: 'Moss Heart',    desc: 'regenerate +0.6 HP/s', base: 9, growth: 1.5, max: 4 },
];

export function upgradeCost(up, owned) {
  return Math.round(up.base * up.growth ** owned);
}

/** Apply one purchase to the keeper's stats and body. */
export function applyUpgradeEffect(id, stats, player) {
  if (id === 'damage') stats.damage += 4;
  else if (id === 'rate') stats.fireInterval *= 0.87;
  else if (id === 'speed') stats.speed *= 1.12;
  else if (id === 'light') stats.light += 32;
  else if (id === 'heart') { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); }
  else if (id === 'pierce') stats.pierce += 1;
  else if (id === 'multi') stats.multishot += 1;
  else if (id === 'regen') stats.regen += 0.6;
}
