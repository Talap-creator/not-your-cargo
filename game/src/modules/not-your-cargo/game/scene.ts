// Phaser renderer. Draws a RenderModel with vector shapes (placeholder art until sprites arrive):
// shapes differ by FORM, not only colour — triangle bikes, square raiders, diamond cargo, round kits.
// The canvas is a fixed 960×540 logical view scaled to fit, so a wide window never shows more of the
// PvP arena than a narrow one (G01).
import Phaser from "phaser";
import { VIEW_H, VIEW_W } from "../sim/config";
import type { Rect } from "../sim/geom";
// Every SVG in assets/sprites becomes a texture named after its file (bike_blue.svg → "bike_blue").
const SPRITE_URLS = import.meta.glob("../assets/sprites/*.svg", { query: "?no-inline", import: "default", eager: true }) as Record<string, string>;
// raster size (2× the viewBox) for the ones that are not 1:1 squares of 64
const RASTER: Record<string, [number, number]> = {
  bike_blue: [128, 96], bike_pink: [128, 96], bike_paint: [128, 96], turret_mg: [96, 32], turret_shotgun: [96, 40], turret_laser: [96, 32], turret_rocket: [96, 40],
  raider: [96, 96], cargo: [64, 64], repair_kit: [64, 64], target: [80, 80], ground_sand: [256, 256], station: [320, 320],
  turret: [96, 96], drone: [80, 80], boss: [256, 192], truck: [224, 112], terminal: [96, 96], core: [64, 64], evac: [320, 320], rocket: [48, 20],
};
const SPRITES: Record<string, [string, number, number]> = Object.fromEntries(
  Object.entries(SPRITE_URLS)
    .map(([path, url]) => {
      const key = path.split("/").pop()!.replace(/\.svg$/, "");
      const [w, h] = RASTER[key] ?? [96, 96];
      return [key, [url, w, h] as [string, number, number]] as const;
    })
    .filter(([key]) => !key.startsWith("icon_") && key !== "wall_block" && key !== "ground_road"),
);

export interface RBike {
  x: number; y: number; aim: number; heading: number; hp: number; maxHp: number; alive: boolean;
  color: number; carrying: boolean; dashing: boolean; shield: number; me: boolean; weapon?: string; trail?: boolean; paint?: number | null;
}
export interface RenderModel {
  key: string; // map id — labels are rebuilt when it changes
  w: number;
  h: number;
  walls: Rect[];
  decor: { x: number; y: number; r: number }[];
  zones: { rect: Rect; color: number; label: string; sprite?: string }[];
  bikes: RBike[];
  enemies: { x: number; y: number; aim: number; hp: number; maxHp: number; kind?: string; tele?: { x2: number; y2: number } | null }[];
  truck?: { x: number; y: number; rot: number; hp: number; maxHp: number; waiting: boolean } | null;
  props?: { key: string; x: number; y: number; w: number; rot: number; alpha?: number }[];
  targets?: { x: number; y: number; alive: boolean }[];
  warnings: { x: number; y: number; left: number }[];
  cargo: { x: number; y: number; visible: boolean; carried: boolean; sprite?: string };
  projectiles: { x: number; y: number; kind: number; vx?: number; vy?: number }[];
  repairs: { x: number; y: number; ready: boolean }[];
  hold: { x: number; y: number; progress: number; color: number } | null;
  focus: { x: number; y: number };
  objective: { x: number; y: number } | null;
  /** limited sight around the focus (sandstorm / blackout) */
  fog?: { r: number; color: number; alpha: number } | null;
  events: { type: string; x: number; y: number; mine?: boolean; r?: number }[];
  shake: boolean;
}

export interface FrameSource {
  frame(dtMs: number): RenderModel | null;
  setCamera(scrollX: number, scrollY: number): void;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number }

const C = {
  ground: 0xc9a46a,
  groundDark: 0xb48f58,
  wall: 0x3b3330,
  wallTop: 0x5a4d46,
  decor: 0x8d8a4a,
  cargo: 0xff7a1a,
  bullet: 0xfff1b8,
  pellet: 0xffb36b,
  enemyBullet: 0xff3b3b,
  raider: 0x7a2420,
  kit: 0x4fd18b,
};

export function createGame(parent: HTMLElement, src: FrameSource): Phaser.Game {
  class World extends Phaser.Scene {
    private g!: Phaser.GameObjects.Graphics;
    private ui!: Phaser.GameObjects.Graphics;
    private labels: Phaser.GameObjects.Text[] = [];
    private mapKey = "";
    private parts: Particle[] = [];
    private top!: Phaser.GameObjects.Graphics;
    private ground: Phaser.GameObjects.TileSprite | null = null;
    private pool = new Map<string, Phaser.GameObjects.Image[]>();
    private used = new Map<string, number>();
    constructor() {
      super("world");
    }
    preload() {
      for (const [key, [url, w, h]] of Object.entries(SPRITES)) this.load.svg(key, url, { width: w, height: h });
    }
    private fog: { g: Phaser.GameObjects.Graphics; hole: Phaser.GameObjects.Graphics }[] = [];
    /** A full-screen tint with a round hole (inverted geometry mask): limited sight. */
    private fogLayer(i: number, x: number, y: number, r: number, color: number, alpha: number) {
      let l = this.fog[i];
      if (!l) {
        const g = this.add.graphics().setScrollFactor(0).setDepth(9);
        const hole = this.make.graphics({}, false).setScrollFactor(0);
        const mask = hole.createGeometryMask();
        mask.setInvertAlpha(true);
        g.setMask(mask);
        l = { g, hole };
        this.fog[i] = l;
      }
      l.g.setVisible(true).clear().fillStyle(color, alpha).fillRect(0, 0, VIEW_W, VIEW_H);
      l.hole.clear().fillStyle(0xffffff, 1).fillCircle(x, y, r);
    }
    private has(key: string): boolean {
      return this.textures.exists(key);
    }
    create() {
      this.g = this.add.graphics().setDepth(0);
      this.top = this.add.graphics().setDepth(5);
      this.ui = this.add.graphics().setScrollFactor(0).setDepth(10);
    }
    /** A pooled image for this frame: width in world units, height keeps the aspect. */
    private spr(key: string, x: number, y: number, rot: number, w: number, depth = 2, ox = 0.5, oy = 0.5, alpha = 1) {
      const list = this.pool.get(key) ?? [];
      this.pool.set(key, list);
      const n = this.used.get(key) ?? 0;
      this.used.set(key, n + 1);
      let im = list[n];
      if (!im) {
        im = this.add.image(0, 0, key);
        list.push(im);
      }
      const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
      im.setVisible(true).setPosition(x, y).setRotation(rot).setDepth(depth).setOrigin(ox, oy).setAlpha(alpha);
      im.setDisplaySize(w, (w * src.height) / src.width);
      return im;
    }
    override update(_t: number, dt: number) {
      const m = src.frame(dt);
      const g = this.g;
      g.clear();
      this.top.clear();
      this.ui.clear();
      this.used.clear();
      try {
        this.draw(m, dt);
      } finally {
        for (const [key, list] of this.pool) for (let i = this.used.get(key) ?? 0; i < list.length; i++) list[i]!.setVisible(false);
      }
    }

    private draw(m: RenderModel | null, dt: number) {
      const g = this.g;
      if (this.ground) this.ground.setVisible(!!m);
      if (!m) {
        this.cameras.main.setBackgroundColor(0x1d1714);
        return;
      }
      const cam = this.cameras.main;
      cam.setBackgroundColor(0x1d1714);
      cam.setBounds(0, 0, m.w, m.h);
      const tx = Phaser.Math.Clamp(m.focus.x - VIEW_W / 2, 0, Math.max(0, m.w - VIEW_W));
      const ty = Phaser.Math.Clamp(m.focus.y - VIEW_H / 2, 0, Math.max(0, m.h - VIEW_H));
      const k = 1 - Math.pow(0.0015, dt / 1000);
      cam.scrollX += (tx - cam.scrollX) * k;
      cam.scrollY += (ty - cam.scrollY) * k;
      src.setCamera(cam.scrollX, cam.scrollY);
      if (m.key !== this.mapKey) this.rebuildLabels(m);

      // tiled sand ground (sprite), grid kept faint so motion reads
      if (!this.ground) this.ground = this.add.tileSprite(0, 0, m.w, m.h, "ground_sand").setOrigin(0, 0).setDepth(-1).setTileScale(0.5);
      this.ground.setSize(m.w, m.h).setDisplaySize(m.w, m.h);
      g.lineStyle(1, C.groundDark, 0.15);
      for (let x = 0; x <= m.w; x += 160) g.lineBetween(x, 0, x, m.h);
      for (let y = 0; y <= m.h; y += 160) g.lineBetween(0, y, m.w, y);
      for (const d of m.decor) g.fillStyle(C.decor, 0.55).fillCircle(d.x, d.y, d.r);
      for (const z of m.zones) {
        if (z.sprite && this.has(z.sprite)) this.spr(z.sprite, z.rect.x + z.rect.w / 2, z.rect.y + z.rect.h / 2, 0, Math.min(z.rect.w, z.rect.h), 0.5, 0.5, 0.5, 0.9);
        g.fillStyle(z.color, 0.18).fillRect(z.rect.x, z.rect.y, z.rect.w, z.rect.h);
        g.lineStyle(3, z.color, 0.9).strokeRect(z.rect.x, z.rect.y, z.rect.w, z.rect.h);
      }
      for (const r of m.repairs) {
        g.lineStyle(2, C.kit, r.ready ? 1 : 0.3).strokeCircle(r.x, r.y, 20);
        if (r.ready) this.spr("repair_kit", r.x, r.y, 0, 28);
      }
      for (const w of m.walls) {
        g.fillStyle(C.wall, 1).fillRect(w.x, w.y, w.w, w.h);
        g.fillStyle(C.wallTop, 1).fillRect(w.x, w.y, w.w, Math.min(6, w.h));
      }
      for (const w of m.warnings) {
        const a = 0.4 + 0.4 * Math.sin(w.left * 20);
        g.lineStyle(3, 0xff3b3b, a).strokeCircle(w.x, w.y, 22);
        g.lineBetween(w.x - 10, w.y - 10, w.x + 10, w.y + 10).lineBetween(w.x + 10, w.y - 10, w.x - 10, w.y + 10);
      }
      const cargoKey = m.cargo.sprite && this.has(m.cargo.sprite) ? m.cargo.sprite : "cargo";
      if (m.cargo.visible && !m.cargo.carried) this.spr(cargoKey, m.cargo.x, m.cargo.y, 0, 30, 3);
      for (const pr of m.props ?? []) {
        if (this.has(pr.key)) this.spr(pr.key, pr.x, pr.y, pr.rot, pr.w, 1, 0.5, 0.5, pr.alpha ?? 1);
        else g.fillStyle(0x3b3330, 1).fillRect(pr.x - pr.w / 2, pr.y - pr.w / 2, pr.w, pr.w).fillStyle(0x6ff0ff, 1).fillRect(pr.x - 10, pr.y - 6, 20, 12);
      }
      if (m.truck) {
        const tr = m.truck;
        if (this.has("truck")) this.spr("truck", tr.x, tr.y, tr.rot, 96, 2);
        else g.fillStyle(0xff7a1a, 1).fillRect(tr.x - 44, tr.y - 22, 88, 44);
        this.bar(this.top, tr.x, tr.y - 40, tr.hp / tr.maxHp, 0x4fd18b);
        if (tr.waiting) this.top.lineStyle(2, 0xffd166, 0.8).strokeCircle(tr.x, tr.y, 300);
      }
      for (const t of m.targets ?? []) {
        if (!t.alive) {
          g.fillStyle(0x2a2420, 0.5).fillCircle(t.x, t.y, 12);
          continue;
        }
        this.spr("target", t.x, t.y, 0, 38);
      }
      for (const e of m.enemies) {
        if (e.tele) this.top.lineStyle(e.kind === "boss" ? 6 : 3, 0xff3b3b, 0.55 + 0.35 * Math.sin(this.time.now / 60)).lineBetween(e.x, e.y, e.tele.x2, e.tele.y2);
        const key = e.kind && e.kind !== "raider" && this.has(e.kind) ? e.kind : "raider";
        const size = e.kind === "boss" ? 110 : e.kind === "turret" ? 40 : e.kind === "drone" ? 30 : 38;
        if (key === "raider" && e.kind && e.kind !== "raider") {
          // art not loaded: a distinct shape per kind
          const c = e.kind === "boss" ? 0x5a1a16 : e.kind === "turret" ? 0x3b3330 : 0x7a2420;
          if (e.kind === "drone") g.fillStyle(c, 1).fillCircle(e.x, e.y, 13);
          else g.fillStyle(c, 1).fillRect(e.x - size / 2, e.y - size / 2, size, size);
          g.lineStyle(5, 0x1d1714, 1).lineBetween(e.x, e.y, e.x + Math.cos(e.aim) * size * 0.7, e.y + Math.sin(e.aim) * size * 0.7);
        } else this.spr(key, e.x, e.y, e.aim, size, 2);
        if (e.kind === "boss") {
          this.top.fillStyle(0x000000, 0.5).fillRect(e.x - 50, e.y - 70, 100, 8);
          this.top.fillStyle(0xff3b3b, 1).fillRect(e.x - 50, e.y - 70, 100 * Math.max(0, e.hp / e.maxHp), 8);
        } else this.bar(this.top, e.x, e.y - 26, e.hp / e.maxHp, 0xff5a4a);
      }
      for (const b of m.bikes) this.bike(this.top, b);
      const pg = this.top;
      for (const p of m.projectiles) {
        if (p.kind === 3) {
          const vx = p.vx ?? 1;
          const vy = p.vy ?? 0;
          const l = Math.hypot(vx, vy) || 1;
          pg.lineStyle(4, 0x6ff0ff, 1).lineBetween(p.x - (vx / l) * 140, p.y - (vy / l) * 140, p.x, p.y);
        } else if (p.kind === 4) {
          const a = Math.atan2(p.vy ?? 0, p.vx ?? 1);
          if (this.has("rocket")) this.spr("rocket", p.x, p.y, a, 22, 4);
          else pg.fillStyle(0xff7a1a, 1).fillCircle(p.x, p.y, 6);
        } else if (p.kind === 2) pg.fillStyle(C.enemyBullet, 1).fillCircle(p.x, p.y, 4);
        else if (p.kind === 1) pg.fillStyle(C.pellet, 1).fillCircle(p.x, p.y, 3);
        else pg.fillStyle(C.bullet, 1).fillRect(p.x - 3, p.y - 3, 6, 6);
      }
      if (m.hold) {
        pg.lineStyle(5, 0x000000, 0.35).strokeCircle(m.hold.x, m.hold.y, 30);
        pg.lineStyle(5, m.hold.color, 1);
        pg.beginPath();
        pg.arc(m.hold.x, m.hold.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, m.hold.progress));
        pg.strokePath();
      }
      this.effects(pg, m, dt);
      if (m.fog) {
        // a soft ring then a solid outside: sight shrinks to r around the courier
        const fx = m.focus.x - cam.scrollX;
        const fy = m.focus.y - cam.scrollY;
        const f = m.fog;
        const wobble = 6 * Math.sin(this.time.now / 300);
        this.fogLayer(0, fx, fy, f.r + 40 + wobble, f.color, f.alpha * 0.5);
        this.fogLayer(1, fx, fy, f.r + 90 + wobble, f.color, f.alpha);
      } else for (const l of this.fog) l.g.setVisible(false);
      if (m.objective) this.arrow(m, cam);
    }

    private cargoShape(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) {
      g.fillStyle(C.cargo, 1).fillPoints(
        [
          { x, y: y - r },
          { x: x + r, y },
          { x, y: y + r },
          { x: x - r, y },
        ] as Phaser.Types.Math.Vector2Like[],
        true,
      );
      g.lineStyle(2, 0x1d1714, 1).strokePoints(
        [
          { x, y: y - r },
          { x: x + r, y },
          { x, y: y + r },
          { x: x - r, y },
        ] as Phaser.Types.Math.Vector2Like[],
        true,
      );
    }

    private bike(g: Phaser.GameObjects.Graphics, b: RBike) {
      if (!b.alive) {
        g.fillStyle(0x2a2420, 0.7).fillCircle(b.x, b.y, 14);
        return;
      }
      const h = b.heading;
      const pt = (a: number, r: number) => ({ x: b.x + Math.cos(h + a) * r, y: b.y + Math.sin(h + a) * r });
      if (b.dashing) g.fillStyle(0xffffff, 0.25).fillCircle(b.x - Math.cos(h) * 18, b.y - Math.sin(h) * 18, 14);
      if (b.shield > 0) g.lineStyle(2, 0x9ad7ff, 0.9).strokeCircle(b.x, b.y, 22);
      void pt;
      if (b.me) g.lineStyle(2, 0xffffff, 0.55).strokeCircle(b.x, b.y, 24);
      if (b.trail) {
        // «Steppe Trail»: a two-tone engine trail + a thin gold ring. Pure cosmetics.
        const bx = b.x - Math.cos(h) * 22;
        const by = b.y - Math.sin(h) * 22;
        for (let i = 0; i < 2; i++)
          this.parts.push({ x: bx + (Math.random() - 0.5) * 8, y: by + (Math.random() - 0.5) * 8, vx: -Math.cos(h) * 60, vy: -Math.sin(h) * 60, life: 0.5, max: 0.5, color: i ? 0x6ff0ff : 0xffc24a, size: 4 });
        g.lineStyle(2, 0xffc24a, 0.9).strokeCircle(b.x, b.y, 27);
      }
      if (b.paint != null) {
        // a bought paint (cosmetic): the neutral hull tinted, the side colour kept as a ring
        g.lineStyle(3, b.color, 0.9).strokeCircle(b.x, b.y, 21);
        this.spr("bike_paint", b.x, b.y, h, 46, 2).setTint(b.paint);
      } else this.spr(b.color === 0xff4fa3 ? "bike_pink" : "bike_blue", b.x, b.y, h, 46, 2).clearTint();
      if (b.carrying) this.spr("cargo", b.x - Math.cos(h) * 12, b.y - Math.sin(h) * 12, h, 18, 3);
      // turret follows the aim, not the hull
      const tk = `turret_${b.weapon ?? "mg"}`;
      this.spr(this.has(tk) ? tk : "turret_mg", b.x, b.y, b.aim, b.weapon === "shotgun" || b.weapon === "rocket" ? 30 : 32, 4, 8 / 48, 0.5);
      this.bar(g, b.x, b.y - 30, b.hp / b.maxHp, b.me ? 0x4fd18b : 0xffd166);
    }

    private bar(g: Phaser.GameObjects.Graphics, x: number, y: number, f: number, color: number) {
      g.fillStyle(0x000000, 0.5).fillRect(x - 18, y, 36, 5);
      g.fillStyle(color, 1).fillRect(x - 18, y, 36 * Math.max(0, f), 5);
    }

    private effects(g: Phaser.GameObjects.Graphics, m: RenderModel, dt: number) {
      for (const e of m.events) {
        const burst = (n: number, color: number, speed: number, life: number, size: number) => {
          for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.4 + Math.random() * 0.6);
            this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size });
          }
        };
        if (e.type === "impact") burst(3, 0xe8d3a8, 90, 0.25, 2);
        else if (e.type === "hit") {
          burst(6, 0xff6b4a, 140, 0.3, 3);
          if (e.mine && m.shake) this.cameras.main.shake(90, 0.004);
        } else if (e.type === "death") {
          burst(26, 0xff9a3c, 220, 0.7, 4);
          if (m.shake) this.cameras.main.shake(200, 0.008);
        } else if (e.type === "deliver" || e.type === "pickup") burst(16, C.cargo, 160, 0.5, 3);
        else if (e.type === "repair") burst(12, C.kit, 120, 0.5, 3);
        else if (e.type === "explode") {
          burst(22, 0xff9a3c, (e.r ?? 50) * 3, 0.45, 5);
          g.lineStyle(3, 0xffd166, 0.8).strokeCircle(e.x, e.y, e.r ?? 50);
          if (m.shake) this.cameras.main.shake(120, 0.005);
        } else if (e.type === "data" || e.type === "evac") burst(18, 0x6ff0ff, 160, 0.6, 3);
        else if (e.type === "dash") burst(10, 0xd8c39a, 120, 0.35, 4);
      }
      const s = dt / 1000;
      this.parts = this.parts.filter((p) => (p.life -= s) > 0);
      if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
      for (const p of this.parts) {
        p.x += p.vx * s;
        p.y += p.vy * s;
        g.fillStyle(p.color, p.life / p.max).fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }

    private arrow(m: RenderModel, cam: Phaser.Cameras.Scene2D.Camera) {
      const o = m.objective!;
      const sx = o.x - cam.scrollX;
      const sy = o.y - cam.scrollY;
      if (sx > 30 && sx < VIEW_W - 30 && sy > 30 && sy < VIEW_H - 30) {
        this.ui.lineStyle(3, C.cargo, 0.9).strokeCircle(sx, sy, 34 + 4 * Math.sin(this.time.now / 150));
        return;
      }
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const r = Math.min((VIEW_W / 2 - 40) / Math.abs(Math.cos(a) || 1e-6), (VIEW_H / 2 - 40) / Math.abs(Math.sin(a) || 1e-6));
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const p = (da: number, d: number) => ({ x: x + Math.cos(a + da) * d, y: y + Math.sin(a + da) * d });
      this.ui.fillStyle(C.cargo, 0.95).fillPoints([p(0, 18), p(2.5, 14), p(-2.5, 14)] as Phaser.Types.Math.Vector2Like[], true);
    }

    private rebuildLabels(m: RenderModel) {
      this.ground?.destroy();
      this.ground = null;
      this.labels.forEach((l) => l.destroy());
      this.labels = m.zones.map((z) =>
        this.add
          .text(z.rect.x + z.rect.w / 2, z.rect.y - 14, z.label, { fontFamily: "Arial Black, Arial, sans-serif", fontSize: "14px", color: "#2b211c" })
          .setOrigin(0.5)
          .setDepth(2),
      );
      this.mapKey = m.key;
      this.cameras.main.scrollX = Phaser.Math.Clamp(m.focus.x - VIEW_W / 2, 0, Math.max(0, m.w - VIEW_W));
      this.cameras.main.scrollY = Phaser.Math.Clamp(m.focus.y - VIEW_H / 2, 0, Math.max(0, m.h - VIEW_H));
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: "#1d1714",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: false, mouse: false, touch: false }, // input is ours (Controls), not Phaser's
    audio: { noAudio: true },
    banner: false,
    scene: [World],
  });
}
