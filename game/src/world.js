// The simulation: one state object holding the whole city, and step() advancing
// it one fixed frame. No drawing here and no browser calls beyond the audio the
// caller hands in. Screens (title, pause, busted, wasted) live in main.js.

import { CAR, LANDMARKS, PLAYER, STEP, VIEW, WORLD } from './config.js';
import { buildCity, hitsBuilding, moveWithBuildings } from './city.js';
import { createRandom } from './random.js';
import { populateCity, scarePeds, updateTraffic } from './traffic.js';
import { clearWanted, raiseWanted, updatePolice } from './police.js';
import { fireBullet, playerMelee, playerShoot, updateBullets, updatePickups, updateThugs } from './combat.js';
import { missionTitle, startMission, updateMission } from './missions.js';
import { ACTION_INTERACT, ACTION_MELEE } from './input.js';

export { missionTitle };

function freshPlayer() {
  return {
    x: LANDMARKS.safehouse.x + 70,
    y: LANDMARKS.safehouse.y + 70,
    angle: 0,
    health: PLAYER.health,
    hurtFlash: 0,
    inCar: false,
    car: null,
    shootCooldown: 0,
    meleeCooldown: 0,
    walkPhase: 0,
    radius: PLAYER.radius,
  };
}

export function createWorld(seed, audio) {
  const random = createRandom(seed);
  const city = buildCity(createRandom(1337));
  const state = {
    city,
    random,
    audio,
    playSeconds: 0,
    clockMinutes: 12 * 60,
    money: 40,
    wanted: 0,
    wantedHeat: 0,
    hiddenTimer: 0,
    lastCrime: '',
    player: freshPlayer(),
    cars: [],
    peds: [],
    cops: [],
    thugs: [],
    bullets: [],
    particles: [],
    pickups: [],
    coins: [],
    mission: { index: 0, step: 0, timer: 0, robProgress: 0, thugsSpawned: false, thugsTotal: 0 },
    dialogue: null,
    dialogueQueue: [],
    banner: null,
    objective: '',
    marker: null,
    storyDone: false,
    stats: { carsStolen: 0, missionsDone: 0 },
    busted: false,
    wasted: false,
    events: [],
    camera: { x: 0, y: 0 },
    muted: false,
  };

  function reset() {
    state.playSeconds = 0;
    state.clockMinutes = 12 * 60;
    state.money = 40;
    state.wanted = 0;
    state.wantedHeat = 0;
    state.hiddenTimer = 0;
    state.lastCrime = '';
    state.player = freshPlayer();
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.thugs = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.coins = [];
    state.dialogue = null;
    state.dialogueQueue = [];
    state.banner = null;
    state.objective = '';
    state.marker = null;
    state.storyDone = false;
    state.stats = { carsStolen: 0, missionsDone: 0 };
    state.busted = false;
    state.wasted = false;
    state.events = [];
    state.camera.x = state.player.x - VIEW.width / 2;
    state.camera.y = state.player.y - VIEW.height / 2;
    populateCity(state, random);
    startMission(state, 0, random);
  }

  function resetFromSave(save) {
    reset();
    state.money = save.money ?? 40;
    state.player.health = save.health ?? PLAYER.health;
    state.player.x = save.playerX ?? state.player.x;
    state.player.y = save.playerY ?? state.player.y;
    state.stats.carsStolen = save.carsStolen ?? 0;
    state.stats.missionsDone = save.missionsDone ?? 0;
    state.playSeconds = save.playSeconds ?? 0;
    const index = Math.min(save.missionIndex ?? 0, 4);
    startMission(state, index, random);
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of state.cars) {
      const dist = Math.hypot(car.x - state.player.x, car.y - state.player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  }

  function stealCar(car) {
    if (car.driver === 'traffic') {
      // The driver bails out and runs.
      state.peds.push({
        x: car.x + 40, y: car.y + 20, angle: 0, speed: 60, walkPhase: 0,
        color: '#e67e22', scared: 3, fleeX: 1, fleeY: 0, down: 0, axis: 'h', direction: 1,
      });
      raiseWanted(state, 1, 'car theft');
    }
    car.driver = 'player';
    car.speed = 0;
    state.player.inCar = true;
    state.player.car = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.stats.carsStolen += 1;
    if (state.audio) state.audio.steal();
  }

  function exitCar() {
    const car = state.player.car;
    if (!car) return;
    car.driver = 'none';
    car.speed = 0;
    state.player.inCar = false;
    state.player.car = null;
    state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    if (hitsBuilding(state.city, state.player.x, state.player.y, 14)) {
      state.player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 44;
      state.player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 44;
    }
  }

  function stepPlayerOnFoot(dt, input, actions) {
    const player = state.player;
    const mx = input.moveX();
    const my = input.moveY();
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      const nx = (mx / len) * speed * dt;
      const ny = (my / len) * speed * dt;
      player.radius = PLAYER.radius;
      moveWithBuildings(state.city, player, nx, ny);
      player.walkPhase += dt * 10;
    }
    // Face the mouse: the aim direction is where the pistol points.
    const aim = input.aim();
    const worldAimX = aim.x + state.camera.x;
    const worldAimY = aim.y + state.camera.y;
    player.angle = Math.atan2(worldAimY - player.y, worldAimX - player.x);
    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.meleeCooldown > 0) player.meleeCooldown -= dt;
    if (input.firing() || input.takeClickShot()) {
      if (playerShoot(state, player.angle)) scarePeds(state, player.x, player.y, 320);
    }
    if (actions & ACTION_MELEE) playerMelee(state);
    if (actions & ACTION_INTERACT) {
      const car = nearestCar(78);
      if (car) stealCar(car);
    }
    // Pick up sun coins and cash on foot.
    updatePickups(state, dt);
  }

  function stepPlayerDriving(dt, input, actions) {
    const player = state.player;
    const car = player.car;
    if (!car) {
      player.inCar = false;
      return;
    }
    const throttle = -input.moveY(); // up (W) is -1 on Y, so flip: forward
    const steer = input.moveX();
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.7) * dt;
    else car.speed -= car.speed * 0.9 * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steerAuthority = Math.max(-1, Math.min(1, car.speed / 220));
    car.angle += steer * CAR.turnRate * steerAuthority * dt * (car.speed < 0 ? -1 : 1);
    const dx = Math.cos(car.angle) * car.speed * dt;
    const dy = Math.sin(car.angle) * car.speed * dt;
    const beforeX = car.x;
    const beforeY = car.y;
    car.radius = 22;
    moveWithBuildings(state.city, car, dx, dy);
    // The city has edges: a car that leaves the map is pulled back and slowed.
    if (car.x < 40 || car.x > WORLD.width - 40 || car.y < 40 || car.y > WORLD.height - 40) {
      car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
      car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
      car.speed *= 0.5;
    }
    const moved = Math.hypot(car.x - beforeX, car.y - beforeY);
    const wanted = Math.hypot(dx, dy);
    if (wanted > 4 && moved < wanted * 0.4) {
      // Ran into a wall: lose speed, spark, thud.
      if (Math.abs(car.speed) > 240 && state.audio) state.audio.crash();
      car.speed *= 0.45;
      state.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffdd55', size: 6 });
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (state.audio) state.audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed);
    // Bumping traffic cars: shove them forward and to the side so the player
    // can get past, instead of getting stuck behind slow traffic.
    for (const other of state.cars) {
      if (other === car || other.driver === 'none') continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const dist = Math.hypot(ox, oy);
      if (dist < 56 && dist > 1) {
        other.x += (ox / dist) * 10 - Math.sin(car.angle) * 6;
        other.y += (oy / dist) * 10 + Math.cos(car.angle) * 6;
        other.speed = Math.max(other.speed, Math.min(320, car.speed * 0.9));
        car.speed *= 0.99;
      }
    }
    // Hitting a pedestrian is a crime — and the crowd notices.
    for (const ped of state.peds) {
      if (ped.down > 0) continue;
      const dist = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (dist < 34) {
        ped.down = 3;
        ped.scared = 3;
        car.speed *= 0.7;
        raiseWanted(state, 1, 'hit a pedestrian');
        scarePeds(state, car.x, car.y, 300);
        state.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: 0, life: 0.4, max: 0.4, color: '#ff4d4d', size: 7 });
        if (state.audio) state.audio.crash();
      }
    }
    if (actions & ACTION_INTERACT) exitCar();
  }

  function stepCamera(dt) {
    const targetX = state.player.x - VIEW.width / 2;
    const targetY = state.player.y - VIEW.height / 2;
    const k = Math.min(1, dt * 5);
    state.camera.x += (targetX - state.camera.x) * k;
    state.camera.y += (targetY - state.camera.y) * k;
    state.camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, state.camera.x));
    state.camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, state.camera.y));
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function step(dt, input, actions) {
    state.playSeconds += dt;
    state.clockMinutes += dt / 2;
    if (state.banner && state.playSeconds > state.banner.until) state.banner = null;
    if (state.player.hurtFlash > 0) state.player.hurtFlash -= dt;

    if (state.player.inCar) stepPlayerDriving(dt, input, actions);
    else stepPlayerOnFoot(dt, input, actions);

    updateTraffic(state, dt, random);
    updatePolice(state, dt, random);
    updateBullets(state, dt);
    updateThugs(state, dt, random);
    updateMission(state, dt, random);
    stepParticles(dt);
    stepCamera(dt);
    // Nobody leaves the city on foot either.
    state.player.x = Math.max(24, Math.min(WORLD.width - 24, state.player.x));
    state.player.y = Math.max(24, Math.min(WORLD.height - 24, state.player.y));

    // Cop gunfire queued by the police update becomes real bullets; cash
    // pickups float their value up as text.
    for (const event of state.events) {
      if (event.type === 'copShot') {
        const angle = Math.atan2(event.targetY - event.y, event.targetX - event.x) + (random() - 0.5) * 0.25;
        fireBullet(state, event.x, event.y, angle, 'enemy', COP.bulletDamage);
        if (state.audio) state.audio.shoot();
      } else if (event.type === 'money') {
        state.particles.push({ x: event.x, y: event.y, vx: 0, vy: -30, life: 1.2, max: 1.2, color: '#f7c948', size: 16, text: `+$${event.amount}` });
      }
    }
    state.events.length = 0;

    // Slow health recovery while the heat is off.
    if (state.wanted === 0 && state.player.health > 0 && state.player.health < PLAYER.health) {
      state.player.health = Math.min(PLAYER.health, state.player.health + 2 * dt);
    }
    if (state.player.health <= 0) state.wasted = true;
  }

  function respawnAfterWasted() {
    state.player.health = PLAYER.health;
    state.player.x = LANDMARKS.hospital.x + 70;
    state.player.y = LANDMARKS.hospital.y + 70;
    if (state.player.inCar) {
      state.player.car.driver = 'none';
      state.player.car = null;
      state.player.inCar = false;
    }
    state.money = Math.max(0, state.money - 50);
    clearWanted(state);
    state.cops.length = 0;
    state.wasted = false;
    state.busted = false;
    showBanner('You woke up at Sunshore General. -$50 hospital bill.');
  }

  function respawnAfterBusted() {
    state.money = Math.max(0, state.money - 100);
    clearWanted(state);
    state.cops.length = 0;
    state.player.x = LANDMARKS.safehouse.x + 70;
    state.player.y = LANDMARKS.safehouse.y + 70;
    if (state.player.inCar) {
      state.player.car.driver = 'none';
      state.player.car = null;
      state.player.inCar = false;
    }
    state.busted = false;
    state.wasted = false;
    showBanner('Busted! Bail cost $100. Mara is not amused.');
  }

  function showBanner(text) {
    state.banner = { text, until: state.playSeconds + 4 };
  }

  reset();
  return { state, reset, resetFromSave, step, respawnAfterWasted, respawnAfterBusted };
}
