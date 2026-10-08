// Two Duel instances over an in-memory link. This checks the protocol rules (N03/N05, P04, rematch);
// it is an automated test, not a substitute for live two-person matches on real devices.
import { describe, expect, it } from "vitest";
import { NO_INPUT, type BikeInput } from "../sim/combat";
import { PVP } from "../sim/config";
import { PVP_MAP } from "../sim/maps";
import { Duel } from "./duel";
import { memoryPair } from "./link";
import { decode, encode } from "./protocol";

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(opts: { lossFast?: number } = {}) {
  let now = 0;
  const [hl, gl] = memoryPair("HOST", "GUEST", opts);
  const hostIn: { v: BikeInput } = { v: NO_INPUT };
  const guestIn: { v: BikeInput } = { v: NO_INPUT };
  const host = new Duel(hl, { now: () => now, controls: () => hostIn.v, random: () => 0.25 });
  const guest = new Duel(gl, { now: () => now, controls: () => guestIn.v, random: () => 0.75 });
  hl.connect();
  const run = async (ms: number) => {
    for (let t = 0; t < ms; t += 33) {
      now += 33;
      host.pump();
      guest.pump();
      await flush();
    }
  };
  return { host, guest, hl, gl, hostIn, guestIn, run, clock: () => now };
}

async function startMatch(e: ReturnType<typeof setup>) {
  await flush();
  e.host.setLoadout("mg", true);
  e.guest.setLoadout("shotgun", true);
  await flush();
  await flush();
}

describe("duel over a link", () => {
  it("lobby → ready → match with countdown; one player alone waits", async () => {
    const [hl, other] = memoryPair("A", "B");
    other.open = false;
    const solo = new Duel(hl, { now: () => 0, controls: () => NO_INPUT });
    expect(solo.phase).toBe("waiting");

    const e = setup();
    await flush();
    expect(e.host.phase).toBe("lobby");
    expect(e.guest.phase).toBe("lobby");
    e.host.setLoadout("mg", true);
    await flush();
    expect(e.host.phase).toBe("lobby"); // guest not ready yet
    e.guest.setLoadout("shotgun", true);
    await flush();
    await flush();
    expect(e.host.phase).toBe("match");
    expect(e.guest.phase).toBe("match");
    expect(e.guest.matchId).toBe(e.host.matchId);
    expect(e.host.match?.players[e.guest.mySide].bike.weapon).toBe("shotgun");
    await e.run(500);
    expect(e.guest.view()?.phase).toBe("countdown");
  });

  it("guest input moves the guest bike on the host; snapshots reach the guest", async () => {
    const e = setup();
    await startMatch(e);
    await e.run(3300); // countdown
    const gSide = e.guest.mySide;
    const x0 = e.host.match!.players[gSide].bike.x;
    const y0 = e.host.match!.players[gSide].bike.y;
    void x0;
    e.guestIn.v = { ...NO_INPUT, moveY: 1 };
    await e.run(500);
    const y1 = e.host.match!.players[gSide].bike.y;
    expect(y1 - y0).toBeGreaterThan(90);
    const v = e.guest.view()!;
    expect(Math.abs(v.bikes[gSide].y - y1)).toBeLessThan(40); // prediction close to authority
  });

  it("rules version mismatch blocks the start", async () => {
    const e = setup();
    await flush();
    // a peer announcing another rulesVersion
    (e.host as unknown as { handle(m: unknown): void }).handle({ t: "hello", rv: "other" });
    e.host.setLoadout("mg", true);
    e.guest.setLoadout("mg", true);
    await flush();
    expect(e.host.versionError).toBeTruthy();
    expect(e.host.phase).toBe("lobby");
  });

  it("host ignores stale seq and foreign matchId", async () => {
    const e = setup();
    await startMatch(e);
    await e.run(3300);
    const h = e.host as unknown as { handle(m: unknown): void; guestIn: { s: number } | null };
    h.handle({ t: "in", m: e.host.matchId, s: 1000, mx: 0, my: 0, a: 0, f: 0, i: 0, dn: 0, qn: 0, rn: 0 });
    h.handle({ t: "in", m: e.host.matchId, s: 999, mx: 1, my: 0, a: 0, f: 1, i: 0, dn: 0, qn: 0, rn: 0 });
    expect(h.guestIn?.s).toBe(1000);
    h.handle({ t: "in", m: "other", s: 5000, mx: 1, my: 0, a: 0, f: 1, i: 0, dn: 0, qn: 0, rn: 0 });
    expect(h.guestIn?.s).toBe(1000);
  });

  it("guest silent > 250 ms: its held fire stops on the host", async () => {
    const e = setup();
    await startMatch(e);
    await e.run(3300);
    const gSide = e.guest.mySide;
    e.guestIn.v = { ...NO_INPUT, fire: true, aim: 0 };
    await e.run(300);
    expect(e.host.match!.players[gSide].bike.mag).toBeLessThan(24);
    // guest stops sending (frozen), host keeps simulating
    e.gl.open = false;
    for (let i = 0; i < 40; i++) {
      (e.host as Duel).pump();
      await flush();
    }
    const before = e.host.match!.players[gSide].bike.mag;
    for (let i = 0; i < 20; i++) e.host.pump();
    expect(e.host.match!.players[gSide].bike.mag).toBe(before);
  });

  it("guest leaves mid-match → host gets a technical win, guest is not counted", async () => {
    const e = setup();
    await startMatch(e);
    await e.run(4000);
    e.gl.drop();
    await flush();
    expect(e.host.phase).toBe("result");
    expect(e.host.result?.winner).toBe(e.host.mySide);
    expect(e.host.result?.reason).toBe("opponent-left");
  });

  it("host disappears → guest shows aborted after the watchdog, never hangs", async () => {
    const e = setup();
    await startMatch(e);
    await e.run(4000);
    e.hl.open = false; // host tab frozen: no more snapshots, no leave notice
    let t = 0;
    while (e.guest.phase === "match" && t < 12000) {
      await e.run(500);
      t += 500;
    }
    expect(e.guest.phase).toBe("result");
    expect(e.guest.result?.outcome).toBe("aborted");
    expect(t).toBeLessThanOrEqual(10500);
  }, 30000);

  it("a transient link drop (both still in the room) does not end the match once the link is back", async () => {
    const e = setup();
    await startMatch(e);
    await e.run(4000);
    expect(e.guest.phase).toBe("match");
    e.gl.blip();
    await e.run(3000); // 3 s without any packets
    e.gl.restore();
    await e.run(12000); // well past the 10 s watchdog after the drop
    expect(e.host.phase).toBe("match");
    expect(e.guest.phase).toBe("match");
    expect(e.guest.result).toBeNull();
  }, 30000);

  it("full match by deliveries, same result on both, rematch swaps sides and ignores old packets", async () => {
    const e = setup();
    await startMatch(e);
    await e.run(3300);
    const m = e.host.match!;
    const firstMatchId = m.matchId;
    const hostSide = e.host.mySide;
    // fast-forward: host delivers three times (authority-side state)
    for (let k = 0; k < 3; k++) {
      m.cargo = { x: 0, y: 0, carrier: hostSide, away: 0 };
      m.players[hostSide].bike.carrying = true;
      const base = PVP_MAP.bases[hostSide];
      m.players[hostSide].bike.x = base.x + 50;
      m.players[hostSide].bike.y = base.y + 70;
      e.hostIn.v = { ...NO_INPUT, interact: true };
      await e.run(1700);
    }
    e.hostIn.v = NO_INPUT;
    await e.run(200);
    expect(e.host.phase).toBe("result");
    expect(e.guest.phase).toBe("result");
    expect(e.guest.result).toEqual(e.host.result);
    expect(e.host.result?.winner).toBe(hostSide);

    e.guest.requestRematch(true);
    await flush();
    expect(e.host.phase).toBe("result"); // needs both
    e.host.requestRematch(true);
    await flush();
    await flush();
    expect(e.host.phase).toBe("match");
    expect(e.guest.phase).toBe("match");
    expect(e.host.matchId).not.toBe(firstMatchId);
    expect(e.host.mySide).not.toBe(hostSide);
    // a late packet of the old match changes nothing
    const g = e.guest as unknown as { handle(m: unknown): void };
    g.handle({ t: "result", matchId: firstMatchId, result: { outcome: "win", winner: 0 } });
    expect(e.guest.phase).toBe("match");
  }, 30000);

  it("works with 5% loss on the fast channel", async () => {
    let i = 0;
    const e = setup({ lossFast: 0.05 });
    // deterministic loss pattern via the shared random
    (e.hl as unknown as { random: () => number }).random = () => ((i++ * 37) % 100) / 100;
    (e.gl as unknown as { random: () => number }).random = () => ((i++ * 53) % 100) / 100;
    await startMatch(e);
    await e.run(3300);
    e.guestIn.v = { ...NO_INPUT, moveY: 1 };
    await e.run(1000);
    const s = e.guest.stats();
    expect(s.snapshotLossPct).not.toBeNull();
    expect(s.unstable).toBe(false);
    expect(e.host.match!.players[e.guest.mySide].bike.y).toBeGreaterThan(PVP_MAP.spawns[0].y + 100);
  });

  it("protocol drops malformed or oversized messages", () => {
    expect(decode(new TextEncoder().encode("{bad"))).toBeNull();
    expect(decode(new TextEncoder().encode(JSON.stringify({ t: "in", m: "x", s: "1" })))).toBeNull();
    const big = new Uint8Array(20000);
    expect(decode(big)).toBeNull();
    const clamped = decode(encode({ t: "in", m: "x", s: 1, mx: 5, my: -9, a: 0, f: 1, i: 0, dn: 0, qn: 0, rn: 0 }));
    expect(clamped && clamped.t === "in" && clamped.mx).toBe(1);
    expect(PVP.inputTimeout).toBe(0.25);
  });
});
