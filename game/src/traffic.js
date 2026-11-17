// Traffic cars and pedestrians: the city alive around the player. Traffic cars
// drive along the road grid and turn at intersections; pedestrians stroll the
// sidewalks and run away from gunfire and crashes. Parked cars wait to be stolen.

import { CAR_COLORS, CITY, WORLD } from './config.js';
import { chance, pick, range } from './random.js';
import { hitsBuilding, nearestRoadPoint, randomRoadPoint } from './city.js';

const TRAFFIC_COUNT = 26;
const PED_COUNT = 34;
const PARKED_COUNT = 14;

export function makeCar(random, x, y, kind) {
  return {
    x, y,
    angle: 0,
    speed: 0,
    color: kind === 'cop' ? '#20242c' : pick(random, CAR_COLORS),
    kind: kind || 'sedan',
    driver: kind === 'cop' ? 'cop' : 'traffic',
    steer: 0,
    honkTimer: range(random, 4, 12),
  };
}

function spawnTrafficCar(state, random) {
  const point = randomRoadPoint(random, 100, WORLD.width - 100, 100, 2400);
  const snap = nearestRoadPoint(point.x, point.y);
  const car = makeCar(random, snap.x, snap.y, chance(random, 0.12) ? 'taxi' : 'sedan');
  car.axis = snap.axis;
  car.direction = chance(random, 0.5) ? 1 : -1;
  car.speed = range(random, 110, 190);
  car.angle = car.axis === 'v' ? (car.direction > 0 ? Math.PI / 2 : -Math.PI / 2)
    : (car.direction > 0 ? 0 : Math.PI);
  // Lane offset: keep right, like real traffic.
  if (car.axis === 'v') car.x += car.direction > 0 ? 24 : -24;
  else car.y += car.direction > 0 ? 24 : -24;
  return car;
}

function spawnPedestrian(state, random) {
  const point = randomRoadPoint(random, 100, WORLD.width - 100, 100, 2400);
  return {
    x: point.x + range(random, -70, 70),
    y: point.y + range(random, -70, 70),
    angle: range(random, 0, Math.PI * 2),
    speed: range(random, 38, 68),
    walkPhase: range(random, 0, Math.PI * 2),
    color: pick(random, ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22']),
    scared: 0,
    fleeX: 0,
    fleeY: 0,
    down: 0,
    axis: chance(random, 0.5) ? 'v' : 'h',
    direction: chance(random, 0.5) ? 1 : -1,
  };
}

export function populateCity(state, random) {
  state.cars.length = 0;
  state.peds.length = 0;
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) state.cars.push(spawnTrafficCar(state, random));
  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const point = randomRoadPoint(random, 100, WORLD.width - 100, 100, 2400);
    const snap = nearestRoadPoint(point.x, point.y);
    const car = makeCar(random, snap.x, snap.y, 'sedan');
    car.driver = 'none';
    car.axis = snap.axis;
    car.angle = car.axis === 'v' ? Math.PI / 2 : 0;
    if (car.axis === 'v') car.x += 46;
    else car.y += 46;
    state.cars.push(car);
  }
  for (let i = 0; i < PED_COUNT; i += 1) state.peds.push(spawnPedestrian(state, random));
  // Sun coins: hidden collectibles that pay $25 each.
  state.coins.length = 0;
  for (let i = 0; i < 12; i += 1) {
    const point = randomRoadPoint(random, 150, WORLD.width - 150, 150, 2350);
    state.coins.push({ x: point.x + range(random, -50, 50), y: point.y + range(random, -50, 50), taken: false });
  }
}

/** Pedestrians near (x, y) panic and run away from it. */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    const dx = ped.x - x;
    const dy = ped.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist < radius && dist > 1) {
      ped.scared = 2.5;
      ped.fleeX = dx / dist;
      ped.fleeY = dy / dist;
    }
  }
}

function nearestRoad(roads, value) {
  return roads.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a), roads[0]);
}

function stepTrafficCar(state, car, dt, random) {
  if (car.driver === 'none' || car.driver === 'player') return;
  // At an intersection, sometimes turn onto the crossing road.
  const nearV = CITY.roadsV.some((rx) => Math.abs(car.x - rx) < 46);
  const nearH = CITY.roadsH.some((ry) => Math.abs(car.y - ry) < 46);
  if (nearV && nearH && chance(random, dt * 0.9)) {
    if (car.axis === 'v') {
      car.axis = 'h';
      car.direction = chance(random, 0.5) ? 1 : -1;
      car.y = nearestRoad(CITY.roadsH, car.y) + (car.direction > 0 ? 24 : -24);
      car.angle = car.direction > 0 ? 0 : Math.PI;
    } else {
      car.axis = 'v';
      car.direction = chance(random, 0.5) ? 1 : -1;
      car.x = nearestRoad(CITY.roadsV, car.x) + (car.direction > 0 ? 24 : -24);
      car.angle = car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  // Drive along the road and turn around at its ends.
  if (car.axis === 'v') {
    car.y += car.direction * car.speed * dt;
    if (car.y < 60) car.direction = 1;
    if (car.y > 2440) car.direction = -1;
    car.angle = car.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.x += car.direction * car.speed * dt;
    if (car.x < 60) car.direction = 1;
    if (car.x > WORLD.width - 60) car.direction = -1;
    car.angle = car.direction > 0 ? 0 : Math.PI;
  }
  // Slow down for the car ahead on the same road.
  for (const other of state.cars) {
    if (other === car || other.driver === 'none') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 90 && dist > 1) {
      const ahead = car.axis === 'v'
        ? Math.sign(dy) === car.direction && Math.abs(dx) < 40
        : Math.sign(dx) === car.direction && Math.abs(dy) < 40;
      if (ahead) car.speed = Math.max(40, car.speed - 220 * dt);
      else car.speed = Math.min(190, car.speed + 60 * dt);
    }
  }
}

function stepPedestrian(state, ped, dt, random) {
  if (ped.down > 0) {
    ped.down -= dt;
    return;
  }
  ped.walkPhase += dt * 8;
  let vx;
  let vy;
  let speed = ped.speed;
  if (ped.scared > 0) {
    ped.scared -= dt;
    speed = 210;
    vx = ped.fleeX;
    vy = ped.fleeY;
  } else if (ped.axis === 'v') {
    vx = 0;
    vy = ped.direction;
  } else {
    vx = ped.direction;
    vy = 0;
  }
  ped.x += vx * speed * dt;
  ped.y += vy * speed * dt;
  ped.angle = Math.atan2(vy, vx);
  // Turn around at the map edges, and sometimes at intersections.
  if (ped.x < 80 || ped.x > WORLD.width - 80 || ped.y < 80 || ped.y > 2460) {
    ped.direction *= -1;
  } else if (chance(random, dt * 0.08)) {
    ped.direction *= -1;
  }
  // Stay out of buildings.
  if (hitsBuilding(state.city, ped.x, ped.y, 10)) {
    ped.x -= vx * speed * dt;
    ped.y -= vy * speed * dt;
    ped.direction *= -1;
  }
}

export function updateTraffic(state, dt, random) {
  for (const car of state.cars) stepTrafficCar(state, car, dt, random);
  for (const ped of state.peds) stepPedestrian(state, ped, dt, random);
  // Replace traffic cars that wandered too far from the player with fresh ones nearby.
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.driver !== 'traffic') continue;
    const dist = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (dist > 1600) state.cars[i] = spawnTrafficCar(state, random);
  }
}
