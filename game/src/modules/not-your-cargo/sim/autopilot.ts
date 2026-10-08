// Test-only autopilot: plays a campaign mission through BikeInput alone (no state edits) to check
// that missions are completable and to measure difficulty. Not imported by the game.
import { BIKE, CARGO } from "./config";
import { hasLineOfSight, NO_INPUT, type BikeInput } from "./combat";
import { circleHitsRect } from "./geom";
import { objective, type MissionState } from "./mission";
import { telegraph } from "./enemies";

const CELL = 40;

interface Grid {
  w: number;
  h: number;
  free: Uint8Array;
}

function buildGrid(s: MissionState): Grid {
  const w = Math.ceil(s.map.w / CELL);
  const h = Math.ceil(s.map.h / CELL);
  const free = new Uint8Array(w * h);
  const pad = BIKE.radius + 6;
  for (let gy = 0; gy < h; gy++)
    for (let gx = 0; gx < w; gx++) {
      const cx = gx * CELL + CELL / 2;
      const cy = gy * CELL + CELL / 2;
      let ok = cx > pad && cy > pad && cx < s.map.w - pad && cy < s.map.h - pad;
      for (const r of s.map.walls) if (ok && cx > r.x - pad && cx < r.x + r.w + pad && cy > r.y - pad && cy < r.y + r.h + pad) ok = false;
      free[gy * w + gx] = ok ? 1 : 0;
    }
  return { w, h, free };
}

function nearestFree(g: Grid, gx: number, gy: number): [number, number] {
  for (let r = 0; r < 8; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = gx + dx;
        const y = gy + dy;
        if (x >= 0 && y >= 0 && x < g.w && y < g.h && g.free[y * g.w + x]) return [x, y];
      }
  return [gx, gy];
}

/** A* on the grid; returns world waypoints (cell centres). */
function path(g: Grid, sx: number, sy: number, tx: number, ty: number): { x: number; y: number }[] {
  const [ax, ay] = nearestFree(g, Math.floor(sx / CELL), Math.floor(sy / CELL));
  const [bx, by] = nearestFree(g, Math.floor(tx / CELL), Math.floor(ty / CELL));
  const N = g.w * g.h;
  const gs = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open: number[] = [];
  const start = ay * g.w + ax;
  const goal = by * g.w + bx;
  gs[start] = 0;
  open.push(start);
  const hcost = (i: number) => Math.hypot((i % g.w) - bx, Math.floor(i / g.w) - by);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (gs[open[i]!]! + hcost(open[i]!) < gs[open[bi]!]! + hcost(open[bi]!)) bi = i;
    const cur = open.splice(bi, 1)[0]!;
    if (cur === goal) break;
    closed[cur] = 1;
    const cx = cur % g.w;
    const cy = Math.floor(cur / g.w);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h) continue;
        const ni = ny * g.w + nx;
        if (!g.free[ni] || closed[ni]) continue;
        if (dx && dy && (!g.free[cy * g.w + nx] || !g.free[ny * g.w + cx])) continue; // no corner cutting
        const ng = gs[cur]! + (dx && dy ? 1.414 : 1);
        if (ng < gs[ni]!) {
          gs[ni] = ng;
          from[ni] = cur;
          if (!open.includes(ni)) open.push(ni);
        }
      }
  }
  const out: { x: number; y: number }[] = [];
  for (let i = goal; i !== -1 && i !== start; i = from[i]!) out.push({ x: (i % g.w) * CELL + CELL / 2, y: Math.floor(i / g.w) * CELL + CELL / 2 });
  out.reverse();
  out.push({ x: tx, y: ty });
  return out;
}

export function makeAutopilot(s: MissionState) {
  const grid = buildGrid(s);
  let route: { x: number; y: number }[] = [];
  let routeFor = { x: NaN, y: NaN };
  let tick = 0;
  return (): BikeInput => {
    tick++;
    const p = s.player;
    // where to go
    let goal = objective(s).target;
    if (s.truck) {
      const t = s.truck;
      const next = goal ?? t;
      // escort: ride just ahead of the truck towards its next point
      const a = Math.atan2(next.y - t.y, next.x - t.x);
      goal = { x: t.x + Math.cos(a) * 90, y: t.y + Math.sin(a) * 90 + 50 };
    }
    if (p.hp < 50) {
      const kit = s.kits.filter((k) => k.ready).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
      if (kit && Math.hypot(kit.x - p.x, kit.y - p.y) < 700) goal = kit;
    }
    if (!goal) goal = { x: p.x, y: p.y };
    if (tick % 15 === 1 || Math.hypot(goal.x - routeFor.x, goal.y - routeFor.y) > 60) {
      route = path(grid, p.x, p.y, goal.x, goal.y);
      routeFor = { ...goal };
    }
    while (route.length > 1 && Math.hypot(route[0]!.x - p.x, route[0]!.y - p.y) < 22) route.shift();
    const wp = route[0] ?? goal;
    let mx = wp.x - p.x;
    let my = wp.y - p.y;
    const ml = Math.hypot(mx, my);
    const arrived = Math.hypot(goal.x - p.x, goal.y - p.y) < 24;
    if (ml > 4 && !arrived) {
      mx /= ml;
      my /= ml;
    } else {
      mx = 0;
      my = 0;
    }
    // fight: nearest visible enemy
    let aim = Math.atan2(my, mx || 1);
    let fire = false;
    let best = Infinity;
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 560 && d < best && hasLineOfSight(p.x, p.y, e.x, e.y, s.map)) {
        best = d;
        aim = Math.atan2(e.y - p.y, e.x - p.x);
        fire = true;
      }
    }
    // dodge: a telegraph line passing near the courier → dash sideways
    let dash = false;
    for (const e of s.enemies) {
      const tl = telegraph(e);
      if (!tl) continue;
      const vx = tl.x2 - e.x;
      const vy = tl.y2 - e.y;
      const len2 = vx * vx + vy * vy || 1;
      const k = Math.max(0, Math.min(1, ((p.x - e.x) * vx + (p.y - e.y) * vy) / len2));
      const dist = Math.hypot(e.x + vx * k - p.x, e.y + vy * k - p.y);
      if (dist < 40 && p.dashCd <= 0) {
        const n = Math.hypot(vx, vy) || 1;
        mx = -vy / n;
        my = vx / n;
        dash = true;
      }
    }
    // interact near the current target (cargo / goal / terminal), never while dodging
    const near = (x: number, y: number, r: number) => Math.hypot(x - p.x, y - p.y) < r;
    let interact = false;
    if (!s.cargo.carried && s.cargo.exists && near(s.cargo.x, s.cargo.y, CARGO.pickupRange - 6)) interact = true;
    if (s.cargo.carried && s.map.goal && circleHitsRect(p.x, p.y, 1, s.map.goal)) interact = true;
    if (s.terminal && !s.terminal.done && near(s.terminal.x, s.terminal.y, 46)) interact = true;
    if (interact && !dash) {
      mx = 0;
      my = 0;
    }
    return { ...NO_INPUT, moveX: mx, moveY: my, aim, fire, dash, interact: interact && !dash, reload: !fire && p.mag < 6 };
  };
}
