// The wanted level and the police who answer it. Crime raises stars; the cops
// spawn in proportion, chase the player, and arrest them on foot or ram their
// car. Lay low and out of sight and the heat fades, one star at a time.

import { COP, WANTED, WORLD } from './config.js';
import { range } from './random.js';
import { moveWithBuildings, nearestRoadPoint } from './city.js';

export function raiseWanted(state, stars, reason) {
  if (state.wanted >= WANTED.maxStars) {
    state.wantedHeat = 1;
    return;
  }
  state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
  state.wantedHeat = 1;
  state.hiddenTimer = 0;
  state.lastCrime = reason || 'crime';
  if (state.audio) state.audio.startSiren();
}

export function clearWanted(state) {
  state.wanted = 0;
  state.wantedHeat = 0;
  state.hiddenTimer = 0;
  if (state.audio) state.audio.stopSiren();
}

function spawnCopCar(state, random) {
  const angle = range(random, 0, Math.PI * 2);
  const x = state.player.x + Math.cos(angle) * 700;
  const y = state.player.y + Math.sin(angle) * 700;
  const snap = nearestRoadPoint(
    Math.max(120, Math.min(WORLD.width - 120, x)),
    Math.max(120, Math.min(2400, y)),
  );
  const car = {
    x: snap.x, y: snap.y, angle: 0, speed: 0,
    color: '#20242c', kind: 'cop', driver: 'cop', steer: 0,
  };
  state.cars.push(car);
  return car;
}

function spawnFootCop(state, random) {
  const angle = range(random, 0, Math.PI * 2);
  const x = state.player.x + Math.cos(angle) * 420;
  const y = state.player.y + Math.sin(angle) * 420;
  state.cops.push({
    x: Math.max(60, Math.min(WORLD.width - 60, x)),
    y: Math.max(60, Math.min(2440, y)),
    angle: 0,
    speed: COP.footSpeed,
    shootTimer: range(random, 0.4, 1.2),
    arrestTimer: 0,
    walkPhase: range(random, 0, Math.PI * 2),
  });
}

function nearestCopDistance(state) {
  let best = Infinity;
  for (const cop of state.cops) {
    best = Math.min(best, Math.hypot(cop.x - state.player.x, cop.y - state.player.y));
  }
  for (const car of state.cars) {
    if (car.kind === 'cop') best = Math.min(best, Math.hypot(car.x - state.player.x, car.y - state.player.y));
  }
  return best;
}

export function updatePolice(state, dt, random) {
  if (state.wanted <= 0) {
    // No heat: cops give up and drive away.
    for (let i = state.cops.length - 1; i >= 0; i -= 1) {
      if (Math.hypot(state.cops[i].x - state.player.x, state.cops[i].y - state.player.y) > 900) {
        state.cops.splice(i, 1);
      }
    }
    if (state.audio) state.audio.stopSiren();
    return;
  }

  // Spawn up to the wanted level's quota.
  const wantCars = WANTED.copCarsPerStar[state.wanted];
  const wantFoot = WANTED.footCopsPerStar[state.wanted];
  let haveCars = 0;
  for (const car of state.cars) if (car.kind === 'cop') haveCars += 1;
  while (haveCars < wantCars) {
    spawnCopCar(state, random);
    haveCars += 1;
  }
  while (state.cops.length < wantFoot) spawnFootCop(state, random);

  // The heat fades when no cop can see the player for a while.
  const nearest = nearestCopDistance(state);
  if (nearest > 520) {
    state.hiddenTimer += dt;
    if (state.hiddenTimer > WANTED.decayHiddenSeconds) {
      state.wanted -= 1;
      state.hiddenTimer = 0;
      state.wantedHeat = state.wanted / WANTED.maxStars;
      if (state.wanted === 0) clearWanted(state);
    }
  } else {
    state.hiddenTimer = 0;
  }

  // Foot cops run at the player; close in on foot and the player is busted.
  for (let ci = state.cops.length - 1; ci >= 0; ci -= 1) {
    const cop = state.cops[ci];
    if (cop.health !== undefined && cop.health <= 0) {
      state.cops.splice(ci, 1);
      continue;
    }
    cop.walkPhase += dt * 9;
    const dx = state.player.x - cop.x;
    const dy = state.player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      cop.angle = Math.atan2(dy, dx);
      const speed = COP.footSpeed * (state.player.inCar ? 0.9 : 1);
      cop.x += (dx / dist) * speed * dt;
      cop.y += (dy / dist) * speed * dt;
    }
    if (!state.player.inCar && dist < COP.arrestRange) {
      cop.arrestTimer += dt;
      if (cop.arrestTimer > COP.arrestTime) {
        state.busted = true;
        return;
      }
    } else {
      cop.arrestTimer = Math.max(0, cop.arrestTimer - dt * 2);
    }
    // At three stars and up, cops open fire on foot.
    if (state.wanted >= 3 && !state.player.inCar && dist < COP.shootRange && dist > 60) {
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = COP.shootCooldown + range(random, 0, 0.5);
        state.events.push({ type: 'copShot', x: cop.x, y: cop.y, targetX: state.player.x, targetY: state.player.y });
      }
    }
  }

  // Police cars steer toward the player and ram.
  for (const car of state.cars) {
    if (car.kind !== 'cop') continue;
    const dx = state.player.x - car.x;
    const dy = state.player.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) continue;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    car.speed = Math.min(COP.carSpeed, car.speed + 500 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Slide along buildings instead of driving through them.
    car.radius = 20;
    moveWithBuildings(state.city, car, nx - car.x, ny - car.y);
    // Ram the player's car: damage and a jolt, at most once every 0.8 s per cop.
    if (state.player.inCar && state.player.car) {
      car.ramTimer = Math.max(0, (car.ramTimer || 0) - dt);
      const pdx = state.player.car.x - car.x;
      const pdy = state.player.car.y - car.y;
      if (car.ramTimer <= 0 && Math.hypot(pdx, pdy) < 52) {
        car.ramTimer = 0.8;
        state.player.car.speed *= 0.85;
        state.player.health = Math.max(0, state.player.health - 4);
        state.events.push({ type: 'crash', x: car.x, y: car.y });
        if (state.audio) state.audio.crash();
      }
    }
  }
}
