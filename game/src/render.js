// Drawing only: the world's state and the current screen in, pixels out. The
// canvas is a fixed 1280 x 800 stage scaled to the window; the camera shows a
// window of the city. Flat shapes, canvas text, a minimap and a full HUD.

import { CAR, CITY, FONT, FONT_DISPLAY, LANDMARKS, PALETTE, VIEW, WANTED, WORLD } from './config.js';
import { missionTitle } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const MINIMAP = { x: VIEW.width - 216, y: 16, w: 200, h: 150 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();

  function text(value, x, y, size, color, align, font) {
    const key = `${size}:${font || FONT}`;
    if (!fonts.has(key)) fonts.set(key, `${size}px ${font || FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function inView(x, y, margin) {
    const cam = currentCamera;
    return x > cam.x - margin && x < cam.x + VIEW.width + margin
      && y > cam.y - margin && y < cam.y + VIEW.height + margin;
  }

  let currentCamera = { x: 0, y: 0 };
  const toScreenX = (x) => x - currentCamera.x;
  const toScreenY = (y) => y - currentCamera.y;

  function drawGround(state) {
    const cam = state.camera;
    context.fillStyle = '#a8d18a';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    // Beach and sea along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, toScreenY(CITY.beachTop), VIEW.width, WORLD.height - CITY.beachTop);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, toScreenY(CITY.waterTop), VIEW.width, WORLD.height - CITY.waterTop);
    context.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < VIEW.width; x += 90) {
      const wave = Math.sin((x + state.playSeconds * 30) * 0.02) * 3;
      context.fillRect(x, toScreenY(CITY.waterTop + 40) + wave, 44, 3);
    }
    // Parks.
    for (const park of state.city.parks) {
      if (!inView(park.x + park.w / 2, park.y + park.h / 2, 300)) continue;
      context.fillStyle = PALETTE.park;
      context.fillRect(toScreenX(park.x), toScreenY(park.y), park.w, park.h);
      context.fillStyle = '#5aa84a';
      for (let i = 0; i < 4; i += 1) {
        const tx = park.x + ((i * 137) % park.w);
        const ty = park.y + ((i * 89) % park.h);
        context.beginPath();
        context.arc(toScreenX(tx), toScreenY(ty), 16, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Roads: asphalt, sidewalks, dashed centre lines.
    context.fillStyle = PALETTE.sidewalk;
    for (const rx of CITY.roadsV) context.fillRect(toScreenX(rx - CITY.roadWidth / 2), 0, CITY.roadWidth, VIEW.height);
    for (const ry of CITY.roadsH) context.fillRect(0, toScreenY(ry - CITY.roadWidth / 2), VIEW.width, CITY.roadWidth);
    context.fillStyle = PALETTE.road;
    for (const rx of CITY.roadsV) context.fillRect(toScreenX(rx - CITY.roadWidth / 2 + 16), 0, CITY.roadWidth - 32, VIEW.height);
    for (const ry of CITY.roadsH) context.fillRect(0, toScreenY(ry - CITY.roadWidth / 2 + 16), VIEW.width, CITY.roadWidth - 32);
    context.fillStyle = PALETTE.roadLine;
    for (const rx of CITY.roadsV) {
      for (let y = Math.floor(cam.y / 60) * 60; y < cam.y + VIEW.height; y += 60) {
        context.fillRect(toScreenX(rx) - 2, toScreenY(y), 4, 30);
      }
    }
    for (const ry of CITY.roadsH) {
      for (let x = Math.floor(cam.x / 60) * 60; x < cam.x + VIEW.width; x += 60) {
        context.fillRect(toScreenX(x), toScreenY(ry) - 2, 30, 4);
      }
    }
    // Buildings: pastel roofs with a shaded edge and a door.
    for (const b of state.city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 200)) continue;
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(toScreenX(b.x) + 5, toScreenY(b.y) + 6, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(toScreenX(b.x), toScreenY(b.y), b.w, b.h);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(toScreenX(b.x), toScreenY(b.y), b.w, 8);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(toScreenX(b.x + b.w / 2 - 8), toScreenY(b.y + b.h - 4), 16, 4);
    }
    // Palm trees.
    for (const palm of state.city.palms) {
      if (!inView(palm.x, palm.y, 40)) continue;
      const px = toScreenX(palm.x);
      const py = toScreenY(palm.y);
      context.strokeStyle = '#8a6d3b';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(px, py);
      context.lineTo(px + 3, py - 14);
      context.stroke();
      context.fillStyle = '#3f9e4d';
      context.beginPath();
      context.arc(px + 3, py - 18, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#57b368';
      context.beginPath();
      context.arc(px - 2, py - 22, 7, 0, Math.PI * 2);
      context.fill();
    }
    // Landmark labels.
    context.textAlign = 'center';
    for (const key of Object.keys(LANDMARKS)) {
      const place = LANDMARKS[key];
      if (!inView(place.x, place.y, 60)) continue;
      text(place.name, toScreenX(place.x), toScreenY(place.y) - 18, 13, 'rgba(32,36,44,0.75)', 'center');
    }
  }

  function drawCarShape(car, isPlayerCar) {
    const x = toScreenX(car.x);
    const y = toScreenY(car.y);
    context.save();
    context.translate(x, y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 8);
    context.fill();
    context.fillStyle = car.color;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    // Windshield and rear window.
    context.fillStyle = '#1d2733';
    context.fillRect(6, -CAR.width / 2 + 4, 12, CAR.width - 8);
    context.fillRect(-CAR.length / 2 + 8, -CAR.width / 2 + 4, 8, CAR.width - 8);
    // Headlights.
    context.fillStyle = '#ffe98a';
    context.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 6);
    context.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 9, 3, 6);
    if (car.kind === 'cop') {
      // Light bar, flashing red and blue.
      const flash = Math.floor(Date.now() / 300) % 2 === 0;
      context.fillStyle = flash ? PALETTE.copRed : PALETTE.copBlue;
      context.fillRect(-6, -CAR.width / 2 + 2, 12, 8);
      context.fillStyle = flash ? PALETTE.copBlue : PALETTE.copRed;
      context.fillRect(-6, CAR.width / 2 - 10, 12, 8);
      context.fillStyle = '#f5f5f5';
      context.fillRect(-CAR.length / 2 + 2, -CAR.width / 2 + 2, CAR.length - 4, 6);
    }
    if (isPlayerCar) {
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      roundRect(-CAR.length / 2 - 3, -CAR.width / 2 - 3, CAR.length + 6, CAR.width + 6, 10);
      context.stroke();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, color, walkPhase, down, isPlayer) {
    const sx = toScreenX(x);
    const sy = toScreenY(y);
    context.save();
    context.translate(sx, sy);
    if (down > 0) {
      context.rotate(Math.PI / 2);
      context.globalAlpha = 0.85;
    }
    const bob = Math.sin(walkPhase) * 2;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
    context.fill();
    // Body.
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, bob * 0.4, 11, 0, Math.PI * 2);
    context.fill();
    // Head.
    context.fillStyle = '#f2c89b';
    context.beginPath();
    context.arc(Math.cos(angle) * 3, Math.sin(angle) * 3 + bob * 0.4, 6, 0, Math.PI * 2);
    context.fill();
    // Gun in hand when the player aims.
    if (isPlayer) {
      context.strokeStyle = '#20242c';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
      context.lineTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
      context.stroke();
    }
    context.restore();
  }

  function drawWorld(state) {
    currentCamera = state.camera;
    drawGround(state);
    // Sun coins and cash pickups.
    for (const coin of state.coins) {
      if (coin.taken || !inView(coin.x, coin.y, 30)) continue;
      const pulse = 1 + Math.sin(state.playSeconds * 4 + coin.x) * 0.15;
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(toScreenX(coin.x), toScreenY(coin.y), 9 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#8a6d1f';
      text('$', toScreenX(coin.x), toScreenY(coin.y) + 4, 11, '#8a6d1f', 'center');
    }
    for (const pickup of state.pickups) {
      if (!inView(pickup.x, pickup.y, 30)) continue;
      context.fillStyle = '#58d68d';
      context.beginPath();
      context.arc(toScreenX(pickup.x), toScreenY(pickup.y), 10, 0, Math.PI * 2);
      context.fill();
      text('$', toScreenX(pickup.x), toScreenY(pickup.y) + 4, 12, '#14532d', 'center');
    }
    // Mission marker: a pulsing beacon the player can see from anywhere on screen.
    if (state.marker) {
      const mx = toScreenX(state.marker.x);
      const my = toScreenY(state.marker.y);
      const pulse = 1 + Math.sin(state.playSeconds * 5) * 0.2;
      context.strokeStyle = PALETTE.mission;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(mx, my, 26 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.mission;
      context.beginPath();
      context.moveTo(mx, my - 16);
      context.lineTo(mx + 10, my);
      context.lineTo(mx, my + 16);
      context.lineTo(mx - 10, my);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255, 210, 62, 0.25)';
      context.fillRect(mx - 2, my - 90, 4, 70);
    }
    // Cars, then people, then bullets and particles on top.
    for (const car of state.cars) {
      if (!inView(car.x, car.y, 80)) continue;
      drawCarShape(car, state.player.car === car);
    }
    for (const ped of state.peds) {
      if (!inView(ped.x, ped.y, 40)) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.walkPhase, ped.down, false);
    }
    for (const thug of state.thugs) {
      if (!inView(thug.x, thug.y, 40)) continue;
      if (thug.flash > 0) drawPerson(thug.x, thug.y, thug.angle, '#ffffff', thug.walkPhase, 0, false);
      else drawPerson(thug.x, thug.y, thug.angle, '#c0392b', thug.walkPhase, 0, false);
      // Health bar over a thug.
      context.fillStyle = 'rgba(0,0,0,0.5)';
      context.fillRect(toScreenX(thug.x) - 16, toScreenY(thug.y) - 24, 32, 5);
      context.fillStyle = '#e5534b';
      context.fillRect(toScreenX(thug.x) - 16, toScreenY(thug.y) - 24, 32 * Math.max(0, thug.health / 50), 5);
    }
    for (const cop of state.cops) {
      if (!inView(cop.x, cop.y, 40)) continue;
      drawPerson(cop.x, cop.y, cop.angle, '#2c4a7c', cop.walkPhase, 0, false);
      context.fillStyle = '#2c4a7c';
      context.beginPath();
      context.arc(toScreenX(cop.x), toScreenY(cop.y) - 8, 5, 0, Math.PI * 2);
      context.fill();
    }
    if (!state.player.inCar) {
      const blink = state.player.hurtFlash > 0 && Math.floor(state.player.hurtFlash * 12) % 2 === 0;
      if (!blink) drawPerson(state.player.x, state.player.y, state.player.angle, '#0f766e', state.player.walkPhase, 0, true);
    }
    for (const bullet of state.bullets) {
      context.fillStyle = '#ffd23e';
      context.beginPath();
      context.arc(toScreenX(bullet.x), toScreenY(bullet.y), 3.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      if (p.text) {
        text(p.text, toScreenX(p.x), toScreenY(p.y), 16, p.color, 'center');
      } else {
        context.beginPath();
        context.arc(toScreenX(p.x), toScreenY(p.y), p.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
  }

  function drawMinimap(state) {
    const { x, y, w, h } = MINIMAP;
    const scaleX = w / WORLD.width;
    const scaleY = h / WORLD.height;
    context.fillStyle = PALETTE.panel;
    roundRect(x - 6, y - 6, w + 12, h + 12, 8);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.stroke();
    context.save();
    context.beginPath();
    context.rect(x, y, w, h);
    context.clip();
    context.fillStyle = '#7fae62';
    context.fillRect(x, y, w, h);
    context.fillStyle = PALETTE.water;
    context.fillRect(x, y + CITY.waterTop * scaleY, w, h - CITY.waterTop * scaleY);
    context.fillStyle = PALETTE.sand;
    context.fillRect(x, y + CITY.beachTop * scaleY, w, (CITY.waterTop - CITY.beachTop) * scaleY);
    context.strokeStyle = '#4a4f58';
    context.lineWidth = 2;
    for (const rx of CITY.roadsV) {
      context.beginPath();
      context.moveTo(x + rx * scaleX, y);
      context.lineTo(x + rx * scaleX, y + h);
      context.stroke();
    }
    for (const ry of CITY.roadsH) {
      context.beginPath();
      context.moveTo(x, y + ry * scaleY);
      context.lineTo(x + w, y + ry * scaleY);
      context.stroke();
    }
    if (state.marker) {
      const pulse = 1 + Math.sin(state.playSeconds * 5) * 0.3;
      context.fillStyle = PALETTE.mission;
      context.beginPath();
      context.arc(x + state.marker.x * scaleX, y + state.marker.y * scaleY, 5 * pulse, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#c8c8c8';
    for (const car of state.cars) {
      if (car.kind === 'cop') continue;
      context.fillRect(x + car.x * scaleX - 1, y + car.y * scaleY - 1, 2, 2);
    }
    context.fillStyle = '#ff7f2a';
    for (const thug of state.thugs) context.fillRect(x + thug.x * scaleX - 1, y + thug.y * scaleY - 1, 3, 3);
    context.fillStyle = PALETTE.copRed;
    for (const cop of state.cops) {
      context.beginPath();
      context.arc(x + cop.x * scaleX, y + cop.y * scaleY, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'cop') continue;
      context.fillStyle = PALETTE.copBlue;
      context.beginPath();
      context.arc(x + car.x * scaleX, y + car.y * scaleY, 3, 0, Math.PI * 2);
      context.fill();
    }
    // The player, always on top, with a white ring.
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x + state.player.x * scaleX, y + state.player.y * scaleY, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#0f766e';
    context.lineWidth = 2;
    context.stroke();
    context.restore();
    text('SUNSHORE', x + w / 2, y + h + 20, 11, 'rgba(255,255,255,0.75)', 'center');
  }

  function drawHud(state, options) {
    // Wanted stars, health and money, top left.
    context.fillStyle = PALETTE.panel;
    roundRect(14, 14, 250, 92, 10);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.stroke();
    let stars = '';
    for (let i = 0; i < WANTED.maxStars; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, 28, 44, 26, state.wanted > 0 ? PALETTE.wanted : 'rgba(255,255,255,0.55)', 'left');
    text(state.wanted > 0 ? 'WANTED' : 'CLEAN', 200, 40, 13, state.wanted > 0 ? '#ff8a80' : '#9ccc9c', 'left');
    context.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(28, 56, 180, 12, 6);
    context.fill();
    context.fillStyle = state.player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(28, 56, 180 * Math.max(0, state.player.health / 100), 12, 6);
    context.fill();
    text(`$${Math.floor(state.money).toLocaleString('en-US')}`, 28, 92, 20, PALETTE.gold, 'left');
    text(state.player.inCar ? 'DRIVING — E to get out' : 'ON FOOT — E to steal a car', 28, 122, 13, 'rgba(255,255,255,0.8)', 'left');
    // Mission title and objective, top centre.
    const title = missionTitle(state);
    text(title.toUpperCase(), VIEW.width / 2, 40, 20, '#ffffff', 'center', FONT_DISPLAY);
    context.fillStyle = PALETTE.panel;
    const objectiveWidth = Math.max(320, context.measureText(state.objective).width + 36);
    roundRect(VIEW.width / 2 - objectiveWidth / 2, 50, objectiveWidth, 32, 8);
    context.fill();
    text(state.objective, VIEW.width / 2, 72, 15, '#ffe9a8', 'center');
    if (state.mission.timer > 0) {
      text(`${Math.ceil(state.mission.timer)}s`, VIEW.width / 2, 108, 22, '#ff8a80', 'center');
    }
    if (state.mission.robProgress > 0 && state.mission.robProgress < 1) {
      context.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(VIEW.width / 2 - 110, 96, 220, 10, 5);
      context.fill();
      context.fillStyle = PALETTE.gold;
      roundRect(VIEW.width / 2 - 110, 96, 220 * state.mission.robProgress, 10, 5);
      context.fill();
    }
    drawMinimap(state);
    // Clock, under the minimap's label.
    const hours = Math.floor(state.clockMinutes / 60) % 24;
    const minutes = Math.floor(state.clockMinutes) % 60;
    const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    text(`☀ ${clock}`, MINIMAP.x + MINIMAP.w, 212, 16, '#ffffff', 'right');
    // Controls hint, bottom left.
    text('WASD move/drive · Mouse aim · Click shoot · F punch · E car · Shift run · P pause · M mute', 16, VIEW.height - 14, 12, 'rgba(255,255,255,0.65)', 'left');
    // Mission banner, centre. Measure with the banner's own font, so the
    // panel fits the text exactly.
    if (state.banner) {
      context.font = `20px ${FONT_DISPLAY}`;
      context.fillStyle = 'rgba(0,0,0,0.55)';
      const bw = context.measureText(state.banner.text).width + 48;
      roundRect(VIEW.width / 2 - bw / 2, 150, bw, 44, 10);
      context.fill();
      text(state.banner.text, VIEW.width / 2, 179, 20, PALETTE.gold, 'center', FONT_DISPLAY);
    }
    // Dialogue box, bottom centre.
    if (state.dialogue) {
      context.fillStyle = 'rgba(10, 14, 22, 0.88)';
      roundRect(190, VIEW.height - 132, VIEW.width - 380, 84, 12);
      context.fill();
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.stroke();
      text(state.dialogue.name, 214, VIEW.height - 104, 15, PALETTE.gold, 'left', FONT_DISPLAY);
      text(state.dialogue.text, 214, VIEW.height - 78, 16, '#ffffff', 'left');
      text('click / Space to continue', VIEW.width - 214, VIEW.height - 58, 11, 'rgba(255,255,255,0.55)', 'right');
    }
    // Red/blue flash while the police are after the player.
    if (state.wanted >= 3) {
      const flash = Math.floor(Date.now() / 400) % 2 === 0;
      context.strokeStyle = flash ? 'rgba(255, 60, 60, 0.55)' : 'rgba(70, 140, 255, 0.55)';
      context.lineWidth = 10;
      context.strokeRect(5, 5, VIEW.width - 10, VIEW.height - 10);
    }
    if (state.player.hurtFlash > 0) {
      context.fillStyle = `rgba(255, 0, 0, ${state.player.hurtFlash * 0.5})`;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (options.muted) text('🔇 muted', VIEW.width - 16, VIEW.height - 14, 12, 'rgba(255,255,255,0.65)', 'right');
  }

  function drawButton(button, selected) {
    context.fillStyle = selected ? '#f7c948' : 'rgba(255,255,255,0.12)';
    roundRect(button.x, button.y, button.w, button.h, 10);
    context.fill();
    context.strokeStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.35)';
    context.lineWidth = 2;
    context.stroke();
    text(button.label, button.x + button.w / 2, button.y + button.h / 2 + 8, 22, selected ? '#20242c' : '#ffffff', 'center', FONT_DISPLAY);
  }

  function titleButtons(hasSave) {
    const buttons = [];
    const w = 340;
    const x = VIEW.width / 2 - w / 2;
    let y = 470;
    buttons.push({ id: 'new', label: '▶  New Game', x, y, w, h: 56 });
    y += 72;
    if (hasSave) {
      buttons.push({ id: 'continue', label: '↻  Continue', x, y, w, h: 56 });
      y += 72;
    }
    buttons.push({ id: 'howto', label: '?  How to Play', x, y, w, h: 56 });
    return buttons;
  }

  function drawTitle(state, options) {
    drawWorld(state);
    context.fillStyle = 'rgba(10, 16, 28, 0.45)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    // Sun-soaked title.
    context.fillStyle = '#ffb347';
    context.beginPath();
    context.arc(VIEW.width - 220, 150, 46, 0, Math.PI * 2);
    context.fill();
    text('SUNSHORE', VIEW.width / 2, 210, 96, '#ffffff', 'center', FONT_DISPLAY);
    text('AN OPEN-WORLD CRIME STORY', VIEW.width / 2, 252, 24, PALETTE.gold, 'center', FONT_DISPLAY);
    text('A sun-soaked city. Five jobs. One driver who owes everybody money.', VIEW.width / 2, 292, 17, 'rgba(255,255,255,0.85)', 'center');
    text('Steal cars · Outrun the police · Take the jobs · Take the bank', VIEW.width / 2, 322, 16, 'rgba(255,255,255,0.7)', 'center');
    const buttons = titleButtons(options.hasSave);
    buttons.forEach((button, index) => drawButton(button, index === options.selected));
    text('WASD move · E steal a car · Mouse aim, click to shoot · F punch · P pause', VIEW.width / 2, 700, 15, 'rgba(255,255,255,0.75)', 'center');
    text('An original game. No real city, no real gangsters — Sunshore is invented.', VIEW.width / 2, 726, 13, 'rgba(255,255,255,0.5)', 'center');
    if (options.showHowTo) {
      context.fillStyle = 'rgba(10, 14, 22, 0.92)';
      roundRect(240, 150, VIEW.width - 480, 500, 14);
      context.fill();
      text('HOW TO PLAY', VIEW.width / 2, 200, 30, PALETTE.gold, 'center', FONT_DISPLAY);
      const lines = [
        'You are Rook, a driver in debt to Mara Voss.',
        'Follow the yellow marker: steal cars, deliver packages,',
        'fight Dario\'s crew, lose the police, rob Marina Bank.',
        '',
        'WASD / arrows — move on foot, drive in a car',
        'Mouse — aim · Click — shoot · F — punch',
        'E — steal / enter a car, get out again',
        'Shift — run · P / Esc — pause · M — mute',
        '',
        'Stars mean the police want you. Hide and the heat fades.',
        'Gold coins pay $25. Your progress saves at every mission.',
      ];
      lines.forEach((line, i) => text(line, VIEW.width / 2, 240 + i * 30, 16, '#ffffff', 'center'));
      text('Click anywhere to close', VIEW.width / 2, 610, 15, PALETTE.gold, 'center');
    }
    return buttons;
  }

  function drawPanelScreen(title, lines, prompt, accent) {
    context.fillStyle = 'rgba(8, 12, 20, 0.72)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text(title, VIEW.width / 2, 300, 72, accent || '#ffffff', 'center', FONT_DISPLAY);
    lines.forEach((line, i) => text(line, VIEW.width / 2, 360 + i * 34, 20, 'rgba(255,255,255,0.85)', 'center'));
    text(prompt, VIEW.width / 2, 520, 18, PALETTE.gold, 'center');
  }

  function draw(state, screen, options) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0c1016';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (screen === SCREEN_TITLE) return drawTitle(state, options);
    drawWorld(state);
    drawHud(state, options);
    if (screen === SCREEN_PAUSED) {
      drawPanelScreen('PAUSED', [
        `Mission: ${missionTitle(state)} — $${Math.floor(state.money)}`,
        'Your game is saved.',
        '',
        'P / Esc — resume · M — mute',
      ], 'Press P or click to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanelScreen('BUSTED!', [
        'The Sunshore police caught up with you.',
        'Bail cost $100. Mara is not amused.',
      ], 'Press Enter to get out and keep playing', '#7fb3ff');
    } else if (screen === SCREEN_WASTED) {
      drawPanelScreen('WASTED', [
        'You woke up at Sunshore General.',
        'Hospital bill: $50.',
      ], 'Press Enter to get back on your feet', '#ff8a80');
    }
    return null;
  }

  return { draw, titleButtons };
}
