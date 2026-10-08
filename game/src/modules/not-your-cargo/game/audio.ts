// Sound: CC0 samples from Kenney.nl / OpenGameArt (assets/sfx, sources in CREDITS.md) played
// through WebAudio, plus a looping ambient track. A sample that cannot be fetched or decoded (e.g.
// a browser without Vorbis) falls back to a short synthesized tone, so the game is never silent.
import dashUrl from "../assets/sfx/dash.ogg?no-inline";
import deathUrl from "../assets/sfx/death.ogg?no-inline";
import deliverUrl from "../assets/sfx/deliver.ogg?no-inline";
import dropUrl from "../assets/sfx/drop.ogg?no-inline";
import hitUrl from "../assets/sfx/hit.ogg?no-inline";
import hurtUrl from "../assets/sfx/hurt.ogg?no-inline";
import loseUrl from "../assets/sfx/lose.ogg?no-inline";
import musicUrl from "../assets/sfx/music_loop.ogg?no-inline";
import pickupUrl from "../assets/sfx/pickup.ogg?no-inline";
import shotEnemyUrl from "../assets/sfx/shot_enemy.ogg?no-inline";
import shotMgUrl from "../assets/sfx/shot_mg.ogg?no-inline";
import shotShotgunUrl from "../assets/sfx/shot_shotgun.ogg?no-inline";
import tickUrl from "../assets/sfx/tick.ogg?no-inline";
import clickUrl from "../assets/sfx/ui_click.ogg?no-inline";
import winUrl from "../assets/sfx/win.ogg?no-inline";
import laserUrl from "../assets/sfx/shot_laser.ogg?no-inline";
import rocketUrl from "../assets/sfx/shot_rocket.ogg?no-inline";
import explodeUrl from "../assets/sfx/explode.ogg?no-inline";

export type Sfx =
  | "shot" | "shotgun" | "laser" | "rocket" | "explode" | "enemyShot" | "hit" | "hurt" | "pickup" | "drop" | "deliver" | "death" | "dash" | "tick" | "win" | "lose" | "click";

const URLS: Record<Sfx, string> = {
  shot: shotMgUrl,
  shotgun: shotShotgunUrl,
  laser: laserUrl,
  rocket: rocketUrl,
  explode: explodeUrl,
  enemyShot: shotEnemyUrl,
  hit: hitUrl,
  hurt: hurtUrl,
  pickup: pickupUrl,
  drop: dropUrl,
  deliver: deliverUrl,
  death: deathUrl,
  dash: dashUrl,
  tick: tickUrl,
  win: winUrl,
  lose: loseUrl,
  click: clickUrl,
};

const VOLUME: Partial<Record<Sfx, number>> = { shot: 0.45, enemyShot: 0.4, hit: 0.6, tick: 0.5, click: 0.5 };

const FALLBACK: Record<Sfx, { f: number; f2: number; d: number; type: OscillatorType; v: number }> = {
  shot: { f: 520, f2: 180, d: 0.05, type: "square", v: 0.05 },
  shotgun: { f: 260, f2: 60, d: 0.12, type: "sawtooth", v: 0.07 },
  laser: { f: 1400, f2: 500, d: 0.08, type: "sawtooth", v: 0.05 },
  rocket: { f: 120, f2: 300, d: 0.25, type: "sawtooth", v: 0.06 },
  explode: { f: 90, f2: 30, d: 0.4, type: "sawtooth", v: 0.12 },
  enemyShot: { f: 700, f2: 300, d: 0.05, type: "square", v: 0.04 },
  hit: { f: 160, f2: 90, d: 0.08, type: "triangle", v: 0.12 },
  hurt: { f: 120, f2: 70, d: 0.15, type: "triangle", v: 0.12 },
  pickup: { f: 440, f2: 880, d: 0.15, type: "sine", v: 0.12 },
  drop: { f: 600, f2: 200, d: 0.15, type: "sine", v: 0.1 },
  deliver: { f: 523, f2: 1046, d: 0.35, type: "triangle", v: 0.14 },
  death: { f: 200, f2: 30, d: 0.5, type: "sawtooth", v: 0.12 },
  dash: { f: 300, f2: 700, d: 0.12, type: "sine", v: 0.06 },
  tick: { f: 880, f2: 880, d: 0.06, type: "square", v: 0.05 },
  win: { f: 392, f2: 784, d: 0.6, type: "triangle", v: 0.14 },
  lose: { f: 330, f2: 110, d: 0.7, type: "triangle", v: 0.12 },
  click: { f: 1200, f2: 900, d: 0.03, type: "square", v: 0.03 },
};

export class Audio {
  private _muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<Sfx | "music", AudioBuffer | null>();
  private loading = false;
  private last = new Map<Sfx, number>();
  private music: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private wantMusic = false;

  get muted(): boolean {
    return this._muted;
  }
  set muted(m: boolean) {
    this._muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
    if (m) this.stopMusic();
    else if (this.wantMusic) this.startMusic();
  }

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this._muted ? 0 : 1;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      if (!this.loading) {
        this.loading = true;
        void this.loadAll(this.ctx);
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private async loadAll(ctx: AudioContext): Promise<void> {
    const entries: [Sfx | "music", string][] = [...(Object.entries(URLS) as [Sfx, string][]), ["music", musicUrl]];
    await Promise.all(
      entries.map(async ([k, url]) => {
        try {
          const data = await (await fetch(url)).arrayBuffer();
          this.buffers.set(k, await ctx.decodeAudioData(data));
        } catch {
          this.buffers.set(k, null);
        }
      }),
    );
    if (this.wantMusic && !this._muted) this.startMusic();
  }

  play(name: Sfx): void {
    if (this._muted) return;
    const c = this.ensure();
    if (!c || !this.master) return;
    const now = c.currentTime;
    if ((this.last.get(name) ?? -1) > now - 0.03) return; // no stacking in one frame
    this.last.set(name, now);
    const buf = this.buffers.get(name);
    if (buf) {
      const src = c.createBufferSource();
      const g = c.createGain();
      g.gain.value = VOLUME[name] ?? 0.8;
      src.buffer = buf;
      src.connect(g).connect(this.master);
      src.start();
      return;
    }
    const s = FALLBACK[name];
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = s.type;
    o.frequency.setValueAtTime(s.f, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, s.f2), now + s.d);
    g.gain.setValueAtTime(s.v, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + s.d);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + s.d + 0.02);
  }

  /** Ambient loop on/off (missions, training and online matches). */
  setMusic(on: boolean): void {
    this.wantMusic = on;
    if (on && !this._muted) this.startMusic();
    else this.stopMusic();
  }

  private startMusic(): void {
    if (this.music) return;
    const c = this.ensure();
    const buf = this.buffers.get("music");
    if (!c || !this.master || !buf) return;
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = 0.35;
    src.buffer = buf;
    src.loop = true;
    src.connect(g).connect(this.master);
    src.start();
    this.music = src;
    this.musicGain = g;
  }

  private stopMusic(): void {
    try {
      this.music?.stop();
    } catch {
      /* already stopped */
    }
    this.music?.disconnect();
    this.musicGain?.disconnect();
    this.music = null;
    this.musicGain = null;
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
