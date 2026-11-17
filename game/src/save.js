// Save and load: one localStorage slot holding the story progress, the money,
// the player's health and position, and the play stats. Saving happens after
// every mission and whenever the player pauses; Continue on the title screen
// picks the story up where it left off.

import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      money: state.money,
      health: state.player.health,
      missionIndex: state.mission.index,
      missionStep: state.mission.step,
      playerX: state.player.x,
      playerY: state.player.y,
      carsStolen: state.stats.carsStolen,
      missionsDone: state.stats.missionsDone,
      playSeconds: state.playSeconds,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* storage off: nothing to clear */ }
}
