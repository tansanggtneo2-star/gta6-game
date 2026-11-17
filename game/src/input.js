// Keyboard and mouse input. Held keys give movement and driving; one-shot
// presses (confirm, pause, interact, melee, mute) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MELEE = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const MELEE = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 640;
  let mouseY = 400;
  let mouseDown = false;
  let mouseClicked = false;
  // A click is a single shot even if the press and release fall between two
  // frames: the latch holds it until the world consumes it.
  let clickShot = false;

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (MELEE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MELEE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RUN.has(event.code)) {
      held.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = canvasPoint(event);
    mouseX = point.x;
    mouseY = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    mouseX = point.x;
    mouseY = point.y;
    mouseDown = true;
    mouseClicked = true;
    clickShot = true;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  function anyHeld(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1..1 steering / movement on each axis, from the held keys. */
    moveX() { return (anyHeld(RIGHT) ? 1 : 0) - (anyHeld(LEFT) ? 1 : 0); },
    moveY() { return (anyHeld(DOWN) ? 1 : 0) - (anyHeld(UP) ? 1 : 0); },
    running() { return anyHeld(RUN); },
    /** Mouse position in canvas pixels, for aiming. */
    aim() { return { x: mouseX, y: mouseY }; },
    firing() { return mouseDown; },
    /** True once after a pointer press, then cleared — one shot per click. */
    takeClickShot() {
      const shot = clickShot;
      clickShot = false;
      return shot;
    },
    /** True once after a click, then cleared — for menu buttons and dialogue. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
