// Campaign missions C01–C05 — local single-player simulation. Fixed DT, seeded, no wall clock.
// C01 keeps its map and wave rules; C02–C05 follow section 4 of the spec.
import { CARGO, DT, ENEMY, MISSION, WEAPONS, type WeaponId } from "./config";
import { freePoint, makeBike, stepBike, stepProjectiles, type Actor, type Bike, type BikeInput, type Projectile } from "./combat";
import { circleHitsRect, dist2, rng, type Rect } from "./geom";
import { C01_MAP } from "./maps";
import { C02_MAP, C03_MAP, C04_MAP, C05_MAP, type CampaignMap, type MissionId, type Spawn } from "./campaign-maps";
import { makeBoss, makeDrone, makeRaider, makeTurret, stepEnemy, type Boss, type Enemy } from "./enemies";

export type { MissionId } from "./campaign-maps";
export type { Raider } from "./enemies";

export interface SpawnWarning {
  x: number;
  y: number;
  left: number;
  kind: Spawn["kind"];
}

export interface MissionEvent {
  type: "shot" | "hit" | "impact" | "death" | "pickup" | "drop" | "deliver" | "spawn" | "dash" | "explode" | "data" | "evac" | "repair" | "radio";
  /** radio line id (type "radio") */
  line?: string;
  x: number;
  y: number;
  by?: string;
  r?: number;
}

export interface Truck extends Actor {
  heading: number;
  wp: number; // next path index
  waiting: boolean;
  /** seconds the engine is dead (C03 breakdown), 0 = running */
  stall: number;
}

export interface MissionState {
  id: MissionId;
  map: CampaignMap;
  time: number;
  phase: "playing" | "won" | "lost";
  lostReason: "player" | "convoy" | null;
  player: Bike;
  enemies: Enemy[];
  warnings: SpawnWarning[];
  projectiles: Projectile[];
  /** The one cargo (parcel / core). `exists: false` in the convoy mission. */
  cargo: { x: number; y: number; carried: boolean; exists: boolean };
  pickupHold: number;
  deliverHold: number;
  wave: number;
  /** Mission script stage, see objective(). */
  stage: string;
  route: "north" | "south" | null; // C02
  truck: Truck | null; // C03
  terminal: { x: number; y: number; hold: number; done: boolean } | null; // C04
  evac: { rect: Rect; open: boolean; timer: number | null } | null; // C04
  boss: Boss | null; // C05
  /** C01/C02: the station takes the cargo only when its approaches are clear. */
  goalLocked: boolean;
  /** C02 south: sandstorm (short sight for everyone). C04 after the data: blackout. */
  storm: boolean;
  dark: boolean;
  /** radio lines already said this attempt (each once) */
  said: string[];
  damageTaken: number;
  usedKits: number;
  kits: { x: number; y: number; ready: boolean; left: number }[];
  events: MissionEvent[];
  kills: number;
  nextId: number;
  random: () => number;
  difficulty: Difficulty;
  /** delivery runs (C01/C02): run 1 = there, 2 = the return parcel back to the depot, 3 = there again */
  leg: number;
  legs: number;
  /** mission time the current run started (raiders hold fire for a moment after a hand-over) */
  legAt: number;
}

/** Runs per mission: a contract is several trips, not one sprint (spec: 3–5 min per mission). */
export const LEGS: Record<MissionId, number> = { C01: 3, C02: 2, C03: 1, C04: 1, C05: 1 };

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];
/** enemy damage and enemy HP multipliers */
export const DIFF: Record<Difficulty, { dmg: number; hp: number }> = {
  easy: { dmg: 0.55, hp: 0.75 },
  normal: { dmg: 1, hp: 1 },
  hard: { dmg: 1.25, hp: 1.2 },
};

function tough<T extends Actor>(s: MissionState, e: T): T {
  e.hp = e.maxHp = Math.round(e.maxHp * DIFF[s.difficulty].hp);
  return e;
}

export const TRUCK = { hp: 460, r: 28, speed: 75, escortRadius: 300 };
export const KIT = { heal: 25, every: 20, radius: 22 };
export const C04_HOLD_OUT = 50;
const TERMINAL_HOLD = 1;

function c01Map(): CampaignMap {
  return { ...C01_MAP, goal: C01_MAP.station, cargo: C01_MAP.cargo, turrets: [] };
}

const MAPS: Record<MissionId, () => CampaignMap> = {
  C01: c01Map,
  C02: () => C02_MAP,
  C03: () => C03_MAP,
  C04: () => C04_MAP,
  C05: () => C05_MAP,
};

export function createMission(weapon: WeaponId, seed = 1, id: MissionId = "C01", difficulty: Difficulty = "normal"): MissionState {
  const map = MAPS[id]();
  const random = rng(seed);
  const s: MissionState = {
    id,
    map,
    time: 0,
    phase: "playing",
    lostReason: null,
    player: makeBike("player", 0, map.start.x, map.start.y, weapon),
    enemies: [],
    warnings: [],
    projectiles: [],
    cargo: map.cargo ? { x: map.cargo.x, y: map.cargo.y, carried: false, exists: true } : { x: map.start.x, y: map.start.y, carried: id === "C05", exists: id === "C05" },
    pickupHold: 0,
    deliverHold: 0,
    wave: 0,
    stage: "start",
    route: null,
    truck: null,
    terminal: null,
    evac: null,
    boss: null,
    goalLocked: false,
    storm: false,
    dark: false,
    said: [],
    damageTaken: 0,
    usedKits: 0,
    kits: (map.kits ?? []).map((k) => ({ ...k, ready: true, left: 0 })),
    events: [],
    kills: 0,
    nextId: 1,
    random,
    difficulty,
    leg: 1,
    legs: LEGS[id],
    legAt: 0,
  };
  for (const t of map.turrets) s.enemies.push(tough(s, makeTurret(`t${s.nextId++}`, t.x, t.y)));
  if (id === "C03") {
    const p0 = C03_MAP.path[0]!;
    s.truck = { id: "truck", team: 0, x: p0.x, y: p0.y, r: TRUCK.r, hp: TRUCK.hp, maxHp: TRUCK.hp, alive: true, shield: 0, heading: 0, wp: 1, waiting: true, stall: 0 };
    s.stage = "escort";
    spawn(s, [
      { x: 900, y: 200, kind: "drone" },
      { x: 900, y: 800, kind: "drone" },
    ]);
  }
  if (id === "C04") {
    s.terminal = { ...C04_MAP.terminal, hold: 0, done: false };
    s.evac = { rect: C04_MAP.evac, open: false, timer: null };
    s.stage = "data";
  }
  if (id === "C05") {
    s.player.carrying = true;
    s.stage = "chase";
    spawn(s, C05_MAP.chase);
  }
  radio(s, "start");
  return s;
}

export const STORM_VISION = 300;
export const STALL_TIME = 20;
/** Par times for the 2nd star (seconds), tuned for a human, not the autopilot. */
export const PAR: Record<MissionId, number> = { C01: 300, C02: 270, C03: 240, C04: 180, C05: 210 };

/** A dispatcher line, said once per attempt. Texts live in the UI (i18n RADIO). */
export function radio(s: MissionState, line: string): void {
  const key = `${s.id}.${line}`;
  if (s.said.includes(key)) return;
  s.said.push(key);
  s.events.push({ type: "radio", x: 0, y: 0, line: key });
}

/** 1 = delivered, 2 = within par time, 3 = finished with ≥ 50 HP. */
export function stars(s: MissionState): number {
  if (s.phase !== "won") return 0;
  return 1 + (s.time <= PAR[s.id] ? 1 : 0) + (s.player.hp >= 50 ? 1 : 0);
}

type Text = { ru: string; en: string };
const goalCenter = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function objective(s: MissionState): { text: Text; target: { x: number; y: number } | null } {
  const take = { ru: "Возьми груз: подъедь и держи E", en: "Take the cargo: get close and hold E" };
  if (s.id === "C03") {
    const t = s.truck!;
    const far = Math.hypot(t.x - s.player.x, t.y - s.player.y) > TRUCK.escortRadius;
    return far
      ? { text: { ru: "Вернись к конвою — без тебя он стоит", en: "Get back to the convoy — it waits for you" }, target: t }
      : { text: { ru: "Сопровождай конвой до терминала, защищай грузовик", en: "Escort the convoy to the terminal, protect the truck" }, target: C03_MAP.path[t.wp] ?? t };
  }
  if (s.id === "C04") {
    if (!s.terminal!.done) return { text: { ru: "Скачай навигационные данные: держи E у терминала", en: "Download the nav data: hold E at the terminal" }, target: s.terminal! };
    if (!s.cargo.carried && !s.evac!.open && s.evac!.timer === null) return { text: { ru: "Забери энергоядро в центре станции", en: "Take the energy core in the middle of the station" }, target: s.cargo };
    if (!s.cargo.carried) return { text: take, target: s.cargo };
    if (!s.evac!.open)
      return { text: { ru: `Продержись до эвакуации: ${Math.ceil(s.evac!.timer ?? 0)} с`, en: `Hold out until evacuation: ${Math.ceil(s.evac!.timer ?? 0)} s` }, target: null };
    return { text: { ru: "Эвакуация открыта — заезжай в зону с ядром", en: "Evacuation is open — drive into the zone with the core" }, target: goalCenter(s.evac!.rect) };
  }
  if (s.id === "C05" && s.stage === "chase") return { text: { ru: "Прорвись по коридору на восток", en: "Break through the corridor to the east" }, target: { x: C05_MAP.arenaTrigger + 150, y: 550 } };
  if (s.id === "C05" && s.stage === "boss") return { text: { ru: "Уничтожь перехватчик. Следи за линиями атаки", en: "Destroy the interceptor. Watch the attack lines" }, target: s.boss };
  if (!s.cargo.carried) return { text: take, target: s.cargo };
  const goal = s.map.goal!;
  const run = s.legs > 1 ? ` (${s.leg}/${s.legs})` : "";
  if (s.goalLocked && (s.id === "C01" ? s.wave >= 2 : s.route !== null)) {
    const foe = s.enemies.find((e) => e.kind !== "turret");
    return { text: { ru: "Станция закрыта, пока рядом враги — зачисти подходы", en: "The station stays shut while raiders are near — clear the approach" }, target: foe ?? goalCenter(goal) };
  }
  if (s.id === "C02" && !s.route)
    return { text: { ru: "Выбери путь: короткий север под турелями или длинный юг", en: "Choose: the short north past turrets or the long south" }, target: goalCenter(goal) };
  if (s.leg % 2 === 0) return { text: { ru: `Обратный груз — вези на склад и держи E${run}`, en: `Return parcel — take it to the depot and hold E${run}` }, target: goalCenter(goal) };
  return { text: { ru: `Довези груз в зону доставки и держи E${run}`, en: `Deliver the cargo into the zone and hold E${run}` }, target: goalCenter(goal) };
}

/** Even runs go back west: points and rects mirror across the map width. */
const mirrorX = (s: MissionState, x: number) => (s.leg % 2 === 0 ? s.map.w - x : x);
const mirrorRect = (s: MissionState, r: Rect): Rect => (s.leg % 2 === 0 ? { ...r, x: s.map.w - r.x - r.w } : r);
/** Repeat runs are shorter fights: half of each wave (the courier already fought through once). */
const lighter = (s: MissionState, list: Spawn[]): Spawn[] => (s.leg > 1 ? list.slice(0, Math.ceil(list.length / 2)) : list);
const mirrorSpawns = (s: MissionState, list: Spawn[]): Spawn[] => list.map((p) => ({ ...p, x: mirrorX(s, p.x) }));

/** A delivery that isn't the last run hands over the next parcel at once and turns the route around. */
function nextLeg(s: MissionState): void {
  s.leg += 1;
  s.legAt = s.time;
  s.wave = 0;
  s.route = null;
  s.storm = false;
  s.deliverHold = 0;
  // the receiving end patches the bike up and reloads it before the next run
  s.player.hp = s.player.maxHp;
  s.player.mag = WEAPONS[s.player.weapon].magazine;
  s.player.reloadLeft = 0;
  const depot: Rect = { x: s.map.start.x - 80, y: s.map.start.y - 80, w: 160, h: 160 };
  const station = MAPS[s.id]().goal!;
  s.map = { ...s.map, goal: s.leg % 2 === 0 ? depot : station };
  s.events.push({ type: "deliver", x: s.player.x, y: s.player.y });
  radio(s, `leg${s.leg}`);
}

function spawn(s: MissionState, list: Spawn[]): void {
  for (const p of list) {
    // Never closer than 180 to the player (G03); a too-close point is pushed away along the line.
    let x = p.x;
    let y = p.y;
    const d = Math.sqrt(dist2(x, y, s.player.x, s.player.y));
    if (d < ENEMY.minSpawnDistance) {
      const k = (ENEMY.minSpawnDistance + 20) / Math.max(d, 1);
      const f = freePoint(s.player.x + (x - s.player.x) * k, s.player.y + (y - s.player.y) * k, ENEMY.raiderRadius, s.map);
      x = f.x;
      y = f.y;
    }
    const free = freePoint(x, y, ENEMY.raiderRadius, s.map);
    s.warnings.push({ x: free.x, y: free.y, left: ENEMY.spawnWarning, kind: p.kind });
  }
}

function c01Wave(i: number): Spawn[] {
  return (C01_MAP.waveSpawns[i] ?? []).map((p) => ({ ...p, kind: "raider" as const }));
}

function damageActor(s: MissionState, t: Actor, amount: number, by: string, hurt: Set<string>): void {
  if (!t.alive || t.shield > 0) return;
  t.hp = Math.max(0, t.hp - amount);
  s.events.push({ type: "hit", x: t.x, y: t.y, by });
  hurt.add(t.id);
  if (t.hp <= 0) {
    t.alive = false;
    s.events.push({ type: "death", x: t.x, y: t.y });
    if (t.team === 9) s.kills += 1;
  }
}

export function stepMission(s: MissionState, input: BikeInput): void {
  s.events = [];
  if (s.phase !== "playing") return;
  s.time += DT;
  const p = s.player;
  const dashReady = p.dashCd <= 0;
  p.carrying = s.cargo.exists && s.cargo.carried;

  const shots = stepBike(p, input, DT, s.map, () => s.nextId++, s.random);
  if (shots.length) s.events.push({ type: "shot", x: p.x, y: p.y, by: p.id });
  if (input.dash && dashReady && p.dashLeft > 0) s.events.push({ type: "dash", x: p.x, y: p.y });
  s.projectiles.push(...shots);

  // warnings become enemies
  for (const w of s.warnings) w.left -= DT;
  for (const w of s.warnings.filter((w) => w.left <= 0)) {
    const id = `e${s.nextId++}`;
    s.enemies.push(tough(s, w.kind === "drone" ? makeDrone(id, w.x, w.y) : makeRaider(id, w.x, w.y, s.random)));
    s.events.push({ type: "spawn", x: w.x, y: w.y });
  }
  s.warnings = s.warnings.filter((w) => w.left > 0);

  // enemies (they hunt the courier, and the truck in the convoy mission)
  const hurt = new Set<string>();
  const friendly: Actor[] = s.truck ? [p, s.truck] : [p];
  const ctx = {
    arena: s.map,
    time: s.time,
    fireFrom: s.id === "C01" && s.leg === 1 ? MISSION.quietStart : s.leg > 1 ? s.legAt + 6 : 0,
    ...(s.storm ? { vision: STORM_VISION } : {}),
    random: s.random,
    nextId: () => s.nextId++,
    projectiles: s.projectiles,
    shot: (x: number, y: number, by: string) => s.events.push({ type: "shot", x, y, by }),
    contact: (t: Actor, amount: number, by: string) => damageActor(s, t, amount * DIFF[s.difficulty].dmg, by, hurt),
  };
  for (const e of s.enemies) if (e.alive) stepEnemy(ctx, e, friendly);
  for (const pr of s.projectiles)
    if (pr.team === 9 && !pr.scaled) {
      pr.damage *= DIFF[s.difficulty].dmg;
      pr.scaled = true;
    }

  // projectiles
  const targets: Actor[] = [...friendly, ...s.enemies];
  const res = stepProjectiles(s.projectiles, targets, s.map, DT);
  s.projectiles = res.alive;
  for (const i of res.impacts) s.events.push({ type: "impact", x: i.x, y: i.y });
  for (const x of res.explosions) s.events.push({ type: "explode", x: x.x, y: x.y, r: x.r });
  for (const d of res.damage) {
    const t = targets.find((a) => a.id === d.targetId);
    if (!t) continue;
    s.events.push({ type: "hit", x: t.x, y: t.y, by: d.sourceId });
    hurt.add(t.id);
    if (d.lethal && t.alive) {
      t.alive = false;
      s.events.push({ type: "death", x: t.x, y: t.y });
      if (t.team === 9) s.kills += 1;
    }
  }
  s.enemies = s.enemies.filter((e) => e.alive);
  if (s.boss && !s.boss.alive) s.boss = null;

  if (!p.alive) {
    s.phase = "lost";
    s.lostReason = "player";
    return;
  }
  if (s.truck && !s.truck.alive) {
    s.phase = "lost";
    s.lostReason = "convoy";
    return;
  }

  const playerHurt = hurt.has(p.id);
  if (playerHurt) {
    if (p.hp < 35) radio(s, "lowhp");
  }
  if (playerHurt) {
    s.pickupHold = 0;
    s.deliverHold = 0;
    if (s.terminal) s.terminal.hold = 0;
  }
  for (const k of s.kits) {
    if (!k.ready) {
      k.left -= DT;
      if (k.left <= 0) k.ready = true;
    } else if (p.hp < p.maxHp && Math.hypot(p.x - k.x, p.y - k.y) <= KIT.radius + p.r) {
      p.hp = Math.min(p.maxHp, p.hp + KIT.heal);
      s.usedKits += 1;
      k.ready = false;
      k.left = KIT.every;
      s.events.push({ type: "repair" as MissionEvent["type"], x: k.x, y: k.y });
    }
  }
  if (s.id === "C01" || s.id === "C02") {
    const allWaves = s.id === "C01" ? s.wave >= 2 : s.route === "north" || s.wave >= 2;
    const hostile = s.enemies.some((e) => e.kind !== "turret") || s.warnings.length > 0;
    s.goalLocked = !allWaves || hostile;
  }
  stepCargo(s, input, playerHurt);
  if (s.phase !== "playing") return;
  SCRIPTS[s.id](s, input, playerHurt);
}

/** Pick up (hold 0.5 s within 48), drop (Q), deliver (hold 1.5 s in the goal). Damage cancels holds. */
function stepCargo(s: MissionState, input: BikeInput, playerHurt: boolean): void {
  const p = s.player;
  if (!s.cargo.exists) return;
  if (s.cargo.carried) {
    s.cargo.x = p.x;
    s.cargo.y = p.y;
    if (input.drop) {
      const f = freePoint(p.x + Math.cos(p.aim) * 30, p.y + Math.sin(p.aim) * 30, CARGO.radius, s.map);
      s.cargo = { x: f.x, y: f.y, carried: false, exists: true };
      p.carrying = false;
      s.deliverHold = 0;
      s.events.push({ type: "drop", x: f.x, y: f.y });
      return;
    }
    const goal = s.map.goal;
    const canDeliver = goal && !s.goalLocked && s.id !== "C04" && !(s.id === "C05" && s.stage !== "deliver");
    if (canDeliver && input.interact && !playerHurt && circleHitsRect(p.x, p.y, 1, goal)) {
      s.deliverHold += DT;
      if (s.deliverHold >= CARGO.deliverHold) {
        if (s.leg < s.legs) nextLeg(s);
        else {
          s.phase = "won";
          s.events.push({ type: "deliver", x: p.x, y: p.y });
        }
      }
    } else s.deliverHold = 0;
    return;
  }
  // C04: the core can be taken only after the data
  if (s.id === "C04" && !s.terminal!.done) return;
  const near = dist2(p.x, p.y, s.cargo.x, s.cargo.y) <= CARGO.pickupRange ** 2;
  if (input.interact && near && !playerHurt) {
    s.pickupHold += DT;
    if (s.pickupHold >= CARGO.pickupHold) {
      s.cargo.carried = true;
      s.pickupHold = 0;
      p.carrying = true;
      s.events.push({ type: "pickup", x: p.x, y: p.y });
      radio(s, "pickup");
    }
  } else s.pickupHold = 0;
}

const SCRIPTS: Record<MissionId, (s: MissionState, input: BikeInput, hurt: boolean) => void> = {
  // Waves: the first when the parcel is taken (or the courier drives off without it), the second
  // past the middle of the road. Raiders hold fire for the first 20 s regardless.
  C01: (s) => {
    const fx = mirrorX(s, s.player.x);
    if (s.wave === 0 && (s.cargo.carried || fx > 900)) {
      s.wave = 1;
      spawn(s, mirrorSpawns(s, lighter(s, c01Wave(0))));
      // the first run: two raiders come from the depot behind the courier
      if (s.leg === 1)
        spawn(s, [
          { x: 120, y: 160, kind: "raider" },
          { x: 120, y: 960, kind: "raider" },
        ]);
      // the third run brings drones
      if (s.leg === 3) spawn(s, mirrorSpawns(s, [{ x: 1300, y: 150, kind: "drone" }]));
      radio(s, "behind");
    } else if (s.wave === 1 && fx > 1550) {
      s.wave = 2;
      spawn(s, mirrorSpawns(s, lighter(s, c01Wave(1))));
      radio(s, "wave2");
    }
    if (s.goalLocked && s.wave >= 2 && s.cargo.carried && fx > 2100) radio(s, "locked");
  },
  // The first lane the courier enters is the route of this attempt.
  C02: (s) => {
    const p = s.player;
    if (!s.route) {
      if (circleHitsRect(p.x, p.y, 1, mirrorRect(s, C02_MAP.northTrigger))) {
        s.route = "north";
        spawn(s, mirrorSpawns(s, C02_MAP.northWave));
        radio(s, "north");
      } else if (circleHitsRect(p.x, p.y, 1, mirrorRect(s, C02_MAP.southTrigger))) {
        s.route = "south";
        spawn(s, mirrorSpawns(s, C02_MAP.southWaves[0]!));
        s.wave = 1;
        s.storm = true;
        radio(s, "storm");
      }
    } else if (s.route === "south" && s.wave === 1 && mirrorX(s, p.x) > 1700) {
      s.wave = 2;
      spawn(s, mirrorSpawns(s, C02_MAP.southWaves[1]!));
    }
  },
  // The truck moves only while the courier is within 300; it never runs away from the objective.
  C03: (s) => {
    const t = s.truck!;
    const near = Math.hypot(t.x - s.player.x, t.y - s.player.y) <= TRUCK.escortRadius;
    t.waiting = !near;
    const target = C03_MAP.path[t.wp];
    if (!target) return;
    if (t.hp < t.maxHp * 0.5) radio(s, "truckhurt");
    if (t.stall > 0) {
      t.stall -= DT;
      if (t.stall <= 0) {
        radio(s, "restart");
        spawn(s, C03_MAP.ambush[C03_MAP.ambush.length - 1] ?? []);
      }
      return;
    }
    if (near) {
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      const d = Math.hypot(dx, dy);
      const step = TRUCK.speed * DT;
      if (d <= step) {
        t.x = target.x;
        t.y = target.y;
        const ci = C03_MAP.checkpoints.indexOf(t.wp);
        if (ci >= 0) spawn(s, C03_MAP.ambush[ci] ?? []);
        if (t.wp === 2) {
          t.stall = STALL_TIME;
          spawn(s, [{ x: 1700, y: 200, kind: "drone" }]);
          radio(s, "stall");
        }
        t.wp += 1;
        if (t.wp >= C03_MAP.path.length) {
          s.phase = "won";
          s.events.push({ type: "deliver", x: t.x, y: t.y });
        }
      } else {
        t.x += (dx / d) * step;
        t.y += (dy / d) * step;
        t.heading = Math.atan2(dy, dx);
      }
    }
  },
  // Data first; the first core pickup after the data starts the 30 s countdown ONCE; dropping and
  // re-taking never restarts it; when it ends the evacuation stays open until delivery or death.
  C04: (s, input, hurt) => {
    const p = s.player;
    const term = s.terminal!;
    const ev = s.evac!;
    if (!term.done) {
      if (input.interact && !hurt && Math.hypot(p.x - term.x, p.y - term.y) < 52) {
        term.hold += DT;
        if (term.hold >= TERMINAL_HOLD) {
          term.done = true;
          s.stage = "core";
          s.dark = true;
          radio(s, "blackout");
          s.events.push({ type: "data", x: term.x, y: term.y });
        }
      } else term.hold = 0;
      return;
    }
    if (ev.timer === null && s.cargo.carried) {
      ev.timer = C04_HOLD_OUT;
      s.stage = "holdout";
      spawn(s, C04_MAP.waveSpots.slice(0, 2));
    }
    if (ev.timer !== null && !ev.open) {
      const before = ev.timer;
      ev.timer -= DT;
      // reinforcements every 12 s while holding out
      if (Math.floor(before / 12) !== Math.floor(ev.timer / 12)) spawn(s, [C04_MAP.waveSpots[(s.wave++ % 2) + 2]!]);
      if (ev.timer <= 0) {
        ev.timer = 0;
        ev.open = true;
        s.stage = "evac";
        radio(s, "evac");
        s.events.push({ type: "evac", x: ev.rect.x + ev.rect.w / 2, y: ev.rect.y + ev.rect.h / 2 });
      }
    }
    if (ev.open && s.cargo.carried && circleHitsRect(p.x, p.y, 1, ev.rect)) {
      s.phase = "won";
      s.events.push({ type: "deliver", x: p.x, y: p.y });
    }
  },
  // Chase → the interceptor → only then the final delivery.
  C05: (s) => {
    if (s.stage === "chase" && s.player.x > C05_MAP.arenaTrigger) {
      s.stage = "boss";
      s.boss = tough(s, makeBoss("boss", C05_MAP.bossSpawn.x, C05_MAP.bossSpawn.y));
      radio(s, "boss");
      s.enemies.push(s.boss);
      s.events.push({ type: "spawn", x: s.boss.x, y: s.boss.y });
    } else if (s.stage === "boss" && s.boss && s.boss.hp <= s.boss.maxHp / 2 && !s.said.includes("C05.enraged")) {
      radio(s, "enraged");
      spawn(s, [
        { x: s.boss.x, y: 150, kind: "drone" },
        { x: s.boss.x, y: 950, kind: "drone" },
      ]);
    } else if (s.stage === "boss" && !s.boss) {
      s.stage = "deliver";
      radio(s, "bossdown");
      // the interceptor's escort wants the cargo back
      spawn(s, C05_MAP.chase.slice(0, 4).map((p) => ({ ...p, x: Math.min(s.map.w - 120, p.x + 900) })));
    }
  },
};
