// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. The garden
// is drawn from a fixed seeded scatter of grass tufts and stones, so the
// scene is the same every visit. The lantern's light is a radial gradient
// centred on the keeper: bright near them, dark at the field's edges.
import { ENEMIES, FIELD, FONT, PALETTE, UPGRADES } from './config.js';
import { upgradeCost } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_SHOP = 'shop';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The shop panel's rows, in field coordinates (main.js clicks them too). */
export const SHOP = { x: 300, y: 218, width: 680, rowH: 52 };

function seededScatter(count, seed) {
  let a = seed | 0;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r1 = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    a = (a + 0x6d2b79f5) | 0;
    t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r2 = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    out.push({ x: r1 * FIELD.width, y: 40 + r2 * (FIELD.height - 80), s: 0.6 + r1 * 0.8 });
  }
  return out;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const tufts = seededScatter(90, 12345);
  const stones = seededScatter(26, 999);
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `600 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGround(state) {
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Soft light pools where the garden's old lanterns stand.
    for (const s of stones) {
      context.fillStyle = 'rgba(46, 90, 66, 0.25)';
      context.beginPath();
      context.arc(s.x, s.y, 26 * s.s, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = PALETTE.grass;
    context.lineWidth = 2;
    for (const t of tufts) {
      context.beginPath();
      context.moveTo(t.x, t.y);
      context.lineTo(t.x - 3 * t.s, t.y - 8 * t.s);
      context.moveTo(t.x + 3 * t.s, t.y);
      context.lineTo(t.x + 5 * t.s, t.y - 7 * t.s);
      context.stroke();
    }
    context.fillStyle = PALETTE.stone;
    for (const s of stones) {
      context.beginPath();
      context.arc(s.x + 40, s.y + 30, 4 * s.s, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawLight(state) {
    const p = state.player;
    const r = state.stats.light;
    const g = context.createRadialGradient(p.x, p.y, r * 0.15, p.x, p.y, r * 1.9);
    g.addColorStop(0, 'rgba(255, 209, 102, 0.10)');
    g.addColorStop(0.35, 'rgba(255, 209, 102, 0.03)');
    g.addColorStop(0.7, 'rgba(3, 6, 12, 0.30)');
    g.addColorStop(1, 'rgba(3, 6, 12, 0.62)');
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // The lantern's halo.
    const halo = context.createRadialGradient(p.x, p.y, 4, p.x, p.y, r);
    halo.addColorStop(0, 'rgba(255, 209, 102, 0.20)');
    halo.addColorStop(1, 'rgba(255, 209, 102, 0)');
    context.fillStyle = halo;
    context.beginPath();
    context.arc(p.x, p.y, r, 0, Math.PI * 2);
    context.fill();
    // Light boundary ring.
    context.strokeStyle = 'rgba(255, 209, 102, 0.28)';
    context.lineWidth = 2;
    context.setLineDash([10, 14]);
    context.beginPath();
    context.arc(p.x, p.y, r, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }

  function drawEnemy(e) {
    const def = ENEMIES[e.kind];
    const flash = e.hitFlash > 0;
    context.save();
    context.translate(e.x, e.y);
    if (flash) context.globalAlpha = 0.65;
    if (e.kind === 'wisp') {
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(0, -2, e.radius, Math.PI, 0);
      context.lineTo(e.radius, e.radius * 0.7);
      context.lineTo(e.radius * 0.5, e.radius * 0.35);
      context.lineTo(0, e.radius * 0.8);
      context.lineTo(-e.radius * 0.5, e.radius * 0.35);
      context.lineTo(-e.radius, e.radius * 0.7);
      context.closePath();
      context.fill();
    } else if (e.kind === 'skitter') {
      context.fillStyle = def.color;
      context.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 === 0 ? e.radius + 5 : e.radius - 3;
        const px = Math.cos(a) * rr; const py = Math.sin(a) * rr;
        if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    } else if (e.kind === 'spitter') {
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0d1a16';
      context.beginPath();
      context.arc(4, 2, 6, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'brute') {
      context.fillStyle = def.color;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(a) * e.radius; const py = Math.sin(a) * e.radius;
        if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.strokeStyle = '#2a0f0c';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-e.radius * 0.6, -e.radius * 0.7);
      context.lineTo(-e.radius * 0.9, -e.radius * 1.2);
      context.moveTo(e.radius * 0.6, -e.radius * 0.7);
      context.lineTo(e.radius * 0.9, -e.radius * 1.2);
      context.stroke();
    } else {
      // The Gloom Herald: a crowned shadow with a gold ring.
      context.fillStyle = '#241a3a';
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.boss;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.boss;
      context.beginPath();
      context.moveTo(-18, -e.radius + 6);
      context.lineTo(-12, -e.radius - 14);
      context.lineTo(-4, -e.radius + 2);
      context.lineTo(4, -e.radius - 16);
      context.lineTo(12, -e.radius + 2);
      context.lineTo(18, -e.radius - 12);
      context.lineTo(20, -e.radius + 8);
      context.closePath();
      context.fill();
    }
    // Eyes, and a health arc for hurt foes.
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(-e.radius * 0.35, -e.radius * 0.15, 2.6, 0, Math.PI * 2);
    context.arc(e.radius * 0.35, -e.radius * 0.15, 2.6, 0, Math.PI * 2);
    context.fill();
    if (e.hp < e.maxHp && e.kind !== 'herald') {
      context.strokeStyle = 'rgba(255,255,255,0.35)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, e.radius + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e.hp) / e.maxHp);
      context.stroke();
    }
    context.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    context.save();
    context.translate(p.x, p.y);
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0) context.globalAlpha = 0.45;
    // Dash trail.
    if (p.dashTimer > 0) {
      context.strokeStyle = 'rgba(159, 216, 255, 0.7)';
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(-p.vx * 0.05, -p.vy * 0.05);
      context.lineTo(0, 0);
      context.stroke();
    }
    // Cloak.
    context.fillStyle = '#3a6ea5';
    context.beginPath();
    context.moveTo(0, -p.radius - 4);
    context.lineTo(p.radius * 0.85, p.radius * 0.7);
    context.lineTo(-p.radius * 0.85, p.radius * 0.7);
    context.closePath();
    context.fill();
    // Head and hood.
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(0, -4, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2c4a6b';
    context.beginPath();
    context.arc(0, -6, 10, Math.PI, 0);
    context.fill();
    // The lantern, held toward the aim.
    const la = Math.atan2(p.aimY, p.aimX);
    const lx = Math.cos(la) * 22; const ly = Math.sin(la) * 22;
    context.strokeStyle = '#8a6d2f';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, 2);
    context.lineTo(lx, ly);
    context.stroke();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(lx, ly, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(lx, ly, 3.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHud(state, screen) {
    const p = state.player;
    // Top bar.
    context.fillStyle = 'rgba(7, 10, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, 52);
    // Health.
    context.fillStyle = PALETTE.danger;
    roundRect(20, 16, 180, 20, 6);
    context.fill();
    context.fillStyle = '#7ee787';
    roundRect(20, 16, 180 * Math.max(0, p.hp / p.maxHp), 20, 6);
    context.fill();
    text(`${Math.ceil(p.hp)} / ${p.maxHp} HP`, 210, 32, 18, PALETTE.text, 'left', 'middle');
    text(`Score ${state.score}`, 430, 32, 22, PALETTE.text, 'left', 'middle');
    text(`Wave ${Math.max(1, state.wave)} / 10`, 640, 32, 22, PALETTE.text, 'center', 'middle');
    text(`◆ ${state.shards}`, 830, 32, 22, PALETTE.gold, 'left', 'middle');
    const left = state.spawnQueue.length + state.enemies.length;
    text(screen === SCREEN_SHOP ? 'Wave cleared!' : `Foes left: ${left}`, 980, 32, 20, PALETTE.muted, 'left', 'middle');
    // Dash cooldown pip.
    const dashReady = p.dashCooldown <= 0;
    context.fillStyle = dashReady ? '#9fd8ff' : 'rgba(159,216,255,0.25)';
    roundRect(1180, 18, 80, 16, 8);
    context.fill();
    text(dashReady ? 'DASH READY' : 'dash…', 1220, 26, 12, '#070a12', 'center', 'middle');
    // Boss bar.
    if (state.bossMax > 0 && state.bossHp > 0) {
      context.fillStyle = 'rgba(7, 10, 18, 0.72)';
      context.fillRect(340, 60, 600, 26);
      context.fillStyle = PALETTE.boss;
      context.fillRect(344, 64, 592 * (state.bossHp / state.bossMax), 18);
      text('THE GLOOM HERALD', 640, 73, 15, PALETTE.boss, 'center', 'middle');
    }
    // Wave banner.
    if (state.bannerTimer > 0) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      text(state.banner, FIELD.width / 2, 130, 34, PALETTE.gold, 'center', 'middle');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 120 + lines.length * 32 + 64;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7, 10, 18, 0.88)';
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text(title, FIELD.width / 2, y + 62, 44, accent || PALETTE.text, 'center', 'middle');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 118 + i * 32, 20, PALETTE.muted, 'center', 'middle');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.gold, 'center', 'middle');
  }

  function drawShop(state, best) {
    context.fillStyle = 'rgba(7, 10, 18, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('The Lantern Rest', FIELD.width / 2, 84, 44, PALETTE.gold, 'center', 'middle');
    text(`Wave ${state.wave} cleared  •  Score ${state.score}  •  Sunshards ◆ ${state.shards}`, FIELD.width / 2, 126, 20, PALETTE.text, 'center', 'middle');
    text('Spend shards to grow stronger, then face the next wave.', FIELD.width / 2, 156, 18, PALETTE.muted, 'center', 'middle');
    for (let i = 0; i < UPGRADES.length; i += 1) {
      const up = UPGRADES[i];
      const owned = state.upgrades[up.id] || 0;
      const maxed = owned >= up.max;
      const cost = maxed ? 0 : upgradeCost(up, owned);
      const afford = !maxed && state.shards >= cost;
      const y = SHOP.y + i * SHOP.rowH;
      context.fillStyle = afford ? '#16242f' : '#101823';
      roundRect(SHOP.x, y, SHOP.width, SHOP.rowH - 8, 8);
      context.fill();
      context.strokeStyle = afford ? PALETTE.gold : PALETTE.panelEdge;
      context.lineWidth = 1.5;
      roundRect(SHOP.x, y, SHOP.width, SHOP.rowH - 8, 8);
      context.stroke();
      text(`[${up.key}] ${up.name}`, SHOP.x + 18, y + 22, 20, PALETTE.text, 'left', 'middle');
      text(up.desc, SHOP.x + 300, y + 22, 18, PALETTE.muted, 'left', 'middle');
      text(maxed ? 'MAX' : `◆ ${cost}  (${owned}/${up.max})`, SHOP.x + SHOP.width - 18, y + 22, 18, maxed ? PALETTE.muted : afford ? PALETTE.gold : '#c96a5a', 'right', 'middle');
    }
    text('Press 1–6 or click an upgrade to buy  •  Press Enter or click Next Wave to continue', FIELD.width / 2, SHOP.y + UPGRADES.length * SHOP.rowH + 18, 20, PALETTE.gold, 'center', 'middle');
    context.fillStyle = '#1d3a2a';
    roundRect(FIELD.width / 2 - 110, SHOP.y + UPGRADES.length * SHOP.rowH + 44, 220, 44, 10);
    context.fill();
    text(`Next Wave ${state.wave + 1} →`, FIELD.width / 2, SHOP.y + UPGRADES.length * SHOP.rowH + 72, 20, PALETTE.text, 'center', 'middle');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const sx = (Math.random() - 0.5) * state.shake;
    const sy = (Math.random() - 0.5) * state.shake;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawGround(state);
    // Pickups.
    for (const p of state.pickups) {
      if (p.kind === 'shard') {
        context.fillStyle = PALETTE.shard;
        context.save();
        context.translate(p.x, p.y);
        context.rotate(Math.PI / 4);
        context.fillRect(-6, -6, 12, 12);
        context.restore();
      } else {
        context.fillStyle = PALETTE.heart;
        context.beginPath();
        context.arc(p.x - 4, p.y - 2, 5, 0, Math.PI * 2);
        context.arc(p.x + 4, p.y - 2, 5, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.moveTo(p.x - 8, p.y);
        context.lineTo(p.x + 8, p.y);
        context.lineTo(p.x, p.y + 9);
        context.closePath();
        context.fill();
      }
    }
    // Enemy bullets under the foes, player bullets above them.
    context.fillStyle = '#c77dff';
    for (const b of state.ebullets) {
      context.beginPath();
      context.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      context.fill();
    }
    for (const e of state.enemies) drawEnemy(e);
    drawPlayer(state);
    context.fillStyle = PALETTE.bullet;
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 5, 0, Math.PI * 2);
      context.fill();
    }
    // Particles and floating texts.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Floating texts only during play: on panels they would overlap the text.
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      for (const t of state.texts) {
        context.globalAlpha = Math.min(1, t.life / 0.5);
        text(t.text, t.x, t.y, 16, t.color, 'center', 'middle');
      }
      context.globalAlpha = 1;
    }
    drawLight(state);
    // Hurt flash.
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 60, 60, ${state.flash * 0.5})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    if (screen === SCREEN_TITLE) {
      drawPanel('EMBERKEEP', [
        'The last lantern in a garden gone dark.',
        'Hold the light. Spend the shards. Survive ten waves.',
        'Move WASD / arrows  •  Aim mouse  •  Hold click to shoot',
        'Dash Shift  •  Pause P  •  Mute M',
        `Best score: ${best}`,
      ], 'Press Space or click to begin');
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_SHOP) drawShop(state, best);
    else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The garden waits in the dark.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('The Light Goes Out', [
        `Score ${state.score}  •  Best ${best}`,
        `Wave ${state.wave} of 10  •  ${state.kills} shadows banished  •  ${state.shards} shards kept`,
        '',
      ], 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('VICTORY — Dawn Returns', [
        `Score ${state.score}  •  Best ${best}`,
        `All ten waves cleared  •  ${state.kills} shadows banished`,
        'The Gloom Herald is unmade. The garden blooms again.',
      ], 'Press Space or click to play again', PALETTE.gold);
    }
  }

  /** CSS-pixel mouse position to field coordinates. */
  function toField(cssX, cssY) {
    return { x: (cssX - view.x) / view.scale, y: (cssY - view.y) / view.scale };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
