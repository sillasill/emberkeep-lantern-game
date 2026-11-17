// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, shop, paused, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|shop|win|end (with
// &seed=N) stages that scene instead of running the loop, paints it every
// frame and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_CLEAR, EVENT_ELITE, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import {
  RELIC_CARDS, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE, SCREEN_WIN, SHOP,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { UPGRADES } from './config.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  // Paint continuously while staged: a headless compositor only presents
  // frames a page keeps producing, so a one-off paint can be missed by a
  // screenshot. Ready after the second paint; the tab is closed after use.
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted >= 2) window.__shotReady = true;
    requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastKills = 0;
  let lastHp = world.state.player.hp;
  // A small read-only hook for play-testing from the console.
  window.__emberkeep = { world, get screen() { return screen; } };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.startWave(1);
    lastKills = 0;
    lastHp = world.state.player.hp;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Wave 1. Hold the light.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.win();
    else audio.over();
    announce(won
      ? `Victory. Score ${world.state.score}. Best ${best}.`
      : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_SHOP) {
      // Relic keys (Q/W/E) take a relic card; shop keys buy; a click on a
      // relic card or an upgrade row does the same; Enter or the Next Wave
      // button starts the next wave.
      const relicKey = input.takeRelicKey();
      if (relicKey) {
        const relic = world.state.relicDraft && world.state.relicDraft[Number.parseInt(relicKey, 10) - 1];
        if (relic && world.buyRelic(Number.parseInt(relicKey, 10) - 1)) {
          audio.relic();
          announce(`${relic.name} taken. ${relic.flavor}`);
        }
      }
      const key = input.takeShopKey();
      if (key) {
        const up = UPGRADES[Number.parseInt(key, 10) - 1];
        if (up && world.buyUpgrade(up.id)) { audio.pickup(); announce(`${up.name} bought.`); }
      }
      const click = input.takeClick();
      if (click) {
        const field = renderer.toField(click.x, click.y);
        let bought = false;
        if (world.state.relicDraft) {
          for (let i = 0; i < world.state.relicDraft.length; i += 1) {
            const x = SHOP.x + i * (RELIC_CARDS.width + RELIC_CARDS.gap);
            if (field.x >= x && field.x <= x + RELIC_CARDS.width
              && field.y >= RELIC_CARDS.y && field.y <= RELIC_CARDS.y + RELIC_CARDS.height) {
              const relic = world.state.relicDraft[i];
              if (world.buyRelic(i)) { audio.relic(); announce(`${relic.name} taken. ${relic.flavor}`); }
              bought = true;
              break;
            }
          }
        }
        if (!bought) {
          for (let i = 0; i < UPGRADES.length; i += 1) {
            const y = SHOP.y + i * SHOP.rowH;
            if (field.x >= SHOP.x && field.x <= SHOP.x + SHOP.width && field.y >= y && field.y <= y + SHOP.rowH - 6) {
              if (world.buyUpgrade(UPGRADES[i].id)) { audio.pickup(); announce(`${UPGRADES[i].name} bought.`); }
              bought = true;
              break;
            }
          }
        }
        if (!bought && actions & ACTION_CONFIRM) {
          audio.unlock();
          world.startWave(world.state.wave + 1);
          screen = SCREEN_PLAY;
          announce(`Wave ${world.state.wave}.`);
        }
        return;
      }
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        world.startWave(world.state.wave + 1);
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}.`);
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.stepTitle(STEP);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    const move = input.moveVector();
    const aimCss = input.aim();
    const aim = renderer.toField(aimCss.x, aimCss.y);
    const events = world.step(STEP, {
      mx: move.x, my: move.y, aimX: aim.x, aimY: aim.y,
      firing: input.firing(), dash: Boolean(actions & ACTION_DASH),
    });
    if (actions & ACTION_DASH && world.state.player.dashCooldown > 0.9 * 2.5) audio.dash();
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_ELITE) audio.elite();
    if (world.state.kills > lastKills) { audio.kill(world.state.combo); lastKills = world.state.kills; }
    if (events & EVENT_PICKUP) audio.pickup();
    if (world.state.player.hp < lastHp) audio.hurt();
    lastHp = world.state.player.hp;
    if (events & EVENT_CLEAR) {
      audio.waveClear();
      screen = SCREEN_SHOP;
      announce(`Wave ${world.state.wave} cleared. Spend your shards.`);
    } else if (events & EVENT_WIN) {
      endGame(true);
    } else if (events & EVENT_OVER) {
      endGame(false);
    } else if (events & EVENT_HIT) {
      announce(world.state.player.hp <= 25 ? 'Low health. Find a heart.' : `Hit. ${Math.ceil(world.state.player.hp)} health left.`);
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen !== SCREEN_PLAY) handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberkeep. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
