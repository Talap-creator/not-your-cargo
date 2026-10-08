import { describe, expect, it } from "vitest";
import { BIKE, CARGO, DT, PVP, WEAPONS } from "./config";
import { NO_INPUT, makeBike, stepBike, stepProjectiles, type Arena, type BikeInput } from "./combat";
import { normalizeMove } from "./geom";
import { createMission, stepMission } from "./mission";
import { createMatch, stepMatch, abortMatch, type MatchState, type TickInput } from "./match";
import { PVP_MAP } from "./maps";

const open: Arena = { w: 4000, h: 4000, walls: [] };
const inp = (p: Partial<BikeInput> = {}): BikeInput => ({ ...NO_INPUT, ...p });
const ids = () => {
  let n = 1;
  return () => n++;
};
const zero = () => 0.5;

describe("movement", () => {
  it("normalizes diagonal input", () => {
    const v = normalizeMove(1, 1);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });

  it("moves 240 u/s and 0.85× with cargo", () => {
    const b = makeBike("a", 0, 1000, 1000, "mg");
    for (let i = 0; i < 30; i++) stepBike(b, inp({ moveX: 1, moveY: 1 }), DT, open, ids(), zero);
    expect(Math.hypot(b.x - 1000, b.y - 1000)).toBeCloseTo(BIKE.speed, 0);
    const c = makeBike("c", 0, 1000, 1000, "mg");
    c.carrying = true;
    for (let i = 0; i < 30; i++) stepBike(c, inp({ moveX: 1 }), DT, open, ids(), zero);
    expect(c.x - 1000).toBeCloseTo(BIKE.speed * BIKE.cargoSlow, 0);
  });

  it("dash: 0.18 s at 600, 4 s cooldown, blocked by walls", () => {
    const b = makeBike("a", 0, 100, 100, "mg");
    stepBike(b, inp({ moveX: 1, dash: true }), DT, open, ids(), zero);
    expect(b.dashCd).toBeCloseTo(BIKE.dashCooldown);
    for (let i = 0; i < 5; i++) stepBike(b, inp({ moveX: 1 }), DT, open, ids(), zero);
    // 0.18 s at 600 + 0.02 s at 240
    expect(b.x - 100).toBeCloseTo(600 * 0.18 + 240 * (0.2 - 0.18), 0);
    const x = b.x;
    stepBike(b, inp({ dash: true }), DT, open, ids(), zero);
    expect(b.dashLeft).toBeLessThanOrEqual(0); // still on cooldown
    expect(b.x).toBe(x);

    const walled: Arena = { w: 1000, h: 1000, walls: [{ x: 160, y: 0, w: 20, h: 1000 }] };
    const w = makeBike("w", 0, 100, 500, "mg");
    for (let i = 0; i < 10; i++) stepBike(w, inp({ moveX: 1, dash: i === 0 }), DT, walled, ids(), zero);
    expect(w.x).toBeLessThanOrEqual(160 - BIKE.radius + 0.01);
  });
});

describe("weapons", () => {
  it("machine gun: 8/s, 24 rounds, auto reload 1.4 s", () => {
    const b = makeBike("a", 0, 500, 500, "mg");
    let shots = 0;
    for (let i = 0; i < 30 * 3; i++) shots += stepBike(b, inp({ fire: true }), DT, open, ids(), zero).length;
    expect(shots).toBe(WEAPONS.mg.magazine); // 3 s: 24 rounds in 3 s, then reloading
    for (let i = 0; i < Math.ceil(1.4 / DT) + 2; i++) stepBike(b, inp(), DT, open, ids(), zero);
    expect(b.mag).toBe(WEAPONS.mg.magazine);
  });

  it("shotgun fires 5 pellets per volley, manual reload with R", () => {
    const b = makeBike("a", 0, 500, 500, "shotgun");
    const out = stepBike(b, inp({ fire: true }), DT, open, ids(), zero);
    expect(out).toHaveLength(5);
    stepBike(b, inp({ reload: true }), DT, open, ids(), zero);
    expect(b.reloadLeft).toBeGreaterThan(0);
  });

  it("a fast bullet does not pass through a thin wall, and hits once", () => {
    const arena: Arena = { w: 2000, h: 1000, walls: [{ x: 510, y: 0, w: 2, h: 1000 }] };
    const target = makeBike("t", 1, 600, 500, "mg");
    const p = [{ id: 1, owner: "s", team: 0, x: 495, y: 500, vx: 750, vy: 0, ttl: 1, damage: 8, kind: "bullet" as const }];
    const r = stepProjectiles(p, [target], arena, DT);
    expect(r.alive).toHaveLength(0);
    expect(r.damage).toHaveLength(0);
    const p2 = [{ id: 2, owner: "s", team: 0, x: 560, y: 500, vx: 750, vy: 0, ttl: 1, damage: 8, kind: "bullet" as const }];
    const r2 = stepProjectiles(p2, [target], open, DT);
    expect(r2.damage).toHaveLength(1);
    expect(target.hp).toBe(92);
    expect(stepProjectiles(r2.alive, [target], open, DT).damage).toHaveLength(0);
  });
});

describe("mission C01", () => {
  it("no enemy fire during the first 20 s", () => {
    const s = createMission("mg", 3);
    // drive off without the parcel to trigger the first wave early
    let enemyShots = 0;
    for (let i = 0; i < 20 * 30 - 1; i++) {
      stepMission(s, inp({ moveX: s.player.x < 950 ? 1 : 0 }));
      enemyShots += s.projectiles.filter((p) => p.kind === "enemy").length;
    }
    expect(s.wave).toBe(1);
    expect(enemyShots).toBe(0);
  });

  it("pickup needs a 0.5 s hold, delivery a 1.5 s hold in the station → won", () => {
    const s = createMission("mg", 1);
    s.legs = 1; // single-run check; the runs have their own test
    s.player.x = s.map.cargo.x;
    s.player.y = s.map.cargo.y;
    for (let i = 0; i < 14; i++) stepMission(s, inp({ interact: true }));
    expect(s.cargo.carried).toBe(false);
    for (let i = 0; i < 2; i++) stepMission(s, inp({ interact: true }));
    expect(s.cargo.carried).toBe(true);
    s.enemies = [];
    s.warnings = [];
    s.player.x = s.map.goal!.x + 80;
    s.player.y = s.map.goal!.y + 80;
    for (let i = 0; i < 46 && s.phase === "playing"; i++) {
      s.warnings = [];
      s.enemies = [];
      stepMission(s, inp({ interact: true }));
    }
    expect(s.phase).toBe("won");
  });

  it("C01 is three runs: there, the return parcel to the depot (full repair), there again → won", () => {
    const s = createMission("mg", 1);
    expect(s.legs).toBe(3);
    s.player.x = s.map.cargo.x;
    s.player.y = s.map.cargo.y;
    for (let i = 0; i < 16; i++) stepMission(s, inp({ interact: true }));
    const station = { ...s.map.goal! };
    const deliverAt = (g: { x: number; y: number }) => {
      s.player.x = g.x + 80;
      s.player.y = g.y + 80;
      for (let i = 0; i < 60 && s.phase === "playing"; i++) {
        s.warnings = [];
        s.enemies = [];
        s.wave = 2;
        stepMission(s, inp({ interact: true }));
        if (s.deliverHold === 0 && i > 50) break;
      }
    };
    s.player.hp = 40;
    deliverAt(s.map.goal!);
    expect(s.leg).toBe(2);
    expect(s.phase).toBe("playing");
    expect(s.player.hp).toBe(100);
    expect(s.cargo.carried).toBe(true);
    expect(s.map.goal!.x).toBeLessThan(station.x); // back to the depot
    deliverAt(s.map.goal!);
    expect(s.leg).toBe(3);
    expect(s.map.goal).toEqual(station);
    deliverAt(s.map.goal!);
    expect(s.phase).toBe("won");
  });

  it("player death → lost; a new mission starts clean", () => {
    const s = createMission("mg", 1);
    s.player.hp = 1;
    s.projectiles.push({ id: 99, owner: "r", team: 9, x: s.player.x - 40, y: s.player.y, vx: 480, vy: 0, ttl: 1, damage: 5, kind: "enemy" });
    for (let i = 0; i < 5; i++) stepMission(s, inp());
    expect(s.phase).toBe("lost");
    const fresh = createMission("mg", 1);
    expect(fresh.player.hp).toBe(100);
    expect(fresh.enemies).toHaveLength(0);
    expect(fresh.projectiles).toHaveLength(0);
  });
});

// ── PvP ─────────────────────────────────────────────────────────────────────────────────────
const live = (i: Partial<BikeInput> = {}): TickInput => ({ input: inp(i), age: 0 });
function match(priority: 0 | 1 = 0): MatchState {
  const m = createMatch({ matchId: "m1", seed: 7, userIds: ["A", "B"], weapons: ["mg", "shotgun"], priority });
  while (m.phase === "countdown") stepMatch(m, [live(), live()]);
  return m;
}
const at = (m: MatchState, side: 0 | 1, x: number, y: number) => {
  m.players[side].bike.x = x;
  m.players[side].bike.y = y;
};
function deliverOnce(m: MatchState, side: 0 | 1) {
  m.cargo = { x: PVP_MAP.cargoHome.x, y: PVP_MAP.cargoHome.y, carrier: side, away: 0 };
  m.players[side].bike.carrying = true;
  const base = PVP_MAP.bases[side];
  at(m, side, base.x + base.w / 2, base.y + base.h / 2);
  for (let i = 0; i < 50 && m.players[side].deliveries === m.players[side].deliveries; i++) {
    const before = m.players[side].deliveries;
    stepMatch(m, side === 0 ? [live({ interact: true }), live()] : [live(), live({ interact: true })]);
    if (m.players[side].deliveries > before || m.phase === "ended") break;
  }
}

describe("pvp match", () => {
  it("countdown lasts 3 s, then 4-minute timer", () => {
    const m = createMatch({ matchId: "m", seed: 1, userIds: ["A", "B"], weapons: ["mg", "mg"], priority: 0 });
    let t = 0;
    while (m.phase === "countdown") {
      stepMatch(m, [live(), live()]);
      t++;
    }
    expect(t).toBe(PVP.countdown * 30);
    expect(m.phaseLeft).toBe(PVP.matchTime);
  });

  it("same-tick contested pickup: exactly one carrier, priority side wins and alternates", () => {
    for (const pr of [0, 1] as const) {
      const m = match(pr);
      at(m, 0, 780, 500);
      at(m, 1, 820, 500);
      for (let i = 0; i < 16; i++) stepMatch(m, [live({ interact: true }), live({ interact: true })]);
      expect(m.cargo.carrier).toBe(pr);
      expect(m.players.filter((p) => p.bike.carrying)).toHaveLength(1);
    }
  });

  it("damage cancels pickup hold", () => {
    const m = match();
    at(m, 0, 790, 500);
    at(m, 1, 1300, 900);
    for (let i = 0; i < 10; i++) stepMatch(m, [live({ interact: true }), live()]);
    m.projectiles.push({ id: 500, owner: "B", team: 1, x: 790 + 40, y: 500, vx: -750, vy: 0, ttl: 1, damage: 8, kind: "bullet" });
    stepMatch(m, [live({ interact: true }), live()]);
    expect(m.players[0].pickupHold).toBe(0);
    expect(m.cargo.carrier).toBeNull();
  });

  it("delivery scores once, cargo returns to centre after 3 s", () => {
    const m = match();
    deliverOnce(m, 0);
    expect(m.players[0].deliveries).toBe(1);
    expect(m.cargo.away).toBeGreaterThan(0);
    for (let i = 0; i < 91; i++) stepMatch(m, [live(), live()]);
    expect(m.cargo.away).toBe(0);
    expect(m.cargo.carrier).toBeNull();
    expect(m.players[0].deliveries).toBe(1);
  });

  it("lethal damage on the completing tick cancels the delivery", () => {
    const m = match();
    m.cargo = { x: 0, y: 0, carrier: 0, away: 0 };
    m.players[0].bike.carrying = true;
    const base = PVP_MAP.bases[0];
    at(m, 0, base.x + 55, base.y + 70);
    at(m, 1, 1400, 900);
    for (let i = 0; i < 44; i++) stepMatch(m, [live({ interact: true }), live()]);
    expect(m.players[0].deliveries).toBe(0);
    m.players[0].bike.hp = 5;
    const b = m.players[0].bike;
    m.projectiles.push({ id: 900, owner: "B", team: 1, x: b.x + 30, y: b.y, vx: -750, vy: 0, ttl: 1, damage: 8, kind: "bullet" });
    stepMatch(m, [live({ interact: true }), live()]);
    expect(m.players[0].deliveries).toBe(0);
    expect(m.players[0].bike.alive).toBe(false);
    expect(m.cargo.carrier).toBeNull();
    expect(m.players[1].kills).toBe(1);
  });

  it("three deliveries win; result is formed once", () => {
    const m = match();
    for (let k = 0; k < 3; k++) {
      deliverOnce(m, 1);
      m.cargo.away = 0;
    }
    expect(m.phase).toBe("ended");
    expect(m.result?.winner).toBe(1);
    const id = m.result?.resultId;
    stepMatch(m, [live(), live()]);
    abortMatch(m, "late");
    expect(m.result?.resultId).toBe(id);
    expect(m.result?.outcome).toBe("win");
  });

  it("timer: leader wins; tie → sudden death → draw after 60 s", () => {
    const m = match();
    deliverOnce(m, 0);
    m.phaseLeft = DT * 2;
    stepMatch(m, [live(), live()]);
    stepMatch(m, [live(), live()]);
    expect(m.result?.winner).toBe(0);
    expect(m.result?.reason).toBe("time");

    const t = match();
    t.phaseLeft = DT;
    stepMatch(t, [live(), live()]);
    expect(t.phase).toBe("sudden");
    t.phaseLeft = DT;
    stepMatch(t, [live(), live()]);
    expect(t.result?.outcome).toBe("draw");
  });

  it("sudden death: first delivery wins", () => {
    const m = match();
    m.phase = "sudden";
    m.phaseLeft = 60;
    deliverOnce(m, 1);
    expect(m.result?.winner).toBe(1);
    expect(m.result?.reason).toBe("sudden-death");
  });

  it("input silent > 250 ms: held fire and interaction stop, bike still takes damage", () => {
    const m = match();
    at(m, 0, 790, 500);
    const stale: TickInput = { input: inp({ fire: true, interact: true, moveX: 1 }), age: 0.3 };
    const x = m.players[0].bike.x;
    for (let i = 0; i < 20; i++) stepMatch(m, [stale, live()]);
    expect(m.players[0].bike.x).toBe(x);
    expect(m.projectiles.filter((p) => p.owner === "A")).toHaveLength(0);
    expect(m.cargo.carrier).toBeNull();
    const b = m.players[0].bike;
    m.projectiles.push({ id: 7, owner: "B", team: 1, x: b.x + 30, y: b.y, vx: -750, vy: 0, ttl: 1, damage: 8, kind: "bullet" });
    stepMatch(m, [stale, live()]);
    expect(m.players[0].bike.hp).toBe(92);
  });

  it("respawn after 3 s at own base with full HP and 1 s shield that firing ends", () => {
    const m = match();
    m.players[0].bike.hp = 1;
    const b = m.players[0].bike;
    m.projectiles.push({ id: 7, owner: "B", team: 1, x: b.x + 30, y: b.y, vx: -750, vy: 0, ttl: 1, damage: 8, kind: "bullet" });
    stepMatch(m, [live(), live()]);
    expect(m.players[0].bike.alive).toBe(false);
    for (let i = 0; i < 90; i++) stepMatch(m, [live(), live()]);
    const r = m.players[0].bike;
    expect(r.alive).toBe(true);
    expect(r.hp).toBe(100);
    expect(r.x).toBe(PVP_MAP.spawns[0].x);
    expect(r.shield).toBeGreaterThan(0);
    stepMatch(m, [live({ fire: true }), live()]);
    expect(m.players[0].bike.shield).toBe(0);
  });

  it("a repair kit heals one player by 25, not two", () => {
    const m = match();
    m.repairs[0].ready = true;
    const r = m.repairs[0];
    at(m, 0, r.x - 5, r.y);
    at(m, 1, r.x + 5, r.y);
    m.players[0].bike.hp = 50;
    m.players[1].bike.hp = 50;
    stepMatch(m, [live(), live()]);
    expect(m.players[0].bike.hp + m.players[1].bike.hp).toBe(125);
    expect(r.ready).toBe(false);
  });

  it("arena is mirror-symmetric", () => {
    const key = (w: { x: number; y: number; w: number; h: number }) => `${w.x},${w.y},${w.w},${w.h}`;
    const set = new Set(PVP_MAP.walls.map(key));
    for (const w of PVP_MAP.walls) expect(set.has(key({ x: PVP.arenaW - w.x - w.w, y: w.y, w: w.w, h: w.h }))).toBe(true);
    expect(PVP_MAP.spawns[0].x + PVP_MAP.spawns[1].x).toBe(PVP.arenaW);
    expect(CARGO.pickupRange).toBe(48);
  });
});
