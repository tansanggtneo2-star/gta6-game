// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// five screens: title, play, paused, busted and wasted. The title menu is
// driven by mouse clicks and by arrow keys + Enter.
//
// ?seed=N fixes the city's traffic. ?shot=title|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createWorld } from './world.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { clearSave, hasSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const audio = createAudio();
const world = createWorld(seed, audio);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
// A handle for automated play-testing (and nothing else): the live world state.
window.__sunshore = world;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function announce(message) {
  status.textContent = message;
}

window.addEventListener('keydown', () => audio.unlock(), { once: false });
window.addEventListener('pointerdown', () => audio.unlock(), { once: false });

function runShot(name) {
  const scene = stageShot(name, world);
  const options = { hasSave: false, selected: 0, muted: false, showHowTo: false };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, options);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let selected = 0;
  let showHowTo = false;
  let saved = hasSave();
  let accumulator = 0;
  let last = performance.now();
  let prevMoveY = 0;
  let muted = false;
  let saveTimer = 0;
  // Behind the title menu the city stays alive, but the player stands still:
  // this stub input moves nothing and fires nothing.
  const quietInput = {
    moveX: () => 0,
    moveY: () => 0,
    running: () => false,
    aim: () => ({ x: 640, y: 400 }),
    firing: () => false,
    takeClickShot: () => false,
    takeClick: () => false,
    takeActions: () => 0,
  };

  function buttons() {
    return renderer.titleButtons(saved);
  }

  function startNewGame() {
    world.reset();
    clearSave();
    saved = false;
    screen = SCREEN_PLAY;
    showHowTo = false;
    announce('New game. Follow the yellow marker. Mara Voss is waiting at the diner.');
    audio.click();
  }

  function continueGame() {
    const save = loadSave();
    if (!save) {
      startNewGame();
      return;
    }
    world.resetFromSave(save);
    screen = SCREEN_PLAY;
    showHowTo = false;
    announce('Welcome back to Sunshore.');
    audio.click();
  }

  function activateButton(button) {
    if (!button) return;
    if (button.id === 'new') startNewGame();
    else if (button.id === 'continue') continueGame();
    else if (button.id === 'howto') {
      showHowTo = true;
      audio.click();
    }
  }

  function handleTitleInput(actions) {
    const list = buttons();
    const moveY = input.moveY();
    if (moveY !== 0 && moveY !== prevMoveY) {
      selected = (selected + moveY + list.length) % list.length;
      audio.click();
    }
    prevMoveY = moveY;
    if (showHowTo) {
      if (actions & ACTION_CONFIRM || input.takeClick()) showHowTo = false;
      return;
    }
    if (actions & ACTION_CONFIRM) activateButton(list[selected]);
    if (input.takeClick()) {
      const aim = input.aim();
      for (let i = 0; i < list.length; i += 1) {
        const b = list[i];
        if (aim.x >= b.x && aim.x <= b.x + b.w && aim.y >= b.y && aim.y <= b.y + b.h) {
          selected = i;
          activateButton(b);
          return;
        }
      }
    }
  }

  function handlePlayInput(actions) {
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      saveGame(world.state);
      if (audio) audio.setEngine(0);
      announce('Paused. Game saved.');
      return;
    }
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      return;
    }
    // Clicking a dialogue box hurries it along.
    if (input.takeClick() && world.state.dialogue) {
      world.state.dialogue = null;
      return;
    }
    if (actions & ACTION_CONFIRM && world.state.dialogue) {
      world.state.dialogue = null;
    }
  }

  function step() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      handleTitleInput(actions);
      // The city stays alive behind the menu: traffic drives, peds stroll.
      world.step(STEP, quietInput, 0);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (input.takeClick()) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        world.respawnAfterBusted();
        saveGame(world.state);
        screen = SCREEN_PLAY;
        announce('Out on bail. Back to work.');
      }
      return;
    }
    if (screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) {
        world.respawnAfterWasted();
        saveGame(world.state);
        screen = SCREEN_PLAY;
        announce('Back on your feet.');
      }
      return;
    }
    handlePlayInput(actions);
    if (screen !== SCREEN_PLAY) return;
    world.step(STEP, input, actions);
    saveTimer += STEP;
    if (saveTimer > 15) {
      saveTimer = 0;
      saveGame(world.state);
    }
    if (world.state.busted) {
      screen = SCREEN_BUSTED;
      audio.busted();
      audio.setEngine(0);
      announce('Busted by the police.');
    } else if (world.state.wasted) {
      screen = SCREEN_WASTED;
      audio.busted();
      audio.setEngine(0);
      announce('Wasted.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }
    renderer.draw(world.state, screen, { hasSave: saved, selected, muted, showHowTo });
  }

  // Leaving the tab pauses a running game rather than letting the cops catch the player unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(world.state);
      announce('Paused.');
    }
  });

  announce('Sunshore. An open-world crime story. Press Enter or click New Game to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
