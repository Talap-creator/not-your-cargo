// The game controller: menus (DOM), the C01 mission loop, and the PvP duel on the room the lobby's
// rooms system hands over. One instance per mounted scene; `destroy()` frees everything.
import type Phaser from "phaser";
import type { MultiplayerRoom } from "@idosgames/module-sdk";
import { ALL_WEAPONS, BIKE, CARGO, DT, MISSION, PVP, VIEW_H, VIEW_W, WEAPONS, type WeaponId } from "../sim/config";
import { createMission, objective, stepMission, stars, PAR, DIFFICULTIES, type MissionState } from "../sim/mission";
import { ACHIEVEMENTS, DIFF_NAME, unlocked } from "./achievements";
import { radioText } from "./radio";
import { PVP_MAP } from "../sim/maps";
import { telegraph } from "../sim/enemies";
import type { MissionId } from "../sim/campaign-maps";
import { createTraining, stepTraining, trainTarget, TRAIN_STEPS, type TrainingState } from "../sim/tutorial";
import { Duel, type DuelView } from "../net/duel";
import { sessionLink } from "../net/link";
import { Audio } from "./audio";
import { Controls } from "./controls";
import { reason, tr, MISSION_TEXT, STORY, TRAIN_TEXT, type Key, type Lang } from "./i18n";
import { completeMission, isMissionOpen, loadSave, mergeSaves, recordDuel, writeSave, type SaveData } from "./save";
import { createGame, type RenderModel } from "./scene";
import { injectStyles } from "./styles";
import type { TokenCosmetic } from "./token";
import type { CloudSave } from "./cloud";
import { browserWallet, mintAchievement, mintedSet } from "./nft";
import { isEmbeddedInPlatform } from "@idosgames/wallet";
import { campaignScore, LB_CAMPAIGN, LB_DUELS, PAINTS, paintById, RARITY_COLOR, type Armory, type TopEntry } from "./armory";

type Mode = "menu" | "story" | "training" | "tresult" | "campaign" | "brief" | "mission" | "paused" | "mresult" | "pvp" | "achievements" | "armory" | "ranks";
type PlayMode = "mission" | "training";

const CAMPAIGN: { id: string; ru: string; en: string }[] = [
  { id: "C01", ru: "Первая доставка", en: "First Delivery" },
  { id: "C02", ru: "Засада", en: "Ambush" },
  { id: "C03", ru: "Конвой", en: "Convoy" },
  { id: "C04", ru: "Станция", en: "Station" },
  { id: "C05", ru: "Перехватчик", en: "Interceptor" },
];

export interface GameDeps {
  bannerUrl: string;
  /** Open the lobby's rooms screen for this game; false when multiplayer is not available. */
  openRooms(create: boolean): boolean;
  multiplayerAvailable(): boolean;
  /** The NYCARGO cosmetic checker (signature-verified wallet + on-chain balance). */
  token: TokenCosmetic | null;
  armory?: Armory | null;
  cloud?: CloudSave | null;
}

const SIDE_COLORS: readonly [number, number] = [0x3aa0ff, 0xff4fa3];
const sideColor = (i: number): number => (i === 0 ? SIDE_COLORS[0] : SIDE_COLORS[1]);
const ME_COLOR = 0x3aa0ff;

export class NycGame {
  mode: Mode = "menu";
  save: SaveData;
  private root: HTMLElement;
  private stage: HTMLElement;
  private overlay: HTMLElement;
  private hud: HTMLElement;
  private phaser: Phaser.Game;
  private controls: Controls;
  private audio = new Audio();
  private running = true;
  cam = { x: 0, y: 0 };

  mission: MissionState | null = null;
  training: TrainingState | null = null;
  private play: PlayMode = "mission";
  private storyIdx = 0;
  private missionId: MissionId = "C01";
  private acc = 0;
  private missionEvents: RenderModel["events"] = [];
  private lastQuietSecond = -1;

  private room: MultiplayerRoom | null = null;
  duel: Duel | null = null;
  private duelTimer: ReturnType<typeof setInterval> | null = null;
  private duelOff: (() => void) | null = null;
  private pvpMenu = false;
  private focusWarnUntil = 0;
  private screenKey = "";
  lastView: DuelView | null = null;
  private offFocus: (() => void) | null = null;
  private offRefit: (() => void) | null = null;
  private radioLine = "";
  private radioUntil = 0;
  private newAchievements: string[] = [];
  private armoryMsg = "";
  private nftMsg = "";
  private nftBusy = "";
  /** achievement asked for by ?mint=<id> (a mint opened from the embedded game in a new tab) */
  private mintAsk: string | null = null;
  private lastDrops: string[] = [];
  private cratePrice: number | null = null;
  private ranks: { tab: string; list: TopEntry[] | string | null } = { tab: LB_CAMPAIGN, list: null };
  private tokenMsg = "";
  /** Equipped paint id, only if the server inventory confirms it. */
  get paintId(): string | null {
    const a = this.deps.armory;
    return a && this.save.paint && a.owned.has(this.save.paint) ? this.save.paint : null;
  }
  get paintTint(): number | null {
    return paintById(this.paintId)?.tint ?? null;
  }
  get trail(): boolean {
    return this.deps.token?.eligible === true;
  }

  constructor(host: HTMLElement, private deps: GameDeps) {
    injectStyles();
    this.save = loadSave();
    this.audio.muted = this.save.muted;
    this.root = el("div", "nyc-root");
    this.stage = el("div", "nyc-stage");
    this.hud = el("div", "nyc-hud");
    this.overlay = el("div", "nyc-overlay");
    this.overlay.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) this.audio.play("click");
    });
    const rotate = el("div", "nyc-rotate");
    rotate.textContent = "↻ Поверни телефон горизонтально · Rotate your phone";
    this.root.append(this.stage, this.hud, this.overlay, rotate);
    host.appendChild(this.root);
    this.phaser = createGame(this.stage, {
      frame: (dt) => this.frame(dt),
      setCamera: (x, y) => {
        this.cam.x = x;
        this.cam.y = y;
      },
    });
    this.controls = new Controls(this.root, {
      toWorld: (cx, cy) => {
        const canvas = this.stage.querySelector("canvas");
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect();
        if (!r.width) return null;
        return { x: ((cx - r.left) / r.width) * VIEW_W + this.cam.x, y: ((cy - r.top) / r.height) * VIEW_H + this.cam.y };
      },
    });
    this.controls.onEscape = () => this.escape();
    // Phones: re-fit the canvas after rotation / address-bar resize (FIT alone can keep a stale size).
    const refit = () => setTimeout(() => this.phaser.scale.refresh(), 120);
    window.addEventListener("resize", refit);
    window.addEventListener("orientationchange", refit);
    this.offRefit = () => {
      window.removeEventListener("resize", refit);
      window.removeEventListener("orientationchange", refit);
    };
    this.controls.onFocusLost = () => {
      if (this.mode === "mission" || this.mode === "training") this.setMode("paused");
      if (this.mode === "pvp") this.focusWarnUntil = performance.now() + 3000;
    };
    this.render();
    try {
      const ask = new URLSearchParams(location.search).get("mint");
      if (ask && ACHIEVEMENTS.some((a) => a.id === ask)) {
        this.mintAsk = ask;
        this.setMode("achievements");
      }
    } catch {
      /* no location (tests) */
    }
    if (deps.cloud) {
      // progress from the account (another device / the site's frame) joins the local one
      const before = this.save;
      void deps.cloud.pull(before).then((merged) => {
        if (merged === before) return;
        // progress made while the cloud answered must survive: merge into the CURRENT save
        this.save = mergeSaves(this.save, merged);
        writeSave(this.save);
        deps.cloud?.push(this.save);
        this.screenKey = "";
        this.render();
      });
    }
    if (deps.armory) {
      deps.armory.subscribe(() => {
        if (this.duel) this.duel.myPaint = this.paintId;
        if (this.mode === "armory") {
          this.screenKey = "";
          this.render();
        }
      });
      void deps.armory.refresh();
    }
    if (deps.token) {
      deps.token.subscribe(() => {
        if (this.duel) this.duel.myTrail = this.trail;
        this.screenKey = "";
        this.render();
      });
      void deps.token.refresh();
      // a wallet switch on the site / in the extension shows up on the next focus
      const onFocus = () => void deps.token?.refresh();
      window.addEventListener("focus", onFocus);
      this.offFocus = () => window.removeEventListener("focus", onFocus);
    }
  }

  get lang(): Lang {
    return this.save.lang;
  }
  private t(k: Key): string {
    return tr(this.lang, k);
  }

  // ── lifecycle (EngineScene) ───────────────────────────────────────────────────────────────
  setRunning(on: boolean): void {
    this.running = on;
    if (on) this.phaser.loop.wake();
    else {
      this.controls.release();
      if (this.mode === "mission" || this.mode === "training") this.setMode("paused");
      // A suspended host keeps its interval running; if the browser throttles it the guest's
      // watchdog ends the match as aborted (N05). The online world is never paused locally.
      if (!this.duel) this.phaser.loop.sleep();
    }
  }

  destroy(): void {
    this.leaveDuel();
    this.offFocus?.();
    this.offRefit?.();
    this.controls.dispose();
    this.audio.dispose();
    this.phaser.destroy(true);
    this.root.remove();
  }

  capture(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 1500);
      this.phaser.loop.wake();
      this.phaser.renderer.snapshot((image) => {
        clearTimeout(timer);
        if (!(image instanceof HTMLImageElement)) return resolve(null);
        const c = document.createElement("canvas");
        c.width = image.naturalWidth || image.width;
        c.height = image.naturalHeight || image.height;
        c.getContext("2d")?.drawImage(image, 0, 0);
        c.toBlob(resolve, "image/png");
      });
    });
  }

  // ── modes ─────────────────────────────────────────────────────────────────────────────────
  private setMode(m: Mode): void {
    this.mode = m;
    if (m === "mission" || m === "training") this.play = m;
    else this.controls.release();
    this.controls.enabled = m === "mission" || m === "training" || m === "pvp";
    // touch controls and the rotate prompt only while actually playing
    this.root.classList.toggle("play", m === "mission" || m === "training" || (m === "pvp" && this.duel?.phase === "match"));
    this.audio.setMusic(m === "mission" || m === "training" || (m === "pvp" && this.duel?.phase === "match"));
    this.render();
  }

  private escape(): void {
    if (this.mode === "mission" || this.mode === "training") this.setMode("paused");
    else if (this.mode === "paused") this.setMode(this.play);
    else if (this.mode === "story") this.finishStory();
    else if (this.mode === "pvp" && this.duel?.phase === "match") {
      this.pvpMenu = !this.pvpMenu;
      this.controls.release();
      this.render();
    } else if (this.mode === "brief") this.setMode("campaign");
  }

  /** "Campaign": the story the first time, then the training ground, then the route map. */
  openCampaign(): void {
    if (!this.save.storySeen) {
      this.storyIdx = 0;
      this.setMode("story");
    } else if (!this.save.trainingDone) this.startTraining();
    else this.setMode("campaign");
  }

  private finishStory(): void {
    if (!this.save.storySeen) this.updateSave({ storySeen: true });
    if (!this.save.trainingDone) this.startTraining();
    else this.setMode("campaign");
  }

  startTraining(): void {
    this.training = createTraining();
    this.acc = 0;
    this.missionEvents = [];
    this.setMode("training");
  }

  startMission(weapon?: WeaponId, id: MissionId = this.missionId): void {
    const w = weapon && this.save.weapons.includes(weapon) ? weapon : this.save.weapon;
    this.missionId = id;
    // A fresh state every time: nothing from a previous attempt survives a retry (Q02).
    this.mission = createMission(w, Math.floor(Math.random() * 1e9), id, this.save.difficulty);
    this.acc = 0;
    this.missionEvents = [];
    this.setMode("mission");
  }

  /** Save new progress and announce the achievements it unlocked. */
  private commit(next: SaveData): void {
    const before = new Set(unlocked(this.save));
    this.save = next;
    writeSave(next);
    this.deps.cloud?.push(next);
    const fresh = ACHIEVEMENTS.filter((a) => !before.has(a.id) && a.progress(next) >= 1);
    if (fresh.length) {
      this.radioLine = "🏆 " + fresh.map((a) => a.name[this.lang]).join(" · ");
      this.radioUntil = performance.now() + 6000;
      this.newAchievements = fresh.map((a) => a.id);
    }
  }

  // ── PvP ───────────────────────────────────────────────────────────────────────────────────
  /** Called by the multiplayer registry's start(room) on both devices. */
  playOnline(room: MultiplayerRoom): void {
    this.leaveDuel();
    this.room = room;
    this.mission = null;
    const duel = new Duel(sessionLink(room.session), {
      now: () => performance.now(),
      controls: () => this.controls.sample(this.myBikePos()),
      log: (m) => console.info(m),
    });
    duel.myTrail = this.trail;
    duel.myPaint = this.paintId;
    duel.setLoadout(this.save.weapon, false);
    this.duel = duel;
    this.pvpMenu = false;
    let lastPhase = duel.phase;
    let lastResult: string | null = null;
    this.duelOff = duel.subscribe(() => {
      const r = duel.result?.resultId ?? null;
      if (duel.phase !== lastPhase || r !== lastResult) {
        if (duel.phase === "result" && r !== lastResult && duel.result) {
          const won = duel.result.winner === duel.mySide;
          this.audio.play(duel.result.outcome === "win" ? (won ? "win" : "lose") : "lose");
          if (duel.result.outcome !== "aborted") this.commit(recordDuel(this.save, duel.result.outcome === "win" && won));
          if (duel.result.outcome === "win" && won) void this.deps.armory?.submitDuelWin().catch(() => undefined);
        }
        lastPhase = duel.phase;
        lastResult = r;
        this.audio.setMusic(duel.phase === "match");
        this.root.classList.toggle("play", duel.phase === "match");
      }
      this.render(); // de-duplicated by the screen key
    });
    this.duelTimer = setInterval(() => duel.pump(), 1000 / 30);
    this.setMode("pvp");
  }

  private myBikePos(): { x: number; y: number } | null {
    const v = this.lastView;
    if (!v) return null;
    return v.bikes[v.mySide];
  }

  private leaveDuel(): void {
    if (this.duelTimer) clearInterval(this.duelTimer);
    this.duelTimer = null;
    this.duelOff?.();
    this.duelOff = null;
    this.duel?.dispose();
    this.duel = null;
    this.lastView = null;
    const room = this.room;
    this.room = null;
    if (room) void room.leave().catch(() => undefined);
  }

  // ── frame ─────────────────────────────────────────────────────────────────────────────────
  private frame(dtMs: number): RenderModel | null {
    if (this.mode === "pvp" && this.duel) return this.pvpFrame();
    if (this.mode === "training" || this.mode === "tresult" || (this.mode === "paused" && this.play === "training")) return this.trainingFrame(dtMs);
    if (this.mode !== "mission" && this.mode !== "paused" && this.mode !== "mresult") return null;
    if (!this.mission) return null;
    const s = this.mission;
    if (this.mode === "mission" && this.running && !document.hidden) {
      this.acc += Math.min(dtMs, 250);
      while (this.acc >= DT * 1000) {
        this.acc -= DT * 1000;
        stepMission(s, this.controls.sample(s.player));
        for (const e of s.events) {
          if (e.type === "radio" && e.line) {
            const line = radioText(e.line, this.lang);
            if (line) {
              this.radioLine = line;
              this.radioUntil = performance.now() + 5500;
              this.audio.play("tick");
            }
            continue;
          }
          this.missionEvents.push({ type: e.type, x: e.x, y: e.y, mine: e.type === "hit" && e.by !== "player", r: e.r });
        }
        this.sfx(
          s.events.map((e) => ({ type: e.type, mine: e.type === "hit" ? e.by !== "player" : e.by === "player" })),
          s.player.weapon,
        );
        if (s.phase !== "playing") {
          if (s.phase === "won") {
            this.commit(completeMission(this.save, s.id, stars(s), s.difficulty));
            void this.deps.armory?.submitCampaign(campaignScore(this.save.stars, this.save.cleared)).catch(() => undefined);
            this.audio.play("win");
          } else this.audio.play("lose");
          this.setMode("mresult");
          break;
        }
      }
      const quiet = Math.ceil(MISSION.quietStart - s.time);
      if (s.id === "C01" && s.wave > 0 && quiet > 0 && quiet <= 3 && quiet !== this.lastQuietSecond) {
        this.lastQuietSecond = quiet;
        this.audio.play("tick");
      }
    }
    this.missionHud(s);
    const p = s.player;
    const ev = this.missionEvents;
    this.missionEvents = [];
    const holding = s.pickupHold > 0 ? s.pickupHold / CARGO.pickupHold : s.deliverHold > 0 ? s.deliverHold / CARGO.deliverHold : 0;
    const ru = this.lang === "ru";
    const zones: RenderModel["zones"] = [];
    if (s.map.goal) zones.push({ rect: s.map.goal, color: 0x2f7dd1, label: ru ? "ДОСТАВКА" : "DELIVERY", sprite: "station" });
    if (s.evac) zones.push({ rect: s.evac.rect, color: s.evac.open ? 0x4fd18b : 0x6b625a, label: ru ? (s.evac.open ? "ЭВАКУАЦИЯ ОТКРЫТА" : "ЭВАКУАЦИЯ") : s.evac.open ? "EVAC OPEN" : "EVAC", sprite: "evac" });
    const props: NonNullable<RenderModel["props"]> = [];
    if (s.terminal) props.push({ key: "terminal", x: s.terminal.x, y: s.terminal.y, w: 44, rot: 0, alpha: s.terminal.done ? 0.6 : 1 });
    const truck = s.truck;
    const termHold = s.terminal && !s.terminal.done && s.terminal.hold > 0 ? s.terminal.hold : 0;
    return {
      key: `${s.id}:${this.lang}`,
      w: s.map.w,
      h: s.map.h,
      walls: s.map.walls,
      decor: s.map.decor,
      zones,
      bikes: [{ ...p, maxHp: BIKE.hp, color: ME_COLOR, dashing: p.dashLeft > 0, me: true, trail: this.trail, paint: this.paintTint }],
      enemies: s.enemies.map((e) => ({ x: e.x, y: e.y, aim: e.aim, hp: e.hp, maxHp: e.maxHp, kind: e.kind, tele: telegraph(e) })),
      warnings: s.warnings,
      cargo: { x: s.cargo.x, y: s.cargo.y, visible: s.cargo.exists, carried: s.cargo.carried, sprite: s.id === "C01" ? "cargo" : "core" },
      truck: truck ? { x: truck.x, y: truck.y, rot: truck.heading, hp: truck.hp, maxHp: truck.maxHp, waiting: truck.waiting } : null,
      props,
      projectiles: s.projectiles.map((q) => ({ x: q.x, y: q.y, kind: projectileCode(q.kind), vx: q.vx, vy: q.vy })),
      repairs: s.kits.map((k) => ({ x: k.x, y: k.y, ready: k.ready })),
      hold: termHold > 0 ? { x: p.x, y: p.y, progress: termHold, color: 0x6ff0ff } : holding > 0 ? { x: p.x, y: p.y, progress: holding, color: 0xff7a1a } : null,
      focus: p,
      objective: objective(s).target,
      fog: s.storm ? { r: 300, color: 0x8a6436, alpha: 0.9 } : s.dark ? { r: 250, color: 0x07060c, alpha: 0.9 } : null,
      events: ev,
      shake: this.save.shake,
    };
  }

  private trainingFrame(dtMs: number): RenderModel | null {
    const s = this.training;
    if (!s) return null;
    if (this.mode === "training" && this.running && !document.hidden) {
      this.acc += Math.min(dtMs, 250);
      while (this.acc >= DT * 1000) {
        this.acc -= DT * 1000;
        const before = s.step;
        stepTraining(s, this.controls.sample(s.player));
        for (const e of s.events) this.missionEvents.push({ type: e.type, x: e.x, y: e.y });
        this.sfx(s.events.map((e) => ({ type: e.type, mine: e.type !== "hit" })), s.player.weapon);
        if (s.step !== before && s.step !== "done") this.audio.play("tick");
        if (s.step === "done") {
          if (!this.save.trainingDone) this.updateSave({ trainingDone: true });
          this.audio.play("win");
          this.setMode("tresult");
          break;
        }
      }
    }
    const p = s.player;
    if (this.mode === "training") {
      const n = Math.min(TRAIN_STEPS.indexOf(s.step) + 1, TRAIN_STEPS.length - 1);
      const tip = (TRAIN_TEXT[s.step] ?? TRAIN_TEXT.done!)[this.lang];
      this.hud.innerHTML = `<div class="nyc-hud-left">${this.bikeHud(p.hp, p.weapon, p.mag, p.reloadLeft, p.dashCd, p.carrying)}</div>
        <div class="nyc-hud-top"><div class="nyc-tip">${this.t("trainTitle")} ${n}/${TRAIN_STEPS.length - 1}</div>
        <div class="nyc-objective">${tip}</div></div>`;
    } else this.hud.innerHTML = "";
    const ev = this.missionEvents;
    this.missionEvents = [];
    const holding = s.pickupHold > 0 ? s.pickupHold / CARGO.pickupHold : s.deliverHold > 0 ? s.deliverHold / CARGO.deliverHold : 0;
    return {
      key: `train:${this.lang}`,
      w: s.map.w,
      h: s.map.h,
      walls: s.map.walls,
      decor: [],
      zones: [{ rect: s.map.zone, color: 0x2f7dd1, label: this.lang === "ru" ? "ДОСТАВКА" : "DELIVERY" }],
      bikes: [{ ...p, maxHp: BIKE.hp, color: ME_COLOR, dashing: p.dashLeft > 0, me: true, trail: this.trail, paint: this.paintTint }],
      enemies: [],
      targets: s.targets.map((t) => ({ x: t.x, y: t.y, alive: t.alive })),
      warnings: [],
      cargo: { x: s.cargo.x, y: s.cargo.y, visible: true, carried: s.cargo.carried },
      projectiles: s.projectiles.map((q) => ({ x: q.x, y: q.y, kind: q.kind === "pellet" ? 1 : 0 })),
      repairs: [],
      hold: holding > 0 ? { x: p.x, y: p.y, progress: holding, color: 0xff7a1a } : null,
      focus: p,
      objective: trainTarget(s),
      events: ev,
      shake: this.save.shake,
    };
  }

  /** mine: my shot / I am the one hit. */
  private sfx(events: { type: string; mine?: boolean }[], myWeapon: WeaponId = "mg"): void {
    for (const e of events) {
      if (e.type === "shot") this.audio.play(e.mine ? (myWeapon === "mg" ? "shot" : myWeapon) : "enemyShot");
      else if (e.type === "explode") this.audio.play("explode");
      else if (e.type === "hit") this.audio.play(e.mine ? "hurt" : "hit");
      else if (e.type === "drop") this.audio.play("drop");
      else if (e.type === "pickup") this.audio.play("pickup");
      else if (e.type === "deliver") this.audio.play("deliver");
      else if (e.type === "death") this.audio.play("death");
      else if (e.type === "dash") this.audio.play("dash");
    }
  }

  private pvpFrame(): RenderModel | null {
    const d = this.duel!;
    const v = d.phase === "match" || d.phase === "result" ? d.view() : null;
    this.lastView = v;
    this.pvpHud(d, v);
    if (!v) return null;
    this.sfx(v.events.map((e) => ({ type: e.type, mine: e.side === v.mySide })), v.bikes[v.mySide].weapon);
    const me = v.bikes[v.mySide];
    const holding = me.pickupHold > 0 ? me.pickupHold / CARGO.pickupHold : me.deliverHold > 0 ? me.deliverHold / CARGO.deliverHold : 0;
    const myBase = PVP_MAP.bases[v.mySide];
    const target =
      v.cargo.carrier === v.mySide
        ? { x: myBase.x + myBase.w / 2, y: myBase.y + myBase.h / 2 }
        : v.cargo.away > 0
          ? null
          : { x: v.cargo.x, y: v.cargo.y };
    return {
      key: `pvp:${v.matchId}:${v.mySide}:${this.lang}`,
      w: PVP_MAP.w,
      h: PVP_MAP.h,
      walls: PVP_MAP.walls,
      decor: [],
      zones: PVP_MAP.bases.map((b, i) => ({
        rect: b,
        color: sideColor(i),
        label: i === v.mySide ? (this.lang === "ru" ? "ТВОЯ БАЗА" : "YOUR BASE") : this.lang === "ru" ? "БАЗА СОПЕРНИКА" : "RIVAL BASE",
      })),
      bikes: v.bikes.map((b, i) => ({
        x: b.x, y: b.y, aim: b.aim, heading: b.heading, hp: b.hp, maxHp: BIKE.hp, alive: b.alive, color: sideColor(i), weapon: b.weapon,
        carrying: b.carrying, dashing: b.dashing, shield: b.shield, me: i === v.mySide, trail: i === v.mySide ? this.trail : this.duel?.peerTrail === true,
        paint: i === v.mySide ? this.paintTint : (paintById(this.duel?.peerPaint)?.tint ?? null),
      })),
      enemies: [],
      warnings: [],
      cargo: { x: v.cargo.x, y: v.cargo.y, visible: v.cargo.away <= 0, carried: v.cargo.carrier !== null },
      projectiles: v.projectiles,
      repairs: PVP_MAP.repairs.map((r, i) => ({ ...r, ready: v.repairs[i] === true })),
      hold: holding > 0 ? { x: me.x, y: me.y, progress: holding, color: sideColor(v.mySide) } : null,
      focus: me.alive ? me : PVP_MAP.spawns[v.mySide],
      objective: target,
      events: v.events.map((e) => ({ ...e, mine: e.type === "hit" && e.side === v.mySide })),
      shake: this.save.shake,
    };
  }

  // ── HUD (updated every frame, cheap textContent writes) ───────────────────────────────────
  private bikeHud(hp: number, weapon: WeaponId, mag: number, reloadLeft: number, dashCd: number, carrying: boolean): string {
    const spec = WEAPONS[weapon];
    const ammo = reloadLeft > 0 ? `↻ ${reloadLeft.toFixed(1)}s` : `${mag}/${spec.magazine}`;
    const dash = dashCd > 0 ? `${dashCd.toFixed(1)}s` : "✓";
    return `<div class="nyc-hp"><i style="width:${Math.max(0, hp)}%"></i><b>${Math.ceil(hp)}</b></div>
      <div class="nyc-chips"><span>${this.t(weapon)} · ${ammo}</span><span>⚡ ${dash}</span>${carrying ? `<span class="nyc-cargo-chip">◆</span>` : ""}</div>`;
  }

  private missionHud(s: MissionState): void {
    if (this.mode !== "mission") {
      this.hud.innerHTML = "";
      return;
    }
    const p = s.player;
    const o = objective(s);
    const quiet = Math.ceil(MISSION.quietStart - s.time);
    const extra = s.truck
      ? `<div class="nyc-chips"><span>🚚 ${Math.ceil(s.truck.hp)}/${s.truck.maxHp}${s.truck.waiting ? " ⏸" : ""}</span></div>`
      : s.boss
        ? `<div class="nyc-boss"><i style="width:${(s.boss.hp / s.boss.maxHp) * 100}%"></i></div>`
        : "";
    const radio = performance.now() < this.radioUntil ? `<div class="nyc-radio">📻 ${escapeHtml(this.radioLine)}</div>` : "";
    this.hud.innerHTML = `${radio}<div class="nyc-hud-left">${this.bikeHud(p.hp, p.weapon, p.mag, p.reloadLeft, p.dashCd, p.carrying)}${s.truck ? extra : ""}</div>
      <div class="nyc-hud-top">${s.boss ? extra : ""}<div class="nyc-objective">${o.text[this.lang]}</div>
      ${s.id === "C01" && s.wave > 0 && quiet > 0 ? `<div class="nyc-tip">${this.t("quiet")} ${quiet}s</div>` : ""}</div>`;
  }

  private pvpHud(d: Duel, v: DuelView | null): void {
    if (d.phase !== "match" || !v) {
      this.hud.innerHTML = "";
      return;
    }
    const me = v.bikes[v.mySide];
    const opp = v.bikes[v.mySide === 0 ? 1 : 0];
    const st = d.stats();
    const mm = Math.floor(v.phaseLeft / 60);
    const ss = Math.floor(v.phaseLeft % 60).toString().padStart(2, "0");
    let goal =
      v.cargo.away > 0
        ? this.t("cargoReturns")
        : v.cargo.carrier === v.mySide
          ? this.t("bringHome")
          : v.cargo.carrier !== null
            ? this.t("stopCarrier")
            : this.t("takeCargo");
    if (!me.alive) goal = `${this.t("respawn")} ${Math.ceil(me.respawnLeft)}`;
    const center =
      v.phase === "countdown"
        ? `<div class="nyc-big">${this.t("countdown")} ${Math.ceil(v.phaseLeft)}</div>`
        : `<div class="nyc-score"><span style="color:#3aa0ff">${v.bikes[0].deliveries}</span> : <span style="color:#ff4fa3">${v.bikes[1].deliveries}</span>
           <small>${v.phase === "sudden" ? this.t("suddenDeath") + " " : ""}${mm}:${ss}</small></div>`;
    const net = `${this.t("quality")}: ${st.rttMs !== null ? Math.round(st.rttMs) + " ms" : "—"}${st.snapshotLossPct !== null ? ` · ${st.snapshotLossPct}%` : ""}`;
    const focus = performance.now() < this.focusWarnUntil ? `<div class="nyc-warn">${this.t("focusLost")}</div>` : "";
    this.hud.innerHTML = `<div class="nyc-hud-left">${this.bikeHud(me.hp, me.weapon, me.mag, me.reloadLeft, me.dashCd, me.carrying)}
        <div class="nyc-chips"><span>${this.t("them")}: ${Math.ceil(opp.hp)} HP</span></div></div>
      <div class="nyc-hud-top">${center}<div class="nyc-objective">${goal}</div>${focus}</div>
      <div class="nyc-hud-right ${st.unstable ? "bad" : ""}">${st.unstable ? this.t("unstable") : net}</div>`;
  }

  // ── screens ───────────────────────────────────────────────────────────────────────────────
  render(): void {
    const d = this.duel;
    const key = [this.deps.token?.status.state, this.deps.token?.status.balance, this.mode, this.missionId, this.save.completed.length, this.storyIdx, this.lang, this.save.muted, this.save.shake, this.save.weapon, this.pvpMenu, d?.phase, d?.myReady, d?.peerReady, d?.peerWeapon, d?.myWeapon, d?.peerId, d?.versionError, d?.rematchMe, d?.rematchPeer, d?.result?.resultId, d?.notice].join("|");
    if (key === this.screenKey) return;
    this.screenKey = key;
    const o = this.overlay;
    o.innerHTML = "";
    o.className = "nyc-overlay";
    const show = (panel: HTMLElement, cls = "") => {
      o.className = `nyc-overlay on ${cls}`;
      o.append(panel);
    };
    switch (this.mode) {
      case "menu":
        return show(this.menuScreen(), "menu");
      case "story":
        return show(this.storyScreen(), "menu");
      case "campaign":
        return show(this.campaignScreen(), "menu");
      case "tresult":
        return show(
          panel(this.t("trainDone"), [
            text(this.t("trainDoneText")),
            button(this.t("toCampaign"), () => this.setMode("campaign"), true),
            button(this.t("toMenu"), () => this.setMode("menu")),
          ]),
        );
      case "training":
        return;
      case "brief":
        return show(this.briefScreen());
      case "achievements":
        return show(this.achievementsScreen());
      case "armory":
        return show(this.armoryScreen());
      case "ranks":
        return show(this.ranksScreen());
      case "paused":
        return show(
          panel(this.t("paused"), [
            button(this.t("cont"), () => this.setMode(this.play), true),
            button(this.t("restart"), () => (this.play === "training" ? this.startTraining() : this.startMission())),
            button(this.t("toMenu"), () => this.setMode("menu")),
          ]),
        );
      case "mresult": {
        const s = this.mission!;
        const won = s.phase === "won";
        const st = stars(s);
        const stats = `${DIFF_NAME[s.difficulty][this.lang]} · ${this.t("time")}: ${Math.round(s.time)}s (${this.lang === "ru" ? "норма" : "par"} ${PAR[s.id]}s) · HP ${Math.ceil(s.player.hp)} · ${this.t("kills")}: ${s.kills}`;
        const mt = MISSION_TEXT[s.id]!;
        const convoy = s.lostReason === "convoy";
        return show(
          panel(won ? (s.id === "C05" ? this.t("finale") : this.t("won")) : this.t(convoy ? "convoyLost" : "lost"), [
            ...(won ? [text("★".repeat(st) + "☆".repeat(3 - st), "nyc-stars")] : []),
            text(won ? mt.win[this.lang] : this.t(convoy ? "convoyLostText" : "lostText")),
            ...(won ? [text(this.lang === "ru" ? "★ доставка · ★ в норму времени · ★ HP ≥ 50 на финише" : "★ delivered · ★ within par · ★ finish with HP ≥ 50", "nyc-help")] : []),
            text(stats, "nyc-muted"),
            button(this.t("retry"), () => this.startMission(), !won),
            button(this.t("campaignMap"), () => this.setMode("campaign"), won),
            button(this.t("toMenu"), () => this.setMode("menu")),
          ]),
        );
      }
      case "pvp":
        return this.pvpScreen(show);
      case "mission":
        return;
    }
  }

  private menuScreen(): HTMLElement {
    const p = el("div", "nyc-menu");
    const img = document.createElement("img");
    img.src = this.deps.bannerUrl;
    img.alt = "NOT YOUR CARGO";
    img.className = "nyc-banner";
    p.append(img, text(this.t("subtitle"), "nyc-muted"));
    const started = this.save.storySeen || this.save.trainingDone;
    p.append(button(this.t(started ? "continueCampaign" : "campaign"), () => this.openCampaign(), true));
    const mp = this.deps.multiplayerAvailable();
    const duel = button(this.t("duel"), () => this.deps.openRooms(true));
    const join = button(this.t("join"), () => this.deps.openRooms(false));
    duel.disabled = join.disabled = !mp;
    p.append(duel, join);
    if (!mp) p.append(text(this.t("noMp"), "nyc-muted"));
    const got = unlocked(this.save).length;
    const extra = el("div", "nyc-row");
    extra.append(
      button(`🏆 ${this.lang === "ru" ? "Достижения" : "Achievements"} ${got}/${ACHIEVEMENTS.length}`, () => this.setMode("achievements")),
      button(`📊 ${this.lang === "ru" ? "Рейтинг" : "Ranking"}`, () => this.openRanks(LB_CAMPAIGN)),
    );
    p.append(extra);
    if (this.deps.armory) p.append(button(`🎁 ${this.lang === "ru" ? "Кейсы и покраска" : "Crates & paint"}`, () => this.openArmory()));
    const row = el("div", "nyc-row");
    row.append(
      button(this.lang === "ru" ? "EN" : "RU", () => this.updateSave({ lang: this.lang === "ru" ? "en" : "ru" })),
      button(`${this.t("sound")}: ${this.t(this.save.muted ? "off" : "on")}`, () => {
        this.updateSave({ muted: !this.save.muted });
        this.audio.muted = this.save.muted;
      }),
      button(`${this.t("shake")}: ${this.t(this.save.shake ? "on" : "off")}`, () => this.updateSave({ shake: !this.save.shake })),
    );
    p.append(row, this.trailPanel(), text(this.t("controlsHelp"), "nyc-help"));
    return p;
  }

  private trailPanel(): HTMLElement {
    const box = el("div", "nyc-trail");
    const tk = this.deps.token;
    const st = tk?.status;
    const ru = this.lang === "ru";
    const head = ru ? "Степной след — облик для держателей NYCARGO (≥1 токен), без влияния на бой" : "Steppe Trail — a look for NYCARGO holders (≥1 token), no combat effect";
    const line =
      !tk || !st
        ? ru ? "Недоступно в этой сборке" : "Not available in this build"
        : st.state === "loading"
          ? ru ? "Проверяем баланс…" : "Checking the balance…"
          : st.state === "disconnected"
            ? ru ? "Кошелёк Solana не привязан" : "No Solana wallet linked"
            : st.state === "eligible"
              ? (ru ? "✓ Открыт · баланс " : "✓ Unlocked · balance ") + st.balance + " NYCARGO"
              : st.state === "insufficient"
                ? (ru ? "Нужен 1 NYCARGO · сейчас " : "Needs 1 NYCARGO · now ") + st.balance
                : (ru ? "Не удалось проверить баланс (это не ноль): " : "Could not read the balance (not zero): ") + (st.error ?? "");
    box.append(text(head, "nyc-muted"), text(line, st?.state === "eligible" ? "nyc-ok" : st?.state === "error" ? "nyc-error" : ""));
    if (this.tokenMsg) box.append(text(this.tokenMsg, "nyc-error"));
    if (tk) {
      const r = el("div", "nyc-row");
      if (st?.state === "disconnected")
        r.append(
          button(ru ? "Привязать кошелёк" : "Link wallet", async () => {
            const err = await tk.link();
            this.tokenMsg = err === "no-wallet" ? (ru ? "В браузере нет Solana-кошелька. Открой игру на idosgames.com" : "No Solana wallet in this browser. Open the game on idosgames.com") : err ?? "";
            this.screenKey = "";
            this.render();
          }),
        );
      r.append(button(ru ? "Проверить снова" : "Check again", () => void tk.refresh()));
      box.append(r);
    }
    return box;
  }

  private storyScreen(): HTMLElement {
    const p = el("div", "nyc-panel nyc-story");
    const slide = STORY[this.storyIdx] ?? STORY[0]!;
    if (this.storyIdx === 0) {
      const img = document.createElement("img");
      img.src = this.deps.bannerUrl;
      img.alt = "";
      img.className = "nyc-banner";
      p.append(img);
    }
    const dots = el("div", "nyc-dots");
    dots.textContent = STORY.map((_, i) => (i === this.storyIdx ? "●" : "○")).join(" ");
    p.append(text(slide[this.lang], "nyc-story-text"), dots);
    const last = this.storyIdx >= STORY.length - 1;
    const row = el("div", "nyc-row");
    row.append(
      button(this.t("skip"), () => this.finishStory()),
      button(
        last ? this.t(this.save.trainingDone ? "toCampaign" : "toTraining") : this.t("next"),
        () => {
          if (last) this.finishStory();
          else {
            this.storyIdx += 1;
            this.render();
          }
        },
        true,
      ),
    );
    p.append(row);
    return p;
  }

  private campaignScreen(): HTMLElement {
    const items: HTMLElement[] = [];
    for (const m of CAMPAIGN) {
      const done = this.save.completed.includes(m.id);
      const playable = isMissionOpen(this.save, m.id);
      const best = this.save.stars[m.id] ?? 0;
      const label = `${m.id} · ${m[this.lang]}${done ? " " + "★".repeat(best) + "☆".repeat(3 - best) : ""}${playable ? "" : " 🔒"}`;
      const b = button(
        label,
        () => {
          this.missionId = m.id as MissionId;
          this.setMode("brief");
        },
        playable && !done,
      );
      if (done && best < 3) b.title = this.lang === "ru" ? "Переиграй за все три звезды" : "Replay for all three stars";
      b.disabled = !playable;
      items.push(b);
    }
    const row = el("div", "nyc-row");
    row.append(
      button(this.t("story"), () => {
        this.storyIdx = 0;
        this.setMode("story");
      }),
      button(this.t("training"), () => this.startTraining()),
    );
    items.push(row, button(this.t("toMenu"), () => this.setMode("menu")));
    return panel(this.t("campaignMap"), items);
  }

  private achievementsScreen(): HTMLElement {
    const ru = this.lang === "ru";
    const list = el("div", "nyc-ach-list");
    const fresh = new Set(this.newAchievements);
    // unlocked first, then by progress
    const sorted = [...ACHIEVEMENTS].sort((a, b) => b.progress(this.save) - a.progress(this.save));
    for (const a of sorted) {
      const p = a.progress(this.save);
      const row = el("div", `nyc-ach${p >= 1 ? " done" : ""}${fresh.has(a.id) ? " fresh" : ""}`);
      const bar = el("div", "nyc-ach-bar");
      bar.style.setProperty("--p", `${Math.round(p * 100)}%`);
      row.append(text(`${p >= 1 ? "🏆" : "▫"} ${a.name[this.lang]}`), text(a.goal[this.lang], "nyc-muted"), bar);
      // only for achievements this account has (progress follows the account via the cloud save)
      if (p >= 1) row.append(this.nftButton(a.id, a.name.en));
      list.append(row);
    }
    this.newAchievements = [];
    return panel(`🏆 ${ru ? "Достижения" : "Achievements"} ${unlocked(this.save).length}/${ACHIEVEMENTS.length}`, [
      text(ru ? `Онлайн: ${this.save.pvpWins} побед из ${this.save.pvpMatches} дуэлей` : `Online: ${this.save.pvpWins} wins of ${this.save.pvpMatches} duels`, "nyc-muted"),
      text(
        ru
          ? "NFT-сувенир: выпускаешь сам из своего Solana-кошелька (Phantom), сеть берёт ≈0.002 SOL. Это сувенир, а не доказательство: ачивки считаются в игре на твоём устройстве."
          : "NFT souvenir: you mint it from your own Solana wallet (Phantom), the network takes ≈0.002 SOL. A souvenir, not a proof: achievements are tracked by the game on your device.",
        "nyc-muted",
      ),
      ...(this.nftMsg ? [text(this.nftMsg, this.nftMsg.startsWith("✓") ? "nyc-ok" : "nyc-error")] : []),
      list,
      button(this.t("toMenu"), () => this.setMode("menu"), true),
    ]);
  }

  private nftButton(id: string, nameEn: string): HTMLElement {
    const ru = this.lang === "ru";
    if (mintedSet().has(id)) return text("NFT ✓", "nyc-ok");
    const b = button(this.nftBusy === id ? "…" : ru ? "Выпустить NFT" : "Mint NFT", () => void this.mintNft(id, nameEn), this.mintAsk === id);
    b.disabled = !!this.nftBusy;
    b.classList.add("nyc-nft-btn");
    return b;
  }

  private async mintNft(id: string, nameEn: string): Promise<void> {
    const ru = this.lang === "ru";
    const wallet = browserWallet();
    if (!wallet) {
      if (isEmbeddedInPlatform()) {
        // the site's frame can't sign transactions: the game's own page in a new tab, with Phantom there
        window.open(`https://qa0x2dy9.idos.games/?mint=${encodeURIComponent(id)}`, "_blank", "noopener");
        this.nftMsg = ru ? "Открыл игру в новой вкладке — выпусти NFT там через Phantom" : "Opened the game in a new tab — mint there with Phantom";
      } else this.nftMsg = ru ? "Нужен Solana-кошелёк в браузере (Phantom)" : "A Solana wallet in the browser is needed (Phantom)";
      this.screenKey = "";
      return this.render();
    }
    const rpc = await this.deps.token?.rpcUrl();
    if (!rpc) {
      this.nftMsg = ru ? "Нет адреса RPC в настройках тайтла" : "No RPC URL in the title data";
      this.screenKey = "";
      return this.render();
    }
    this.nftBusy = id;
    this.nftMsg = "";
    this.screenKey = "";
    this.render();
    try {
      const { Connection } = await import("@solana/web3.js");
      const r = await mintAchievement(new Connection(rpc, "confirmed"), wallet, id, nameEn);
      this.nftMsg = `✓ NFT ${r.asset.slice(0, 6)}…${r.asset.slice(-4)}`;
      this.audio.play("deliver");
    } catch (e) {
      this.nftMsg = `${ru ? "Не выпущен" : "Not minted"}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200);
    } finally {
      this.nftBusy = "";
      this.screenKey = "";
      this.render();
    }
  }

  private openArmory(): void {
    this.armoryMsg = "";
    this.lastDrops = [];
    this.setMode("armory");
    const a = this.deps.armory;
    if (!a) return;
    void a.refresh().then((err) => {
      if (err) this.armoryMsg = err;
      this.screenKey = "";
      this.render();
    });
    void a.price().then((p) => {
      this.cratePrice = p;
      this.screenKey = "";
      this.render();
    });
  }

  private armoryScreen(): HTMLElement {
    const ru = this.lang === "ru";
    const a = this.deps.armory!;
    const price = this.cratePrice;
    const items: HTMLElement[] = [
      text(ru ? "Покраска байка — только внешний вид, на бой не влияет. Кейс крутит сервер iDos." : "Bike paint is cosmetic only — no combat effect. The crate is rolled by the iDos server.", "nyc-muted"),
      text(`${ru ? "Баланс в игре" : "In-game balance"}: ${a.balance} NYCARGO`),
    ];
    const row = el("div", "nyc-row");
    const open = button(
      a.busy ? "…" : `${ru ? "Открыть кейс" : "Open crate"}${price != null ? ` · ${price} NYCARGO` : ""}`,
      async () => {
        const r = await a.open();
        if ("error" in r) this.armoryMsg = r.error === "busy" ? "" : `${ru ? "Не открылся" : "Failed"}: ${r.error}`;
        else {
          this.lastDrops = r.drops;
          this.armoryMsg = "";
          this.audio.play("deliver");
          if (r.drops[0] && !this.save.paint) this.updateSave({ paint: r.drops[0] });
        }
        this.screenKey = "";
        this.render();
      },
      true,
    );
    open.disabled = a.busy || price == null;
    row.append(
      open,
      button(ru ? "Пополнить NYCARGO" : "Top up NYCARGO", async () => {
        const ok = await a.topUp();
        this.armoryMsg = ok ? "" : ru ? "Пополнение — через кошелёк сайта: открой игру на idosgames.com" : "Top-up uses the site wallet: open the game on idosgames.com";
        this.screenKey = "";
        this.render();
      }),
    );
    items.push(row);
    if (price == null) items.push(text(ru ? "Кейс пока не настроен в тайтле" : "The crate is not configured yet", "nyc-muted"));
    if (this.lastDrops.length) {
      const got = this.lastDrops.map((id) => paintById(id)!).map((p) => `${p[this.lang]} (${p.rarity})`).join(" + ");
      items.push(text(`🎉 ${ru ? "Выпало" : "You got"}: ${got}`, "nyc-ok"));
    }
    if (this.armoryMsg) items.push(text(this.armoryMsg, "nyc-error"));
    items.push(text(ru ? "Покраска (нажми, чтобы надеть) · шанс: обычная 60% · редкая 28% · эпик 10% · легенда 2% · каждый 10-й кейс — эпик или легенда" : "Paint (tap to equip) · odds: common 60% · rare 28% · epic 10% · legendary 2% · every 10th crate adds an epic or legendary", "nyc-muted"));
    const grid = el("div", "nyc-paints");
    grid.append(button(ru ? "Без покраски" : "No paint", () => this.updateSave({ paint: null }), !this.paintId));
    for (const p of PAINTS) {
      const own = a.owned.has(p.id);
      const b = button(`${own ? "" : "🔒 "}${p[this.lang]}`, () => this.updateSave({ paint: p.id }), this.paintId === p.id);
      b.style.borderColor = RARITY_COLOR[p.rarity];
      b.style.setProperty("--swatch", `#${p.tint.toString(16).padStart(6, "0")}`);
      b.classList.add("nyc-paint");
      b.disabled = !own;
      grid.append(b);
    }
    items.push(grid, button(this.t("toMenu"), () => this.setMode("menu")));
    return panel(`🎁 ${ru ? "Кейсы и покраска" : "Crates & paint"}`, items);
  }

  private openRanks(tab: string): void {
    this.ranks = { tab, list: null };
    this.setMode("ranks");
    const a = this.deps.armory;
    if (!a) return;
    void a.top(tab).then((list) => {
      if (this.ranks.tab !== tab) return;
      this.ranks = { tab, list };
      this.screenKey = "";
      this.render();
    });
  }

  private ranksScreen(): HTMLElement {
    const ru = this.lang === "ru";
    const tabs = el("div", "nyc-row");
    tabs.append(
      button(ru ? "Кампания" : "Campaign", () => this.openRanks(LB_CAMPAIGN), this.ranks.tab === LB_CAMPAIGN),
      button(ru ? "Дуэли (неделя)" : "Duels (week)", () => this.openRanks(LB_DUELS), this.ranks.tab === LB_DUELS),
    );
    const mine = campaignScore(this.save.stars, this.save.cleared);
    const items: HTMLElement[] = [
      tabs,
      text(
        this.ranks.tab === LB_CAMPAIGN
          ? ru ? `Очки: лучшие звёзды миссии × сложность (лёгкая 1, норма 2, хард 3). Твои: ${mine} из 45` : `Points: best mission stars × difficulty (easy 1, normal 2, hard 3). Yours: ${mine} of 45`
          : ru ? "Победы в онлайн-дуэлях за эту неделю" : "Online duel wins this week",
        "nyc-muted",
      ),
    ];
    const l = this.ranks.list;
    if (l === null) items.push(text(ru ? "Загрузка…" : "Loading…"));
    else if (typeof l === "string") items.push(text(`${ru ? "Не загрузилось" : "Failed to load"}: ${l}`, "nyc-error"));
    else if (!l.length) items.push(text(ru ? "Пока пусто — будь первым" : "Empty so far — be the first"));
    else {
      const list = el("div", "nyc-ach-list");
      for (const e of l) list.append(text(`${e.rank ? `#${e.rank}` : "—"} ${e.me ? "▶ " : ""}${e.name} · ${e.score}`, e.me ? "nyc-ok" : ""));
      items.push(list);
    }
    items.push(button(this.t("toMenu"), () => this.setMode("menu"), true));
    return panel(`📊 ${ru ? "Рейтинг" : "Ranking"}`, items);
  }

  private weaponPicker(selected: WeaponId, available: WeaponId[], pick: (w: WeaponId) => void, disabled = false): HTMLElement {
    const row = el("div", "nyc-row");
    for (const w of ALL_WEAPONS) {
      const ok = available.includes(w);
      const s = WEAPONS[w];
      const b = button(`${this.t(w)}${ok ? "" : ` 🔒`}`, () => pick(w), w === selected);
      b.title = ok ? `${s.pellets > 1 ? `${s.pellets}×${s.damage}` : s.damage} · ${s.magazine}` : this.t("locked");
      b.disabled = !ok || disabled;
      row.append(b);
    }
    return row;
  }

  private briefScreen(): HTMLElement {
    const mt = MISSION_TEXT[this.missionId]!;
    const diff = el("div", "nyc-row");
    const beaten = this.save.cleared[this.missionId] ?? [];
    for (const d of DIFFICULTIES) diff.append(button(`${DIFF_NAME[d][this.lang]}${beaten.includes(d) ? " ✓" : ""}`, () => this.updateSave({ difficulty: d }), d === this.save.difficulty));
    return panel(`${this.missionId} · ${mt.title[this.lang]}`, [
      text(mt.brief[this.lang]),
      text(this.lang === "ru" ? "Сложность" : "Difficulty", "nyc-muted"),
      diff,
      text(this.t("weapon"), "nyc-muted"),
      this.weaponPicker(this.save.weapon, this.save.weapons, (w) => this.updateSave({ weapon: w })),
      button(this.t("start"), () => this.startMission(undefined, this.missionId), true),
      button(this.t("back"), () => this.setMode("campaign")),
    ]);
  }

  private pvpScreen(show: (p: HTMLElement, cls?: string) => void): void {
    const d = this.duel;
    if (!d) return;
    const leave = button(this.t("leave"), () => {
      this.leaveDuel();
      this.setMode("menu");
    });
    if (d.phase === "waiting") return show(panel(this.t("room"), [text(this.t("waiting")), text(this.t("rules"), "nyc-muted"), leave]));
    if (d.phase === "lobby") {
      const items: HTMLElement[] = [text(this.t("rules"), "nyc-muted")];
      if (d.isHost) items.push(text(this.t("youAreHost"), "nyc-muted"));
      if (d.versionError) items.push(text(`${this.t("versionError")} (${d.versionError})`, "nyc-error"));
      items.push(text(this.t("weapon"), "nyc-muted"));
      items.push(this.weaponPicker(d.myWeapon, ALL_WEAPONS, (w) => d.setLoadout(w, false), d.myReady));
      items.push(text(`${this.t("opponent")}: ${d.peerWeapon ? this.t(d.peerWeapon) : "…"} · ${d.peerReady ? this.t("ready") : this.t("notReady")}`));
      const r = button(d.myReady ? `✓ ${this.t("ready")}` : this.t("ready"), () => d.setLoadout(d.myWeapon, !d.myReady), !d.myReady);
      r.disabled = !!d.versionError;
      items.push(r, leave);
      if (d.notice === "peer-declined") items.unshift(text(this.t("decline"), "nyc-muted"));
      return show(panel(this.t("room"), items));
    }
    if (d.phase === "match") {
      if (!this.pvpMenu) return;
      return show(
        panel(this.t("fightGoesOn"), [
          button(this.t("resume"), () => {
            this.pvpMenu = false;
            this.render();
          }, true),
          leave,
        ]),
        "dim",
      );
    }
    // result
    const res = d.result!;
    const mine = d.mySide;
    const title =
      res.outcome === "aborted" ? this.t("aborted") : res.outcome === "draw" ? this.t("draw") : res.winner === mine ? this.t("victory") : this.t("defeat");
    const st = d.stats();
    const items: HTMLElement[] = [
      text(reason(this.lang, res.reason), "nyc-muted"),
      text(`${this.t("deliveries")}: ${this.t("you")} ${res.deliveries[mine]} — ${this.t("them")} ${res.deliveries[mine === 0 ? 1 : 0]}`),
      text(`${this.t("kills")}: ${res.kills[mine]} — ${res.kills[mine === 0 ? 1 : 0]} · ${this.t("time")}: ${res.duration}s`),
      text(`${this.t("quality")}: ${st.rttMs !== null ? Math.round(st.rttMs) + " ms" : "—"}${st.snapshotLossPct !== null ? ` · loss ${st.snapshotLossPct}%` : ""}`, "nyc-muted"),
    ];
    const peerHere = !!d.peerId && res.outcome !== "aborted";
    if (peerHere) {
      if (d.rematchPeer && !d.rematchMe) items.push(text(this.t("peerWantsRematch")));
      if (d.rematchMe) items.push(text(this.t("rematchWait"), "nyc-muted"));
      else items.push(button(this.t("rematch"), () => d.requestRematch(true), true));
      items.push(button(this.t("decline"), () => d.requestRematch(false)));
    }
    items.push(leave, text(this.t("hostTrust"), "nyc-help"));
    show(panel(title, items));
  }

  private updateSave(p: Partial<SaveData>): void {
    this.save = { ...this.save, ...p };
    writeSave(this.save);
    this.deps.cloud?.push(this.save);
    this.render();
  }

  /** Debug surface for the agent / reviewers (nothing in the canvas is visible to the DOM). */
  debugState(): unknown {
    const s = this.mission;
    const d = this.duel;
    return {
      mode: this.mode,
      save: { completed: this.save.completed, weapons: this.save.weapons },
      mission: s && { phase: s.phase, time: Math.round(s.time), hp: s.player.hp, x: Math.round(s.player.x), y: Math.round(s.player.y), carried: s.cargo.carried, wave: s.wave, enemies: s.enemies.length, id: s.id, stage: s.stage, leg: s.leg, legs: s.legs, difficulty: s.difficulty },
      duel: d && { phase: d.phase, host: d.isHost, side: d.mySide, matchId: d.matchId, result: d.result, stats: d.stats(), view: this.lastView && { phase: this.lastView.phase, left: Math.round(this.lastView.phaseLeft), cargo: this.lastView.cargo, score: this.lastView.bikes.map((b) => b.deliveries) } },
      pvpRules: { winDeliveries: PVP.winDeliveries, matchTime: PVP.matchTime },
    };
  }
}

// ── tiny DOM helpers ──────────────────────────────────────────────────────────────────────────
function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
function text(s: string, cls = ""): HTMLElement {
  const p = el("p", cls);
  p.textContent = s;
  return p;
}
function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = el("button", primary ? "nyc-btn primary" : "nyc-btn") as HTMLButtonElement;
  b.type = "button";
  b.textContent = label;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}
function panel(title: string, items: HTMLElement[]): HTMLElement {
  const p = el("div", "nyc-panel");
  const h = el("h2", "");
  h.textContent = title;
  p.append(h, ...items);
  return p;
}

function projectileCode(kind: string): number {
  return kind === "pellet" ? 1 : kind === "enemy" ? 2 : kind === "laser" ? 3 : kind === "rocket" ? 4 : 0;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
