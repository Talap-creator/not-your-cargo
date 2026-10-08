// Campaign enemies (G03). Every attack is telegraphed: turrets show the line of the coming burst,
// drones show their ram line, the boss shows the rocket fan / charge before it happens.
import { DT, ENEMY } from "./config";
import { hasLineOfSight, moveCircle, type Actor, type Arena, type Projectile } from "./combat";

export const TURRET = { hp: 60, r: 18, range: 460, telegraph: 0.8, shots: 3, gap: 0.12, cooldown: 2.2, damage: 6, speed: 520 };
export const DRONE = { hp: 24, r: 12, speed: 190, keep: 210, telegraph: 0.6, dashSpeed: 650, dashTime: 0.35, contact: 12, cooldown: 2 };
export const BOSS = { hp: 480, r: 40, speed: 120, pause: 1.6, pauseEnraged: 0.9, fanTele: 0.8, rockets: 5, fanSpread: 0.9, rocketDamage: 14, rocketSplash: 45, rocketSpeed: 340, ramTele: 0.9, ramSpeed: 700, ramTime: 0.6, contact: 20 };

export interface Raider extends Actor {
  kind: "raider";
  aim: number;
  burstLeft: number;
  burstGap: number;
  cooldown: number;
  strafe: number;
}
export interface Turret extends Actor {
  kind: "turret";
  aim: number;
  tele: number; // > 0: aiming, the line is shown
  burstLeft: number;
  burstGap: number;
  cooldown: number;
}
export interface Drone extends Actor {
  kind: "drone";
  aim: number;
  state: "approach" | "tele" | "dash" | "rest";
  t: number;
  hitDone: boolean;
}
export interface Boss extends Actor {
  kind: "boss";
  aim: number;
  state: "pause" | "fanTele" | "ramTele" | "ram";
  t: number;
  next: "fan" | "ram";
  hitDone: boolean;
}
export type Enemy = Raider | Turret | Drone | Boss;

export interface EnemyCtx {
  arena: Arena;
  time: number;
  /** Earliest time enemies may shoot (C01: the first 20 s are quiet). */
  fireFrom: number;
  random: () => number;
  nextId: () => number;
  projectiles: Projectile[];
  shot: (x: number, y: number, by: string) => void;
  /** Contact damage (drone/boss ram) to a target. */
  contact: (target: Actor, amount: number, by: string) => void;
  /** Weather: enemies cannot see/shoot beyond this (C02 sandstorm). */
  vision?: number;
}

export function makeRaider(id: string, x: number, y: number, random: () => number): Raider {
  const r = ENEMY.raiderRadius;
  return { kind: "raider", id, team: 9, x, y, r, hp: ENEMY.raiderHp, maxHp: ENEMY.raiderHp, alive: true, shield: 0, aim: 0, burstLeft: 0, burstGap: 0, cooldown: 1 + random(), strafe: random() < 0.5 ? -1 : 1 };
}
export function makeTurret(id: string, x: number, y: number): Turret {
  return { kind: "turret", id, team: 9, x, y, r: TURRET.r, hp: TURRET.hp, maxHp: TURRET.hp, alive: true, shield: 0, aim: Math.PI, tele: 0, burstLeft: 0, burstGap: 0, cooldown: 1 };
}
export function makeDrone(id: string, x: number, y: number): Drone {
  return { kind: "drone", id, team: 9, x, y, r: DRONE.r, hp: DRONE.hp, maxHp: DRONE.hp, alive: true, shield: 0, aim: 0, state: "approach", t: 1, hitDone: false };
}
export function makeBoss(id: string, x: number, y: number): Boss {
  return { kind: "boss", id, team: 9, x, y, r: BOSS.r, hp: BOSS.hp, maxHp: BOSS.hp, alive: true, shield: 0, aim: Math.PI, state: "pause", t: 1.5, next: "fan", hitDone: false };
}

function bullet(c: EnemyCtx, e: Actor, a: number, speed: number, damage: number, extra: Partial<Projectile> = {}): void {
  c.projectiles.push({
    id: c.nextId(),
    owner: e.id,
    team: e.team,
    x: e.x + Math.cos(a) * (e.r + 4),
    y: e.y + Math.sin(a) * (e.r + 4),
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    ttl: 1.4,
    damage,
    kind: "enemy",
    ...extra,
  });
  c.shot(e.x, e.y, e.id);
}

const nearest = (e: Actor, targets: Actor[]): Actor | null => {
  let best: Actor | null = null;
  let bd = Infinity;
  for (const t of targets) {
    if (!t.alive) continue;
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
};

export function stepEnemy(c: EnemyCtx, e: Enemy, targets: Actor[]): void {
  const tgt = nearest(e, targets);
  if (!tgt) return;
  const dx = tgt.x - e.x;
  const dy = tgt.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const sees = hasLineOfSight(e.x, e.y, tgt.x, tgt.y, c.arena);
  const canFire = c.time >= c.fireFrom && d <= (c.vision ?? Infinity);
  switch (e.kind) {
    case "raider": {
      e.aim = Math.atan2(dy, dx);
      const want = d > 260 || !sees ? 1 : d < 170 ? -1 : 0;
      const mx = (dx / d) * want + (-dy / d) * e.strafe * 0.6;
      const my = (dy / d) * want + (dx / d) * e.strafe * 0.6;
      const ml = Math.hypot(mx, my) || 1;
      moveCircle(e, e.r, (mx / ml) * ENEMY.raiderSpeed * DT, (my / ml) * ENEMY.raiderSpeed * DT, c.arena);
      if (c.random() < 0.01) e.strafe = -e.strafe;
      e.cooldown -= DT;
      if (e.burstLeft > 0) {
        e.burstGap -= DT;
        if (e.burstGap <= 0) {
          e.burstLeft -= 1;
          e.burstGap = ENEMY.raiderBurstGap;
          bullet(c, e, e.aim + (c.random() - 0.5) * 0.12, ENEMY.raiderBulletSpeed, ENEMY.raiderDamage);
        }
      } else if (canFire && sees && d < ENEMY.raiderRange && e.cooldown <= 0) {
        e.burstLeft = ENEMY.raiderBurst;
        e.burstGap = 0;
        e.cooldown = ENEMY.raiderCooldown + c.random() * 0.6;
      }
      return;
    }
    case "turret": {
      e.cooldown -= DT;
      if (e.burstLeft > 0) {
        e.burstGap -= DT;
        if (e.burstGap <= 0) {
          e.burstLeft -= 1;
          e.burstGap = TURRET.gap;
          bullet(c, e, e.aim, TURRET.speed, TURRET.damage);
        }
      } else if (e.tele > 0) {
        e.tele -= DT; // the aim is locked while the line shows: sidestep it
        if (e.tele <= 1e-9) {
          e.burstLeft = TURRET.shots;
          e.burstGap = 0;
          e.cooldown = TURRET.cooldown;
        }
      } else {
        if (sees) e.aim = Math.atan2(dy, dx);
        if (canFire && sees && d < TURRET.range && e.cooldown <= 0) e.tele = TURRET.telegraph;
      }
      return;
    }
    case "drone": {
      e.t -= DT;
      if (e.state === "approach") {
        e.aim = Math.atan2(dy, dx);
        const want = d > DRONE.keep ? 1 : -0.5;
        moveCircle(e, e.r, (dx / d) * want * DRONE.speed * DT, (dy / d) * want * DRONE.speed * DT, c.arena);
        if (canFire && sees && d < DRONE.keep + 80 && e.t <= 0) {
          e.state = "tele";
          e.t = DRONE.telegraph;
        }
      } else if (e.state === "tele") {
        if (e.t <= 0) {
          e.state = "dash";
          e.t = DRONE.dashTime;
          e.hitDone = false;
        }
      } else if (e.state === "dash") {
        moveCircle(e, e.r, Math.cos(e.aim) * DRONE.dashSpeed * DT, Math.sin(e.aim) * DRONE.dashSpeed * DT, c.arena);
        for (const t of targets) {
          if (!e.hitDone && t.alive && Math.hypot(t.x - e.x, t.y - e.y) < t.r + e.r) {
            e.hitDone = true; // one ram hits once
            c.contact(t, DRONE.contact, e.id);
          }
        }
        if (e.t <= 0) {
          e.state = "rest";
          e.t = DRONE.cooldown;
        }
      } else if (e.t <= 0) e.state = "approach";
      return;
    }
    case "boss": {
      const enraged = e.hp <= e.maxHp / 2;
      const k = enraged ? 0.75 : 1;
      e.t -= DT;
      if (e.state === "pause") {
        e.aim = Math.atan2(dy, dx);
        const want = d > 300 ? 1 : d < 200 ? -1 : 0;
        moveCircle(e, e.r, (dx / d) * want * BOSS.speed * DT, (dy / d) * want * BOSS.speed * DT, c.arena);
        if (e.t <= 0 && canFire) {
          e.state = e.next === "fan" ? "fanTele" : "ramTele";
          e.t = (e.next === "fan" ? BOSS.fanTele : BOSS.ramTele) * k;
          e.next = e.next === "fan" ? "ram" : "fan";
        }
      } else if (e.state === "fanTele") {
        if (e.t <= 0) {
          // A fan with gaps between rockets: a safe direction always exists.
          for (let i = 0; i < BOSS.rockets; i++) {
            const a = e.aim - BOSS.fanSpread / 2 + (BOSS.fanSpread * i) / (BOSS.rockets - 1);
            bullet(c, e, a, BOSS.rocketSpeed, BOSS.rocketDamage, { kind: "rocket", splash: BOSS.rocketSplash, ttl: 2.2 });
          }
          e.state = "pause";
          e.t = enraged ? BOSS.pauseEnraged : BOSS.pause;
        }
      } else if (e.state === "ramTele") {
        if (e.t <= 0) {
          e.state = "ram";
          e.t = BOSS.ramTime;
          e.hitDone = false;
        }
      } else {
        moveCircle(e, e.r, Math.cos(e.aim) * BOSS.ramSpeed * DT, Math.sin(e.aim) * BOSS.ramSpeed * DT, c.arena);
        for (const t of targets) {
          if (!e.hitDone && t.alive && Math.hypot(t.x - e.x, t.y - e.y) < t.r + e.r) {
            e.hitDone = true;
            c.contact(t, BOSS.contact, e.id);
          }
        }
        if (e.t <= 0) {
          e.state = "pause";
          e.t = enraged ? BOSS.pauseEnraged : BOSS.pause;
        }
      }
      return;
    }
  }
}

/** The telegraph line to draw for an enemy that is about to attack, or null. */
export function telegraph(e: Enemy): { x2: number; y2: number } | null {
  const len = e.kind === "turret" ? TURRET.range : e.kind === "drone" ? DRONE.dashSpeed * DRONE.dashTime : e.kind === "boss" ? 420 : 0;
  const active = (e.kind === "turret" && e.tele > 0) || (e.kind === "drone" && e.state === "tele") || (e.kind === "boss" && (e.state === "fanTele" || e.state === "ramTele"));
  return active ? { x2: e.x + Math.cos(e.aim) * len, y2: e.y + Math.sin(e.aim) * len } : null;
}
