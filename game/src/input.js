// Keyboard and pointer input. Held keys give a movement vector and an aim
// point; one-shot presses (confirm, pause, dash, mute, shop keys) are queued
// as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;

const MOVE = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 640;
  let mouseY = 360;
  let mouseDown = false;
  let shopKey = '';
  let relicKey = '';
  let click = null;

  window.addEventListener('keydown', (event) => {
    if (MOVE[event.code]) { keys.add(event.code); event.preventDefault(); return; }
    if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; event.preventDefault(); }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (DASH.has(event.code)) { if (!event.repeat) actions |= ACTION_DASH; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (/^Digit[1-8]$/.test(event.code)) shopKey = event.code.slice(5);
    else if (event.code === 'KeyQ') relicKey = '1';
    else if (event.code === 'KeyW') relicKey = '2';
    else if (event.code === 'KeyE') relicKey = '3';
    else return;
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    click = { x: mouseX, y: mouseY };
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** Normalised movement vector from the held keys. */
    moveVector() {
      let x = 0;
      let y = 0;
      for (const code of keys) { x += MOVE[code][0]; y += MOVE[code][1]; }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Mouse position in CSS pixels (the renderer maps it to field space). */
    aim() { return { x: mouseX, y: mouseY }; },
    firing() { return mouseDown; },
    /** The last pointer-down position (CSS px, canvas-relative), once. */
    takeClick() { const c = click; click = null; return c; },
    takeActions() { const taken = actions; actions = 0; return taken; },
    /** A shop digit pressed since the last call, '' if none. */
    takeShopKey() { const k = shopKey; shopKey = ''; return k; },
    /** A relic card key (Q/W/E, as '1'/'2'/'3') pressed since the last call. */
    takeRelicKey() { const k = relicKey; relicKey = ''; return k; },
  };
}
