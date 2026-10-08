// Player input from keyboard + mouse, and a basic twin-stick touch layout. Edge actions (dash, drop,
// reload) latch until sampled once. Losing focus or hiding the tab releases everything (G04/N05).
import type { BikeInput } from "../sim/combat";

export interface AimFrame {
  /** client px → world units, using the current camera */
  toWorld(clientX: number, clientY: number): { x: number; y: number } | null;
}

export class Controls {
  private keys = new Set<string>();
  private mouseDown = false;
  private client: { x: number; y: number } | null = null;
  private edge = { dash: false, drop: false, reload: false };
  private touchMove = { x: 0, y: 0 };
  private touchAim: number | null = null;
  private touchFire = false;
  private touchInteract = false;
  private lastAim = 0;
  enabled = true;
  onEscape: (() => void) | null = null;
  onFocusLost: (() => void) | null = null;
  private offs: (() => void)[] = [];
  readonly touchUi: HTMLElement | null = null;

  constructor(private surface: HTMLElement, private frame: AimFrame) {
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn as EventListener, opts);
      this.offs.push(() => t.removeEventListener(type, fn as EventListener, opts));
    };
    on(window, "keydown", (e: KeyboardEvent) => {
      if (!this.enabled) return;
      const k = e.code;
      if (k === "Escape") {
        this.onEscape?.();
        return;
      }
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) {
        if (k === "Space") this.edge.dash = true;
        if (k === "KeyQ") this.edge.drop = true;
        if (k === "KeyR") this.edge.reload = true;
      }
      this.keys.add(k);
    });
    on(window, "keyup", (e: KeyboardEvent) => this.keys.delete(e.code));
    on(surface, "mousemove", (e: MouseEvent) => (this.client = { x: e.clientX, y: e.clientY }));
    on(surface, "mousedown", (e: MouseEvent) => {
      if (e.button === 0) this.mouseDown = true;
      this.client = { x: e.clientX, y: e.clientY };
    });
    on(window, "mouseup", (e: MouseEvent) => {
      if (e.button === 0) this.mouseDown = false;
    });
    on(surface, "contextmenu", (e: Event) => e.preventDefault());
    on(window, "blur", () => this.release(true));
    on(document, "visibilitychange", () => {
      if (document.hidden) this.release(true);
    });
    if (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches) {
      this.touchUi = this.buildTouch();
      surface.appendChild(this.touchUi);
    }
  }

  /** Release every held control (focus lost, menu opened, match over). */
  release(focusLost = false): void {
    this.keys.clear();
    this.mouseDown = false;
    this.edge = { dash: false, drop: false, reload: false };
    this.touchMove = { x: 0, y: 0 };
    this.touchAim = null;
    this.touchFire = false;
    this.touchInteract = false;
    if (focusLost) this.onFocusLost?.();
  }

  /** Current input; `from` is the bike position the aim is measured from. Consumes edges. */
  sample(from: { x: number; y: number } | null): BikeInput {
    if (!this.enabled) return { moveX: 0, moveY: 0, aim: this.lastAim, fire: false, dash: false, interact: false, drop: false, reload: false };
    const k = this.keys;
    let mx = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    let my = (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0);
    if (this.touchMove.x || this.touchMove.y) {
      mx = this.touchMove.x;
      my = this.touchMove.y;
    }
    let aim = this.lastAim;
    if (this.touchAim !== null) aim = this.touchAim;
    else if (this.client && from) {
      const w = this.frame.toWorld(this.client.x, this.client.y);
      if (w) aim = Math.atan2(w.y - from.y, w.x - from.x);
    }
    this.lastAim = aim;
    const out: BikeInput = {
      moveX: mx,
      moveY: my,
      aim,
      fire: this.mouseDown || this.touchFire,
      interact: k.has("KeyE") || this.touchInteract,
      dash: this.edge.dash,
      drop: this.edge.drop,
      reload: this.edge.reload,
    };
    this.edge = { dash: false, drop: false, reload: false };
    return out;
  }

  private buildTouch(): HTMLElement {
    const ui = document.createElement("div");
    ui.className = "nyc-touch";
    const stick = (side: "left" | "right") => {
      const z = document.createElement("div");
      z.className = `nyc-stick nyc-stick-${side}`;
      const knob = document.createElement("div");
      knob.className = "nyc-knob";
      z.appendChild(knob);
      let id: number | null = null;
      let ox = 0;
      let oy = 0;
      const set = (dx: number, dy: number) => {
        const len = Math.hypot(dx, dy);
        const r = 56;
        const k = len > r ? r / len : 1;
        knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        if (side === "left") this.touchMove = len > 8 ? { x: (dx * k) / r, y: (dy * k) / r } : { x: 0, y: 0 };
        else {
          if (len > 8) this.touchAim = Math.atan2(dy, dx);
          this.touchFire = len > 24;
        }
      };
      z.addEventListener("pointerdown", (e) => {
        id = e.pointerId;
        ox = e.clientX;
        oy = e.clientY;
        try {
          z.setPointerCapture(e.pointerId);
        } catch {
          /* pointer already gone (e.g. a cancelled touch) — tracking by id still works */
        }
      });
      z.addEventListener("pointermove", (e) => e.pointerId === id && set(e.clientX - ox, e.clientY - oy));
      const end = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        id = null;
        knob.style.transform = "";
        if (side === "left") this.touchMove = { x: 0, y: 0 };
        else this.touchFire = false;
      };
      z.addEventListener("pointerup", end);
      z.addEventListener("pointercancel", end);
      return z;
    };
    const btn = (label: string, down: () => void, up?: () => void) => {
      const b = document.createElement("button");
      b.className = "nyc-tbtn";
      b.textContent = label;
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        down();
      });
      if (up) {
        b.addEventListener("pointerup", up);
        b.addEventListener("pointercancel", up);
        b.addEventListener("pointerleave", up);
      }
      return b;
    };
    const buttons = document.createElement("div");
    buttons.className = "nyc-tbtns";
    buttons.append(
      btn("⚡", () => (this.edge.dash = true)),
      btn("E", () => (this.touchInteract = true), () => (this.touchInteract = false)),
      btn("Q", () => (this.edge.drop = true)),
      btn("R", () => (this.edge.reload = true)),
    );
    const pause = btn("⏸", () => this.onEscape?.());
    pause.className = "nyc-tbtn nyc-tpause";
    ui.append(pause);
    ui.append(stick("left"), stick("right"), buttons);
    return ui;
  }

  dispose(): void {
    this.offs.forEach((f) => f());
    this.touchUi?.remove();
  }
}
