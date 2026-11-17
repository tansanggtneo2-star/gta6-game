// Sunshore tuning: every number and colour in one place, so the rest of the game
// reads like a design document. The world is a fixed 3600 x 2700 city; the camera
// shows a 1280 x 800 window of it and follows the player.

export const WORLD = { width: 3600, height: 2700 };
export const VIEW = { width: 1280, height: 800 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'sunshore.save.v1';

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  pistolDamage: 25,
  pistolCooldown: 0.22,
  pistolRange: 520,
  meleeDamage: 18,
  meleeRange: 46,
  meleeCooldown: 0.45,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 420,
  brake: 620,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  grip: 0.92,
};

export const COP = {
  carSpeed: 520,
  footSpeed: 235,
  arrestRange: 30,
  arrestTime: 1.2,
  shootRange: 340,
  shootCooldown: 0.9,
  bulletDamage: 6,
};

export const WANTED = {
  maxStars: 5,
  decayHiddenSeconds: 7,
  copCarsPerStar: [0, 0, 1, 2, 3, 4],
  footCopsPerStar: [0, 2, 3, 4, 5, 6],
};

// City layout: roads form the grid; blocks between them hold buildings, parks and lots.
export const CITY = {
  roadsV: [400, 1000, 1600, 2200, 2800, 3200],
  roadsH: [350, 850, 1350, 1850, 2350],
  roadWidth: 120,
  beachTop: 2500,
  waterTop: 2620,
};

export const LANDMARKS = {
  safehouse: { name: "Rook's Apartment", x: 400, y: 350 },
  diner: { name: 'Sunset Diner', x: 1000, y: 1350 },
  bank: { name: 'Marina Bank', x: 2800, y: 2050 },
  pier: { name: 'Pier 9', x: 1800, y: 2560 },
  factory: { name: 'Old Factory', x: 3200, y: 1350 },
  market: { name: 'Harbor Market', x: 2200, y: 850 },
  hospital: { name: 'Sunshore General', x: 1600, y: 850 },
};

export const PALETTE = {
  grass: '#8fce6e',
  park: '#6db95a',
  sand: '#f2d9a0',
  water: '#2f9fd8',
  waterDeep: '#1f7fb8',
  road: '#565b66',
  roadLine: '#f7d54a',
  sidewalk: '#c9c2b4',
  buildingRoof: '#e8e0d0',
  text: '#ffffff',
  textDark: '#20242c',
  panel: 'rgba(16, 20, 28, 0.78)',
  panelEdge: 'rgba(255, 255, 255, 0.25)',
  gold: '#f7c948',
  health: '#58d68d',
  healthLow: '#e5534b',
  wanted: '#ffd23e',
  copBlue: '#3f8cff',
  copRed: '#ff4d4d',
  mission: '#ffd23e',
  sun: '#ffb347',
};

export const BUILDING_COLORS = [
  '#f2a65a', '#e07856', '#7fb3d5', '#f5d76e', '#e98aa5',
  '#9b59b6', '#58c9a5', '#d9a05b', '#8fa8c8', '#c96f4a',
];

export const CAR_COLORS = [
  '#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c',
  '#ecf0f1', '#2c3e50', '#e67e22', '#fd79a8', '#00cec9',
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
