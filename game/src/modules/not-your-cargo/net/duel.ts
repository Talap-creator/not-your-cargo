// The PvP duel over a Link: room lobby (loadout + Ready) → countdown → match → result → rematch.
// Host-authoritative (N02): the room's host runs `stepMatch`, the guest only sends input and draws
// snapshots, predicting its own movement. No host migration, no reconnect: a lost peer ends the
// match honestly (N05). Time comes from `now()` and everything advances in `pump()`, so tests drive
// it without real clocks.
import { DT, INPUT_HZ, PVP, RULES_VERSION, SNAPSHOT_HZ, type WeaponId } from "../sim/config";
import { NO_INPUT, makeBike, stepBike, type Bike, type BikeInput } from "../sim/combat";
import { abortMatch, createMatch, stepMatch, type MatchResult, type MatchState, type Side } from "../sim/match";
import { PVP_MAP } from "../sim/maps";
import type { Link } from "./link";
import {
  decode,
  encode,
  helloMsg,
  type InputMsg,
  type NetMsg,
  type SnapBike,
  type SnapMsg,
  type StartMsg,
} from "./protocol";

export type DuelPhase = "waiting" | "lobby" | "match" | "result";

export const UNSTABLE_AFTER_MS = 1500;
export const HOST_WATCHDOG_MS = 10_000;
export const PEER_LOST_MS = 10_000;
const INTERP_DELAY_MS = 100;

export interface BikeView {
  x: number; y: number; aim: number; heading: number; hp: number; alive: boolean; weapon: WeaponId;
  mag: number; reloadLeft: number; dashCd: number; dashing: boolean; carrying: boolean; shield: number;
  respawnLeft: number; pickupHold: number; deliverHold: number; deliveries: number; kills: number;
}
export interface DuelView {
  matchId: string;
  phase: MatchState["phase"];
  phaseLeft: number;
  mySide: Side;
  bikes: [BikeView, BikeView];
  cargo: { x: number; y: number; carrier: Side | null; away: number };
  projectiles: { x: number; y: number; kind: number; vx?: number; vy?: number }[];
  repairs: boolean[];
  events: { type: string; x: number; y: number; side: number }[];
}

export interface NetStats {
  rttMs: number | null;
  snapshotLossPct: number | null;
  sinceLastPacketMs: number;
  unstable: boolean;
}

interface Snap {
  at: number;
  s: SnapMsg;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface DuelOptions {
  now: () => number;
  /** Local controls; returns the input of this moment with edge flags (dash/drop/reload) consumed. */
  controls: () => BikeInput;
  random?: () => number;
  log?: (msg: string) => void;
}

export class Duel {
  readonly isHost: boolean;
  phase: DuelPhase = "waiting";
  myWeapon: WeaponId = "mg";
  myReady = false;
  peerId: string | null = null;
  peerWeapon: WeaponId | null = null;
  peerReady = false;
  /** Cosmetic only (the NYCARGO «Steppe Trail»): drawn, never simulated. */
  myTrail = false;
  peerTrail = false;
  /** cosmetic paint ids (validated against the known list by the UI) */
  myPaint: string | null = null;
  peerPaint: string | null = null;
  peerRulesVersion: string | null = null;
  versionError: string | null = null;
  matchIndex = 0;
  mySide: Side = 0;
  matchId = "";
  result: MatchResult | null = null;
  rematchMe = false;
  rematchPeer = false;
  /** Why the peer is gone, for the UI ("opponent left", "host lost"…). */
  notice: string | null = null;

  // host
  match: MatchState | null = null;
  private acc = 0;
  private lastPump = 0;
  private tickCount = 0;
  private guestIn: InputMsg | null = null;
  private guestLastAt = 0;
  private guestEdges = { dn: 0, qn: 0, rn: 0 };
  private pendingEvents: SnapMsg["ev"] = [];
  private peerLostAt: number | null = null;
  private firstPriorityHost = true;

  // guest
  private snaps: Snap[] = [];
  private lastTick = -1;
  private lastSnapAt = 0;
  private snapsReceived = 0;
  private firstTick = -1;
  private seq = 0;
  private pending: InputMsg[] = [];
  private edges = { dn: 0, qn: 0, rn: 0 };
  private pred: Bike | null = null;
  private lastInputSent = 0;
  private guestEvents: DuelView["events"] = [];

  private offs: (() => void)[] = [];
  private listeners = new Set<() => void>();
  private disposed = false;

  constructor(
    private link: Link,
    private o: DuelOptions,
  ) {
    this.isHost = link.selfId === link.hostId();
    const seed = Math.floor((o.random ?? Math.random)() * 2 ** 31);
    this.firstPriorityHost = (seed & 1) === 0;
    this.lastPump = o.now();
    this.offs.push(
      link.onMessage((from, _ch, data) => this.onMessage(from, data)),
      link.onPeerOpen((id) => this.onPeerOpen(id)),
      link.onPeerClose((id) => this.onPeerGone(id, false)),
      link.onMemberLeft((id) => this.onPeerGone(id, true)),
      link.onClosed((reason) => this.onRoomClosed(reason)),
      link.onMembers(() => this.refreshPeer()),
    );
    this.refreshPeer();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private changed(): void {
    this.listeners.forEach((f) => f());
  }
  private log(m: string): void {
    this.o.log?.(`[duel] ${m}`);
  }

  // ── lobby ─────────────────────────────────────────────────────────────────────────────────
  private refreshPeer(): void {
    const others = this.link.others();
    const first = others[0];
    if (!this.peerId && first) {
      this.peerId = first;
      if (this.link.isOpen(first)) this.onPeerOpen(first);
    }
  }

  private onPeerOpen(id: string): void {
    if (this.peerId && id !== this.peerId) return;
    this.peerId = id;
    this.peerLostAt = null;
    this.sendRel(helloMsg());
    this.sendRel({ t: "loadout", weapon: this.myWeapon, ready: this.myReady, trail: this.myTrail, ...(this.myPaint ? { paint: this.myPaint } : {}) });
    if (this.phase === "waiting") this.phase = "lobby";
    this.changed();
  }

  setLoadout(weapon: WeaponId, ready: boolean): void {
    if (this.phase !== "lobby" && this.phase !== "waiting") return;
    this.myWeapon = weapon;
    this.myReady = ready && !this.versionError;
    this.sendRel({ t: "loadout", weapon, ready: this.myReady, trail: this.myTrail, ...(this.myPaint ? { paint: this.myPaint } : {}) });
    this.maybeStart();
    this.changed();
  }

  private maybeStart(): void {
    if (!this.isHost || this.phase !== "lobby" || !this.peerId) return;
    if (!this.myReady || !this.peerReady || !this.peerWeapon) return;
    if (this.peerRulesVersion !== RULES_VERSION) return;
    this.startMatch();
  }

  private startMatch(): void {
    if (!this.peerId) return;
    const idx = this.matchIndex;
    const hostSide: Side = idx % 2 === 0 ? 0 : 1; // sides swap every rematch
    const guestSide: Side = hostSide === 0 ? 1 : 0;
    const hostHasPriority = idx % 2 === 0 ? this.firstPriorityHost : !this.firstPriorityHost;
    const random = this.o.random ?? Math.random;
    const start: StartMsg = {
      t: "start",
      matchId: `${this.link.selfId.slice(0, 6)}-${idx}-${Math.floor(random() * 1e9).toString(36)}`,
      seed: Math.floor(random() * 2 ** 31),
      sides: { [this.link.selfId]: hostSide, [this.peerId]: guestSide },
      weapons: hostSide === 0 ? [this.myWeapon, this.peerWeapon!] : [this.peerWeapon!, this.myWeapon],
      priority: hostHasPriority ? hostSide : guestSide,
    };
    const ids: [string, string] = hostSide === 0 ? [this.link.selfId, this.peerId] : [this.peerId, this.link.selfId];
    this.match = createMatch({ matchId: start.matchId, seed: start.seed, userIds: ids, weapons: start.weapons, priority: start.priority });
    this.guestIn = null;
    this.guestLastAt = this.o.now();
    this.guestEdges = { dn: 0, qn: 0, rn: 0 };
    this.acc = 0;
    this.tickCount = 0;
    this.sendRel(start);
    this.beginMatch(start);
    this.log(`start ${start.matchId} hostSide=${hostSide} priority=${start.priority}`);
  }

  private beginMatch(start: StartMsg): void {
    this.matchId = start.matchId;
    this.mySide = start.sides[this.link.selfId] ?? 0;
    this.phase = "match";
    this.result = null;
    this.rematchMe = false;
    this.rematchPeer = false;
    this.notice = null;
    this.snaps = [];
    this.lastTick = -1;
    this.firstTick = -1;
    this.snapsReceived = 0;
    this.lastSnapAt = this.o.now();
    this.pending = [];
    this.edges = { dn: 0, qn: 0, rn: 0 };
    const sp = PVP_MAP.spawns[this.mySide];
    this.pred = makeBike(this.link.selfId, this.mySide, sp.x, sp.y, start.weapons[this.mySide]);
    this.changed();
  }

  requestRematch(want: boolean): void {
    if (this.phase !== "result") return;
    this.rematchMe = want;
    this.sendRel({ t: "rematch", matchId: this.matchId, want });
    if (!want) this.backToLobby();
    else this.maybeRematch();
    this.changed();
  }

  private maybeRematch(): void {
    if (this.isHost && this.phase === "result" && this.rematchMe && this.rematchPeer && this.peerId) {
      this.matchIndex += 1;
      this.startMatch();
    }
  }

  private backToLobby(): void {
    this.phase = this.peerId ? "lobby" : "waiting";
    this.myReady = false;
    this.peerReady = false;
    this.match = null;
    this.changed();
  }

  // ── messages ──────────────────────────────────────────────────────────────────────────────
  private onMessage(from: string, data: Uint8Array): void {
    // Identity comes from the room session's link, never from the payload (N03).
    if (!this.peerId) this.peerId = from;
    if (from !== this.peerId) return;
    const m = decode(data);
    if (!m) return;
    this.handle(m);
  }

  private handle(m: NetMsg): void {
    const now = this.o.now();
    switch (m.t) {
      case "hello":
        this.peerRulesVersion = m.rv;
        this.versionError = m.rv === RULES_VERSION ? null : `rules ${RULES_VERSION} ≠ ${m.rv}`;
        if (this.versionError) this.myReady = false;
        if (this.phase === "waiting") this.phase = "lobby";
        this.maybeStart();
        break;
      case "loadout":
        if (this.phase !== "lobby" && this.phase !== "waiting") break;
        this.peerWeapon = m.weapon;
        this.peerReady = m.ready;
        this.peerTrail = m.trail === true;
        this.peerPaint = m.paint ?? null;
        this.maybeStart();
        break;
      case "start":
        if (this.isHost) break;
        if (m.matchId === this.matchId) break; // duplicate
        this.matchIndex += this.matchId ? 1 : 0;
        this.beginMatch(m);
        break;
      case "in": {
        if (!this.isHost || !this.match || m.m !== this.match.matchId) break;
        if (this.guestIn && m.s <= this.guestIn.s) break; // old or duplicated seq
        this.guestIn = m;
        this.guestLastAt = now;
        this.peerLostAt = null;
        break;
      }
      case "sn": {
        if (this.isHost || m.m !== this.matchId || this.phase !== "match") break;
        if (m.k <= this.lastTick) break; // old tick
        if (this.firstTick < 0) this.firstTick = m.k;
        this.lastTick = m.k;
        this.lastSnapAt = now;
        this.snapsReceived += 1;
        this.snaps.push({ at: now, s: m });
        if (this.snaps.length > 30) this.snaps.shift();
        for (const e of m.ev) this.guestEvents.push({ type: e[0], x: e[1], y: e[2], side: e[3] });
        this.reconcile(m);
        break;
      }
      case "result":
        if (m.matchId !== this.matchId || this.result) break; // one terminal result per match
        this.result = m.result;
        this.phase = "result";
        break;
      case "rematch":
        if (m.matchId !== this.matchId) break;
        this.rematchPeer = m.want;
        if (!m.want && this.phase === "result") {
          this.notice = "peer-declined";
          this.backToLobby();
        }
        this.maybeRematch();
        break;
      case "bye":
        this.onPeerGone(this.peerId ?? "", true);
        break;
    }
    this.changed();
  }

  private onPeerGone(id: string, confirmed: boolean): void {
    if (!this.peerId || id !== this.peerId) return;
    const hostGone = !this.isHost;
    if (this.phase === "match") {
      if (confirmed) this.endByDisconnect(hostGone ? "host-left" : "opponent-left");
      else if (this.peerLostAt === null) this.peerLostAt = this.o.now();
    } else if (confirmed) {
      this.notice = hostGone ? "host-left" : "opponent-left";
      this.peerId = null;
      this.peerReady = false;
      this.peerWeapon = null;
      if (this.phase !== "result") this.phase = "waiting";
    }
    this.changed();
  }

  private onRoomClosed(reason: string): void {
    if (this.phase === "match") this.endByDisconnect(`room-closed:${reason}`);
    this.notice = "room-closed";
    this.changed();
  }

  /** Host: the guest is gone → technical win for the host. Guest: the host is gone → aborted. */
  private endByDisconnect(reason: string): void {
    if (this.isHost && this.match) {
      abortMatch(this.match, reason, this.mySide);
      this.publishResult();
    } else if (!this.result) {
      this.result = {
        resultId: `${this.matchId}:aborted`,
        outcome: "aborted",
        winner: null,
        reason,
        deliveries: this.lastSnapScores(),
        kills: [0, 0],
        duration: 0,
      };
      this.phase = "result";
    }
    this.notice = reason;
  }

  private lastSnapScores(): [number, number] {
    const s = this.snaps[this.snaps.length - 1]?.s;
    return s ? [s.p[0].dv, s.p[1].dv] : [0, 0];
  }

  private publishResult(): void {
    const m = this.match;
    if (!m?.result || this.result) return;
    this.result = m.result;
    this.phase = "result";
    this.sendRel({ t: "result", matchId: m.matchId, result: m.result });
    // a last snapshot so the guest sees the final state
    this.sendSnapshot();
  }

  private sendRel(msg: NetMsg): void {
    if (this.peerId) this.link.send(this.peerId, "rel", encode(msg));
  }

  // ── the loop ──────────────────────────────────────────────────────────────────────────────
  /** Advance by wall time. Called ~30×/s by the scene's interval (not RAF, so it keeps going while
   *  the tab is in the background as far as the browser allows). */
  pump(): void {
    if (this.disposed) return;
    const now = this.o.now();
    const dtMs = Math.min(1000, now - this.lastPump);
    this.lastPump = now;
    if (this.isHost) this.pumpHost(now, dtMs);
    else this.pumpGuest(now);
  }

  private pumpHost(now: number, dtMs: number): void {
    const m = this.match;
    if (this.phase !== "match" || !m) return;
    if (this.peerLostAt !== null && now - this.peerLostAt > PEER_LOST_MS) {
      this.endByDisconnect("opponent-lost");
      this.changed();
      return;
    }
    if (m.phase !== "countdown" && now - this.guestLastAt > PEER_LOST_MS) {
      this.endByDisconnect("opponent-silent");
      this.changed();
      return;
    }
    this.acc += dtMs;
    let mine = this.o.controls();
    let steps = 0;
    while (this.acc >= DT * 1000 && steps < 30) {
      this.acc -= DT * 1000;
      steps++;
      const gi = this.guestIn;
      const gInput: BikeInput = gi
        ? {
            moveX: gi.mx,
            moveY: gi.my,
            aim: gi.a,
            fire: gi.f === 1,
            interact: gi.i === 1,
            dash: gi.dn > this.guestEdges.dn,
            drop: gi.qn > this.guestEdges.qn,
            reload: gi.rn > this.guestEdges.rn,
          }
        : NO_INPUT;
      const age = (now - this.guestLastAt) / 1000;
      if (gi && age <= PVP.inputTimeout) this.guestEdges = { dn: gi.dn, qn: gi.qn, rn: gi.rn };
      const ins: [{ input: BikeInput; age: number }, { input: BikeInput; age: number }] =
        this.mySide === 0 ? [{ input: mine, age: 0 }, { input: gInput, age }] : [{ input: gInput, age }, { input: mine, age: 0 }];
      stepMatch(m, ins);
      mine = { ...mine, dash: false, drop: false, reload: false }; // edges apply once
      for (const e of m.events) this.pendingEvents.push([e.type, r1(e.x), r1(e.y), e.side ?? -1]);
      this.tickCount++;
      if (this.tickCount % (30 / SNAPSHOT_HZ) === 0) this.sendSnapshot();
      if (m.result) {
        this.publishResult();
        break;
      }
    }
    this.changed();
  }

  private sendSnapshot(): void {
    const m = this.match;
    if (!m || !this.peerId) return;
    const pb = (side: Side): SnapBike => {
      const p = m.players[side];
      const b = p.bike;
      return {
        x: r1(b.x), y: r1(b.y), a: r2(b.aim), h: r2(b.heading), hp: b.hp, al: b.alive ? 1 : 0, w: b.weapon, mg: b.mag,
        rl: r2(b.reloadLeft), dl: r2(b.dashLeft), dc: r2(b.dashCd), dx: r2(b.dashX), dy: r2(b.dashY), c: b.carrying ? 1 : 0,
        sh: r2(b.shield), rs: r2(p.respawnLeft), ph: r2(p.pickupHold), dh: r2(p.deliverHold), dv: p.deliveries, k: p.kills,
      };
    };
    const snap: SnapMsg = {
      t: "sn",
      m: m.matchId,
      k: m.tick,
      ack: this.guestIn?.s ?? 0,
      ph: m.phase,
      pl: r2(m.phaseLeft),
      p: [pb(0), pb(1)],
      c: [r1(m.cargo.x), r1(m.cargo.y), m.cargo.carrier ?? -1, r2(m.cargo.away)],
      pr: m.projectiles.slice(0, 120).map((p) => [r1(p.x), r1(p.y), kindCode(p.kind), r2(Math.atan2(p.vy, p.vx))]),
      rp: [m.repairs[0]?.ready ? 1 : 0, m.repairs[1]?.ready ? 1 : 0],
      ev: this.pendingEvents.splice(0, 40),
    };
    this.link.send(this.peerId, "fast", encode(snap));
  }

  private pumpGuest(now: number): void {
    if (this.phase !== "match") return;
    if (now - this.lastSnapAt > HOST_WATCHDOG_MS) {
      this.endByDisconnect("host-silent");
      this.changed();
      return;
    }
    if (this.peerLostAt !== null && now - this.peerLostAt > PEER_LOST_MS) {
      this.endByDisconnect("host-lost");
      this.changed();
      return;
    }
    if (now - this.lastInputSent < 1000 / INPUT_HZ - 2) return;
    this.lastInputSent = now;
    const c = this.o.controls();
    if (c.dash) this.edges.dn++;
    if (c.drop) this.edges.qn++;
    if (c.reload) this.edges.rn++;
    const msg: InputMsg = {
      t: "in",
      m: this.matchId,
      s: ++this.seq,
      mx: r2(c.moveX),
      my: r2(c.moveY),
      a: r2(c.aim),
      f: c.fire ? 1 : 0,
      i: c.interact ? 1 : 0,
      ...this.edges,
    };
    if (this.peerId) this.link.send(this.peerId, "fast", encode(msg));
    this.pending.push(msg);
    if (this.pending.length > 90) this.pending.shift();
    // Predict own movement only; HP, hits, cargo and score stay the host's.
    const last = this.snaps[this.snaps.length - 1]?.s;
    if (this.pred && last && last.ph !== "countdown") this.predictStep(this.pred, msg, c.dash);
    else if (this.pred) this.pred.aim = c.aim;
    this.changed();
  }

  private predictStep(b: Bike, m: InputMsg, dash: boolean): void {
    stepBike(b, { moveX: m.mx, moveY: m.my, aim: m.a, fire: false, interact: false, dash, drop: false, reload: false }, DT, PVP_MAP, () => 0, () => 0.5);
  }

  /** Snap own predicted bike to the authority, then replay inputs the host has not processed yet. */
  private reconcile(s: SnapMsg): void {
    const me = s.p[this.mySide];
    const b = this.pred;
    if (!b) return;
    b.x = me.x;
    b.y = me.y;
    b.alive = me.al === 1;
    b.carrying = me.c === 1;
    b.dashLeft = me.dl;
    b.dashCd = me.dc;
    b.dashX = me.dx;
    b.dashY = me.dy;
    const acked = this.pending.filter((p) => p.s <= s.ack);
    this.pending = this.pending.filter((p) => p.s > s.ack);
    if (!b.alive || s.ph === "countdown") return;
    let prev = { dn: acked.length ? acked[acked.length - 1]!.dn : (this.pending[0]?.dn ?? 0) };
    for (const p of this.pending) {
      const dash = p.dn > prev.dn;
      prev = { dn: p.dn };
      this.predictStep(b, p, dash);
    }
  }

  // ── views for the renderer ────────────────────────────────────────────────────────────────
  stats(): NetStats {
    const now = this.o.now();
    const rtt = this.peerId ? this.link.rttMs(this.peerId) : null;
    if (this.isHost) {
      const since = this.match && this.match.phase !== "countdown" ? now - this.guestLastAt : 0;
      return { rttMs: rtt, snapshotLossPct: null, sinceLastPacketMs: since, unstable: this.phase === "match" && since > UNSTABLE_AFTER_MS };
    }
    const expected = this.lastTick >= 0 ? (this.lastTick - this.firstTick) / (30 / SNAPSHOT_HZ) + 1 : 0;
    const loss = expected > 0 ? Math.max(0, Math.round((1 - this.snapsReceived / expected) * 100)) : null;
    const since = now - this.lastSnapAt;
    return { rttMs: rtt, snapshotLossPct: loss, sinceLastPacketMs: since, unstable: this.phase === "match" && since > UNSTABLE_AFTER_MS };
  }

  view(): DuelView | null {
    if (this.isHost) return this.hostView();
    return this.guestView();
  }

  private hostView(): DuelView | null {
    const m = this.match;
    if (!m) return null;
    const bv = (side: Side): BikeView => {
      const p = m.players[side];
      const b = p.bike;
      return {
        x: b.x, y: b.y, aim: b.aim, heading: b.heading, hp: b.hp, alive: b.alive, weapon: b.weapon, mag: b.mag,
        reloadLeft: b.reloadLeft, dashCd: b.dashCd, dashing: b.dashLeft > 0, carrying: b.carrying, shield: b.shield,
        respawnLeft: p.respawnLeft, pickupHold: p.pickupHold, deliverHold: p.deliverHold, deliveries: p.deliveries, kills: p.kills,
      };
    };
    const ev = m.events.map((e) => ({ type: e.type, x: e.x, y: e.y, side: e.side ?? -1 }));
    return {
      matchId: m.matchId,
      phase: m.phase,
      phaseLeft: m.phaseLeft,
      mySide: this.mySide,
      bikes: [bv(0), bv(1)],
      cargo: { ...m.cargo },
      projectiles: m.projectiles.map((p) => ({ x: p.x, y: p.y, kind: kindCode(p.kind), vx: p.vx, vy: p.vy })),
      repairs: m.repairs.map((r) => r.ready),
      events: ev,
    };
  }

  private guestView(): DuelView | null {
    const n = this.snaps.length;
    const newest = this.snaps[n - 1];
    if (!newest) return null;
    const now = this.o.now();
    const latest = newest.s;
    // Opponent: interpolate between the two snapshots around (now − 100 ms).
    const t = now - INTERP_DELAY_MS;
    let a: Snap = this.snaps[0] ?? newest;
    let b: Snap = newest;
    for (let i = n - 1; i > 0; i--) {
      const prev = this.snaps[i - 1]!;
      if (prev.at <= t) {
        a = prev;
        b = this.snaps[i]!;
        break;
      }
    }
    const k = b.at > a.at ? Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at))) : 1;
    const lerp = (x: number, y: number) => x + (y - x) * k;
    const toView = (sb: SnapBike): BikeView => ({
      x: sb.x, y: sb.y, aim: sb.a, heading: sb.h, hp: sb.hp, alive: sb.al === 1, weapon: sb.w, mag: sb.mg,
      reloadLeft: sb.rl, dashCd: sb.dc, dashing: sb.dl > 0, carrying: sb.c === 1, shield: sb.sh,
      respawnLeft: sb.rs, pickupHold: sb.ph, deliverHold: sb.dh, deliveries: sb.dv, kills: sb.k,
    });
    const opp: Side = this.mySide === 0 ? 1 : 0;
    const oa = a.s.p[opp];
    const ob = b.s.p[opp];
    const oppView = { ...toView(latest.p[opp]), x: lerp(oa.x, ob.x), y: lerp(oa.y, ob.y), aim: ob.a, heading: ob.h };
    const meView = toView(latest.p[this.mySide]);
    if (this.pred && meView.alive) {
      meView.x = this.pred.x;
      meView.y = this.pred.y;
      meView.aim = this.pred.aim;
      meView.heading = this.pred.heading;
      meView.dashing = this.pred.dashLeft > 0;
    }
    const bikes: [BikeView, BikeView] = this.mySide === 0 ? [meView, oppView] : [oppView, meView];
    const carrier = latest.c[2] === -1 ? null : (latest.c[2] as Side);
    const cargo = { x: latest.c[0], y: latest.c[1], carrier, away: latest.c[3] };
    if (carrier !== null) {
      cargo.x = bikes[carrier].x;
      cargo.y = bikes[carrier].y;
    }
    const events = this.guestEvents;
    this.guestEvents = [];
    return {
      matchId: latest.m,
      phase: latest.ph,
      phaseLeft: Math.max(0, latest.pl - (latest.ph === "ended" ? 0 : (now - newest.at) / 1000)),
      mySide: this.mySide,
      bikes,
      cargo,
      projectiles: latest.pr.map(([x, y, kind, a]) => ({ x, y, kind, vx: Math.cos(a ?? 0), vy: Math.sin(a ?? 0) })),
      repairs: [latest.rp[0] === 1, latest.rp[1] === 1],
      events,
    };
  }

  /** Leave the duel: tell the peer, stop listening. The room itself is left by the caller. */
  dispose(): void {
    if (this.disposed) return;
    this.sendRel({ t: "bye" });
    if (this.isHost && this.match && !this.match.result) abortMatch(this.match, "host-quit");
    this.disposed = true;
    this.offs.forEach((f) => f());
    this.listeners.clear();
  }
}

const kindCode = (k: string): number => (k === "pellet" ? 1 : k === "laser" ? 3 : k === "rocket" ? 4 : 0);
