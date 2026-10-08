// Shared combat for the campaign and PvP: bikes, weapons, dash, projectiles, walls. Pure and
// deterministic — no Phaser, no clocks, no Math.random — so the PvP host and the tests run it alike.
import { BIKE, WEAPONS, type WeaponId } from "./config";
import {
  normalizeMove,
  resolveCircleRect,
  segmentCircleT,
  segmentRectT,
  type Rect,
} from "./geom";

export interface BikeInput {
  moveX: number;
  moveY: number;
  aim: number; // radians
  fire: boolean;
  dash: boolean; // edge: true only on the tick it was pressed
  interact: boolean; // held
  drop: boolean; // edge
  reload: boolean; // edge
}

export const NO_INPUT: BikeInput = {
  moveX: 0,
  moveY: 0,
  aim: 0,
  fire: false,
  dash: false,
  interact: false,
  drop: false,
  reload: false,
};

export interface Actor {
  id: string;
  team: number;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Seconds of spawn protection left (PvP). Damage is ignored while > 0. */
  shield: number;
}

export interface Bike extends Actor {
  kind: "bike";
  aim: number;
  heading: number;
  weapon: WeaponId;
  mag: number;
  reloadLeft: number;
  fireCd: number;
  dashLeft: number;
  dashCd: number;
  dashX: number;
  dashY: number;
  carrying: boolean;
  /** Shots this bike fired during the current tick (PvP: firing ends spawn protection). */
  firedThisTick: boolean;
}

export interface Projectile {
  id: number;
  owner: string;
  team: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  damage: number;
  kind: "bullet" | "pellet" | "enemy" | "laser" | "rocket";
  /** Explosion radius on impact or at the end of its flight (rockets). */
  splash?: number;
  /** damage already scaled by the mission difficulty */
  scaled?: true;
}

export interface DamageEvent {
  targetId: string;
  sourceId: string;
  amount: number;
  lethal: boolean;
}

export interface Arena {
  w: number;
  h: number;
  walls: Rect[];
}

export function makeBike(id: string, team: number, x: number, y: number, weapon: WeaponId): Bike {
  return {
    kind: "bike",
    id,
    team,
    x,
    y,
    r: BIKE.radius,
    hp: BIKE.hp,
    maxHp: BIKE.hp,
    alive: true,
    shield: 0,
    aim: 0,
    heading: 0,
    weapon,
    mag: WEAPONS[weapon].magazine,
    reloadLeft: 0,
    fireCd: 0,
    dashLeft: 0,
    dashCd: 0,
    dashX: 0,
    dashY: 0,
    carrying: false,
    firedThisTick: false,
  };
}

/** Move a circle by (dx,dy) in substeps so it cannot tunnel through a wall, then keep it inside. */
export function moveCircle(a: { x: number; y: number }, r: number, dx: number, dy: number, arena: Arena): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
  for (let i = 0; i < steps; i++) {
    a.x += dx / steps;
    a.y += dy / steps;
    for (const w of arena.walls) resolveCircleRect(a, r, w);
    a.x = Math.min(Math.max(a.x, r), arena.w - r);
    a.y = Math.min(Math.max(a.y, r), arena.h - r);
  }
}

/** Movement, dash and weapon timers for one bike. Returns new projectiles (not yet in the world). */
export function stepBike(
  b: Bike,
  input: BikeInput,
  dt: number,
  arena: Arena,
  nextProjectileId: () => number,
  random: () => number,
): Projectile[] {
  b.firedThisTick = false;
  if (!b.alive) return [];
  const slow = b.carrying ? BIKE.cargoSlow : 1;
  const move = normalizeMove(input.moveX, input.moveY);
  b.aim = input.aim;

  b.dashCd = Math.max(0, b.dashCd - dt);
  if (input.dash && b.dashCd <= 0 && b.dashLeft <= 0) {
    const dir = move.x !== 0 || move.y !== 0 ? normalizeMove(move.x * 1e3, move.y * 1e3) : { x: Math.cos(b.aim), y: Math.sin(b.aim) };
    b.dashX = dir.x;
    b.dashY = dir.y;
    b.dashLeft = BIKE.dashTime;
    b.dashCd = BIKE.dashCooldown;
  }

  let vx: number;
  let vy: number;
  if (b.dashLeft > 0) {
    const t = Math.min(dt, b.dashLeft);
    b.dashLeft -= dt;
    // Dash speed for the dashed part of the tick, normal speed for the rest.
    const dashPart = BIKE.dashSpeed * slow * t;
    const rest = BIKE.speed * slow * (dt - t);
    vx = (b.dashX * dashPart + move.x * rest) / dt;
    vy = (b.dashY * dashPart + move.y * rest) / dt;
  } else {
    vx = move.x * BIKE.speed * slow;
    vy = move.y * BIKE.speed * slow;
  }
  if (vx !== 0 || vy !== 0) b.heading = Math.atan2(vy, vx);
  moveCircle(b, b.r, vx * dt, vy * dt, arena);

  return stepWeapon(b, input, dt, nextProjectileId, random);
}

function stepWeapon(
  b: Bike,
  input: BikeInput,
  dt: number,
  nextId: () => number,
  random: () => number,
): Projectile[] {
  const spec = WEAPONS[b.weapon];
  // The cooldown keeps its remainder while the trigger is held, so 8 shots/s stay 8/s at 30 Hz.
  b.fireCd -= dt;
  if (!input.fire || b.reloadLeft > 0) b.fireCd = Math.max(0, b.fireCd);
  if (b.reloadLeft > 0) {
    b.reloadLeft -= dt;
    if (b.reloadLeft <= 0) {
      b.reloadLeft = 0;
      b.mag = spec.magazine;
    }
  }
  if (input.reload && b.reloadLeft <= 0 && b.mag < spec.magazine) {
    b.reloadLeft = spec.reload;
  }
  const out: Projectile[] = [];
  if (input.fire && b.fireCd <= 0 && b.mag > 0 && b.reloadLeft <= 0) {
    b.mag -= 1;
    b.fireCd = Math.max(b.fireCd + spec.interval, 0);
    b.firedThisTick = true;
    for (let i = 0; i < spec.pellets; i++) {
      const offset =
        spec.pellets > 1
          ? -spec.spread / 2 + (spec.spread * i) / (spec.pellets - 1) + (random() - 0.5) * 0.05
          : (random() - 0.5) * spec.spread;
      const a = b.aim + offset;
      const muzzle = b.r + 4;
      out.push({
        id: nextId(),
        owner: b.id,
        team: b.team,
        x: b.x + Math.cos(b.aim) * muzzle,
        y: b.y + Math.sin(b.aim) * muzzle,
        vx: Math.cos(a) * spec.bulletSpeed,
        vy: Math.sin(a) * spec.bulletSpeed,
        ttl: spec.ttl,
        damage: spec.damage,
        kind: spec.id === "laser" ? "laser" : spec.id === "rocket" ? "rocket" : spec.pellets > 1 ? "pellet" : "bullet",
        ...(spec.splash ? { splash: spec.splash } : {}),
      });
    }
    if (b.mag === 0) b.reloadLeft = spec.reload;
  }
  return out;
}

/**
 * Advance projectiles one tick. The path of the tick is swept against walls and targets: the
 * nearest contact wins, a projectile hits at most once, then it is gone (G02).
 */
/** Rockets are the anti-armour weapon: ×1.6 against the boss and turrets (missions only). */
export const ROCKET_HEAVY_BONUS = 1.6;

export function stepProjectiles(
  projectiles: Projectile[],
  targets: Actor[],
  arena: Arena,
  dt: number,
): { alive: Projectile[]; damage: DamageEvent[]; impacts: { x: number; y: number }[]; explosions: { x: number; y: number; r: number }[] } {
  const alive: Projectile[] = [];
  const damage: DamageEvent[] = [];
  const impacts: { x: number; y: number }[] = [];
  const explosions: { x: number; y: number; r: number }[] = [];
  const hurt = (a: Actor, p: Projectile) => {
    if (a.shield > 0 || !a.alive) return;
    const kind = (a as { kind?: string }).kind;
    const amount = p.kind === "rocket" && (kind === "boss" || kind === "turret") ? p.damage * ROCKET_HEAVY_BONUS : p.damage;
    a.hp = Math.max(0, a.hp - amount);
    damage.push({ targetId: a.id, sourceId: p.owner, amount, lethal: a.hp <= 0 });
  };
  // One explosion damages every enemy actor in range exactly once (G02).
  const explode = (p: Projectile, x: number, y: number) => {
    const r = p.splash ?? 0;
    explosions.push({ x, y, r });
    for (const a of targets) if (a.alive && a.team !== p.team && Math.hypot(a.x - x, a.y - y) <= r + a.r) hurt(a, p);
  };
  for (const p of projectiles) {
    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    let bestT = 2;
    let hit: Actor | null = null;
    for (const w of arena.walls) {
      const t = segmentRectT(p.x, p.y, nx, ny, w);
      if (t !== null && t < bestT) {
        bestT = t;
        hit = null;
      }
    }
    for (const a of targets) {
      if (!a.alive || a.team === p.team) continue;
      const t = segmentCircleT(p.x, p.y, nx, ny, a.x, a.y, a.r);
      if (t !== null && t < bestT) {
        bestT = t;
        hit = a;
      }
    }
    if (bestT <= 1) {
      const ix = p.x + (nx - p.x) * bestT;
      const iy = p.y + (ny - p.y) * bestT;
      impacts.push({ x: ix, y: iy });
      if (p.splash) explode(p, ix, iy);
      else if (hit) hurt(hit, p);
      continue;
    }
    p.x = nx;
    p.y = ny;
    p.ttl -= dt;
    if (p.ttl > 0 && nx >= 0 && ny >= 0 && nx <= arena.w && ny <= arena.h) alive.push(p);
    else if (p.splash) explode(p, Math.min(Math.max(nx, 0), arena.w), Math.min(Math.max(ny, 0), arena.h));
  }
  return { alive, damage, impacts, explosions };
}

/** Line of sight between two points (walls are opaque). */
export function hasLineOfSight(ax: number, ay: number, bx: number, by: number, arena: Arena): boolean {
  for (const w of arena.walls) if (segmentRectT(ax, ay, bx, by, w) !== null) return false;
  return true;
}

/** Nearest free point to (x,y) for dropped cargo: never inside a wall or outside the arena. */
export function freePoint(x: number, y: number, r: number, arena: Arena): { x: number; y: number } {
  const p = { x, y };
  for (let i = 0; i < 4; i++) {
    for (const w of arena.walls) resolveCircleRect(p, r + 2, w);
    p.x = Math.min(Math.max(p.x, r + 2), arena.w - r - 2);
    p.y = Math.min(Math.max(p.y, r + 2), arena.h - r - 2);
  }
  return p;
}
