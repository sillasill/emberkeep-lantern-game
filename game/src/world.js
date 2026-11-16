// The game's rules and state, with no drawing and no browser in it: the
// keeper, the shadow horde, ember bolts, pickups, waves and the shop.
// step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sound, announcements) without the world knowing
// about screens or sound. The lantern's light is the core rule: foes inside
// it take 50% more damage, so holding ground near the keeper matters.
import { ENEMIES, FIELD, LIGHT_BONUS, PLAYER, STEP, UPGRADES, WAVES } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_SHOOT = 64;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }

/** What wave n sends: wisps always, then skitters, spitters, brutes; wave 10 is the Herald. */
export function waveComposition(n) {
  if (n >= WAVES) return [{ kind: 'herald', count: 1 }, { kind: 'wisp', count: 6 }];
  return [
    { kind: 'wisp', count: 5 + n },
    { kind: 'skitter', count: n >= 2 ? 2 + n : 0 },
    { kind: 'spitter', count: n >= 3 ? 1 + Math.floor(n / 2) : 0 },
    { kind: 'brute', count: n >= 4 ? Math.floor(n / 2) - 1 : 0 },
  ].filter((e) => e.count > 0);
}

export function upgradeCost(up, owned) {
  return Math.round(up.base * up.growth ** owned);
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
    speed: PLAYER.speed, light: 220, pierce: 0,
  };
  const state = {
    player, stats,
    score: 0, shards: 0, wave: 0, kills: 0, time: 0,
    enemies: [], bullets: [], ebullets: [], pickups: [],
    particles: [], texts: [], upgrades: {},
    waveState: 'title', // title | fight | shop | won | lost
    spawnQueue: [], spawnTimer: 0, enemiesLeft: 0,
    shake: 0, flash: 0, banner: '', bannerTimer: 0,
    bossHp: 0, bossMax: 0,
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
    state.score = 0; state.shards = 0; state.wave = 0; state.kills = 0; state.time = 0;
    state.enemies.length = 0; state.bullets.length = 0; state.ebullets.length = 0;
    state.pickups.length = 0; state.particles.length = 0; state.texts.length = 0;
    state.upgrades = {}; state.waveState = 'title';
    state.spawnQueue.length = 0; state.enemiesLeft = 0;
    state.shake = 0; state.flash = 0; state.banner = ''; state.bannerTimer = 0;
    state.bossHp = 0; state.bossMax = 0;
  }

  function spawnEnemy(kind) {
    const def = ENEMIES[kind];
    // Spawn just outside the field edge, on a random side.
    const side = Math.floor(random() * 4);
    let x; let y;
    if (side === 0) { x = random() * FIELD.width; y = -30; }
    else if (side === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
    else if (side === 2) { x = random() * FIELD.width; y = FIELD.height + 30; }
    else { x = -30; y = random() * FIELD.height; }
    const hpScale = 1 + (state.wave - 1) * 0.08;
    const enemy = {
      kind, x, y, hp: def.hp * hpScale, maxHp: def.hp * hpScale,
      speed: def.speed * (0.9 + random() * 0.2), radius: def.radius,
      damage: def.damage, score: def.score, shards: def.shards,
      shootTimer: 1 + random() * 1.5, summonTimer: 5, burstTimer: 3.5,
      phase: random() * TAU, hitFlash: 0, knockX: 0, knockY: 0,
    };
    state.enemies.push(enemy);
    if (kind === 'herald') { state.bossHp = enemy.hp; state.bossMax = enemy.maxHp; }
    return enemy;
  }

  function startWave(n) {
    state.wave = n;
    state.waveState = 'fight';
    state.spawnQueue = [];
    for (const part of waveComposition(n)) {
      for (let i = 0; i < part.count; i += 1) state.spawnQueue.push(part.kind);
    }
    // Shuffle the queue so the wave arrives mixed, not in blocks.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    state.spawnTimer = 0.5;
    state.enemiesLeft = state.spawnQueue.length;
    banner(n >= WAVES ? 'Wave 10 — The Gloom Herald' : `Wave ${n}`);
  }

  function dropPickup(x, y, kind) {
    state.pickups.push({ kind, x, y, vx: (random() - 0.5) * 60, vy: (random() - 0.5) * 60, life: 20 });
  }

  function killEnemy(enemy, index) {
    state.enemies.splice(index, 1);
    state.score += enemy.score;
    state.kills += 1;
    state.enemiesLeft = state.spawnQueue.length + state.enemies.length;
    burst(enemy.x, enemy.y, ENEMIES[enemy.kind].color, enemy.kind === 'herald' ? 40 : 12, 160);
    addText(enemy.x, enemy.y - 10, `+${enemy.score}`, '#f2ead8');
    for (let i = 0; i < enemy.shards; i += 1) dropPickup(enemy.x, enemy.y, 'shard');
    if (random() < 0.08) dropPickup(enemy.x, enemy.y, 'heart');
    if (enemy.kind === 'herald') { state.bossHp = 0; }
  }

  function hurtPlayer(damage, fromX, fromY) {
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
    if (player.hp <= 0) {
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
    if (id === 'damage') stats.damage += 4;
    else if (id === 'rate') stats.fireInterval *= 0.87;
    else if (id === 'speed') stats.speed *= 1.12;
    else if (id === 'light') stats.light += 32;
    else if (id === 'heart') { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 25); }
    else if (id === 'pierce') stats.pierce += 1;
    burst(player.x, player.y, '#ffd166', 14, 120);
    return true;
  }

  /** One fixed step of live play. input: {mx, my, aimX, aimY, firing, dash}. */
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);

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
      player.dashCooldown = PLAYER.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.1);
      burst(player.x, player.y, '#9fd8ff', 8, 100);
    }
    if (player.dashTimer > 0) player.dashTimer -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    const aimLen = Math.hypot(input.aimX - player.x, input.aimY - player.y) || 1;
    player.aimX = (input.aimX - player.x) / aimLen;
    player.aimY = (input.aimY - player.y) / aimLen;

    // --- firing
    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0) {
      player.fireTimer = stats.fireInterval;
      const spread = (random() - 0.5) * 0.06;
      const ca = Math.cos(spread); const sa = Math.sin(spread);
      const dx = player.aimX * ca - player.aimY * sa;
      const dy = player.aimX * sa + player.aimY * ca;
      state.bullets.push({
        x: player.x + dx * 22, y: player.y + dy * 22,
        vx: dx * PLAYER.bulletSpeed, vy: dy * PLAYER.bulletSpeed,
        life: PLAYER.bulletLife, pierce: stats.pierce, damage: stats.damage,
      });
      events |= EVENT_SHOOT;
    }

    // --- spawning
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = Math.max(0.25, 0.8 - state.wave * 0.05);
        state.enemiesLeft = state.spawnQueue.length + state.enemies.length;
      }
    }

    // --- enemies
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;
      const dx = player.x - e.x; const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d; const uy = dy / d;
      let mvx = ux; let mvy = uy;
      if (e.kind === 'skitter') {
        const wob = Math.sin(state.time * 6 + e.phase) * 0.7;
        mvx = ux - uy * wob; mvy = uy + ux * wob;
        const ml = Math.hypot(mvx, mvy) || 1; mvx /= ml; mvy /= ml;
      } else if (e.kind === 'spitter') {
        // Keep a standoff distance and shoot.
        if (d < 230) { mvx = -ux; mvy = -uy; }
        else if (d < 300) { mvx = -uy * 0.6; mvy = ux * 0.6; }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 520) {
          e.shootTimer = 2.2;
          state.ebullets.push({ x: e.x, y: e.y, vx: ux * 240, vy: uy * 240, life: 3, radius: 7, damage: e.damage });
        }
      } else if (e.kind === 'herald') {
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = 6;
          for (let k = 0; k < 2; k += 1) {
            const w = spawnEnemy('wisp');
            w.x = e.x + (random() - 0.5) * 120; w.y = e.y + (random() - 0.5) * 120;
          }
          banner('The Herald calls the dark');
        }
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = 4;
          for (let k = 0; k < 10; k += 1) {
            const a = (k / 10) * TAU;
            state.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 3.5, radius: 8, damage: 15 });
          }
        }
      }
      const inLight = d < stats.light;
      const sp = e.speed * (inLight ? 0.85 : 1);
      e.x += (mvx * sp + e.knockX) * dt;
      e.y += (mvy * sp + e.knockY) * dt;
      e.knockX *= 0.86; e.knockY *= 0.86;
      // Touch damage.
      if (d < e.radius + player.radius) {
        events |= hurtPlayer(e.damage, e.x, e.y);
        if (state.waveState === 'lost') return events;
        // Push the enemy back so one touch is one hit.
        e.x -= ux * 30; e.y -= uy * 30;
      }
      if (e.kind === 'herald') { state.bossHp = Math.max(0, e.hp); }
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
        const inLight = Math.hypot(e.x - player.x, e.y - player.y) < stats.light;
        const dmg = b.damage * (inLight ? LIGHT_BONUS : 1);
        e.hp -= dmg;
        e.hitFlash = 0.12;
        e.knockX += b.vx * 0.12; e.knockY += b.vy * 0.12;
        addText(e.x, e.y - e.radius - 6, String(Math.round(dmg)), inLight ? '#ffd166' : '#f2ead8');
        burst(b.x, b.y, '#ffb347', 3, 80);
        events |= EVENT_KILL; // reused as "a bolt landed"; the caller plays the quiet hit sound
        if (e.hp <= 0) killEnemy(e, j);
        if (b.pierce > 0) { b.pierce -= 1; }
        else { state.bullets.splice(i, 1); }
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
        events |= hurtPlayer(b.damage, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
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
      if (d < PLAYER.pickupRadius) { p.x += (dx / d) * 320 * dt; p.y += (dy / d) * 320 * dt; }
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
      if (state.wave >= WAVES) {
        state.waveState = 'won';
        return events | EVENT_WIN;
      }
      state.waveState = 'shop';
      return events | EVENT_CLEAR;
    }
    return events;
  }

  /** The title screen's backdrop: wisps drift and embers float, nothing can hurt. */
  function stepTitle(dt) {
    state.time += dt;
    if (state.enemies.length < 7 && random() < dt * 0.7) {
      const w = spawnEnemy('wisp');
      w.x = random() * FIELD.width; w.y = random() * FIELD.height;
    }
    for (const e of state.enemies) {
      e.phase += dt;
      e.x += Math.cos(e.phase * 0.5) * 12 * dt;
      e.y += Math.sin(e.phase * 0.7) * 10 * dt;
    }
    if (random() < dt * 6) {
      addParticle(random() * FIELD.width, FIELD.height + 6, (random() - 0.5) * 12, -24 - random() * 30, 3, 2 + random() * 2, '#ffb347');
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  return { state, reset, startWave, buyUpgrade, step, stepTitle };
}
