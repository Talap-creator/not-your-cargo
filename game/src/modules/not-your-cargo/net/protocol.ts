// Wire format between the two peers (N03). JSON in a Uint8Array over the RealtimeSession channels:
// "rel" (ordered, reliable) for lobby/start/result, "fast" (unordered, no retransmit) for input and
// snapshots. Every incoming message is size-capped, shape-checked and clamped; anything else is dropped.
import { RULES_VERSION, type WeaponId } from "../sim/config";
import type { MatchResult, MatchPhase, Side } from "../sim/match";

export const MAX_MESSAGE_BYTES = 12_000;

export interface HelloMsg { t: "hello"; rv: string }
export interface LoadoutMsg { t: "loadout"; weapon: WeaponId; ready: boolean; trail?: boolean; paint?: string }
export interface StartMsg {
  t: "start";
  matchId: string;
  seed: number;
  sides: Record<string, Side>;
  weapons: [WeaponId, WeaponId];
  priority: Side;
}
export interface ResultMsg { t: "result"; matchId: string; result: MatchResult }
export interface RematchMsg { t: "rematch"; matchId: string; want: boolean }
export interface ByeMsg { t: "bye" }
/** Guest → host input. Edge actions travel as counters so a lost or duplicated packet cannot drop
 *  or repeat a dash/drop/reload: the host applies an edge when the counter grows. */
export interface InputMsg {
  t: "in";
  m: string;
  s: number;
  mx: number;
  my: number;
  a: number;
  f: 0 | 1;
  i: 0 | 1;
  dn: number;
  qn: number;
  rn: number;
}

export interface SnapBike {
  x: number; y: number; a: number; h: number; hp: number; al: 0 | 1; w: WeaponId; mg: number;
  rl: number; dl: number; dc: number; dx: number; dy: number; c: 0 | 1; sh: number; rs: number;
  ph: number; dh: number; dv: number; k: number;
}
export interface SnapMsg {
  t: "sn";
  m: string;
  k: number; // tick
  ack: number; // last processed input seq of the guest
  ph: MatchPhase;
  pl: number; // phase seconds left
  p: [SnapBike, SnapBike];
  c: [number, number, number, number]; // cargo x, y, carrier (-1 none), away
  pr: [number, number, number, number][]; // projectiles x, y, kind (0 bullet, 1 pellet, 3 laser, 4 rocket), angle
  rp: [0 | 1, 0 | 1];
  ev: [string, number, number, number][]; // events: type, x, y, side (-1)
}

export type NetMsg = HelloMsg | LoadoutMsg | StartMsg | ResultMsg | RematchMsg | ByeMsg | InputMsg | SnapMsg;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function encode(msg: NetMsg): Uint8Array {
  return enc.encode(JSON.stringify(msg));
}

const num = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null;
const isWeapon = (v: unknown): v is WeaponId => v === "mg" || v === "shotgun" || v === "laser" || v === "rocket";

/** Parse and validate one message. Returns null for anything malformed or oversized. */
export function decode(data: Uint8Array): NetMsg | null {
  if (data.byteLength > MAX_MESSAGE_BYTES) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(dec.decode(data));
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  switch (o.t) {
    case "hello":
      return typeof o.rv === "string" && o.rv.length < 40 ? { t: "hello", rv: o.rv } : null;
    case "loadout":
      return isWeapon(o.weapon) && typeof o.ready === "boolean" ? { t: "loadout", weapon: o.weapon, ready: o.ready, trail: o.trail === true, ...(typeof o.paint === "string" && /^paint_[a-z]{1,16}$/.test(o.paint) ? { paint: o.paint } : {}) } : null;
    case "rematch":
      return typeof o.matchId === "string" && typeof o.want === "boolean" ? { t: "rematch", matchId: o.matchId, want: o.want } : null;
    case "bye":
      return { t: "bye" };
    case "in": {
      const s = num(o.s, 0, 1e9), mx = num(o.mx, -1, 1), my = num(o.my, -1, 1), a = num(o.a, -10, 10);
      const dn = num(o.dn, 0, 1e9), qn = num(o.qn, 0, 1e9), rn = num(o.rn, 0, 1e9);
      if (typeof o.m !== "string" || s === null || mx === null || my === null || a === null || dn === null || qn === null || rn === null) return null;
      return { t: "in", m: o.m, s: Math.floor(s), mx, my, a, f: o.f ? 1 : 0, i: o.i ? 1 : 0, dn: Math.floor(dn), qn: Math.floor(qn), rn: Math.floor(rn) };
    }
    // Host-only messages: the guest trusts the authority by design (N02), still checks the shape.
    case "start":
      if (typeof o.matchId !== "string" || typeof o.seed !== "number" || !o.sides || typeof o.sides !== "object") return null;
      if (!Array.isArray(o.weapons) || !o.weapons.every(isWeapon) || (o.priority !== 0 && o.priority !== 1)) return null;
      return o as unknown as StartMsg;
    case "result":
      return typeof o.matchId === "string" && o.result && typeof o.result === "object" ? (o as unknown as ResultMsg) : null;
    case "sn":
      return typeof o.m === "string" && typeof o.k === "number" && Array.isArray(o.p) && o.p.length === 2 ? (o as unknown as SnapMsg) : null;
    default:
      return null;
  }
}

export const helloMsg = (): HelloMsg => ({ t: "hello", rv: RULES_VERSION });
