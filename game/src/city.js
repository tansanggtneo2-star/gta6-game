// The city of Sunshore: a sun-soaked coastal town on a road grid, with a beach
// and marina along the south edge, a park, and pastel buildings filling the blocks.
// One fixed seed builds it, so every session plays the same streets.

import { BUILDING_COLORS, CITY, LANDMARKS, WORLD } from './config.js';
import { chance, pick, range } from './random.js';

const HALF_ROAD = CITY.roadWidth / 2;

export function buildCity(random) {
  const buildings = [];
  const palms = [];
  const parks = [];

  // Buildings fill each block between neighbouring roads, with a margin for sidewalks.
  const xs = [60, ...CITY.roadsV, WORLD.width - 60];
  const ys = [60, ...CITY.roadsH, CITY.beachTop - 60];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + HALF_ROAD + 14;
      const x1 = xs[bx + 1] - HALF_ROAD - 14;
      const y0 = ys[by] + HALF_ROAD + 14;
      const y1 = ys[by + 1] - HALF_ROAD - 14;
      if (x1 - x0 < 120 || y1 - y0 < 120) continue;
      // One block in five is a park instead of buildings.
      if (chance(random, 0.18)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = Math.max(1, Math.floor((x1 - x0) / 220));
      const rows = Math.max(1, Math.floor((y1 - y0) / 200));
      const cellW = (x1 - x0) / cols;
      const cellH = (y1 - y0) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if (chance(random, 0.12)) continue; // an empty lot, for parking
          const w = cellW * range(random, 0.55, 0.8);
          const h = cellH * range(random, 0.5, 0.75);
          const x = x0 + cx * cellW + (cellW - w) / 2;
          const y = y0 + cy * cellH + (cellH - h) / 2;
          buildings.push({
            x, y, w, h,
            color: pick(random, BUILDING_COLORS),
            roof: range(random, 0.5, 0.95),
          });
        }
      }
    }
  }

  // Palm trees line the roads and the beach promenade.
  for (const roadX of CITY.roadsV) {
    for (let y = 120; y < CITY.beachTop; y += 260) {
      if (chance(random, 0.7)) palms.push({ x: roadX + HALF_ROAD + 26, y: y + range(random, -30, 30) });
      if (chance(random, 0.7)) palms.push({ x: roadX - HALF_ROAD - 26, y: y + 130 + range(random, -30, 30) });
    }
  }
  for (let x = 100; x < WORLD.width; x += 240) {
    palms.push({ x, y: CITY.beachTop + 40 + range(random, -8, 8) });
  }

  return { buildings, palms, parks };
}

/** True when the point is on a road (asphalt), not on a sidewalk or a block. */
export function isOnRoad(x, y) {
  const half = CITY.roadWidth / 2 - 16;
  for (const roadX of CITY.roadsV) if (Math.abs(x - roadX) < half) return true;
  for (const roadY of CITY.roadsH) if (Math.abs(y - roadY) < half) return true;
  return false;
}

/** True when the circle at (x, y, radius) touches any building. */
export function hitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
  }
  return false;
}

/** Slide a moving circle against buildings: try x, then y, so it slides along walls. */
export function moveWithBuildings(city, body, dx, dy) {
  const nx = body.x + dx;
  if (!hitsBuilding(city, nx, body.y, body.radius)) body.x = nx;
  const ny = body.y + dy;
  if (!hitsBuilding(city, body.x, ny, body.radius)) body.y = ny;
}

/** A random point on a road, for spawning traffic and police far from the player. */
export function randomRoadPoint(random, minX, maxX, minY, maxY) {
  if (chance(random, 0.5)) {
    const x = pick(random, CITY.roadsV);
    return { x: x + range(random, -30, 30), y: range(random, minY, maxY) };
  }
  const y = pick(random, CITY.roadsH);
  return { x: range(random, minX, maxX), y: y + range(random, -30, 30) };
}

/** The nearest road centre to a point, used to snap spawned cars onto streets. */
export function nearestRoadPoint(x, y) {
  let bestX = CITY.roadsV[0];
  for (const roadX of CITY.roadsV) if (Math.abs(roadX - x) < Math.abs(bestX - x)) bestX = roadX;
  let bestY = CITY.roadsH[0];
  for (const roadY of CITY.roadsH) if (Math.abs(roadY - y) < Math.abs(bestY - y)) bestY = roadY;
  if (Math.abs(bestX - x) < Math.abs(bestY - y)) return { x: bestX, y, axis: 'v' };
  return { x, y: bestY, axis: 'h' };
}

export { LANDMARKS };
