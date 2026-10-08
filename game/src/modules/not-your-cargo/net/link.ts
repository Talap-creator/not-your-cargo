// The duel talks to its peer through this narrow interface. Production: `sessionLink` over the
// iDos RealtimeSession the lobby's rooms system hands the game (WebRTC DataChannels). Tests: an
// in-memory pair. There is no third implementation and no bot opponent.
import type { RealtimeSession } from "@idosgames/core/realtime";

export type Channel = "rel" | "fast";

export interface Link {
  readonly selfId: string;
  /** Live host of the room (the authority). */
  hostId(): string;
  /** Other members of the room (user ids), whether or not their link is open yet. */
  others(): string[];
  isOpen(peerId: string): boolean;
  send(peerId: string, channel: Channel, data: Uint8Array): boolean;
  rttMs(peerId: string): number | null;
  onMessage(fn: (from: string, channel: Channel, data: Uint8Array) => void): () => void;
  onPeerOpen(fn: (peerId: string) => void): () => void;
  onPeerClose(fn: (peerId: string) => void): () => void;
  onMemberLeft(fn: (userId: string) => void): () => void;
  onMembers(fn: () => void): () => void;
  onClosed(fn: (reason: string) => void): () => void;
}

export function sessionLink(session: RealtimeSession): Link {
  return {
    selfId: session.selfId,
    hostId: () => session.hostId,
    others: () => [...session.members.keys()].filter((id) => id !== session.selfId),
    isOpen: (id) => session.isOpen(id),
    send: (id, ch, data) => session.send(id, ch, data),
    rttMs: (id) => session.linkStats(id)?.rttMs ?? null,
    onMessage: (fn) => session.on("message", (e) => fn(e.from, e.channel as Channel, e.data)),
    onPeerOpen: (fn) => session.on("peerOpen", (e) => fn(e.peerId)),
    onPeerClose: (fn) => session.on("peerClose", (e) => fn(e.peerId)),
    onMemberLeft: (fn) => session.on("memberLeft", (e) => fn(e.userId)),
    onMembers: (fn) => {
      const a = session.on("memberJoined", () => fn());
      const b = session.on("membersUpdated", () => fn());
      return () => {
        a();
        b();
      };
    },
    onClosed: (fn) => {
      const a = session.on("roomClosed", () => fn("room-closed"));
      const b = session.on("removed", (e) => fn(`removed:${e.reason}`));
      const c = session.on("left", () => fn("left"));
      return () => {
        a();
        b();
        c();
      };
    },
  };
}

/** Two linked in-memory endpoints for automated tests (optional latency/loss on "fast"). */
export function memoryPair(hostId = "H", guestId = "G", opts: { lossFast?: number; random?: () => number } = {}): [MemoryLink, MemoryLink] {
  const a = new MemoryLink(hostId, hostId);
  const b = new MemoryLink(guestId, hostId);
  a.peer = b;
  b.peer = a;
  a.lossFast = b.lossFast = opts.lossFast ?? 0;
  a.random = b.random = opts.random ?? Math.random;
  return [a, b];
}

type Fn<A extends unknown[]> = (...a: A) => void;

export class MemoryLink implements Link {
  peer: MemoryLink | null = null;
  open = true;
  lossFast = 0;
  random: () => number = Math.random;
  private msg = new Set<Fn<[string, Channel, Uint8Array]>>();
  private po = new Set<Fn<[string]>>();
  private pc = new Set<Fn<[string]>>();
  private ml = new Set<Fn<[string]>>();
  private mb = new Set<Fn<[]>>();
  private cl = new Set<Fn<[string]>>();
  constructor(
    readonly selfId: string,
    private host: string,
  ) {}
  hostId = () => this.host;
  others = () => (this.peer && this.open ? [this.peer.selfId] : []);
  isOpen = (id: string) => this.open && this.peer?.selfId === id && this.peer.open;
  send(id: string, ch: Channel, data: Uint8Array): boolean {
    if (!this.isOpen(id) || !this.peer) return false;
    if (ch === "fast" && this.random() < this.lossFast) return true;
    const p = this.peer;
    const copy = data.slice();
    queueMicrotask(() => p.open && p.msg.forEach((f) => f(this.selfId, ch, copy)));
    return true;
  }
  rttMs = () => 0;
  /** Simulate the peer vanishing (tab closed). */
  drop(): void {
    this.open = false;
    const p = this.peer;
    if (p) {
      p.pc.forEach((f) => f(this.selfId));
      p.ml.forEach((f) => f(this.selfId));
    }
  }
  connect(): void {
    this.po.forEach((f) => f(this.peer!.selfId));
    this.peer!.po.forEach((f) => f(this.selfId));
  }
  private add<T>(set: Set<T>, fn: T): () => void {
    set.add(fn);
    return () => set.delete(fn);
  }
  onMessage = (fn: Fn<[string, Channel, Uint8Array]>) => this.add(this.msg, fn);
  onPeerOpen = (fn: Fn<[string]>) => this.add(this.po, fn);
  onPeerClose = (fn: Fn<[string]>) => this.add(this.pc, fn);
  onMemberLeft = (fn: Fn<[string]>) => this.add(this.ml, fn);
  onMembers = (fn: Fn<[]>) => this.add(this.mb, fn);
  onClosed = (fn: Fn<[string]>) => this.add(this.cl, fn);
}
