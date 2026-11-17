# Emberkeep — Lantern of the Last Garden

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/sillasill/emberkeep-lantern-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/sillasill/emberkeep-lantern-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)


A complete, original top-down arena defence game for make.fun
`best-game-01`. No library, no build step, no network request: plain
static files under `game/`, played with keyboard and mouse in a desktop
browser.

## The game

You are the last lantern-keeper in a garden gone dark. Shadow wisps,
skitters, spitters and brutes come in ten waves; the Gloom Herald waits
on wave 10. Foes inside your lantern's light take 50% more damage, so
holding ground near the light matters — but the horde comes from every
side, and the dark beyond the light is where they are fastest.

New shadows stalk the garden: splitters divide into wisps when slain,
chargers telegraph a line and rush through it, moths loose three-bolt
spreads, shades blink toward you and brambles root themselves to fire
thorn spreads, and golden elites hit harder and pay more. Wave 5 brings
the Dusk Warden, wave 6 a swarm, wave 8 the Long Dark (your light
shrinks), wave 9 a siege — and below half health the Herald rages, and
below a quarter it breaks, summoning chargers and firing sixteen-bolt
bursts.

Three difficulties wait on the title screen: Lantern-Bearer (a gentler
dark, for learning the garden), Keeper (the garden as it was meant to be
kept) and Nightkeeper (tougher foes, richer scores). Clear all ten waves
and dawn returns — then the Endless button, or E, keeps the run going:
waves past ten grow denser, a Herald returns every fifth wave, and the
run ends only when you fall.

- **Fight:** move with WASD or arrows, aim with the mouse, hold click to
  shoot ember bolts. Shift dashes (briefly invulnerable). Enemies drop
  sunshards; hearts heal. Chain kills within a few seconds to build a
  score combo, up to x3.
- **Relics:** after every cleared wave, the Lantern Rest offers a choice
  of three relics, free, one per rest — Ember Nova, Twin Flame, Frostbite
  Embers, Bloodlight, Ricochet Embers, Thorned Lantern, Gilded Shards,
  Swift Step, Shard Magnet, Second Dawn, Overcharge and Halo of Embers.
  Each run draws a different hand, so no two runs play alike. Second Dawn
  refuses the first killing blow once per run; Overcharge turns every
  sixth shot into a heavy ember; the Halo burns foes inside your light.
- **Grow:** the Rest's shop sells eight upgrades for shards — ember
  damage, fire rate, move speed, lantern radius, max HP, piercing bolts,
  twin bolts, regeneration. Buy with keys 1–8 or by clicking, pick a
  relic with Q/W/E or by clicking, then press Enter for the next wave.
- **Win or lose:** clear all ten waves and dawn returns. Fall, and the
  light goes out — your score, best score, wave, kills, best combo, time,
  relics and difficulty are shown, and you can play again at once. After
  a victory, Endless keeps the garden coming.
- **Feel:** fixed 1/60 s simulation, particles, screen shake, floating
  damage numbers, hit flashes, spawn telegraphs, bolt trails, wave
  banners, a boss health bar, and WebAudio synth sound effects and drone
  (M mutes) — the kill chime climbs with your combo. Best score is kept
  in `localStorage`. P pauses.

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Or open `game/index.html` through any static file server. The game
needs no network: every script, sound and image is a file under `game/`
or generated in code.

## Files

- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `serve.ts` — a tiny static server for local play.
- `game/index.html` — the page, one canvas.
- `game/src/config.js` — all tuning numbers and the palette.
- `game/src/random.js` — the seeded generator (mulberry32).
- `game/src/audio.js` — WebAudio synth effects and ambience.
- `game/src/input.js` — keyboard and pointer input.
- `game/src/world.js` — the rules: keeper, horde, shop, relics,
  combo, bosses, difficulties and endless waves.
- `game/src/waves.js` — what each wave (and each endless wave) holds.
- `game/src/upgrades.js` — the eight shop upgrades and their costs.
- `game/src/relics.js` — the twelve relics and the draft.
- `game/src/render.js` — drawing only: field, light, HUD, panels, shop.
- `game/src/shots.js` — the deterministic screenshot scenes
  (`?shot=start|play|shop|win|end&seed=N`, staged by the real rules and
  an autopilot, painting twice and setting `window.__shotReady`).
- `game/src/main.js` — boot and the fixed-step loop, screen by screen.
- `screenshots/` — four real renders of the game: title, combat, the
  shop, and victory.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bfyeqrq3&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
