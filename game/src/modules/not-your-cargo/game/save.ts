// P0 progress: local only, versioned, defensive. A missing or broken save never breaks the game and
// never produces a win. Cloud sync (client.userCustomData) is a P1 task with a merge rule.
import type { WeaponId } from "../sim/config";
import { DIFFICULTIES, type Difficulty } from "../sim/mission";
import type { Lang } from "./i18n";

export interface SaveData {
  v: 1;
  completed: string[];
  weapons: WeaponId[];
  weapon: WeaponId;
  lang: Lang;
  muted: boolean;
  shake: boolean;
  storySeen: boolean;
  trainingDone: boolean;
  /** best stars per mission (1–3) */
  stars: Record<string, number>;
  /** difficulties each mission was won on */
  cleared: Record<string, Difficulty[]>;
  difficulty: Difficulty;
  /** online duel record (local mirror; the server leaderboard is the authority) */
  pvpWins: number;
  pvpMatches: number;
  /** equipped paint id; shown only while the server inventory has it */
  paint: string | null;
}

const KEY = "nyc.save.v1";

export function defaultSave(): SaveData {
  const lang: Lang = typeof navigator !== "undefined" && !navigator.language?.toLowerCase().startsWith("ru") ? "en" : "ru";
  return { v: 1, completed: [], weapons: ["mg"], weapon: "mg", lang, muted: false, shake: true, storySeen: false, trainingDone: false, stars: {}, cleared: {}, difficulty: "normal", pvpWins: 0, pvpMatches: 0, paint: null };
}

export function loadSave(storage: Pick<Storage, "getItem"> | null = safeStorage()): SaveData {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? parseSave(JSON.parse(raw)) : defaultSave();
  } catch {
    return defaultSave();
  }
}

/** Validate any untrusted save object (local storage or the cloud copy). */
export function parseSave(o: any): SaveData {
  const d = defaultSave();
  try {
    if (!o || o.v !== 1) return d;
    const completed: string[] = Array.isArray(o.completed) ? o.completed.filter((c: unknown) => typeof c === "string" && MISSION_ORDER.includes(c)) : [];
    // Weapons follow from completed missions only: a hand-edited weapon list unlocks nothing.
    const unlocked = weaponsFor(completed);
    return {
      v: 1,
      completed,
      weapons: unlocked,
      weapon: unlocked.includes(o.weapon) ? o.weapon : "mg",
      lang: o.lang === "en" || o.lang === "ru" ? o.lang : d.lang,
      muted: o.muted === true,
      shake: o.shake !== false,
      storySeen: o.storySeen === true,
      trainingDone: o.trainingDone === true,
      // stars only for completed missions, clamped
      stars: Object.fromEntries(
        completed.map((m) => [m, Math.max(1, Math.min(3, Math.floor(Number(o.stars?.[m]) || 1)))] as const),
      ),
      // a mission completed before difficulties existed counts as "normal"
      cleared: Object.fromEntries(
        completed.map((m) => {
          const list = Array.isArray(o.cleared?.[m]) ? (o.cleared[m] as unknown[]).filter((d): d is Difficulty => DIFFICULTIES.includes(d as Difficulty)) : [];
          return [m, list.length ? [...new Set(list)] : (["normal"] as Difficulty[])] as const;
        }),
      ),
      difficulty: DIFFICULTIES.includes(o.difficulty) ? o.difficulty : "normal",
      pvpWins: count(o.pvpWins),
      pvpMatches: Math.max(count(o.pvpMatches), count(o.pvpWins)),
      paint: typeof o.paint === "string" && /^paint_[a-z]{1,16}$/.test(o.paint) ? o.paint : null,
    };
  } catch {
    return d;
  }
}

/**
 * Cloud + local: progress is the union (missions, difficulties, best stars, the larger duel record —
 * never a sum, so syncing twice counts nothing twice); story/training seen if seen anywhere; device
 * preferences (language, sound, shake, weapon, difficulty, paint) stay the local ones.
 */
export function mergeSaves(local: SaveData, cloud: SaveData): SaveData {
  const completed = MISSION_ORDER.filter((m) => local.completed.includes(m) || cloud.completed.includes(m));
  const stars: Record<string, number> = {};
  const cleared: Record<string, Difficulty[]> = {};
  for (const m of completed) {
    stars[m] = Math.max(local.stars[m] ?? 0, cloud.stars[m] ?? 0, 1);
    cleared[m] = DIFFICULTIES.filter((x) => (local.cleared[m] ?? []).includes(x) || (cloud.cleared[m] ?? []).includes(x));
    if (!cleared[m].length) cleared[m] = ["normal"];
  }
  const weapons = weaponsFor(completed);
  return {
    ...local,
    completed,
    weapons,
    weapon: weapons.includes(local.weapon) ? local.weapon : "mg",
    stars,
    cleared,
    storySeen: local.storySeen || cloud.storySeen,
    trainingDone: local.trainingDone || cloud.trainingDone,
    pvpWins: Math.max(local.pvpWins, cloud.pvpWins),
    pvpMatches: Math.max(local.pvpMatches, cloud.pvpMatches, local.pvpWins, cloud.pvpWins),
  };
}

/** Same progress (ignoring device preferences)? Used to skip needless cloud writes. */
export function sameProgress(a: SaveData, b: SaveData): boolean {
  const pick = (s: SaveData) => JSON.stringify([s.completed, s.stars, s.cleared, s.storySeen, s.trainingDone, s.pvpWins, s.pvpMatches]);
  return pick(a) === pick(b);
}

export function writeSave(s: SaveData, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: progress just stays in memory */
  }
}

export const MISSION_ORDER = ["C01", "C02", "C03", "C04", "C05"];
const UNLOCKS: Record<string, WeaponId> = { C01: "shotgun", C02: "laser", C03: "rocket" };

export function weaponsFor(completed: string[]): WeaponId[] {
  return ["mg", ...MISSION_ORDER.filter((m) => completed.includes(m) && UNLOCKS[m]).map((m) => UNLOCKS[m]!)];
}

/** A mission is open when it is the first or the previous one is completed. */
export function isMissionOpen(s: SaveData, id: string): boolean {
  const i = MISSION_ORDER.indexOf(id);
  return i === 0 || (i > 0 && s.completed.includes(MISSION_ORDER[i - 1]!));
}

/** Idempotent: a second win of the same mission changes nothing. */
export function completeMission(s: SaveData, id: string, stars = 1, difficulty: Difficulty = "normal"): SaveData {
  if (!MISSION_ORDER.includes(id)) return s;
  const best = Math.max(s.stars[id] ?? 0, Math.min(3, Math.max(1, stars)));
  const had = s.cleared[id] ?? [];
  const cleared = had.includes(difficulty) ? s.cleared : { ...s.cleared, [id]: [...had, difficulty] };
  if (s.completed.includes(id)) return best === s.stars[id] && cleared === s.cleared ? s : { ...s, cleared, stars: { ...s.stars, [id]: best } };
  const completed = [...s.completed, id];
  return { ...s, completed, cleared, weapons: weaponsFor(completed), stars: { ...s.stars, [id]: best } };
}

export function recordDuel(s: SaveData, won: boolean): SaveData {
  return { ...s, pvpMatches: s.pvpMatches + 1, pvpWins: s.pvpWins + (won ? 1 : 0) };
}

function count(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}
