// Missions and the story of Sunshore: Rook, a driver fresh out of the game,
// takes jobs from Mara Voss, who runs the Sunset Diner and half the town's
// business. Five missions, each a chain of steps — drive, deliver, fight,
// escape, rob — with dialogue, a marker on the map and a cash reward.

import { LANDMARKS } from './config.js';
import { raiseWanted } from './police.js';
import { spawnThugs } from './combat.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Mara Voss',
    reward: 150,
    intro: [
      "Mara Voss: Rook. You're back in Sunshore and broke. Same as always.",
      'Mara Voss: I need a driver. Borrow a car — any car — and bring it to the Sunset Diner.',
      'Mara Voss: Walk up to a car and press E. If someone is driving it, they will object. Briefly.',
    ],
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: LANDMARKS.diner.x, y: LANDMARKS.diner.y, radius: 90, text: 'Drive to the Sunset Diner' },
    ],
    complete: 'Mara Voss: Not bad. The car stays with me. The money is yours.',
  },
  {
    id: 'courier-run',
    title: 'Courier Run',
    giver: 'Mara Voss',
    reward: 250,
    intro: [
      'Mara Voss: A package for a client at Pier 9. It is small, it is legal-ish, and it is late already.',
      'Mara Voss: Pick it up here at the diner, then drive it to the pier. Ninety seconds. The client hates waiting.',
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.diner.x, y: LANDMARKS.diner.y, radius: 80, text: 'Pick up the package at the Sunset Diner' },
      { type: 'timed', x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, radius: 100, timeLimit: 90, text: 'Deliver the package to Pier 9 — fast!' },
    ],
    complete: 'Mara Voss: On time. The client sends his regards, and his money.',
  },
  {
    id: 'debt-collection',
    title: 'Debt Collection',
    giver: 'Mara Voss',
    reward: 350,
    intro: [
      'Mara Voss: Dario owes me three thousand. His boys are hanging around the Old Factory, spending it.',
      'Mara Voss: Go remind them who I am. Fists work. So does the pistol — click to shoot, F to swing.',
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.factory.x, y: LANDMARKS.factory.y, radius: 160, text: 'Go to the Old Factory' },
      { type: 'fight', x: LANDMARKS.factory.x, y: LANDMARKS.factory.y, count: 3, armed: true, text: 'Deal with Dario\'s crew (0/3 down)' },
      { type: 'goto', x: LANDMARKS.diner.x, y: LANDMARKS.diner.y, radius: 80, text: 'Report back to Mara at the diner' },
    ],
    complete: 'Mara Voss: Dario paid. In full, with interest. You are earning your keep, Rook.',
  },
  {
    id: 'hot-pursuit',
    title: 'Hot Pursuit',
    giver: 'Mara Voss',
    reward: 400,
    intro: [
      'Mara Voss: The cops took my ledger in a raid. I got it back — and now they want it back.',
      'Mara Voss: Lose them. Three stars on your head. When the heat is gone, come home to the apartment.',
    ],
    steps: [
      { type: 'escape', text: 'Lose the police (get your wanted level to zero)' },
      { type: 'goto', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, radius: 90, text: 'Reach the safehouse' },
    ],
    complete: 'Mara Voss: Clean. The ledger stays with us. You drive like the cops owe you money.',
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    giver: 'Mara Voss',
    reward: 1000,
    intro: [
      'Mara Voss: One last job, Rook. Marina Bank. In, out, gone — then lose the cops and meet me at home.',
      'Mara Voss: Stand at the vault door and hold your nerve. The whole town will be looking for you after.',
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 140, text: 'Get to Marina Bank' },
      { type: 'rob', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 90, holdSeconds: 4, text: 'Crack the vault — stay at the door' },
      { type: 'escape', text: 'Lose the police (get your wanted level to zero)' },
      { type: 'goto', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, radius: 90, text: 'Reach the safehouse with the score' },
    ],
    complete: 'Mara Voss: We did it. Sunshore is ours now, Rook. Free roam — the city is yours.',
  },
];

export function showDialogue(state, name, text) {
  state.dialogueQueue.push({ name, text });
}

function nextDialogue(state) {
  if (!state.dialogue && state.dialogueQueue.length > 0) {
    state.dialogue = state.dialogueQueue.shift();
    state.dialogue.until = state.playSeconds + 4.5;
  }
  if (state.dialogue && state.playSeconds > state.dialogue.until) {
    state.dialogue = null;
  }
}

function startStep(state, random) {
  const mission = MISSIONS[state.mission.index];
  const step = mission.steps[state.mission.step];
  state.mission.timer = step.timeLimit || 0;
  state.mission.robProgress = 0;
  state.mission.thugsSpawned = false;
  state.mission.thugsTotal = 0;
  if (step.type === 'escape') {
    const stars = mission.id === 'the-big-score' ? 4 : 3;
    raiseWanted(state, stars, 'mission heat');
    showDialogue(state, 'Mara Voss', 'The cops are on you. Lose them — stay out of sight and the heat fades.');
  }
  if (step.type === 'fight') {
    spawnThugs(state, random, step.x, step.y, step.count, step.armed);
    state.mission.thugsSpawned = true;
    state.mission.thugsTotal = step.count;
  }
}

export function startMission(state, index, random) {
  const mission = MISSIONS[index];
  state.mission = { index, step: 0, timer: 0, robProgress: 0, thugsSpawned: false, thugsTotal: 0 };
  state.dialogueQueue.length = 0;
  state.dialogue = null;
  for (const line of mission.intro) {
    const cut = line.indexOf(': ');
    showDialogue(state, cut === -1 ? mission.giver : line.slice(0, cut), cut === -1 ? line : line.slice(cut + 2));
  }
  if (state.audio) state.audio.missionStart();
  startStep(state, random);
}

function completeMission(state, random) {
  const mission = MISSIONS[state.mission.index];
  state.money += mission.reward;
  state.stats.missionsDone += 1;
  state.banner = { text: `MISSION COMPLETE — ${mission.title}  +$${mission.reward}`, until: state.playSeconds + 4 };
  showDialogue(state, mission.giver, mission.complete);
  if (state.audio) state.audio.missionDone();
  const next = state.mission.index + 1;
  if (next < MISSIONS.length) {
    state.mission.index = next;
    state.mission.step = 0;
    startMission(state, next, random);
  } else {
    state.storyDone = true;
    state.mission = { index: next, step: 0, timer: 0, robProgress: 0, thugsSpawned: false, thugsTotal: 0 };
    state.objective = 'Free roam — Sunshore is yours. Grab sun coins, steal cars, stay out of trouble.';
  }
}

function failStep(state, random, reason) {
  showDialogue(state, 'Mara Voss', reason);
  state.mission.step = 0;
  startStep(state, random);
}

/** Advance the current mission one frame; sets state.objective and state.marker. */
export function updateMission(state, dt, random) {
  nextDialogue(state);
  if (state.storyDone || state.mission.index >= MISSIONS.length) {
    state.objective = 'Free roam — Sunshore is yours. Grab sun coins, steal cars, stay out of trouble.';
    state.marker = null;
    return;
  }
  const mission = MISSIONS[state.mission.index];
  const step = mission.steps[state.mission.step];
  const player = state.player;
  const distTo = (x, y) => Math.hypot(player.x - x, player.y - y);

  let done = false;
  if (step.type === 'steal') {
    state.objective = step.text;
    state.marker = null;
    done = player.inCar;
  } else if (step.type === 'goto' || step.type === 'timed') {
    state.objective = step.text;
    state.marker = { x: step.x, y: step.y };
    if (step.type === 'timed') {
      state.mission.timer -= dt;
      state.objective = `${step.text} — ${Math.max(0, Math.ceil(state.mission.timer))}s left`;
      if (state.mission.timer <= 0) {
        failStep(state, random, 'Mara Voss: Too slow! The client walked. Do it again — faster this time.');
        return;
      }
    }
    done = distTo(step.x, step.y) < step.radius;
  } else if (step.type === 'fight') {
    const down = state.mission.thugsTotal - state.thugs.length;
    state.objective = `Deal with Dario's crew (${Math.max(0, down)}/${state.mission.thugsTotal} down)`;
    state.marker = { x: step.x, y: step.y };
    done = state.mission.thugsSpawned && state.thugs.length === 0;
  } else if (step.type === 'rob') {
    state.objective = step.text;
    state.marker = { x: step.x, y: step.y };
    if (!player.inCar && distTo(step.x, step.y) < step.radius) {
      state.mission.robProgress += dt / step.holdSeconds;
      state.objective = `${step.text} — ${Math.floor(state.mission.robProgress * 100)}%`;
      done = state.mission.robProgress >= 1;
    } else {
      state.mission.robProgress = Math.max(0, state.mission.robProgress - dt * 0.5);
    }
  } else if (step.type === 'escape') {
    state.objective = step.text;
    state.marker = null;
    done = state.wanted === 0;
  }

  if (done) {
    state.mission.step += 1;
    if (state.mission.step >= mission.steps.length) {
      completeMission(state, random);
    } else {
      startStep(state, random);
    }
  }
}

/** The mission marker the HUD and minimap draw, if the current step has one. */
export function missionTitle(state) {
  if (state.storyDone || state.mission.index >= MISSIONS.length) return 'Free Roam';
  return `${state.mission.index + 1}. ${MISSIONS[state.mission.index].title}`;
}
