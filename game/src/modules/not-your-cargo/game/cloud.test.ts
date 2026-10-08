import { describe, expect, it, vi } from "vitest";
import { CloudSave, CLOUD_KEY } from "./cloud";
import { completeMission, defaultSave, mergeSaves, recordDuel } from "./save";

describe("cloud save", () => {
  it("merge = union of progress, max of records, local device preferences", () => {
    let phone = completeMission(defaultSave(), "C01", 2, "easy");
    phone = { ...phone, lang: "en", muted: true };
    let pc = completeMission(completeMission(defaultSave(), "C01", 3, "hard"), "C02", 1);
    pc = recordDuel(recordDuel(pc, true), false);
    const m = mergeSaves(phone, pc);
    expect(m.completed).toEqual(["C01", "C02"]);
    expect(m.stars).toEqual({ C01: 3, C02: 1 });
    expect(m.cleared.C01).toEqual(["easy", "hard"]);
    expect(m.weapons).toEqual(["mg", "shotgun", "laser"]);
    expect([m.pvpWins, m.pvpMatches]).toEqual([1, 2]);
    expect([m.lang, m.muted]).toEqual(["en", true]);
    // merging again changes nothing (no double counting)
    expect(mergeSaves(m, pc)).toEqual(m);
  });

  it("pull merges the cloud copy; a tampered cloud copy is validated like a local one", async () => {
    const cloudCopy = { ...completeMission(defaultSave(), "C01", 3, "hard"), weapons: ["mg", "rocket"], completed: ["C01", "C99"] };
    const set = vi.fn(async () => ({ ok: true, data: { KeyID: CLOUD_KEY } }));
    const client = { userCustomData: { getMyUserCustomData: async () => ({ ok: true, data: { Private: { [CLOUD_KEY]: { Value: JSON.stringify(cloudCopy) } } } }), setPrivateData: set } } as never;
    const c = new CloudSave(client);
    const merged = await c.pull(defaultSave());
    expect(merged.completed).toEqual(["C01"]);
    expect(merged.weapons).toEqual(["mg", "shotgun"]); // weapons follow missions, not the stored list
    expect(c.status).toBe("synced");
  });

  it("a server error keeps the local save and reports it", async () => {
    const client = { userCustomData: { getMyUserCustomData: async () => ({ ok: false, reason: "connection" }), setPrivateData: vi.fn() } } as never;
    const c = new CloudSave(client);
    const local = completeMission(defaultSave(), "C01");
    expect(await c.pull(local)).toBe(local);
    expect(c.status).toBe("error");
  });
});
