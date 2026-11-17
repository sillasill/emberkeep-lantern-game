// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. The garden
// is drawn from a fixed seeded scatter of grass tufts and stones, so the
// scene is the same every visit. The lantern's light is a radial gradient
// centred on the keeper: bright near them, dark at the field's edges.
import { DIFFICULTIES, ENEMIES, FIELD, FONT, PALETTE } from './config.js';
import { relicById } from './relics.js';
import { UPGRADES, upgradeCost } from './upgrades.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_SHOP = 'shop';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The shop panel's rows, in field coordinates (main.js clicks them too). */
export const SHOP = { x: 290, y: 272, width: 700, rowH: 44 };
/** The three relic cards offered at the rest, in field coordinates. */
export const RELIC_CARDS = { y: 160, width: 220, height: 100, gap: 20 };
export const RELIC_KEYS = ['Q', 'W', 'E'];
/** The three difficulty cards on the title screen, in field coordinates. */
export const DIFFICULTY_CARDS = { x: 290, y: 316, width: 220, height: 96, gap: 20 };
/** The Endless button on the victory panel, in field coordinates. */
export const ENDLESS_BTN = { x: 490, y: 470, width: 300, height: 44 };

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
  const blooms = seededScatter(42, 4242);
  const bloomColors = ['#f2c94c', '#ff7ab8', '#8ef1d4', '#b388ff'];
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

  /** Split a string into lines no wider than maxWidth at the given size. */
  function wrapLines(value, maxWidth, size) {
    if (!fonts.has(size)) fonts.set(size, `600 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    const words = String(value).split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width <= maxWidth || !line) line = next;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
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
    // Night blooms: tiny flowers that glow faintly in the dark.
    for (let i = 0; i < blooms.length; i += 1) {
      const b = blooms[i];
      context.fillStyle = bloomColors[i % bloomColors.length];
      context.globalAlpha = 0.35 + 0.25 * Math.sin(state.time * 1.4 + i);
      context.beginPath();
      context.arc(b.x, b.y, 3 * b.s, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawLight(state) {
    const p = state.player;
    const r = state.light || state.stats.light;
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
    const arriving = e.spawnAge !== undefined && e.spawnAge < 0.35;
    context.save();
    context.translate(e.x, e.y);
    if (flash) context.globalAlpha = 0.65;
    else if (arriving) context.globalAlpha = 0.25 + (0.75 * e.spawnAge) / 0.35;
    // Spawn telegraph: a closing ring where the shadow arrives.
    if (arriving) {
      context.strokeStyle = def.color;
      context.globalAlpha = 0.8;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, e.radius + 14 * (1 - e.spawnAge / 0.35), 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 0.25 + (0.75 * e.spawnAge) / 0.35;
    }
    // A charger's telegraph line: the path it is about to take.
    if (e.kind === 'charger' && e.chargeState === 'tele') {
      context.strokeStyle = 'rgba(255, 159, 67, 0.75)';
      context.lineWidth = 3;
      context.setLineDash([8, 8]);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(e.chargeDx * 260, e.chargeDy * 260);
      context.stroke();
      context.setLineDash([]);
    }
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
    } else if (e.kind === 'splitter') {
      // Two lobes joined: the shadow that divides.
      context.fillStyle = def.color;
      context.beginPath();
      context.arc(-e.radius * 0.45, 0, e.radius * 0.65, 0, Math.PI * 2);
      context.arc(e.radius * 0.45, 0, e.radius * 0.65, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.35)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -e.radius * 0.5);
      context.lineTo(0, e.radius * 0.5);
      context.stroke();
    } else if (e.kind === 'charger') {
      // A horned wedge, leaning into its charge.
      context.fillStyle = def.color;
      context.beginPath();
      context.moveTo(e.radius, 0);
      context.lineTo(-e.radius * 0.7, -e.radius * 0.8);
      context.lineTo(-e.radius * 0.3, 0);
      context.lineTo(-e.radius * 0.7, e.radius * 0.8);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(e.radius * 0.35, -3, 2.6, 0, Math.PI * 2);
      context.arc(e.radius * 0.35, 3, 2.6, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'moth') {
      // Wide pale wings that beat as it drifts.
      const beat = Math.sin(e.phase * 8) * 0.35;
      context.fillStyle = def.color;
      context.beginPath();
      context.ellipse(-e.radius * 0.7, -e.radius * (0.3 + beat), e.radius * 0.8, e.radius * 0.45, -0.5, 0, Math.PI * 2);
      context.ellipse(e.radius * 0.7, -e.radius * (0.3 + beat), e.radius * 0.8, e.radius * 0.45, 0.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0d1a16';
      context.beginPath();
      context.ellipse(0, 2, 5, 8, 0, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'shade') {
      // A blinking diamond, dark violet with a pale core.
      context.fillStyle = def.color;
      context.save();
      context.rotate(Math.PI / 4);
      context.fillRect(-e.radius * 0.75, -e.radius * 0.75, e.radius * 1.5, e.radius * 1.5);
      context.restore();
      context.fillStyle = '#e9e4ff';
      context.beginPath();
      context.arc(0, 0, 4, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'bramble') {
      // A rooted thorn ball: green spikes around a dark heart.
      context.fillStyle = def.color;
      context.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 === 0 ? e.radius + 6 : e.radius - 2;
        const px = Math.cos(a) * rr; const py = Math.sin(a) * rr;
        if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.fillStyle = '#0d1a16';
      context.beginPath();
      context.arc(0, 0, 6, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === 'warden') {
      // The Dusk Warden: a tall blue shadow with a square crown.
      context.fillStyle = '#16283d';
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#9fd8ff';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = '#9fd8ff';
      context.fillRect(-14, -e.radius - 8, 8, 12);
      context.fillRect(-3, -e.radius - 12, 8, 16);
      context.fillRect(8, -e.radius - 8, 8, 12);
    } else {
      // The Gloom Herald: a crowned shadow with a gold ring.
      context.fillStyle = e.enraged ? '#3a1020' : '#241a3a';
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = e.enraged ? '#ff5d5d' : PALETTE.boss;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = e.enraged ? '#ff5d5d' : PALETTE.boss;
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
    // Eyes (charger and moth draw their own), and a health arc for hurt foes.
    if (e.kind !== 'charger' && e.kind !== 'moth') {
      context.fillStyle = '#fff';
      context.beginPath();
      context.arc(-e.radius * 0.35, -e.radius * 0.15, 2.6, 0, Math.PI * 2);
      context.arc(e.radius * 0.35, -e.radius * 0.15, 2.6, 0, Math.PI * 2);
      context.fill();
    }
    // Elites wear a gold ring.
    if (e.elite) {
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, 0, e.radius + 8, 0, Math.PI * 2);
      context.stroke();
    }
    if (e.hp < e.maxHp && e.kind !== 'herald' && e.kind !== 'warden') {
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
    text(state.endless ? `Endless Wave ${state.wave}` : `Wave ${Math.max(1, state.wave)} / 10`, 640, 32, 22, PALETTE.text, 'center', 'middle');
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
      context.fillStyle = state.bossLabel === 'THE GLOOM HERALD' ? PALETTE.boss : '#9fd8ff';
      context.fillRect(344, 64, 592 * (state.bossHp / state.bossMax), 18);
      // White with a dark outline, so the name reads over both the coloured
      // fill and the dark track behind it.
      context.font = `600 15px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineWidth = 3;
      context.strokeStyle = '#070a12';
      context.strokeText(state.bossLabel || 'BOSS', 640, 73);
      context.fillStyle = '#ffffff';
      context.fillText(state.bossLabel || 'BOSS', 640, 73);
    }
    // Combo: chained kills multiply the score while the timer holds.
    if (state.combo >= 3) {
      const mult = Math.min(3, 1 + 0.1 * state.combo);
      text(`COMBO x${mult.toFixed(1)}`, 1260, 66, 20, PALETTE.gold, 'right', 'middle');
      context.fillStyle = 'rgba(242, 201, 76, 0.35)';
      context.fillRect(1140, 72, 120 * Math.max(0, state.comboTimer / 2.5), 4);
    }
    // Owned relics, as small coloured initials under the bar.
    const ownedIds = Object.keys(state.relics);
    for (let i = 0; i < ownedIds.length; i += 1) {
      const relic = relicById(ownedIds[i]);
      if (!relic) continue;
      const cx = 30 + i * 30;
      context.fillStyle = relic.color;
      context.beginPath();
      context.arc(cx, 66, 11, 0, Math.PI * 2);
      context.fill();
      text(relic.name[0], cx, 66, 13, '#070a12', 'center', 'middle');
    }
    // Wave banner — only while playing or resting; the end panels cover it.
    if ((screen === SCREEN_PLAY || screen === SCREEN_SHOP) && state.bannerTimer > 0) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      text(state.banner, FIELD.width / 2, 130, 34, PALETTE.gold, 'center', 'middle');
      context.globalAlpha = 1;
    }
  }

  /** The title screen: the garden behind, the name, what the game holds,
   *  and three difficulties to choose from before the run starts. */
  function drawTitle(state, best) {
    const glow = context.createRadialGradient(640, 320, 40, 640, 320, 460);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.12)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const x = 260; const y = 64; const width = 760; const height = 560;
    context.fillStyle = 'rgba(7, 10, 18, 0.88)';
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text('EMBERKEEP', FIELD.width / 2, y + 78, 64, PALETTE.gold, 'center', 'middle');
    text('The last lantern in a garden gone dark.', FIELD.width / 2, y + 126, 20, PALETTE.text, 'center', 'middle');
    text('Hold the light. Spend the shards. Survive ten waves.', FIELD.width / 2, y + 154, 20, PALETTE.text, 'center', 'middle');
    text('10 waves  •  12 relics  •  11 foes  •  3 bosses  •  endless after dawn', FIELD.width / 2, y + 188, 18, PALETTE.gold, 'center', 'middle');
    text('Choose your darkness:', FIELD.width / 2, y + 226, 18, PALETTE.muted, 'center', 'middle');
    for (let i = 0; i < DIFFICULTIES.length; i += 1) {
      const d = DIFFICULTIES[i];
      const cx = DIFFICULTY_CARDS.x + i * (DIFFICULTY_CARDS.width + DIFFICULTY_CARDS.gap);
      const cy = DIFFICULTY_CARDS.y;
      const selected = state.difficulty === d.id;
      context.fillStyle = selected ? '#3a2f10' : '#101823';
      roundRect(cx, cy, DIFFICULTY_CARDS.width, DIFFICULTY_CARDS.height, 10);
      context.fill();
      context.strokeStyle = selected ? PALETTE.gold : PALETTE.panelEdge;
      context.lineWidth = selected ? 2.5 : 1.5;
      roundRect(cx, cy, DIFFICULTY_CARDS.width, DIFFICULTY_CARDS.height, 10);
      context.stroke();
      text(`[${d.key}] ${d.name}`, cx + DIFFICULTY_CARDS.width / 2, cy + 26, 18, selected ? PALETTE.gold : PALETTE.text, 'center', 'middle');
      const descLines = wrapLines(d.desc, DIFFICULTY_CARDS.width - 16, 13);
      for (let j = 0; j < descLines.length; j += 1) {
        text(descLines[j], cx + DIFFICULTY_CARDS.width / 2, cy + 52 + j * 16, 13, PALETTE.muted, 'center', 'middle');
      }
    }
    text('Move WASD / arrows  •  Aim mouse  •  Hold click to shoot', FIELD.width / 2, y + 384, 20, PALETTE.text, 'center', 'middle');
    text('Dash Shift  •  Pause P  •  Mute M', FIELD.width / 2, y + 414, 20, PALETTE.text, 'center', 'middle');
    text(`Best score: ${best}`, FIELD.width / 2, y + 452, 18, PALETTE.muted, 'center', 'middle');
    text('Press Space or click to begin', FIELD.width / 2, y + 512, 22, PALETTE.gold, 'center', 'middle');
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function difficultyName(state) {
    const d = DIFFICULTIES.find((x) => x.id === state.difficulty);
    return d ? d.name : 'Keeper';
  }

  /** The victory panel: the run's numbers, and a way onward into endless. */
  function drawWin(state, best) {
    const x = 320; const y = 130; const width = 640; const height = 390;
    context.fillStyle = 'rgba(7, 10, 18, 0.88)';
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    roundRect(x, y, width, height, 14);
    context.stroke();
    text('VICTORY — Dawn Returns', FIELD.width / 2, y + 62, 44, PALETTE.gold, 'center', 'middle');
    text(`Score ${state.score}  •  Best ${best}`, FIELD.width / 2, y + 118, 20, PALETTE.text, 'center', 'middle');
    text(`All ten waves cleared  •  ${state.kills} shadows banished`, FIELD.width / 2, y + 150, 20, PALETTE.muted, 'center', 'middle');
    text(`Time ${formatTime(state.time)}  •  ${Object.keys(state.relics).length} relics  •  ${difficultyName(state)}  •  Best combo x${Math.min(3, 1 + 0.1 * state.bestCombo).toFixed(1)}`, FIELD.width / 2, y + 182, 20, PALETTE.muted, 'center', 'middle');
    text('The Gloom Herald is unmade. The garden blooms again.', FIELD.width / 2, y + 214, 20, PALETTE.muted, 'center', 'middle');
    context.fillStyle = '#1d3a2a';
    roundRect(ENDLESS_BTN.x, ENDLESS_BTN.y, ENDLESS_BTN.width, ENDLESS_BTN.height, 10);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 1.5;
    roundRect(ENDLESS_BTN.x, ENDLESS_BTN.y, ENDLESS_BTN.width, ENDLESS_BTN.height, 10);
    context.stroke();
    text('Endless — keep going  (E)', FIELD.width / 2, ENDLESS_BTN.y + 22, 19, PALETTE.text, 'center', 'middle');
    text('Press Space or click to play again', FIELD.width / 2, y + height + 34, 22, PALETTE.gold, 'center', 'middle');
  }

  /** The game-over panel: the run's numbers, and play again at once. */
  function drawOver(state, best) {
    drawPanel('The Light Goes Out', [
      `Score ${state.score}  •  Best ${best}`,
      `Wave ${state.wave} of 10  •  ${state.kills} shadows banished`,
      `Time ${formatTime(state.time)}  •  ${Object.keys(state.relics).length} relics  •  ${difficultyName(state)}  •  Best combo x${Math.min(3, 1 + 0.1 * state.bestCombo).toFixed(1)}`,
      'The garden waits in the dark. The lantern can be lit again.',
    ], 'Press Space or click to play again');
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
    text('The Lantern Rest', FIELD.width / 2, 72, 40, PALETTE.gold, 'center', 'middle');
    text(`Wave ${state.wave} cleared  •  Score ${state.score}  •  Sunshards ◆ ${state.shards}`, FIELD.width / 2, 108, 20, PALETTE.text, 'center', 'middle');
    text(state.relicDraft && state.relicDraft.length > 0
      ? 'A relic chooses you — then spend shards to grow stronger.'
      : 'Spend shards to grow stronger, then face the next wave.', FIELD.width / 2, 136, 18, PALETTE.muted, 'center', 'middle');
    // Relic draft: three cards, free, one per rest.
    if (state.relicDraft && state.relicDraft.length > 0) {
      for (let i = 0; i < state.relicDraft.length; i += 1) {
        const relic = state.relicDraft[i];
        const x = SHOP.x + i * (RELIC_CARDS.width + RELIC_CARDS.gap);
        const y = RELIC_CARDS.y;
        const taken = state.relicTaken;
        context.fillStyle = taken ? '#101823' : '#1a2b1e';
        roundRect(x, y, RELIC_CARDS.width, RELIC_CARDS.height, 10);
        context.fill();
        context.strokeStyle = taken ? PALETTE.panelEdge : relic.color;
        context.lineWidth = taken ? 1 : 2;
        roundRect(x, y, RELIC_CARDS.width, RELIC_CARDS.height, 10);
        context.stroke();
        text(`[${RELIC_KEYS[i]}] ${relic.name}`, x + RELIC_CARDS.width / 2, y + 24, 19, taken ? PALETTE.muted : relic.color, 'center', 'middle');
        // The description wraps to two lines inside the card; a one-line
        // draw overflowed the card for the longer relics.
        const descLines = wrapLines(relic.desc, RELIC_CARDS.width - 16, 13);
        for (let j = 0; j < descLines.length; j += 1) {
          text(descLines[j], x + RELIC_CARDS.width / 2, y + 50 + j * 16, 13, taken ? PALETTE.muted : PALETTE.text, 'center', 'middle');
        }
        text(relic.flavor, x + RELIC_CARDS.width / 2, y + RELIC_CARDS.height - 12, 13, PALETTE.muted, 'center', 'middle');
      }
    }
    for (let i = 0; i < UPGRADES.length; i += 1) {
      const up = UPGRADES[i];
      const owned = state.upgrades[up.id] || 0;
      const maxed = owned >= up.max;
      const cost = maxed ? 0 : upgradeCost(up, owned);
      const afford = !maxed && state.shards >= cost;
      const y = SHOP.y + i * SHOP.rowH;
      context.fillStyle = afford ? '#16242f' : '#101823';
      roundRect(SHOP.x, y, SHOP.width, SHOP.rowH - 6, 8);
      context.fill();
      context.strokeStyle = afford ? PALETTE.gold : PALETTE.panelEdge;
      context.lineWidth = 1.5;
      roundRect(SHOP.x, y, SHOP.width, SHOP.rowH - 6, 8);
      context.stroke();
      text(`[${up.key}] ${up.name}`, SHOP.x + 18, y + 19, 19, PALETTE.text, 'left', 'middle');
      text(up.desc, SHOP.x + 300, y + 19, 17, PALETTE.muted, 'left', 'middle');
      text(maxed ? 'MAX' : `◆ ${cost}  (${owned}/${up.max})`, SHOP.x + SHOP.width - 18, y + 19, 17, maxed ? PALETTE.muted : afford ? PALETTE.gold : '#c96a5a', 'right', 'middle');
    }
    const footY = SHOP.y + UPGRADES.length * SHOP.rowH + 14;
    text('Q/W/E or click a relic  •  1–8 or click an upgrade to buy  •  Enter or click Next Wave to continue', FIELD.width / 2, footY, 18, PALETTE.gold, 'center', 'middle');
    context.fillStyle = '#1d3a2a';
    roundRect(FIELD.width / 2 - 110, footY + 16, 220, 40, 10);
    context.fill();
    text(`Next Wave ${state.wave + 1} →`, FIELD.width / 2, footY + 36, 19, PALETTE.text, 'center', 'middle');
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
      // A short trail behind each bolt, so shots read as shots. Heavy
      // overcharge embers draw bigger and brighter.
      context.strokeStyle = b.big ? 'rgba(255, 159, 67, 0.8)' : 'rgba(255, 179, 71, 0.55)';
      context.lineWidth = b.big ? 5 : 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      context.lineTo(b.x, b.y);
      context.stroke();
      context.fillStyle = b.big ? '#ff9f43' : PALETTE.bullet;
      context.beginPath();
      context.arc(b.x, b.y, b.big ? 9 : 5, 0, Math.PI * 2);
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
      drawTitle(state, best);
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_SHOP) drawShop(state, best);
    else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The garden waits in the dark.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawOver(state, best);
    } else if (screen === SCREEN_WIN) {
      drawWin(state, best);
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
