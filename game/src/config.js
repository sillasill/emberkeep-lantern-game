// Emberkeep — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Ten waves; wave 10 ends with the Gloom Herald. Clear it and you win. */
export const WAVES = 10;

export const PLAYER = {
  radius: 16,
  speed: 270,
  maxHp: 100,
  fireInterval: 0.24,
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletLife: 0.85,
  dashCooldown: 2.5,
  dashTime: 0.16,
  dashSpeed: 780,
  pickupRadius: 120,
};

/** Enemies inside the lantern's light take this damage multiplier. */
export const LIGHT_BONUS = 1.5;

export const ENEMIES = {
  wisp:    { hp: 22,  speed: 72,  radius: 13, damage: 8,  score: 50,  shards: 1, color: '#b388ff' },
  skitter: { hp: 15,  speed: 158, radius: 11, damage: 6,  score: 75,  shards: 1, color: '#ff7ab8' },
  spitter: { hp: 34,  speed: 58,  radius: 14, damage: 10, score: 100, shards: 2, color: '#7ee787' },
  brute:   { hp: 95,  speed: 46,  radius: 21, damage: 20, score: 200, shards: 3, color: '#ff6b5e' },
  herald:  { hp: 950, speed: 42,  radius: 34, damage: 25, score: 2000, shards: 20, color: '#e8c15a' },
};

/** Shop upgrades between waves. cost grows each time one is bought. */
export const UPGRADES = [
  { id: 'damage', key: '1', name: 'Ember Damage', desc: '+4 bolt damage', base: 6, growth: 1.5, max: 8 },
  { id: 'rate',   key: '2', name: 'Quick Hands',  desc: '+15% fire rate',  base: 8, growth: 1.5, max: 6 },
  { id: 'speed',  key: '3', name: 'Swift Boots',  desc: '+12% move speed', base: 4, growth: 1.4, max: 5 },
  { id: 'light',  key: '4', name: 'Bright Lantern', desc: '+32 light radius', base: 6, growth: 1.5, max: 6 },
  { id: 'heart',  key: '5', name: 'Heartwood',    desc: '+25 max HP, heal 25', base: 7, growth: 1.5, max: 6 },
  { id: 'pierce', key: '6', name: 'Piercing Embers', desc: 'bolts pierce +1 foe', base: 12, growth: 1.6, max: 2 },
];

export const PALETTE = {
  backdrop: '#070a12',
  ground: '#0d1a16',
  groundLight: '#12241d',
  grass: '#1d3a2a',
  stone: '#2c3a44',
  player: '#ffd166',
  playerCore: '#fff3c4',
  bullet: '#ffb347',
  shard: '#ffd166',
  heart: '#ff6b81',
  panel: '#101823',
  panelEdge: '#2a3b4d',
  text: '#f2ead8',
  muted: '#93a3ad',
  gold: '#f2c94c',
  danger: '#ff5d5d',
  boss: '#e8c15a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberkeep.best';
