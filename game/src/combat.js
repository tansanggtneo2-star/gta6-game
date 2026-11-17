// Combat: the player's pistol and fists, enemy thugs, bullets, and the cash
// they drop. Bullets fly straight, die on walls, and hurt whatever they hit.

import { PLAYER } from './config.js';
import { hitsBuilding } from './city.js';
import { range } from './random.js';

export function spawnThugs(state, random, x, y, count, armed) {
  for (let i = 0; i < count; i += 1) {
    state.thugs.push({
      x: x + range(random, -90, 90),
      y: y + range(random, -90, 90),
      angle: range(random, 0, Math.PI * 2),
      health: 50,
      speed: range(random, 130, 165),
      punchTimer: 0,
      shootTimer: range(random, 0.5, 1.5),
      armed: !!armed,
      walkPhase: range(random, 0, Math.PI * 2),
      flash: 0,
    });
  }
}

export function fireBullet(state, x, y, angle, from, damage) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * 900,
    vy: Math.sin(angle) * 900,
    life: 0.8,
    from,
    damage,
  });
  state.particles.push({ x, y, vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120, life: 0.08, max: 0.08, color: '#ffd23e', size: 5 });
}

export function playerShoot(state, angle) {
  if (state.player.shootCooldown > 0 || state.player.inCar) return false;
  state.player.shootCooldown = PLAYER.pistolCooldown;
  const px = state.player.x + Math.cos(angle) * 22;
  const py = state.player.y + Math.sin(angle) * 22;
  fireBullet(state, px, py, angle, 'player', PLAYER.pistolDamage);
  if (state.audio) state.audio.shoot();
  return true;
}

export function playerMelee(state) {
  if (state.player.meleeCooldown > 0) return false;
  state.player.meleeCooldown = PLAYER.meleeCooldown;
  const px = state.player.x;
  const py = state.player.y;
  const angle = state.player.angle;
  let hitSomething = false;
  function swing(target, radius) {
    const dx = target.x - px;
    const dy = target.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER.meleeRange + radius) return false;
    const targetAngle = Math.atan2(dy, dx);
    let diff = Math.abs(targetAngle - angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 1.1) return false;
    target.health = (target.health ?? 100) - PLAYER.meleeDamage;
    return true;
  }
  for (const thug of state.thugs) if (swing(thug, 14)) hitSomething = true;
  for (const cop of state.cops) if (swing(cop, 12)) hitSomething = true;
  if (hitSomething && state.audio) state.audio.punch();
  return hitSomething;
}

function bulletHitsCircle(bullet, x, y, radius) {
  return Math.hypot(bullet.x - x, bullet.y - y) < radius + 4;
}

export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let dead = bullet.life <= 0;
    if (!dead && hitsBuilding(state.city, bullet.x, bullet.y, 2)) {
      state.particles.push({ x: bullet.x, y: bullet.y, vx: 0, vy: 0, life: 0.15, max: 0.15, color: '#cccccc', size: 4 });
      dead = true;
    }
    if (!dead && bullet.from !== 'player') {
      if (!state.player.inCar && bulletHitsCircle(bullet, state.player.x, state.player.y, 14)) {
        state.player.health = Math.max(0, state.player.health - bullet.damage);
        state.player.hurtFlash = 0.25;
        dead = true;
      }
    }
    if (!dead && bullet.from === 'player') {
      for (let t = 0; t < state.thugs.length; t += 1) {
        const thug = state.thugs[t];
        if (bulletHitsCircle(bullet, thug.x, thug.y, 14)) {
          thug.health -= bullet.damage;
          thug.flash = 0.15;
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of state.cops) {
          if (bulletHitsCircle(bullet, cop.x, cop.y, 12)) {
            cop.health = (cop.health ?? 100) - bullet.damage;
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

export function updateThugs(state, dt, random) {
  for (let i = state.thugs.length - 1; i >= 0; i -= 1) {
    const thug = state.thugs[i];
    if (thug.flash > 0) thug.flash -= dt;
    if (thug.health <= 0) {
      // Drop cash and fall.
      state.pickups.push({ x: thug.x, y: thug.y, amount: 20 + Math.floor(range(random, 0, 25)), kind: 'cash' });
      state.particles.push({ x: thug.x, y: thug.y, vx: 0, vy: -40, life: 0.5, max: 0.5, color: '#f7c948', size: 8 });
      state.thugs.splice(i, 1);
      continue;
    }
    const dx = state.player.x - thug.x;
    const dy = state.player.y - thug.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 700) continue; // thugs only fight when the player is near
    thug.walkPhase += dt * 8;
    thug.angle = Math.atan2(dy, dx);
    if (thug.armed && dist > 120 && dist < 420) {
      thug.shootTimer -= dt;
      if (thug.shootTimer <= 0) {
        thug.shootTimer = 1.1 + range(random, 0, 0.6);
        fireBullet(state, thug.x, thug.y, thug.angle + range(random, -0.12, 0.12), 'enemy', 7);
        if (state.audio) state.audio.shoot();
      }
    } else if (dist > 30) {
      thug.x += (dx / dist) * thug.speed * dt;
      thug.y += (dy / dist) * thug.speed * dt;
    }
    if (dist < 36) {
      thug.punchTimer -= dt;
      if (thug.punchTimer <= 0) {
        thug.punchTimer = 1.0;
        state.player.health = Math.max(0, state.player.health - 8);
        state.player.hurtFlash = 0.25;
        if (state.audio) state.audio.punch();
      }
    }
  }
}

export function updatePickups(state, dt) {
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = state.pickups[i];
    const dist = Math.hypot(pickup.x - state.player.x, pickup.y - state.player.y);
    if (!state.player.inCar && dist < 30) {
      state.money += pickup.amount;
      state.events.push({ type: 'money', amount: pickup.amount, x: pickup.x, y: pickup.y });
      if (state.audio) state.audio.pickup();
      state.pickups.splice(i, 1);
    }
  }
  for (let i = state.coins.length - 1; i >= 0; i -= 1) {
    const coin = state.coins[i];
    if (coin.taken) continue;
    const dist = Math.hypot(coin.x - state.player.x, coin.y - state.player.y);
    if (!state.player.inCar && dist < 30) {
      coin.taken = true;
      state.money += 25;
      state.events.push({ type: 'money', amount: 25, x: coin.x, y: coin.y });
      if (state.audio) state.audio.coin();
    }
  }
}
