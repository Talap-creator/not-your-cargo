import { describe, expect, it } from "vitest";
import { NO_INPUT, type BikeInput } from "./combat";
import { createTraining, stepTraining } from "./tutorial";

const inp = (p: Partial<BikeInput> = {}): BikeInput => ({ ...NO_INPUT, ...p });

describe("training ground", () => {
  it("walks through every step in order and finishes", () => {
    const s = createTraining();
    const run = (n: number, i: Partial<BikeInput>) => {
      for (let k = 0; k < n; k++) stepTraining(s, inp(i));
    };
    run(10, { fire: true }); // shooting before the move step does not skip it
    expect(s.step).toBe("move");
    s.player.x = s.map.marker.x;
    s.player.y = s.map.marker.y;
    run(1, {});
    expect(s.step).toBe("shoot");
    for (const t of s.targets) {
      const aim = Math.atan2(t.y - s.player.y, t.x - s.player.x);
      run(20, { fire: true, aim });
      run(5, { aim });
    }
    expect(s.targets.every((t) => !t.alive)).toBe(true);
    expect(s.step).toBe("dash");
    run(1, { moveY: -1, dash: true });
    expect(s.step).toBe("reload");
    run(60, {}); // let a running auto-reload finish
    s.player.mag = 3;
    run(1, { reload: true });
    expect(s.step).toBe("take");
    s.player.x = s.cargo.x - 20;
    s.player.y = s.cargo.y;
    run(16, { interact: true });
    expect(s.step).toBe("drop");
    run(1, { drop: true });
    expect(s.step).toBe("retake");
    s.player.x = s.cargo.x;
    s.player.y = s.cargo.y;
    run(16, { interact: true });
    expect(s.step).toBe("deliver");
    s.player.x = s.map.zone.x + 80;
    s.player.y = s.map.zone.y + 80;
    run(46, { interact: true });
    expect(s.step).toBe("done");
  });
});
