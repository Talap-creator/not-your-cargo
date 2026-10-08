import { PVP } from "./config";
import type { Rect } from "./geom";
import type { Arena } from "./combat";

// ── C01 «Первая доставка»: a steppe road from the abandoned depot (left) to the station (right) ──
export interface MissionMap extends Arena {
  start: { x: number; y: number };
  cargo: { x: number; y: number };
  station: Rect; // delivery zone
  waveSpawns: { x: number; y: number }[][];
  decor: { x: number; y: number; r: number }[];
}

export const C01_MAP: MissionMap = {
  w: 2600,
  h: 1100,
  walls: [
    // depot ruins around the start
    { x: 120, y: 260, w: 260, h: 40 },
    { x: 120, y: 800, w: 260, h: 40 },
    { x: 120, y: 300, w: 40, h: 160 },
    // mid-road cover
    { x: 760, y: 420, w: 60, h: 120 },
    { x: 980, y: 640, w: 140, h: 50 },
    { x: 1250, y: 300, w: 50, h: 180 },
    { x: 1400, y: 720, w: 160, h: 50 },
    { x: 1700, y: 460, w: 70, h: 160 },
    // solar array rows (opaque)
    { x: 1900, y: 180, w: 220, h: 30 },
    { x: 1900, y: 880, w: 220, h: 30 },
    // station walls with an open front
    { x: 2300, y: 330, w: 40, h: 160 },
    { x: 2300, y: 610, w: 40, h: 160 },
    { x: 2340, y: 330, w: 200, h: 40 },
    { x: 2340, y: 730, w: 200, h: 40 },
  ],
  start: { x: 230, y: 560 },
  cargo: { x: 520, y: 560 },
  station: { x: 2360, y: 470, w: 160, h: 160 },
  waveSpawns: [
    [
      { x: 1150, y: 120 },
      { x: 1150, y: 980 },
      { x: 1450, y: 540 },
      { x: 1300, y: 900 },
    ],
    [
      { x: 1900, y: 100 },
      { x: 1900, y: 1000 },
      { x: 2150, y: 540 },
      { x: 2000, y: 360 },
      { x: 2200, y: 900 },
    ],
  ],
  decor: [
    { x: 620, y: 300, r: 14 },
    { x: 880, y: 860, r: 18 },
    { x: 1120, y: 220, r: 12 },
    { x: 1580, y: 280, r: 16 },
    { x: 1820, y: 820, r: 14 },
    { x: 2200, y: 960, r: 12 },
  ],
};

// ── PvP «Перехват груза»: symmetric 1600×1000 arena (P02). Everything left of x=800 is mirrored. ──
export interface PvpMap extends Arena {
  bases: [Rect, Rect]; // delivery zones, side 0 = left
  spawns: [{ x: number; y: number }, { x: number; y: number }];
  cargoHome: { x: number; y: number };
  repairs: [{ x: number; y: number }, { x: number; y: number }];
}

const half: Rect[] = [
  // base shield walls: protect the spawn, leave openings up and down
  { x: 200, y: 400, w: 30, h: 200 },
  { x: 60, y: 300, w: 170, h: 30 },
  { x: 60, y: 670, w: 170, h: 30 },
  // mid-left cover
  { x: 430, y: 200, w: 140, h: 40 },
  { x: 430, y: 760, w: 140, h: 40 },
  { x: 520, y: 450, w: 40, h: 100 },
  // lanes: upper and lower bypass split by long blocks
  { x: 640, y: 330, w: 40, h: 120 },
  { x: 640, y: 550, w: 40, h: 120 },
];

function mirror(r: Rect): Rect {
  return { x: PVP.arenaW - r.x - r.w, y: r.y, w: r.w, h: r.h };
}

export const PVP_MAP: PvpMap = {
  w: PVP.arenaW,
  h: PVP.arenaH,
  walls: [
    ...half,
    ...half.map(mirror),
    // centre: a broken ring around the cargo, open on all four diagonals
    { x: 760, y: 410, w: 80, h: 24 },
    { x: 760, y: 566, w: 80, h: 24 },
  ],
  bases: [
    { x: 70, y: 430, w: 110, h: 140 },
    { x: PVP.arenaW - 70 - 110, y: 430, w: 110, h: 140 },
  ],
  spawns: [
    { x: 125, y: 500 },
    { x: PVP.arenaW - 125, y: 500 },
  ],
  cargoHome: { x: 800, y: 500 },
  repairs: [
    { x: 800, y: 120 },
    { x: 800, y: 880 },
  ],
};
