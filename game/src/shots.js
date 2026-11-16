// The screenshot scenes behind ?shot=start|play|shop|win|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (aim at the nearest foe, keep a fighting
// distance, dash when one gets close), so the frame is what a real game
// looks like and the same seed always gives the same frame. The shop scene
// plays until wave 1 is cleared; the win scene stages the Herald at low
// health so the autopilot's kill triggers the real victory screen.
import { FIELD, STEP } from './config.js';
import { EVENT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 12;
const LIMIT_SECONDS = 600;

function nearestEnemy(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return { enemy: best, dist: bestD };
}

function autopilot(state) {
  const p = state.player;
  const { enemy, dist } = nearestEnemy(state);
  let mx = 0;
  let my = 0;
  let aimX = p.x + p.aimX * 100;
  let aimY = p.y + p.aimY * 100;
  let dash = false;
  if (enemy && dist < 320) {
    aimX = enemy.x;
    aimY = enemy.y;
    const dx = enemy.x - p.x;
    const dy = enemy.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // Close in until 260 away, then hold and strafe; flee when crowded.
    if (dist > 280) { mx = dx / len; my = dy / len; }
    else if (dist < 120) { mx = -dx / len; my = -dy / len; dash = true; }
    else { mx = -dy / len * 0.6; my = dx / len * 0.6; }
  } else {
    // Nothing close: sweep up the nearest shard or heart, else drift centre.
    let target = null;
    let targetD = Infinity;
    for (const pk of state.pickups) {
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < targetD) { targetD = d; target = pk; }
    }
    if (target) {
      if (enemy) { aimX = enemy.x; aimY = enemy.y; }
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      mx = dx / len; my = dy / len;
    } else {
      const dx = FIELD.width / 2 - p.x;
      const dy = FIELD.height / 2 - p.y;
      const len = Math.hypot(dx, dy) || 1;
      if (len > 60) { mx = dx / len; my = dy / len; }
      if (enemy) { aimX = enemy.x; aimY = enemy.y; }
    }
  }
  return { mx, my, aimX, aimY, firing: enemy !== null, dash };
}

function stepWorld(world, input) {
  return world.step(STEP, input);
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'shop' && name !== 'win' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.stepTitle(STEP);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    // A hurried keeper who never shoots: the horde catches up, as it does.
    world.startWave(1);
    for (let i = 0; i < LIMIT_SECONDS / STEP; i += 1) {
      const input = autopilot(world.state);
      input.firing = false;
      if (stepWorld(world, input) & EVENT_OVER) break;
    }
    return { screen: world.state.waveState === 'lost' ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'shop') {
    world.startWave(1);
    for (let i = 0; i < LIMIT_SECONDS / STEP; i += 1) {
      if (stepWorld(world, autopilot(world.state)) & EVENT_CLEAR) break;
    }
    return { screen: SCREEN_SHOP, best: world.state.score };
  }
  if (name === 'win') {
    world.startWave(10);
    // Let the Herald arrive and leave it nearly unmade; its escort fights on.
    let staged = false;
    for (let i = 0; i < LIMIT_SECONDS / STEP; i += 1) {
      const events = stepWorld(world, autopilot(world.state));
      if (!staged) {
        const herald = world.state.enemies.find((e) => e.kind === 'herald');
        if (herald) {
          staged = true;
          herald.hp = 24;
        }
      }
      if (events & EVENT_WIN) break;
      if (events & EVENT_OVER) break;
    }
    return { screen: world.state.waveState === 'won' ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  // play: wave 3, mid-fight, lantern lit, HUD full.
  world.startWave(3);
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    stepWorld(world, autopilot(world.state));
    if (world.state.waveState !== 'fight') break;
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
