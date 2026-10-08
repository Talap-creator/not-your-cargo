// PvP «Перехват груза» — the authoritative match simulation the HOST runs (N02). The guest never
// runs this; it only sends input and draws snapshots. Deterministic per seed; no wall clock.
import { CARGO, DT, PVP, type WeaponId } from "./config";
import {
  NO_INPUT,
  freePoint,
  makeBike,
  stepBike,
  stepProjectiles,
  type Bike,
  type BikeInput,
  type Projectile,
} from "./combat";
import { circleHitsRect, dist2, rng } from "./geom";
import { PVP_MAP } from "./maps";

export type Side = 0 | 1;
export type MatchPhase = "countdown" | "play" | "sudden" | "ended";
export type Outcome = "win" | "draw" | "aborted";

export interface MatchPlayer {
  side: Side;
  userId: string;
  bike: Bike;
  respawnLeft: number;
  pickupHold: number;
  deliverHold: number;
  deliveries: number;
  kills: number;
  deaths: number;
}

export interface MatchResult {
  resultId: string;
  outcome: Outcome;
  winner: Side | null;
  reason: string;
  deliveries: [number, number];
  kills: [number, number];
  duration: number;
}

export interface MatchEvent {
  type: "shot" | "hit" | "impact" | "death" | "pickup" | "drop" | "deliver" | "repair" | "respawn" | "cargoBack" | "explode";
  x: number;
  y: number;
  side?: Side;
}

export interface MatchState {
  matchId: string;
  tick: number;
  phase: MatchPhase;
  phaseLeft: number; // countdown / main timer / sudden death seconds left
  elapsed: number; // active seconds (play + sudden)
  players: [MatchPlayer, MatchPlayer];
  projectiles: Projectile[];
  cargo: { x: number; y: number; carrier: Side | null; away: number }; // away > 0: returning to centre
  repairs: { x: number; y: number; ready: boolean; left: number }[];
  /** Tie-break side for the same-tick contest; alternates per match (P02). */
  priority: Side;
  result: MatchResult | null;
  events: MatchEvent[];
  nextId: number;
  random: () => number;
}

export interface MatchSetup {
  matchId: string;
  seed: number;
  userIds: [string, string]; // index = side
  weapons: [WeaponId, WeaponId];
  priority: Side;
}

export function createMatch(setup: MatchSetup): MatchState {
  const m = PVP_MAP;
  const mk = (side: Side): MatchPlayer => {
    const sp = m.spawns[side];
    const bike = makeBike(setup.userIds[side], side, sp.x, sp.y, setup.weapons[side]);
    bike.aim = side === 0 ? 0 : Math.PI;
    bike.heading = bike.aim;
    return { side, userId: setup.userIds[side], bike, respawnLeft: 0, pickupHold: 0, deliverHold: 0, deliveries: 0, kills: 0, deaths: 0 };
  };
  return {
    matchId: setup.matchId,
    tick: 0,
    phase: "countdown",
    phaseLeft: PVP.countdown,
    elapsed: 0,
    players: [mk(0), mk(1)],
    projectiles: [],
    cargo: { x: m.cargoHome.x, y: m.cargoHome.y, carrier: null, away: 0 },
    repairs: m.repairs.map((r) => ({ x: r.x, y: r.y, ready: false, left: PVP.repairEvery })),
    priority: setup.priority,
    result: null,
    events: [],
    nextId: 1,
    random: rng(setup.seed),
  };
}

/** Input as the host sees it this tick: `age` = seconds since the last valid input of that player. */
export interface TickInput {
  input: BikeInput;
  age: number;
}

function finish(s: MatchState, outcome: Outcome, winner: Side | null, reason: string): void {
  if (s.result) return; // terminal result is formed once and never changes
  s.phase = "ended";
  s.result = {
    resultId: `${s.matchId}:${s.tick}`,
    outcome,
    winner,
    reason,
    deliveries: [s.players[0].deliveries, s.players[1].deliveries],
    kills: [s.players[0].kills, s.players[1].kills],
    duration: Math.round(s.elapsed),
  };
  s.projectiles = [];
}

/** Abort from outside (host lost the guest, version clash…). Idempotent. */
export function abortMatch(s: MatchState, reason: string, winner: Side | null = null): void {
  finish(s, winner === null ? "aborted" : "win", winner, reason);
}

export function stepMatch(s: MatchState, inputs: [TickInput, TickInput]): void {
  s.events = [];
  if (s.phase === "ended") return;
  s.tick += 1;

  if (s.phase === "countdown") {
    s.phaseLeft -= DT;
    for (const p of s.players) p.bike.aim = inputs[p.side].input.aim;
    if (s.phaseLeft <= 1e-9) {
      s.phase = "play";
      s.phaseLeft = PVP.matchTime;
    }
    return;
  }
  s.elapsed += DT;

  // A player silent for > 250 ms: movement, fire and held interaction are zeroed (N03). The bike
  // stays in the world and can be hit — silence is not invulnerability.
  const eff = inputs.map((ti) => (ti.age > PVP.inputTimeout ? { ...NO_INPUT, aim: ti.input.aim } : ti.input)) as [BikeInput, BikeInput];
  const order: Side[] = s.priority === 0 ? [0, 1] : [1, 0];

  // 1. input / movement / weapons
  for (const p of s.players) {
    const b = p.bike;
    if (!b.alive) continue;
    b.shield = Math.max(0, b.shield - DT);
    const shots = stepBike(b, eff[p.side], DT, PVP_MAP, () => s.nextId++, s.random);
    if (shots.length) {
      b.shield = 0; // first shot ends spawn protection (P03)
      s.events.push({ type: "shot", x: b.x, y: b.y, side: p.side });
      s.projectiles.push(...shots);
    }
  }

  // 2. hits and damage
  const bikes = s.players.map((p) => p.bike);
  const res = stepProjectiles(s.projectiles, bikes, PVP_MAP, DT);
  s.projectiles = res.alive;
  for (const i of res.impacts) s.events.push({ type: "impact", x: i.x, y: i.y });
  for (const x of res.explosions) s.events.push({ type: "explode", x: x.x, y: x.y });
  const hurt: [boolean, boolean] = [false, false];
  const killedNow: [boolean, boolean] = [false, false];
  for (const d of res.damage) {
    const victim = s.players.find((p) => p.userId === d.targetId)!;
    hurt[victim.side] = true;
    s.events.push({ type: "hit", x: victim.bike.x, y: victim.bike.y, side: victim.side });
    if (d.lethal && !killedNow[victim.side]) killedNow[victim.side] = true;
  }

  // 3. deaths and cargo drop (both may die in one tick)
  for (const p of s.players) {
    if (!killedNow[p.side] || !p.bike.alive) continue;
    p.bike.alive = false;
    p.deaths += 1;
    s.players[p.side === 0 ? 1 : 0].kills += 1;
    p.respawnLeft = PVP.respawn;
    p.pickupHold = 0;
    p.deliverHold = 0;
    s.events.push({ type: "death", x: p.bike.x, y: p.bike.y, side: p.side });
    if (s.cargo.carrier === p.side) {
      const f = freePoint(p.bike.x, p.bike.y, CARGO.radius, PVP_MAP);
      s.cargo = { x: f.x, y: f.y, carrier: null, away: 0 };
      p.bike.carrying = false;
      s.events.push({ type: "drop", x: f.x, y: f.y, side: p.side });
    }
  }

  // respawn timers
  for (const p of s.players) {
    if (p.bike.alive) continue;
    p.respawnLeft -= DT;
    if (p.respawnLeft <= 0) {
      const sp = PVP_MAP.spawns[p.side];
      const w = p.bike.weapon;
      const fresh = makeBike(p.userId, p.side, sp.x, sp.y, w);
      fresh.shield = PVP.spawnShield;
      fresh.aim = p.side === 0 ? 0 : Math.PI;
      p.bike = fresh;
      s.events.push({ type: "respawn", x: sp.x, y: sp.y, side: p.side });
    }
  }

  // cargo returning to the centre after a delivery
  if (s.cargo.away > 0) {
    s.cargo.away -= DT;
    if (s.cargo.away <= 0) {
      s.cargo = { x: PVP_MAP.cargoHome.x, y: PVP_MAP.cargoHome.y, carrier: null, away: 0 };
      s.events.push({ type: "cargoBack", x: s.cargo.x, y: s.cargo.y });
    }
  }

  // 4. interactions: only living players who took no cancelling damage this tick
  let deliveredBy: Side | null = null;
  const pickupDone: Side[] = [];
  for (const side of order) {
    const p = s.players[side];
    const b = p.bike;
    const inp = eff[side];
    if (!b.alive) continue;
    if (hurt[side]) {
      p.pickupHold = 0;
      p.deliverHold = 0;
    }
    if (s.cargo.carrier === side) {
      s.cargo.x = b.x;
      s.cargo.y = b.y;
      if (inp.drop) {
        const f = freePoint(b.x + Math.cos(b.aim) * 30, b.y + Math.sin(b.aim) * 30, CARGO.radius, PVP_MAP);
        s.cargo = { x: f.x, y: f.y, carrier: null, away: 0 };
        b.carrying = false;
        p.deliverHold = 0;
        s.events.push({ type: "drop", x: f.x, y: f.y, side });
      } else if (inp.interact && !hurt[side] && circleHitsRect(b.x, b.y, 1, PVP_MAP.bases[side])) {
        b.shield = 0;
        p.deliverHold += DT;
        if (p.deliverHold >= CARGO.deliverHold) deliveredBy = side;
      } else p.deliverHold = 0;
    } else if (s.cargo.carrier === null && s.cargo.away <= 0) {
      const near = dist2(b.x, b.y, s.cargo.x, s.cargo.y) <= CARGO.pickupRange * CARGO.pickupRange;
      if (inp.interact && near && !hurt[side]) {
        b.shield = 0; // touching the cargo ends spawn protection
        p.pickupHold += DT;
        if (p.pickupHold >= CARGO.pickupHold) pickupDone.push(side);
      } else p.pickupHold = 0;
    } else p.pickupHold = 0;
  }
  // Same-tick contest: the priority side (first in `order`) gets the one and only cargo.
  const side0 = pickupDone[0];
  if (side0 !== undefined) {
    const side = side0;
    s.cargo.carrier = side;
    s.players[side].bike.carrying = true;
    for (const p of s.players) p.pickupHold = 0;
    s.events.push({ type: "pickup", x: s.cargo.x, y: s.cargo.y, side });
  }

  // repair kits: one kit heals one living player, priority order
  for (const r of s.repairs) {
    if (!r.ready) {
      r.left -= DT;
      if (r.left <= 0) r.ready = true;
      continue;
    }
    for (const side of order) {
      const b = s.players[side].bike;
      if (b.alive && b.hp < b.maxHp && dist2(b.x, b.y, r.x, r.y) <= (PVP.repairRadius + b.r) ** 2) {
        b.hp = Math.min(b.maxHp, b.hp + PVP.repairHp);
        r.ready = false;
        r.left = PVP.repairEvery;
        s.events.push({ type: "repair", x: r.x, y: r.y, side });
        break;
      }
    }
  }

  // 5. delivery points (the deliverer is alive here by construction: lethal damage ran first)
  if (deliveredBy !== null) {
    const p = s.players[deliveredBy];
    p.deliveries += 1;
    p.deliverHold = 0;
    p.bike.carrying = false;
    s.cargo = { x: PVP_MAP.cargoHome.x, y: PVP_MAP.cargoHome.y, carrier: null, away: CARGO.respawnDelay };
    s.events.push({ type: "deliver", x: p.bike.x, y: p.bike.y, side: deliveredBy });
  }

  // 6. victory
  const [a, b] = [s.players[0].deliveries, s.players[1].deliveries];
  if (s.phase === "sudden" && deliveredBy !== null) return finish(s, "win", deliveredBy, "sudden-death");
  if (a >= PVP.winDeliveries) return finish(s, "win", 0, "deliveries");
  if (b >= PVP.winDeliveries) return finish(s, "win", 1, "deliveries");

  // 7. timers
  s.phaseLeft -= DT;
  if (s.phaseLeft <= 1e-9) {
    if (s.phase === "play") {
      if (a !== b) return finish(s, "win", a > b ? 0 : 1, "time");
      s.phase = "sudden";
      s.phaseLeft = PVP.suddenDeath;
    } else return finish(s, "draw", null, "sudden-death-timeout");
  }
}
