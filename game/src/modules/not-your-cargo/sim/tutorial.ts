// «Полигон» — the training ground before the campaign. One action per step, nobody shoots back.
import { CARGO, DT } from "./config";
import { freePoint, makeBike, stepBike, stepProjectiles, type Actor, type Bike, type BikeInput, type Projectile } from "./combat";
import { circleHitsRect, dist2 } from "./geom";
import type { Rect } from "./geom";
import type { Arena } from "./combat";

export type TrainStep = "move" | "shoot" | "dash" | "reload" | "take" | "drop" | "retake" | "deliver" | "done";
export const TRAIN_STEPS: TrainStep[] = ["move", "shoot", "dash", "reload", "take", "drop", "retake", "deliver", "done"];

export interface TrainMap extends Arena {
  start: { x: number; y: number };
  marker: { x: number; y: number };
  targets: { x: number; y: number }[];
  cargo: { x: number; y: number };
  zone: Rect;
}

export const TRAIN_MAP: TrainMap = {
  w: 1600,
  h: 760,
  walls: [
    { x: 0, y: 0, w: 1600, h: 30 },
    { x: 0, y: 730, w: 1600, h: 30 },
    { x: 700, y: 30, w: 40, h: 250 },
    { x: 700, y: 480, w: 40, h: 250 },
    { x: 1080, y: 200, w: 30, h: 120 },
  ],
  start: { x: 140, y: 380 },
  marker: { x: 420, y: 380 },
  targets: [
    { x: 560, y: 220 },
    { x: 610, y: 380 },
    { x: 560, y: 540 },
  ],
  cargo: { x: 1000, y: 380 },
  zone: { x: 1360, y: 300, w: 160, h: 160 },
};

export interface TrainTarget extends Actor {
  kind: "target";
}

export interface TrainingState {
  map: TrainMap;
  time: number;
  step: TrainStep;
  player: Bike;
  targets: TrainTarget[];
  projectiles: Projectile[];
  cargo: { x: number; y: number; carried: boolean };
  pickupHold: number;
  deliverHold: number;
  events: { type: string; x: number; y: number }[];
  nextId: number;
}

export function createTraining(): TrainingState {
  const m = TRAIN_MAP;
  return {
    map: m,
    time: 0,
    step: "move",
    player: makeBike("player", 0, m.start.x, m.start.y, "mg"),
    targets: m.targets.map((t, i) => ({ kind: "target", id: `t${i}`, team: 9, x: t.x, y: t.y, r: 18, hp: 16, maxHp: 16, alive: true, shield: 0 })),
    projectiles: [],
    cargo: { x: m.cargo.x, y: m.cargo.y, carried: false },
    pickupHold: 0,
    deliverHold: 0,
    events: [],
    nextId: 1,
  };
}

/** Where the HUD arrow points for the current step. */
export function trainTarget(s: TrainingState): { x: number; y: number } | null {
  switch (s.step) {
    case "move":
      return s.map.marker;
    case "shoot": {
      const t = s.targets.find((x) => x.alive);
      return t ? { x: t.x, y: t.y } : null;
    }
    case "take":
    case "retake":
      return { x: s.cargo.x, y: s.cargo.y };
    case "deliver":
      return { x: s.map.zone.x + s.map.zone.w / 2, y: s.map.zone.y + s.map.zone.h / 2 };
    default:
      return null;
  }
}

export function stepTraining(s: TrainingState, input: BikeInput): void {
  s.events = [];
  if (s.step === "done") return;
  s.time += DT;
  const p = s.player;
  const shots = stepBike(p, input, DT, s.map, () => s.nextId++, () => 0.5);
  p.carrying = s.cargo.carried;
  if (shots.length) s.events.push({ type: "shot", x: p.x, y: p.y });
  s.projectiles.push(...shots);
  const res = stepProjectiles(s.projectiles, s.targets, s.map, DT);
  s.projectiles = res.alive;
  for (const i of res.impacts) s.events.push({ type: "impact", x: i.x, y: i.y });
  for (const d of res.damage) {
    const t = s.targets.find((x) => x.id === d.targetId);
    if (t && d.lethal && t.alive) {
      t.alive = false;
      s.events.push({ type: "death", x: t.x, y: t.y });
    }
  }

  // cargo (same holds as the campaign)
  const near = dist2(p.x, p.y, s.cargo.x, s.cargo.y) <= CARGO.pickupRange ** 2;
  const canTake = s.step === "take" || s.step === "retake" || s.step === "deliver";
  if (s.cargo.carried) {
    s.cargo.x = p.x;
    s.cargo.y = p.y;
    if (input.drop) {
      const f = freePoint(p.x + Math.cos(p.aim) * 30, p.y + Math.sin(p.aim) * 30, CARGO.radius, s.map);
      s.cargo = { x: f.x, y: f.y, carried: false };
      s.deliverHold = 0;
      s.events.push({ type: "drop", x: f.x, y: f.y });
      if (s.step === "drop") s.step = "retake";
    } else if (input.interact && s.step === "deliver" && circleHitsRect(p.x, p.y, 1, s.map.zone)) {
      s.deliverHold += DT;
      if (s.deliverHold >= CARGO.deliverHold) {
        s.step = "done";
        s.events.push({ type: "deliver", x: p.x, y: p.y });
      }
    } else s.deliverHold = 0;
  } else if (canTake && input.interact && near) {
    s.pickupHold += DT;
    if (s.pickupHold >= CARGO.pickupHold) {
      s.cargo.carried = true;
      p.carrying = true;
      s.pickupHold = 0;
      s.events.push({ type: "pickup", x: p.x, y: p.y });
      s.step = s.step === "take" ? "drop" : "deliver";
    }
  } else s.pickupHold = 0;

  // step gates
  if (s.step === "move" && dist2(p.x, p.y, s.map.marker.x, s.map.marker.y) < 40 * 40) s.step = "shoot";
  else if (s.step === "shoot" && s.targets.every((t) => !t.alive)) s.step = "dash";
  else if (s.step === "dash" && p.dashLeft > 0) s.step = "reload";
  else if (s.step === "reload" && p.reloadLeft > 0) s.step = "take";
}
