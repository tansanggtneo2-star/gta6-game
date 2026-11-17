// The screenshot scenes behind ?shot=title|drive|chase|mission. Each one stages
// the real game state — a live city, real cars, real cops, a real mission —
// deterministically from the seed, so the same shot always shows the same frame.
// The game is painted, not played, for the shot: no stepping, no randomness after staging.

import { LANDMARKS } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { spawnThugs } from './combat.js';
import { startMission } from './missions.js';

function centreCamera(state) {
  state.camera.x = Math.max(0, Math.min(3600 - 1280, state.player.x - 640));
  state.camera.y = Math.max(0, Math.min(2700 - 800, state.player.y - 400));
}

function clearDialogue(state) {
  state.dialogue = null;
  state.dialogueQueue.length = 0;
}

function putPlayerInCar(state, x, y, angle, speed) {
  // Take the nearest parked car and hand it to the player.
  let car = null;
  for (const candidate of state.cars) {
    if (candidate.driver === 'none') { car = candidate; break; }
  }
  if (!car) car = state.cars[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.driver = 'player';
  car.color = '#e67e22';
  state.player.inCar = true;
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

function stageDrive(state) {
  clearDialogue(state);
  state.money = 250;
  state.player.health = 100;
  // The player has just stolen a car and is driving up the avenue, traffic around.
  putPlayerInCar(state, 1624, 1700, -Math.PI / 2, 340);
  state.mission.step = 1;
  state.objective = 'Drive to the Sunset Diner';
  state.marker = { x: LANDMARKS.diner.x, y: LANDMARKS.diner.y };
  centreCamera(state);
  return { screen: SCREEN_PLAY };
}

function stageChase(state, random) {
  clearDialogue(state);
  state.money = 640;
  state.player.health = 82;
  startMission(state, 3, random);
  clearDialogue(state);
  putPlayerInCar(state, 2224, 1374, 0, 420);
  // Three police cars closing in and two foot cops on the sidewalk.
  const copSpots = [
    { x: 2050, y: 1374, angle: 0 },
    { x: 2400, y: 1290, angle: Math.PI },
    { x: 2224, y: 1560, angle: -Math.PI / 2 },
  ];
  for (const spot of copSpots) {
    state.cars.push({
      x: spot.x, y: spot.y, angle: spot.angle, speed: 480,
      color: '#20242c', kind: 'cop', driver: 'cop', steer: 0,
    });
  }
  state.cops.push(
    { x: 2150, y: 1450, angle: 0, speed: 235, shootTimer: 1, arrestTimer: 0, walkPhase: 0 },
    { x: 2300, y: 1300, angle: 0, speed: 235, shootTimer: 1, arrestTimer: 0, walkPhase: 0 },
  );
  state.wanted = 3;
  state.wantedHeat = 1;
  state.objective = 'Lose the police (get your wanted level to zero)';
  state.marker = null;
  state.banner = { text: 'THE POLICE ARE ON YOU — LOSE THE HEAT', until: state.playSeconds + 30 };
  centreCamera(state);
  return { screen: SCREEN_PLAY };
}

function stageMission(state, random) {
  clearDialogue(state);
  state.money = 390;
  state.player.health = 100;
  startMission(state, 2, random);
  clearDialogue(state);
  // Jump to the fight step: Rook is at the Old Factory, Dario's crew closing in.
  state.mission.step = 1;
  state.mission.thugsSpawned = true;
  state.mission.thugsTotal = 3;
  spawnThugs(state, random, LANDMARKS.factory.x, LANDMARKS.factory.y, 3, true);
  state.player.x = LANDMARKS.factory.x - 140;
  state.player.y = LANDMARKS.factory.y + 60;
  state.player.angle = 0;
  state.objective = "Deal with Dario's crew (0/3 down)";
  state.marker = { x: LANDMARKS.factory.x, y: LANDMARKS.factory.y };
  state.dialogue = { name: 'Mara Voss', text: "Dario's boys. Remind them who I am.", until: state.playSeconds + 30 };
  centreCamera(state);
  return { screen: SCREEN_PLAY };
}

/**
 * Set `world` to the named scene (title, drive, chase or mission; any other
 * name is the title) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'drive') return stageDrive(state);
  if (name === 'chase') return stageChase(state, state.random);
  if (name === 'mission') return stageMission(state, state.random);
  // Title: the city alive behind the menu, the player standing by the apartment.
  clearDialogue(state);
  state.camera.x = 0;
  state.camera.y = 0;
  state.player.x = LANDMARKS.safehouse.x + 70;
  state.player.y = LANDMARKS.safehouse.y + 70;
  return { screen: SCREEN_TITLE };
}
