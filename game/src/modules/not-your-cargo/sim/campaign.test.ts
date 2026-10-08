import { describe, expect, it } from "vitest";
import { NO_INPUT, makeBike, stepBike, stepProjectiles, type Arena, type BikeInput } from "./combat";
import { DT, WEAPONS } from "./config";
import { C02_MAP, C03_MAP, C04_MAP, C05_MAP } from "./campaign-maps";
import { createMission, stepMission, C04_HOLD_OUT, TRUCK, type MissionState } from "./mission";
import { makeTurret, makeDrone, stepEnemy, telegraph, TURRET } from "./enemies";

const inp = (p: Partial<BikeInput> = {}): BikeInput => ({ ...NO_INPUT, ...p });
const open: Arena = { w: 4000, h: 4000, walls: [] };
const run = (s: MissionState, n: number, i: Partial<BikeInput> = {}) => {
  for (let k = 0; k < n; k++) stepMission(s, inp(i));
};
const clearEnemies = (s: MissionState) => {
  s.enemies = s.enemies.filter((e) => e.kind === "boss");
  s.warnings = [];
  s.projectiles = [];
};
const ctxFor = (projectiles: unknown[], contact: () => void = () => {}) =>
  ({ arena: open, time: 30, fireFrom: 0, random: () => 0.5, nextId: () => 1, projectiles, shot: () => {}, contact }) as never;

describe("weapons P1", () => {
  it("laser: 18 damage, stopped by the first target", () => {
    const b = makeBike("a", 0, 100, 500, "laser");
    let ps = stepBike(b, inp({ fire: true, aim: 0 }), DT, open, () => 1, () => 0.5);
    const near = makeBike("n", 1, 300, 500, "mg");
    const far = makeBike("f", 1, 450, 500, "mg");
    for (let i = 0; i < 4; i++) ps = stepProjectiles(ps, [near, far], open, DT).alive;
    expect(near.hp).toBe(100 - WEAPONS.laser.damage);
    expect(far.hp).toBe(100);
  });

  it("rocket: one explosion hits each enemy once, own team untouched", () => {
    const b = makeBike("a", 0, 100, 500, "rocket");
    let ps = stepBike(b, inp({ fire: true, aim: 0 }), DT, open, () => 1, () => 0.5);
    const t1 = makeBike("t1", 1, 300, 500, "mg");
    const t2 = makeBike("t2", 1, 300, 540, "mg");
    const ally = makeBike("al", 0, 300, 460, "mg");
    let boom = 0;
    for (let i = 0; i < 30 && ps.length; i++) {
      const r = stepProjectiles(ps, [t1, t2, ally], open, DT);
      ps = r.alive;
      boom += r.explosions.length;
    }
    expect(boom).toBe(1);
    expect(t1.hp).toBe(72);
    expect(t2.hp).toBe(72);
    expect(ally.hp).toBe(100);
  });
});

describe("enemies", () => {
  it("turret telegraphs before firing and keeps the locked aim", () => {
    const t = makeTurret("t", 500, 500);
    t.cooldown = 0;
    const target = makeBike("p", 0, 700, 500, "mg");
    const projectiles: unknown[] = [];
    const ctx = ctxFor(projectiles);
    stepEnemy(ctx, t, [target]);
    expect(telegraph(t)).not.toBeNull();
    expect(projectiles.length).toBe(0);
    const aim = t.aim;
    target.y = 700; // the courier sidesteps; the locked line does not follow
    for (let i = 0; i < Math.ceil(TURRET.telegraph / DT) + 2; i++) stepEnemy(ctx, t, [target]);
    expect(t.aim).toBe(aim);
    expect(projectiles.length).toBeGreaterThan(0);
  });

  it("drone ram hits once per dash", () => {
    const d = makeDrone("d", 500, 500);
    d.t = 0;
    const target = makeBike("p", 0, 650, 500, "mg");
    let hits = 0;
    const ctx = ctxFor([], () => hits++);
    for (let i = 0; i < 60; i++) stepEnemy(ctx, d, [target]);
    expect(hits).toBe(1);
  });
});

describe("C02 ambush", () => {
  it("the first lane entered decides the route; both lanes reach the station", () => {
    for (const lane of ["north", "south"] as const) {
      const s = createMission("mg", 1, "C02");
      s.legs = 1;
      s.player.x = C02_MAP.cargo!.x;
      s.player.y = C02_MAP.cargo!.y;
      run(s, 16, { interact: true });
      expect(s.cargo.carried).toBe(true);
      const tr = lane === "north" ? C02_MAP.northTrigger : C02_MAP.southTrigger;
      s.player.x = tr.x + 30;
      s.player.y = tr.y + tr.h / 2;
      run(s, 1);
      expect(s.route).toBe(lane);
      const other = lane === "north" ? C02_MAP.southTrigger : C02_MAP.northTrigger;
      s.player.x = other.x + 30;
      s.player.y = other.y + other.h / 2;
      run(s, 1);
      expect(s.route).toBe(lane);
      const g = C02_MAP.goal!;
      s.player.x = g.x + 80;
      s.player.y = g.y + 80;
      for (let i = 0; i < 50 && s.phase === "playing"; i++) {
        clearEnemies(s);
        stepMission(s, inp({ interact: true }));
      }
      expect(s.phase).toBe("won");
    }
  });
});

describe("C03 convoy", () => {
  it("the truck waits without the courier and finishes with him", () => {
    const s = createMission("mg", 1, "C03");
    const t = s.truck!;
    s.player.x = t.x + 400;
    s.player.y = t.y;
    clearEnemies(s);
    run(s, 30);
    expect(t.waiting).toBe(true);
    expect(t.x).toBe(C03_MAP.path[0]!.x);
    let stalled = false;
    for (let i = 0; i < 150 * 30 && s.phase === "playing"; i++) {
      clearEnemies(s);
      s.player.x = t.x;
      s.player.y = t.y + 60;
      stepMission(s, inp());
      if (t.stall > 0) stalled = true;
    }
    expect(stalled).toBe(true); // the engine dies at the second post
    expect(s.said).toContain("C03.stall");
    expect(s.phase).toBe("won");
  });

  it("a destroyed truck loses the mission", () => {
    const s = createMission("mg", 1, "C03");
    s.truck!.hp = 1;
    s.projectiles.push({ id: 9, owner: "r", team: 9, x: s.truck!.x - 60, y: s.truck!.y, vx: 480, vy: 0, ttl: 1, damage: 5, kind: "enemy" });
    run(s, 10);
    expect(s.phase).toBe("lost");
    expect(s.lostReason).toBe("convoy");
    expect(TRUCK.hp).toBe(460);
  });
});

describe("C04 station", () => {
  it("core needs the data; the hold-out starts once; re-take does not restart; evac wins only with the core", () => {
    const s = createMission("mg", 1, "C04");
    const core = { ...s.cargo };
    s.player.x = core.x - 30;
    s.player.y = core.y;
    run(s, 20, { interact: true });
    expect(s.cargo.carried).toBe(false); // no data yet
    s.player.x = C04_MAP.terminal.x - 30;
    s.player.y = C04_MAP.terminal.y;
    run(s, 31, { interact: true });
    expect(s.terminal!.done).toBe(true);
    s.player.x = core.x - 30;
    s.player.y = core.y;
    run(s, 16, { interact: true });
    expect(s.cargo.carried).toBe(true);
    expect(s.evac!.timer!).toBeGreaterThan(C04_HOLD_OUT - 1);
    clearEnemies(s);
    run(s, 150);
    const left = s.evac!.timer!;
    run(s, 1, { drop: true });
    s.player.x = s.cargo.x;
    s.player.y = s.cargo.y;
    run(s, 16, { interact: true });
    expect(s.cargo.carried).toBe(true);
    expect(s.evac!.timer!).toBeLessThan(left); // not restarted
    for (let i = 0; i < (C04_HOLD_OUT + 5) * 30 && !s.evac!.open; i++) {
      clearEnemies(s);
      s.player.hp = 100;
      stepMission(s, inp());
    }
    expect(s.evac!.open).toBe(true);
    const ev = s.evac!.rect;
    run(s, 1, { drop: true });
    s.player.x = ev.x + 100;
    s.player.y = ev.y + 100;
    clearEnemies(s);
    run(s, 5);
    expect(s.phase).toBe("playing"); // no core, no win
    s.cargo.x = s.player.x;
    s.cargo.y = s.player.y;
    run(s, 16, { interact: true });
    expect(s.phase).toBe("won");
  });
});

describe("mission events", () => {
  it("C02 south brings the sandstorm (short enemy sight); north does not", () => {
    const s = createMission("mg", 1, "C02");
    s.player.x = C02_MAP.southTrigger.x + 30;
    s.player.y = C02_MAP.southTrigger.y + 300;
    run(s, 1);
    expect(s.storm).toBe(true);
    const n = createMission("mg", 1, "C02");
    n.player.x = C02_MAP.northTrigger.x + 30;
    n.player.y = 200;
    run(n, 1);
    expect(n.storm).toBe(false);
  });

  it("radio lines are said once; stars count par time and HP", async () => {
    const { stars, PAR } = await import("./mission");
    const s = createMission("mg", 1, "C01");
    expect(s.said).toContain("C01.start");
    s.phase = "won";
    s.time = PAR.C01 - 1;
    s.player.hp = 80;
    expect(stars(s)).toBe(3);
    s.time = PAR.C01 + 1;
    s.player.hp = 20;
    expect(stars(s)).toBe(1);
  });
});

describe("C05 interceptor", () => {
  it("chase → boss → delivery only after the boss", () => {
    const s = createMission("mg", 1, "C05");
    expect(s.cargo.carried).toBe(true);
    const g = C05_MAP.goal!;
    s.player.x = g.x + 80;
    s.player.y = g.y + 80;
    clearEnemies(s);
    run(s, 50, { interact: true });
    expect(s.phase).toBe("playing"); // the boss first
    expect(s.stage).toBe("boss");
    s.boss!.hp = 1;
    s.projectiles.push({ id: 7, owner: "player", team: 0, x: s.boss!.x - 60, y: s.boss!.y, vx: 750, vy: 0, ttl: 1, damage: 8, kind: "bullet" });
    run(s, 5);
    expect(s.stage).toBe("deliver");
    clearEnemies(s);
    s.player.hp = 100;
    s.player.x = g.x + 80;
    s.player.y = g.y + 80;
    run(s, 50, { interact: true });
    expect(s.phase).toBe("won");
  });
});
