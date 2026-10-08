// Balance probe: the autopilot plays each mission with each weapon over several seeds, using input
// only. Slow-ish, so it runs on demand: BALANCE=1 npx vitest run balance
import { describe, expect, it } from "vitest";
import { TICK_HZ, type WeaponId } from "./config";
import { createMission, stepMission, type Difficulty } from "./mission";
import { makeAutopilot } from "./autopilot";
import type { MissionId } from "./campaign-maps";

const on = process.env.BALANCE === "1";
const SEEDS = Number(process.env.SEEDS ?? 8);
const LIMIT = 6 * 60 * TICK_HZ;
const DIFF = (process.env.DIFF ?? "normal") as Difficulty;

const PLAN: [MissionId, WeaponId[]][] = [
  ["C01", ["mg"]],
  ["C02", ["mg", "shotgun"]],
  ["C03", ["mg", "shotgun", "laser"]],
  ["C04", ["mg", "laser", "rocket"]],
  ["C05", ["mg", "laser", "rocket"]],
];

describe.skipIf(!on)("balance (autopilot)", () => {
  it("every mission is completable by input alone", () => {
    const rows: string[] = [];
    const anyWin: Record<string, boolean> = {};
    for (const [id, weapons] of PLAN) {
      for (const w of weapons) {
        let wins = 0;
        let time = 0;
        let hp = 0;
        const lost: Record<string, number> = {};
        for (let seed = 1; seed <= SEEDS; seed++) {
          const s = createMission(w, seed * 7919, id, DIFF);
          const pilot = makeAutopilot(s);
          let t = 0;
          while (s.phase === "playing" && t < LIMIT) {
            stepMission(s, pilot());
            t++;
          }
          if (s.phase === "won") {
            wins++;
            time += s.time;
            hp += s.player.hp;
          } else {
            const why = s.phase === "lost" ? `${s.lostReason ?? "?"}@${s.stage}${s.boss ? `(boss ${Math.round(s.boss.hp)})` : ""}` : `timeout@${s.stage}${s.id === "C02" ? `/${s.route}` : ""}`;
            lost[why] = (lost[why] ?? 0) + 1;
          }
        }
        anyWin[id] ||= wins > 0;
        rows.push(
          `${id} ${w.padEnd(7)} win ${wins}/${SEEDS}  avg ${wins ? Math.round(time / wins) : "-"}s  hpLeft ${wins ? Math.round(hp / wins) : "-"}  lost ${JSON.stringify(lost)}`,
        );
      }
    }
    console.log("\n" + rows.join("\n"));
    for (const [id] of PLAN) expect(anyWin[id], `${id} never won`).toBe(true);
  }, 600_000);
});
