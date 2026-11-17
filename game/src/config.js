// Emberkeep — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Ten waves; wave 10 ends with the Gloom Herald. Clear it and you win. */
export const WAVES = 10;

/** Three ways to keep the lantern: foe toughness, foe damage and score. */
export const DIFFICULTIES = [
  { id: 'lantern', key: '1', name: 'Lantern-Bearer', desc: 'A gentler dark, for learning the garden', hp: 0.8, damage: 0.8, score: 0.9 },
  { id: 'keeper',   key: '2', name: 'Keeper',         desc: 'The garden as it was meant to be kept',   hp: 1,   damage: 1,   score: 1 },
  { id: 'night',    key: '3', name: 'Nightkeeper',    desc: 'The dark at its worst — and its richest',  hp: 1.3, damage: 1.2, score: 1.3 },
];

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

/** Kills chained within this many seconds build the score combo. */
export const COMBO_WINDOW = 2.5;
/** Each chained kill adds this much score multiplier, up to COMBO_CAP. */
export const COMBO_STEP = 0.1;
export const COMBO_CAP = 3;

/** Wave 8 is the Long Dark: the lantern's light shrinks this much. */
export const DARK_WAVE = 8;
export const DARK_LIGHT = 0.75;

export const ENEMIES = {
  wisp:    { hp: 22,  speed: 72,  radius: 13, damage: 8,  score: 50,  shards: 1, color: '#b388ff' },
  skitter: { hp: 15,  speed: 158, radius: 11, damage: 6,  score: 75,  shards: 1, color: '#ff7ab8' },
  spitter: { hp: 34,  speed: 58,  radius: 14, damage: 10, score: 100, shards: 2, color: '#7ee787' },
  brute:   { hp: 95,  speed: 46,  radius: 21, damage: 20, score: 200, shards: 3, color: '#ff6b5e' },
  // Splits into two wisps when slain; the garden's shadows multiply.
  splitter: { hp: 40, speed: 65,  radius: 15, damage: 10, score: 125, shards: 2, color: '#c9a7ff' },
  // Stalks, then telegraphs a line and charges through it.
  charger: { hp: 55,  speed: 62,  radius: 14, damage: 14, score: 150, shards: 2, color: '#ff9f43' },
  // Drifts in a wide sine and looses a three-bolt spread at the keeper.
  moth:    { hp: 30,  speed: 82,  radius: 12, damage: 8,  score: 125, shards: 2, color: '#8ef1d4' },
  // Blinks across the dark in short hops, closing the distance in bursts.
  shade:   { hp: 26,  speed: 150, radius: 12, damage: 10, score: 150, shards: 2, color: '#7a5cff' },
  // Roots itself at range and looses thorn spreads; slow, but it holds ground.
  bramble: { hp: 60,  speed: 26,  radius: 16, damage: 12, score: 175, shards: 2, color: '#5ec95e' },
  // The wave 5 mini-boss: ring bursts and summons, smaller than the Herald.
  warden:  { hp: 420, speed: 46,  radius: 26, damage: 18, score: 1000, shards: 10, color: '#9fd8ff' },
  herald:  { hp: 950, speed: 42,  radius: 34, damage: 25, score: 2000, shards: 20, color: '#e8c15a' },
};

/** Elites: bigger, tougher, worth more. Their hp and score scale from the base. */
export const ELITE = { hp: 2.5, speed: 1.05, radius: 1.15, score: 3, shards: 2 };

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
