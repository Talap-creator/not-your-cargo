import { describe, expect, it } from "vitest";
import { createMission, DIFF } from "../sim/mission";
import { ACHIEVEMENTS, unlocked } from "./achievements";
import { completeMission, defaultSave, loadSave, recordDuel } from "./save";

describe("difficulty and achievements", () => {
  it("difficulty scales enemy HP; normal is unchanged", () => {
    const hp = (d: "easy" | "normal" | "hard") => createMission("mg", 1, "C02", d).enemies.map((e) => e.maxHp);
    const n = hp("normal");
    expect(n.length).toBeGreaterThan(0);
    expect(hp("hard")[0]).toBe(Math.round(n[0]! * DIFF.hard.hp));
    expect(hp("easy")[0]!).toBeLessThan(n[0]!);
  });

  it("per-difficulty clears unlock their achievements, idempotently", () => {
    let s = defaultSave();
    s = completeMission(s, "C01", 3, "hard");
    s = completeMission(s, "C01", 1, "hard");
    expect(s.cleared.C01).toEqual(["hard"]);
    expect(unlocked(s)).toContain("C01.hard");
    expect(unlocked(s)).not.toContain("C01.easy");
  });

  it("old saves count as normal; duel counters can't be negative or inflated past matches", () => {
    const store = { getItem: () => JSON.stringify({ v: 1, completed: ["C01"], pvpWins: 5, pvpMatches: 2 }) };
    const s = loadSave(store);
    expect(s.cleared.C01).toEqual(["normal"]);
    expect(s.pvpMatches).toBe(5);
    expect(loadSave({ getItem: () => JSON.stringify({ v: 1, pvpWins: -3 }) }).pvpWins).toBe(0);
  });

  it("100 duel wins", () => {
    let s = defaultSave();
    for (let i = 0; i < 100; i++) s = recordDuel(s, true);
    expect(unlocked(s)).toEqual(expect.arrayContaining(["pvp.win1", "pvp.win10", "pvp.win50", "pvp.win100", "pvp.play25"]));
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
