// Campaign layouts for C02–C05 (three schemes: steppe road, convoy corridor, station). C01 keeps
// its own map in maps.ts. Waves are lists of spawn points with an enemy kind.
import type { Rect } from "./geom";
import type { Arena } from "./combat";

export type MissionId = "C01" | "C02" | "C03" | "C04" | "C05";
export const MISSION_IDS: MissionId[] = ["C01", "C02", "C03", "C04", "C05"];

export type SpawnKind = "raider" | "drone";
export interface Spawn {
  x: number;
  y: number;
  kind: SpawnKind;
}

export interface CampaignMap extends Arena {
  start: { x: number; y: number };
  decor: { x: number; y: number; r: number }[];
  /** delivery / goal zone */
  goal: Rect | null;
  cargo: { x: number; y: number } | null;
  turrets: { x: number; y: number }[];
  /** Repair kits: +25 HP, back every 20 s (same rule as PvP). */
  kits?: { x: number; y: number }[];
}

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

// ── C02 «Засада»: the road forks. North: short, past turret nests. South: a long detour. ──────
export const C02_MAP: CampaignMap & {
  northTrigger: Rect;
  southTrigger: Rect;
  northWave: Spawn[];
  southWaves: Spawn[][];
} = {
  w: 2800,
  h: 1200,
  walls: [
    // the divider between the lanes
    R(700, 470, 1500, 60),
    // north lane cover
    R(1050, 180, 50, 140),
    R(1500, 320, 60, 150),
    // south lane: switchbacks make it longer
    R(900, 530, 40, 420),
    R(1250, 780, 40, 420),
    R(1600, 530, 40, 420),
    R(1950, 780, 40, 420),
    // station
    R(2450, 380, 40, 140),
    R(2450, 680, 40, 140),
  ],
  start: { x: 200, y: 600 },
  decor: [
    { x: 400, y: 300, r: 16 },
    { x: 520, y: 950, r: 14 },
    { x: 2300, y: 220, r: 12 },
  ],
  goal: R(2500, 520, 180, 160),
  cargo: { x: 330, y: 600 },
  kits: [{ x: 600, y: 600 }],
  turrets: [
    { x: 1300, y: 90 },
    { x: 1800, y: 420 },
    { x: 2100, y: 120 },
  ],
  northTrigger: R(700, 0, 120, 470),
  southTrigger: R(700, 530, 120, 670),
  northWave: [
    { x: 1700, y: 150, kind: "raider" },
    { x: 1900, y: 300, kind: "raider" },
    { x: 2050, y: 380, kind: "raider" },
    { x: 2300, y: 200, kind: "drone" },
    { x: 2350, y: 900, kind: "raider" },
  ],
  southWaves: [
    [
      { x: 1450, y: 1100, kind: "raider" },
      { x: 1450, y: 650, kind: "drone" },
      { x: 1100, y: 1100, kind: "raider" },
    ],
    [
      { x: 2150, y: 1100, kind: "raider" },
      { x: 2200, y: 650, kind: "drone" },
      { x: 2250, y: 900, kind: "raider" },
    ],
  ],
};

// ── C03 «Конвой»: a corridor with three checkpoints; the truck rolls only with the courier near. ─
export const C03_MAP: CampaignMap & { path: { x: number; y: number }[]; checkpoints: number[]; ambush: Spawn[][] } = {
  w: 3400,
  h: 1000,
  walls: [
    R(0, 0, 3400, 120),
    R(0, 880, 3400, 120),
    R(700, 120, 60, 220),
    R(700, 660, 60, 220),
    R(1450, 300, 60, 140),
    R(1450, 560, 60, 140),
    R(2200, 120, 60, 240),
    R(2200, 640, 60, 240),
    R(2800, 380, 120, 40),
    R(2800, 580, 120, 40),
  ],
  start: { x: 160, y: 560 },
  decor: [
    { x: 1100, y: 760, r: 16 },
    { x: 1900, y: 240, r: 14 },
    { x: 2600, y: 760, r: 12 },
  ],
  goal: R(3200, 400, 160, 200),
  cargo: null,
  turrets: [],
  kits: [
    { x: 1900, y: 820 },
    { x: 1900, y: 180 },
  ],
  path: [
    { x: 200, y: 500 },
    { x: 1100, y: 500 },
    { x: 1900, y: 500 },
    { x: 2600, y: 500 },
    { x: 3280, y: 500 },
  ],
  checkpoints: [1, 2, 3], // path indices that trigger an ambush when reached
  ambush: [
    [
      { x: 1500, y: 200, kind: "raider" },
      { x: 1500, y: 800, kind: "raider" },
    ],
    [
      { x: 2350, y: 200, kind: "raider" },
      { x: 2350, y: 800, kind: "drone" },
      { x: 2500, y: 500, kind: "raider" },
    ],
    [
      { x: 3050, y: 200, kind: "drone" },
      { x: 3050, y: 800, kind: "drone" },
      { x: 3150, y: 300, kind: "raider" },
      { x: 3150, y: 700, kind: "raider" },
    ],
  ],
};

// ── C04 «Станция»: data terminal → the core → hold out 30 s → evacuation pad opens. ───────────
export const C04_MAP: CampaignMap & { terminal: { x: number; y: number }; evac: Rect; waveSpots: Spawn[] } = {
  w: 1800,
  h: 1400,
  walls: [
    // station blocks
    R(500, 300, 260, 60),
    R(1040, 300, 260, 60),
    R(500, 1040, 260, 60),
    R(1040, 1040, 260, 60),
    R(400, 500, 60, 400),
    R(1340, 500, 60, 400),
    R(840, 620, 120, 40),
    R(840, 740, 120, 40),
  ],
  start: { x: 160, y: 1250 },
  decor: [
    { x: 300, y: 200, r: 14 },
    { x: 1600, y: 1200, r: 16 },
  ],
  goal: null,
  cargo: { x: 900, y: 700 },
  turrets: [{ x: 1550, y: 150 }],
  kits: [
    { x: 300, y: 700 },
    { x: 1500, y: 1250 },
  ],
  terminal: { x: 1600, y: 700 },
  evac: R(80, 1100, 220, 220),
  waveSpots: [
    { x: 900, y: 120, kind: "raider" },
    { x: 1650, y: 1250, kind: "drone" },
    { x: 150, y: 150, kind: "raider" },
    { x: 1650, y: 400, kind: "drone" },
  ],
};

// ── C05 «Перехватчик»: a short chase down the corridor, the interceptor, then the final drop. ──
export const C05_MAP: CampaignMap & { arenaTrigger: number; bossSpawn: { x: number; y: number }; chase: Spawn[] } = {
  w: 3600,
  h: 1100,
  walls: [
    R(0, 0, 3600, 100),
    R(0, 1000, 3600, 100),
    R(600, 100, 60, 300),
    R(600, 700, 60, 300),
    R(1200, 380, 60, 340),
    R(1800, 100, 60, 300),
    R(1800, 700, 60, 300),
    // arena pillars
    R(2700, 300, 80, 80),
    R(2700, 720, 80, 80),
    R(3100, 500, 80, 100),
  ],
  start: { x: 150, y: 550 },
  decor: [
    { x: 900, y: 850, r: 14 },
    { x: 1500, y: 250, r: 16 },
  ],
  goal: R(3380, 470, 180, 160),
  cargo: null, // the courier starts with the core
  turrets: [{ x: 1500, y: 900 }],
  kits: [
    { x: 2500, y: 200 },
    { x: 2500, y: 900 },
  ],
  arenaTrigger: 2250,
  bossSpawn: { x: 3200, y: 300 },
  chase: [
    { x: 900, y: 200, kind: "raider" },
    { x: 1000, y: 900, kind: "drone" },
    { x: 1600, y: 550, kind: "raider" },
    { x: 2000, y: 250, kind: "drone" },
  ],
};
