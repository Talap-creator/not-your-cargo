export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const dist2 = (ax: number, ay: number, bx: number, by: number): number =>
  (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

/** Move input of any length → length ≤ 1, so diagonals are not faster (G01). */
export function normalizeMove(x: number, y: number): Vec {
  const len = Math.hypot(x, y);
  if (len <= 1e-6) return { x: 0, y: 0 };
  if (len <= 1) return { x, y };
  return { x: x / len, y: y / len };
}

export function circleHitsRect(cx: number, cy: number, r: number, rc: Rect): boolean {
  const nx = clamp(cx, rc.x, rc.x + rc.w);
  const ny = clamp(cy, rc.y, rc.y + rc.h);
  return dist2(cx, cy, nx, ny) < r * r;
}

/** Push a circle out of a rect along the shortest axis. */
export function resolveCircleRect(p: Vec, r: number, rc: Rect): void {
  const nx = clamp(p.x, rc.x, rc.x + rc.w);
  const ny = clamp(p.y, rc.y, rc.y + rc.h);
  const dx = p.x - nx;
  const dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    p.x = nx + (dx / d) * r;
    p.y = ny + (dy / d) * r;
    return;
  }
  // Centre inside the rect: leave through the nearest side.
  const left = p.x - rc.x;
  const right = rc.x + rc.w - p.x;
  const top = p.y - rc.y;
  const bottom = rc.y + rc.h - p.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) p.x = rc.x - r;
  else if (m === right) p.x = rc.x + rc.w + r;
  else if (m === top) p.y = rc.y - r;
  else p.y = rc.y + rc.h + r;
}

/**
 * First t in [0,1] where segment a→b enters rect (Liang–Barsky), or null. Used per tick for
 * bullets so a fast projectile cannot skip through a thin wall (G02).
 */
export function segmentRectT(ax: number, ay: number, bx: number, by: number, rc: Rect): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const p: readonly [number, number, number, number] = [-dx, dx, -dy, dy];
  const q: readonly [number, number, number, number] = [ax - rc.x, rc.x + rc.w - ax, ay - rc.y, rc.y + rc.h - ay];
  for (let i = 0; i < 4; i++) {
    const pi = p[i as 0]; // i is 0..3
    const qi = q[i as 0];
    if (Math.abs(pi) < 1e-12) {
      if (qi < 0) return null;
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0;
}

/** First t in [0,1] where segment a→b comes within r of point c, or null. */
export function segmentCircleT(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  if (a < 1e-12) return null;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/** Deterministic PRNG (mulberry32) — the same seed gives the same spread on host and in tests. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
