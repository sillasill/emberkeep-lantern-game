// The game's rules and state, with no drawing and no browser in it: the
// keeper, the shadow horde, ember bolts, pickups, waves, the shop, relics
// and the combo. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react (sound, announcements) without the
// world knowing about screens or sound. The lantern's light is the core
// rule: foes inside it take 50% more damage, so holding ground near the
// keeper matters.
import {
  COMBO_CAP, COMBO_STEP, COMBO_WINDOW, DARK_LIGHT, DARK_WAVE,
  DIFFICULTIES, ELITE, ENEMIES, FIELD, LIGHT_BONUS, PLAYER, STEP, WAVES,
} from './config.js';
import { draftRelics } from './relics.js';
import { waveBanner, waveComposition } from './waves.js';
import { UPGRADES, applyUpgradeEffect, upgradeCost } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_SHOOT = 64;
export const EVENT_RELIC = 128;
export const EVENT_ELITE = 256;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }

function difficultyOf(id) {
  return DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[1];
}

/** The score multiplier for a kill chain of `combo` kills. */
export function comboMultiplier(combo) {
  return Math.min(COMBO_CAP, 1 + COMBO_STEP * combo);
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, radius: PLAYER.radius,
    aimX: 1, aimY: 0, fireTimer: 0, dashTimer: 0, dashCooldown: 0,
    invulnerable: 0, moving: false,
  };
  const stats = {
    damage: PLAYER.bulletDamage, fireInterval: PLAYER.fireInterval,
    speed: PLAYER.speed, light: 220, pierce: 0, multishot: 0, regen: 0,
  };
  const state = {
    player, stats,
    score: 0, shards: 0, wave: 0, kills: 0, time: 0,
    enemies: [], bullets: [], ebullets: [], pickups: [],
    particles: [], texts: [], upgrades: {}, relics: {},
    relicDraft: null, relicTaken: false,
    combo: 0, comboTimer: 0, bestCombo: 0,
    darkness: false, light: 220,
    waveState: 'title', // title | fight | shop | won | lost
    spawnQueue: [], spawnTimer: 0, enemiesLeft: 0,
    shake: 0, flash: 0, banner: '', bannerTimer: 0,
    bossHp: 0, bossMax: 0, bossLabel: '',
    difficulty: 'keeper', endless: false, secondWindUsed: false, shotCount: 0,
  };

  function addParticle(x, y, vx, vy, life, size, color) {
    if (state.particles.length > 240) state.particles.shift();
    state.particles.push({ x, y, vx, vy, life, maxLife: life, size, color });
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * TAU;
      const s = speed * (0.4 + random() * 0.8);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + random() * 0.4, 2 + random() * 3, color);
    }
  }
  function addText(x, y, text, color) {
    if (state.texts.length > 24) state.texts.shift();
    state.texts.push({ x, y, text, color, life: 0.9 });
  }
  function banner(text) { state.banner = text; state.bannerTimer = 2.2; }

  function reset() {
    player.x = FIELD.width / 2; player.y = FIELD.height / 2;
    player.vx = 0; player.vy = 0;
    player.hp = PLAYER.maxHp; player.maxHp = PLAYER.maxHp;
    player.fireTimer = 0; player.dashTimer = 0; player.dashCooldown = 0; player.invulnerable = 0;
    stats.damage = PLAYER.bulletDamage; stats.fireInterval = PLAYER.fireInterval;
    stats.speed = PLAYER.speed; stats.light = 220; stats.pierce = 0;
    stats.multishot = 0; stats.regen = 0;
    state.score = 0; state.shards = 0; state.wave = 0; state.kills = 0; state.time = 0;
    state.enemies.length = 0; state.bullets.length = 0; state.ebullets.length = 0;
    state.pickups.length = 0; state.particles.length = 0; state.texts.length = 0;
    state.upgrades = {}; state.relics = {};
    state.relicDraft = null; state.relicTaken = false;
    state.combo = 0; state.comboTimer = 0; state.bestCombo = 0;
    state.darkness = false; state.light = 220;
    state.waveState = 'title';
    state.spawnQueue.length = 0; state.enemiesLeft = 0;
    state.shake = 0; state.flash = 0; state.banner = ''; state.bannerTimer = 0;
    state.bossHp = 0; state.bossMax = 0; state.bossLabel = '';
    state.difficulty = 'keeper'; state.endless = false;
    state.secondWindUsed = false; state.shotCount = 0;
  }

  /** Choose how hard the dark fights back. Only before the run starts. */
  function setDifficulty(id) {
    if (state.waveState !== 'title') return false;
    if (!DIFFICULTIES.some((d) => d.id === id)) return false;
    state.difficulty = id;
    return true;
  }

  /** After victory: keep playing past wave 10, the dark returning denser. */
  function startEndless() {
    if (state.waveState !== 'won') return false;
    state.endless = true;
    startWave(state.wave + 1);
    return true;
  }

  function spawnEnemy(kind, elite = false) {
    const def = ENEMIES[kind];
    // Spawn just outside the field edge, on a random side.
    const side = Math.floor(random() * 4);
    let x; let y;
    if (side === 0) { x = random() * FIELD.width; y = -30; }
    else if (side === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
    else if (side === 2) { x = random() * FIELD.width; y = FIELD.height + 30; }
    else { x = -30; y = random() * FIELD.height; }
    const hpScale = (1 + (state.wave - 1) * 0.08) * difficultyOf(state.difficulty).hp;
    const enemy = {
      kind, x, y,
      hp: def.hp * hpScale * (elite ? ELITE.hp : 1),
      maxHp: def.hp * hpScale * (elite ? ELITE.hp : 1),
      speed: def.speed * (0.9 + random() * 0.2) * (elite ? ELITE.speed : 1),
      radius: def.radius * (elite ? ELITE.radius : 1),
      damage: def.damage * difficultyOf(state.difficulty).damage,
      score: def.score * (elite ? ELITE.score : 1),
      shards: def.shards * (elite ? ELITE.shards : 1),
      elite,
      shootTimer: 1 + random() * 1.5, summonTimer: 5, burstTimer: 3.5,
      spreadTimer: 1.5, blinkTimer: 2, thornTimer: 2,
      chargeState: 'stalk', chargeT: 0, chargeDx: 0, chargeDy: 0,
      phase: random() * TAU, hitFlash: 0, knockX: 0, knockY: 0,
      spawnAge: 0, slowTimer: 0, enraged: false, phase3: false,
    };
    state.enemies.push(enemy);
    if (kind === 'herald') {
      state.bossHp = enemy.hp; state.bossMax = enemy.maxHp; state.bossLabel = 'THE GLOOM HERALD';
    }
    if (kind === 'warden') {
      state.bossHp = enemy.hp; state.bossMax = enemy.maxHp; state.bossLabel = 'THE DUSK WARDEN';
    }
    return enemy;
  }

  function startWave(n) {
    state.wave = n;
    state.waveState = 'fight';
    if (n > WAVES) state.endless = true;
    state.darkness = n === DARK_WAVE;
    state.spawnQueue = [];
    for (const part of waveComposition(n)) {
      for (let i = 0; i < part.count; i += 1) {
        state.spawnQueue.push({ kind: part.kind, elite: i < (part.elite || 0) });
      }
    }
    // Shuffle the queue so the wave arrives mixed, not in blocks.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    state.spawnTimer = 0.5;
    state.enemiesLeft = state.spawnQueue.length;
    banner(waveBanner(n));
    if (state.darkness) banner('Wave 8 — The Long Dark: your light shrinks');
  }

  function dropPickup(x, y, kind) {
    state.pickups.push({ kind, x, y, vx: (random() - 0.5) * 60, vy: (random() - 0.5) * 60, life: 20 });
  }

  function killEnemy(enemy, index) {
    state.enemies.splice(index, 1);
    // The kill chain: every kill inside the window raises the multiplier.
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    const gain = Math.round(enemy.score * comboMultiplier(state.combo) * difficultyOf(state.difficulty).score);
    state.score += gain;
    state.kills += 1;
    state.enemiesLeft = state.spawnQueue.length + state.enemies.length;
    burst(enemy.x, enemy.y, ENEMIES[enemy.kind].color, enemy.kind === 'herald' || enemy.kind === 'warden' ? 40 : 12, 160);
    addText(enemy.x, enemy.y - 10, `+${gain}`, '#f2ead8');
    if (state.combo >= 5) addText(enemy.x, enemy.y - 30, `COMBO x${comboMultiplier(state.combo).toFixed(1)}`, '#ffd166');
    for (let i = 0; i < enemy.shards; i += 1) dropPickup(enemy.x, enemy.y, 'shard');
    if (state.relics.greed) dropPickup(enemy.x, enemy.y, 'shard');
    if (random() < 0.08) dropPickup(enemy.x, enemy.y, 'heart');
    // Bloodlight: a kill inside the light gives a little health back.
    if (state.relics.vampire && Math.hypot(enemy.x - player.x, enemy.y - player.y) < state.light) {
      player.hp = Math.min(player.maxHp, player.hp + 2);
    }
    // Ember Nova: the slain foe bursts, scorching its neighbours. Snapshot
    // the victims first: a chain reaction may remove foes while we iterate.
    if (state.relics.nova) {
      burst(enemy.x, enemy.y, '#ffb347', 10, 200);
      const victims = state.enemies.filter(
        (o) => Math.hypot(o.x - enemy.x, o.y - enemy.y) < 100,
      );
      for (const other of victims) {
        const idx = state.enemies.indexOf(other);
        if (idx === -1) continue; // already gone in a chain reaction
        other.hp -= 20;
        other.hitFlash = 0.12;
        if (other.hp <= 0) killEnemy(other, idx);
      }
    }
    // Splitters divide: two wisps take the fallen one's place.
    if (enemy.kind === 'splitter') {
      for (let k = 0; k < 2; k += 1) {
        const w = spawnEnemy('wisp');
        w.x = enemy.x + (random() - 0.5) * 40;
        w.y = enemy.y + (random() - 0.5) * 40;
      }
      state.enemiesLeft = state.spawnQueue.length + state.enemies.length;
    }
    if (enemy.kind === 'herald' || enemy.kind === 'warden') { state.bossHp = 0; }
  }

  function hurtPlayer(damage, fromX, fromY, enemy) {
    if (player.invulnerable > 0 || player.dashTimer > 0) return 0;
    player.hp -= damage;
    player.invulnerable = 0.7;
    state.flash = 0.35;
    state.shake = 9;
    burst(player.x, player.y, '#ff5d5d', 10, 140);
    const dx = player.x - fromX; const dy = player.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    player.x = Math.min(FIELD.width - 20, Math.max(20, player.x + (dx / len) * 26));
    player.y = Math.min(FIELD.height - 20, Math.max(20, player.y + (dy / len) * 26));
    // Thorned Lantern: the attacker is cut for touching the keeper.
    if (enemy && state.relics.thorns) {
      enemy.hp -= 12;
      enemy.hitFlash = 0.12;
    }
    if (player.hp <= 0) {
      // Second Dawn: the first killing blow is refused once per run.
      if (state.relics['second-wind'] && !state.secondWindUsed) {
        state.secondWindUsed = true;
        player.hp = Math.ceil(player.maxHp * 0.5);
        player.invulnerable = 2;
        banner('Second Dawn — the light refuses to die');
        burst(player.x, player.y, '#fff3c4', 30, 240);
        for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
          const o = state.enemies[i];
          if (o.kind !== 'herald' && o.kind !== 'warden'
            && Math.hypot(o.x - player.x, o.y - player.y) < 220) killEnemy(o, i);
        }
        return EVENT_HIT;
      }
      player.hp = 0;
      state.waveState = 'lost';
      burst(player.x, player.y, '#ffd166', 40, 220);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function buyUpgrade(id) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up || state.waveState !== 'shop') return false;
    const owned = state.upgrades[id] || 0;
    if (owned >= up.max) return false;
    const cost = upgradeCost(up, owned);
    if (state.shards < cost) return false;
    state.shards -= cost;
    state.upgrades[id] = owned + 1;
    applyUpgradeEffect(id, stats, player);
    burst(player.x, player.y, '#ffd166', 14, 120);
    return true;
  }

  /** Take one relic from the draft offered at this rest. Free, once per rest. */
  function buyRelic(index) {
    if (state.waveState !== 'shop' || state.relicTaken) return false;
    if (!state.relicDraft || index < 0 || index >= state.relicDraft.length) return false;
    const relic = state.relicDraft[index];
    if (state.relics[relic.id]) return false;
    state.relics[relic.id] = 1;
    state.relicTaken = true;
    if (relic.id === 'twin') stats.multishot += 1;
    burst(player.x, player.y, relic.color, 18, 140);
    banner(`${relic.name} — ${relic.flavor}`);
    return true;
  }

  /** One fixed step of live play. input: {mx, my, aimX, aimY, firing, dash}. */
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    state.light = stats.light * (state.darkness ? DARK_LIGHT : 1);
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    // Moss Heart: slow regeneration between hits.
    if (stats.regen > 0 && player.hp > 0 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + stats.regen * dt);
    }

    // --- player movement and dash
    const dashing = player.dashTimer > 0;
    const speed = dashing ? PLAYER.dashSpeed : stats.speed;
    player.vx = input.mx * speed;
    player.vy = input.my * speed;
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
    player.moving = input.mx !== 0 || input.my !== 0;
    if (input.dash && player.dashCooldown <= 0 && player.moving) {
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown * (state.relics.swift ? 0.6 : 1);
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.1);
      burst(player.x, player.y, '#9fd8ff', 8, 100);
    }
    if (player.dashTimer > 0) player.dashTimer -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    const aimLen = Math.hypot(input.aimX - player.x, input.aimY - player.y) || 1;
    player.aimX = (input.aimX - player.x) / aimLen;
    player.aimY = (input.aimY - player.y) / aimLen;

    // --- firing (one bolt per multishot level, fanned out)
    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0) {
      player.fireTimer = stats.fireInterval;
      const count = 1 + stats.multishot;
      state.shotCount += 1;
      // Overcharge Ember: every 6th shot is a heavy ember.
      const overcharged = Boolean(state.relics.overcharge) && state.shotCount % 6 === 0;
      for (let k = 0; k < count; k += 1) {
        const fan = count === 1 ? 0 : (k - (count - 1) / 2) * 0.09;
        const spread = (random() - 0.5) * 0.06;
        const a = fan + spread;
        const ca = Math.cos(a); const sa = Math.sin(a);
        const dx = player.aimX * ca - player.aimY * sa;
        const dy = player.aimX * sa + player.aimY * ca;
        state.bullets.push({
          x: player.x + dx * 22, y: player.y + dy * 22,
          vx: dx * PLAYER.bulletSpeed, vy: dy * PLAYER.bulletSpeed,
          life: PLAYER.bulletLife, pierce: stats.pierce + (overcharged ? 2 : 0),
          damage: overcharged ? stats.damage * 3 : stats.damage,
          bounces: state.relics.ricochet ? 1 : 0, big: overcharged,
        });
        burst(player.x + dx * 24, player.y + dy * 24, '#ffb347', 1, 40);
      }
      events |= EVENT_SHOOT;
    }

    // --- spawning
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const next = state.spawnQueue.shift();
        spawnEnemy(next.kind, next.elite);
        if (next.elite) events |= EVENT_ELITE;
        state.spawnTimer = Math.max(0.25, 0.8 - state.wave * 0.05);
        state.enemiesLeft = state.spawnQueue.length + state.enemies.length;
      }
    }

    // --- enemies
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.spawnAge === undefined) e.spawnAge = 1;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.slowTimer > 0) e.slowTimer -= dt;
      if (e.spawnAge < 0.35) e.spawnAge += dt;
      const dx = player.x - e.x; const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d; const uy = dy / d;
      let mvx = ux; let mvy = uy;
      let spd = e.speed;
      const arrived = e.spawnAge >= 0.35;
      if (!arrived) { mvx = 0; mvy = 0; }
      else if (e.kind === 'skitter') {
        const wob = Math.sin(state.time * 6 + e.phase) * 0.7;
        mvx = ux - uy * wob; mvy = uy + ux * wob;
        const ml = Math.hypot(mvx, mvy) || 1; mvx /= ml; mvy /= ml;
      } else if (e.kind === 'moth') {
        const wob = Math.sin(state.time * 3 + e.phase) * 0.9;
        mvx = ux - uy * wob; mvy = uy + ux * wob;
        const ml = Math.hypot(mvx, mvy) || 1; mvx /= ml; mvy /= ml;
        e.spreadTimer -= dt;
        if (e.spreadTimer <= 0 && d < 480) {
          e.spreadTimer = 2.6;
          for (const off of [-0.25, 0, 0.25]) {
            const ca = Math.cos(off); const sa = Math.sin(off);
            state.ebullets.push({
              x: e.x, y: e.y,
              vx: (ux * ca - uy * sa) * 200, vy: (ux * sa + uy * ca) * 200,
              life: 3, radius: 7, damage: e.damage,
            });
          }
        }
      } else if (e.kind === 'spitter') {
        // Keep a standoff distance and shoot.
        if (d < 230) { mvx = -ux; mvy = -uy; }
        else if (d < 300) { mvx = -uy * 0.6; mvy = ux * 0.6; }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 520) {
          e.shootTimer = 2.2;
          state.ebullets.push({ x: e.x, y: e.y, vx: ux * 240, vy: uy * 240, life: 3, radius: 7, damage: e.damage });
        }
      } else if (e.kind === 'charger') {
        // Stalk, telegraph a line, charge through it, then recover.
        e.chargeT += dt;
        if (e.chargeState === 'stalk') {
          if (e.chargeT > 2.2 && d < 420) {
            e.chargeState = 'tele'; e.chargeT = 0;
            e.chargeDx = ux; e.chargeDy = uy;
          }
        } else if (e.chargeState === 'tele') {
          mvx = 0; mvy = 0;
          if (e.chargeT > 0.6) { e.chargeState = 'charge'; e.chargeT = 0; }
        } else if (e.chargeState === 'charge') {
          mvx = e.chargeDx; mvy = e.chargeDy; spd = 520;
          if (e.chargeT > 0.35) { e.chargeState = 'rest'; e.chargeT = 0; }
        } else {
          spd = e.speed * 0.3;
          if (e.chargeT > 0.9) { e.chargeState = 'stalk'; e.chargeT = 0; }
        }
      } else if (e.kind === 'shade') {
        // Blinks across the dark in short hops toward the keeper.
        e.blinkTimer -= dt;
        if (e.blinkTimer <= 0 && d < 460) {
          e.blinkTimer = 2.4;
          burst(e.x, e.y, '#7a5cff', 8, 90);
          e.x += ux * 130; e.y += uy * 130;
          burst(e.x, e.y, '#7a5cff', 8, 90);
        }
      } else if (e.kind === 'bramble') {
        // Roots itself at range and looses thorn spreads.
        spd = e.speed * 0.15;
        e.thornTimer -= dt;
        if (e.thornTimer <= 0 && d < 520) {
          e.thornTimer = 2.8;
          for (const off of [-0.3, 0, 0.3]) {
            const ca = Math.cos(off); const sa = Math.sin(off);
            state.ebullets.push({
              x: e.x, y: e.y,
              vx: (ux * ca - uy * sa) * 210, vy: (ux * sa + uy * ca) * 210,
              life: 3, radius: 7, damage: e.damage,
            });
          }
        }
      } else if (e.kind === 'warden') {
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = 3;
          for (let k = 0; k < 8; k += 1) {
            const a = (k / 8) * TAU;
            state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180, life: 3, radius: 8, damage: 14 });
          }
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = 8;
          const w = spawnEnemy('wisp');
          w.x = e.x + (random() - 0.5) * 100; w.y = e.y + (random() - 0.5) * 100;
          banner('The Warden calls the dark');
        }
      } else if (e.kind === 'herald') {
        // Below half health the Herald rages: faster, summoning and bursting more.
        if (!e.enraged && e.hp < e.maxHp * 0.5) {
          e.enraged = true;
          e.speed *= 1.4;
          banner('The Herald rages');
          state.shake = Math.max(state.shake, 12);
        }
        // Below a quarter the Herald breaks: chargers join the summons and
        // the ring bursts come twice as fast.
        if (!e.phase3 && e.hp < e.maxHp * 0.25) {
          e.phase3 = true;
          e.speed *= 1.25;
          banner('The Herald breaks');
          state.shake = Math.max(state.shake, 14);
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = e.phase3 ? 2.5 : e.enraged ? 3.5 : 6;
          const summons = e.phase3 ? 3 : 2;
          for (let k = 0; k < summons; k += 1) {
            const kind = e.phase3 && k === 0 ? 'charger' : 'wisp';
            const w = spawnEnemy(kind);
            w.x = e.x + (random() - 0.5) * 120; w.y = e.y + (random() - 0.5) * 120;
          }
          banner('The Herald calls the dark');
        }
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = e.phase3 ? 2 : e.enraged ? 2.5 : 4;
          const n = e.phase3 ? 16 : e.enraged ? 14 : 10;
          for (let k = 0; k < n; k += 1) {
            const a = (k / n) * TAU;
            state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 3.5, radius: 8, damage: 15 });
          }
        }
      }
      const inLight = d < state.light;
      if (e.slowTimer > 0) spd *= 0.65;
      spd *= (inLight ? 0.85 : 1);
      // Halo of Embers: foes standing in the light burn.
      if (state.relics.halo && inLight) {
        e.hp -= 2 * dt;
        if (e.hp <= 0) { killEnemy(e, i); continue; }
      }
      e.x += (mvx * spd + e.knockX) * dt;
      e.y += (mvy * spd + e.knockY) * dt;
      e.knockX *= 0.86; e.knockY *= 0.86;
      // Touch damage.
      if (arrived && d < e.radius + player.radius) {
        events |= hurtPlayer(e.damage, e.x, e.y, e);
        if (state.waveState === 'lost') return events;
        if (e.hp <= 0) { killEnemy(e, i); continue; }
        // Push the enemy back so one touch is one hit.
        e.x -= ux * 30; e.y -= uy * 30;
      }
      if (e.kind === 'herald' || e.kind === 'warden') {
        state.bossHp = Math.max(0, e.hp);
      }
    }

    // --- player bullets
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1); continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const rr = e.radius + 6;
        if (dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
        const inLight = Math.hypot(e.x - player.x, e.y - player.y) < state.light;
        const dmg = b.damage * (inLight ? LIGHT_BONUS : 1);
        e.hp -= dmg;
        e.hitFlash = 0.12;
        e.knockX += b.vx * 0.12; e.knockY += b.vy * 0.12;
        if (state.relics.frost) e.slowTimer = 1.2;
        addText(e.x, e.y - e.radius - 6, String(Math.round(dmg)), inLight ? '#ffd166' : '#f2ead8');
        burst(b.x, b.y, '#ffb347', 3, 80);
        events |= EVENT_KILL; // reused as "a bolt landed"; the caller plays the quiet hit sound
        if (e.hp <= 0) killEnemy(e, j);
        else if (b.pierce > 0) { b.pierce -= 1; }
        else if (b.bounces > 0) {
          // Ricochet: turn toward the nearest other foe, once.
          let next = null; let nextD = 280;
          for (const o of state.enemies) {
            if (o === e) continue;
            const dd = Math.hypot(o.x - b.x, o.y - b.y);
            if (dd < nextD) { nextD = dd; next = o; }
          }
          if (next) {
            const sp = Math.hypot(b.vx, b.vy) || 1;
            b.vx = ((next.x - b.x) / nextD) * sp;
            b.vy = ((next.y - b.y) / nextD) * sp;
            b.bounces -= 1;
          } else {
            state.bullets.splice(i, 1);
          }
        } else {
          state.bullets.splice(i, 1);
        }
        break;
      }
    }

    // --- enemy bullets
    for (let i = state.ebullets.length - 1; i >= 0; i -= 1) {
      const b = state.ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.ebullets.splice(i, 1); continue;
      }
      const rr = b.radius + player.radius - 2;
      if (dist2(b.x, b.y, player.x, player.y) < rr * rr) {
        state.ebullets.splice(i, 1);
        events |= hurtPlayer(b.damage, b.x - b.vx * 0.05, b.y - b.vy * 0.05, null);
        if (state.waveState === 'lost') return events;
      }
    }

    // --- pickups: drift, magnetise, collect
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const p = state.pickups[i];
      p.life -= dt;
      if (p.life <= 0) { state.pickups.splice(i, 1); continue; }
      const dx = player.x - p.x; const dy = player.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      // Shard Magnet: pickups fly to the keeper from twice as far.
      const magnet = PLAYER.pickupRadius * (state.relics.magnet ? 2 : 1);
      if (d < magnet) { p.x += (dx / d) * 320 * dt; p.y += (dy / d) * 320 * dt; }
      else { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; }
      if (d < player.radius + 12) {
        state.pickups.splice(i, 1);
        if (p.kind === 'shard') { state.shards += 1; state.score += 5; }
        else { player.hp = Math.min(player.maxHp, player.hp + 20); addText(player.x, player.y - 24, '+20', '#ff6b81'); }
        burst(p.x, p.y, p.kind === 'shard' ? '#ffd166' : '#ff6b81', 5, 70);
        events |= EVENT_PICKUP;
      }
    }

    // --- particles and floating texts
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96;
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.life -= dt; t.y -= 34 * dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }

    // --- wave clear / win
    if (state.waveState === 'fight' && state.spawnQueue.length === 0 && state.enemies.length === 0) {
      const bonus = 100 * state.wave;
      state.score += bonus;
      addText(player.x, player.y - 30, `Wave clear +${bonus}`, '#ffd166');
      // Only wave 10 of a first run wins; endless waves return to the shop.
      if (state.wave === WAVES && !state.endless) {
        state.waveState = 'won';
        return events | EVENT_WIN;
      }
      // The rest offers a relic draft (if any relic is still unowned) and the shop.
      state.relicDraft = draftRelics(random, state.relics);
      if (state.relicDraft.length === 0) state.relicDraft = null;
      state.relicTaken = false;
      state.waveState = 'shop';
      return events | EVENT_CLEAR;
    }
    return events;
  }

  /** The title screen's backdrop: wisps drift and embers float, nothing can hurt. */
  function stepTitle(dt) {
    state.time += dt;
    if (state.enemies.length < 12 && random() < dt * 0.7) {
      const w = spawnEnemy('wisp');
      w.x = random() * FIELD.width; w.y = random() * FIELD.height;
      w.spawnAge = 1; // title wisps arrive already formed
    }
    for (const e of state.enemies) {
      e.phase += dt;
      e.x += Math.cos(e.phase * 0.5) * 12 * dt;
      e.y += Math.sin(e.phase * 0.7) * 10 * dt;
    }
    if (random() < dt * 10) {
      addParticle(random() * FIELD.width, FIELD.height + 6, (random() - 0.5) * 12, -24 - random() * 30, 3, 2 + random() * 2, '#ffb347');
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  return { state, reset, startWave, setDifficulty, startEndless, buyUpgrade, buyRelic, step, stepTitle };
}
