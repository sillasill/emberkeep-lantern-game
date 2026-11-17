// The screenshot scenes behind ?shot=start|play|shop|win|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot (aim at the nearest foe, keep a fighting
// distance, dash when one gets close), so the frame is what a real game
// looks like and the same seed always gives the same frame. The shop scene
// plays until wave 1 is cleared; the win scene plays the whole game for
// real — relics taken, upgrades bought — so the victory panel shows a
// genuine score, kill count and best combo.
import { FIELD, STEP } from './config.js';
import { EVENT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const LIMIT_SECONDS = 600;
/** The order the win staging buys upgrades in at each rest. */
const SHOP_BUY_ORDER = ['damage', 'rate', 'speed', 'light', 'heart', 'pierce', 'multi', 'regen'];

function playRest(world) {
  const s = world.state;
  if (s.relicDraft) world.buyRelic(0);
  for (const id of SHOP_BUY_ORDER) {
    while (world.buyUpgrade(id)) { /* keep buying while affordable */ }
  }
}

/**
 * Play waves 1..(target-1) for real — relics taken, upgrades bought — and
 * stop at the rest before wave `target`. Returns 'rest' when the keeper
 * reaches that rest, 'won' / 'lost' when the run ends first, 'timeout' when
 * the step budget runs out.
 */
function playToWave(world, target) {
  world.startWave(1);
  for (let i = 0; i < LIMIT_SECONDS / STEP; i += 1) {
    const events = stepWorld(world, autopilot(world.state));
    if (events & EVENT_WIN) return 'won';
    if (events & EVENT_OVER) return 'lost';
    if (events & EVENT_CLEAR) {
      const s = world.state;
      if (s.wave + 1 >= target) return 'rest';
      playRest(world);
      world.startWave(s.wave + 1);
    }
  }
  return 'timeout';
}

function nearestEnemy(state, preferKind) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    if (preferKind && e.kind !== preferKind) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  // Nothing of the preferred kind on the field: fall back to any foe.
  if (!best && preferKind) return nearestEnemy(state, null);
  return { enemy: best, dist: bestD };
}

function autopilot(state, preferKind) {
  const p = state.player;
  const { enemy, dist } = nearestEnemy(state, preferKind);
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
    // A richer rest: the keeper arrives at wave 4's rest with relics owned,
    // upgrades bought and shards to spend, so the shop shows a real build.
    if (playToWave(world, 5) === 'rest') {
      return { screen: SCREEN_SHOP, best: world.state.score };
    }
    world.reset();
    world.startWave(1);
    for (let i = 0; i < LIMIT_SECONDS / STEP; i += 1) {
      if (stepWorld(world, autopilot(world.state)) & EVENT_CLEAR) break;
    }
    return { screen: SCREEN_SHOP, best: world.state.score };
  }
  if (name === 'win') {
    // Play the whole game for real: take the first offered relic and buy
    // every affordable upgrade at each rest, the way a keeper would.
    playToWave(world, 11);
    return { screen: world.state.waveState === 'won' ? SCREEN_WIN : SCREEN_PLAY, best: world.state.score };
  }
  // play: a powered keeper mid-fight against the Gloom Herald on wave 10 —
  // ring bursts, summoned shadows and a full HUD, the run's climax in frame.
  // The autopilot hunts the Herald so the boss is in frame, not off-screen.
  if (playToWave(world, 10) === 'rest') {
    world.startWave(10);
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      stepWorld(world, autopilot(world.state, 'herald'));
      const s = world.state;
      if (s.waveState !== 'fight') break;
      // Stop mid-fight: the Herald hurt but alive, the frame busy. A powered
      // keeper can win the whole wave in these 16 seconds otherwise.
      const herald = s.enemies.find((e) => e.kind === 'herald');
      if (herald && herald.hp < herald.maxHp * 0.55) break;
    }
    // Frame the shot: the Herald and the nearest foes step into view beside
    // the keeper. The fight is over; only the camera's subjects move, so the
    // boss is in the lit part of the frame instead of drifting to an edge.
    const s1 = world.state;
    const herald1 = s1.enemies.find((e) => e.kind === 'herald');
    if (herald1) {
      herald1.x = Math.min(1100, Math.max(200, s1.player.x + 280));
      herald1.y = Math.min(560, Math.max(140, s1.player.y - 120));
    }
    const near = s1.enemies.filter((e) => e.kind !== 'herald')
      .sort((a, b) => Math.hypot(a.x - s1.player.x, a.y - s1.player.y) - Math.hypot(b.x - s1.player.x, b.y - s1.player.y))
      .slice(0, 3);
    for (const e of near) {
      const dx = e.x - s1.player.x; const dy = e.y - s1.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = Math.min(d, 380);
      e.x = s1.player.x + (dx / d) * pull;
      e.y = s1.player.y + (dy / d) * pull;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // Fallback if the run ended early: wave 5, mid-fight against the Warden.
  world.reset();
  world.startWave(5);
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    stepWorld(world, autopilot(world.state, 'warden'));
    if (world.state.waveState !== 'fight') break;
  }
  return { screen: SCREEN_PLAY, best: world.state.score };
}
