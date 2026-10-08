// Cosmetic bike paints from the "cargo_crate" lootbox (paid in NYCARGO — the title's crypto currency
// "Main", topped up through the site's wallet), plus the campaign / duel leaderboards.
// Everything here is server-authoritative: the crate is rolled by the iDos backend, ownership is the
// player's server inventory, scores go to iDos leaderboards. Paints never change combat.
import type { IDosGamesClient } from "@idosgames/core";
import { isEmbeddedInPlatform, openPlatformWalletPanel } from "@idosgames/wallet";

export const CRATE_ID = "cargo_crate";
export const CRATE_OPTION = "nyc";
export const NYC_CURRENCY = "Main";
export const LB_CAMPAIGN = "campaign_score";
export const LB_DUELS = "duel_wins_weekly";
/** Server-written top lists (title Runtime data, CloudCode nyc-ranking.js). */
export const TOP_CAMPAIGN_KEY = "nyc_top_campaign";
export const topDuelsKey = (ms = Date.now()) => `nyc_top_duels_${Math.floor((ms - 345600000) / 604800000)}`;
export type MissionReport = { ok: boolean; error?: string; stars?: number; score?: number };

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";
export interface Paint {
  id: string;
  ru: string;
  en: string;
  rarity: Rarity;
  tint: number;
}
/** Mirror of title-config/build.py (the Title config is the source of truth for drops). */
export const PAINTS: Paint[] = [
  { id: "paint_rust", ru: "Ржавчина", en: "Rust", rarity: "Common", tint: 0xc4612a },
  { id: "paint_sand", ru: "Песок", en: "Sand", rarity: "Common", tint: 0xd8b878 },
  { id: "paint_graphite", ru: "Графит", en: "Graphite", rarity: "Common", tint: 0x4a4f57 },
  { id: "paint_toxic", ru: "Токсик", en: "Toxic", rarity: "Rare", tint: 0x9be22d },
  { id: "paint_neon", ru: "Неон", en: "Neon", rarity: "Rare", tint: 0x2ee6ff },
  { id: "paint_camo", ru: "Камуфляж пустыни", en: "Desert camo", rarity: "Rare", tint: 0x8a7a4e },
  { id: "paint_chrome", ru: "Хром", en: "Chrome", rarity: "Epic", tint: 0xdfe6ee },
  { id: "paint_blood", ru: "Кровавая луна", en: "Blood moon", rarity: "Epic", tint: 0xc0182b },
  { id: "paint_gold", ru: "Золотой курьер", en: "Golden courier", rarity: "Legendary", tint: 0xffc824 },
];
export const RARITY_COLOR: Record<Rarity, string> = { Common: "#b3a594", Rare: "#2ee6ff", Epic: "#c77dff", Legendary: "#ffc824" };
export const paintById = (id: string | null | undefined): Paint | undefined => PAINTS.find((p) => p.id === id);

export interface TopEntry {
  rank: number;
  name: string;
  score: number;
  me: boolean;
}

/** Inventory keys may be "paint_x" or "Skin:paint_x"; count every paint the player owns. */
export function ownedFrom(items: Record<string, { TotalAmount?: number }> | undefined): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(items ?? {})) {
    const id = k.split(/[:/]/).pop()!;
    if ((v?.TotalAmount ?? 0) > 0 && paintById(id)) out.add(id);
  }
  return out;
}

/** Campaign leaderboard score: best stars per mission × difficulty weight (easy 1, normal 2, hard 3). Max 45. */
export function campaignScore(stars: Record<string, number>, cleared: Record<string, string[]>): number {
  const w: Record<string, number> = { easy: 1, normal: 2, hard: 3 };
  let sum = 0;
  for (const [m, list] of Object.entries(cleared)) sum += (stars[m] ?? 1) * Math.max(0, ...list.map((d) => w[d] ?? 0));
  return sum;
}

export class Armory {
  owned = new Set<string>();
  balance = "0";
  busy = false;
  private listeners = new Set<() => void>();

  constructor(private client: IDosGamesClient) {}

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(): void {
    this.listeners.forEach((f) => f());
  }

  /** Read balance and owned paints from the server inventory. */
  async refresh(): Promise<string | null> {
    const r = await this.client.user.getUserInventory();
    if (!r.ok) return r.error ?? r.reason;
    this.owned = ownedFrom(r.data.Items);
    this.balance = this.client.data.user.getCryptoCurrencyAmount(NYC_CURRENCY) || r.data.CryptoCurrencies?.[NYC_CURRENCY]?.Amount?.toString() || "0";
    this.emit();
    return null;
  }

  /** Crate price in NYCARGO from the title config (null when the crate isn't configured). */
  async price(): Promise<number | null> {
    const r = await this.client.lootbox.getDefinitions();
    if (!r.ok) return null;
    const opt = r.data.LootboxDefinitions?.Definitions?.[CRATE_ID]?.PriceOptions?.[CRATE_OPTION];
    const e = opt?.Cost?.Standard?.Entries?.find((x: { CurrencyID?: string | null }) => x.CurrencyID === NYC_CURRENCY);
    return e?.Amount ?? null;
  }

  /** Open one crate. Returns the paint that dropped (and any pity bonus), or an error text. */
  async open(): Promise<{ drops: string[] } | { error: string }> {
    if (this.busy) return { error: "busy" };
    this.busy = true;
    this.emit();
    try {
      const r = await this.client.lootbox.open(CRATE_ID, 1, CRATE_OPTION);
      if (!r.ok) return { error: r.error ?? r.reason };
      const drops: string[] = [];
      for (const e of r.data.Resources?.Grant?.Standard?.Entries ?? []) if (e.ItemID && paintById(e.ItemID)) for (let i = 0; i < (e.Amount ?? 1); i++) drops.push(e.ItemID);
      await this.refresh();
      return { drops };
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  /** Top up NYCARGO: the site's wallet card inside idosgames.com. */
  async topUp(): Promise<boolean> {
    if (!isEmbeddedInPlatform()) return false;
    return openPlatformWalletPanel();
  }

  get userId(): string {
    return this.client.auth.context?.userID ?? "";
  }
  /** Display name in the server tops: no personal data, just a stable courier tag. */
  get courierName(): string {
    return `Courier-${this.userId.slice(0, 4).toUpperCase() || "NEW"}`;
  }

  /** Report a won mission; the SERVER checks order/timing, computes stars and updates the top. */
  async reportMission(id: string, difficulty: string, time: number, hp: number): Promise<MissionReport> {
    const r = await this.client.cloudCode.execute("nycMissionWon", { id, difficulty, time: Math.round(time), hp: Math.ceil(hp), name: this.courierName });
    if (!r.ok) return { ok: false, error: r.error ?? r.reason };
    if (r.data.Error) return { ok: false, error: r.data.Error.Error ?? "script error" };
    return (r.data.FunctionResult as MissionReport) ?? { ok: false, error: "no result" };
  }

  /** Both players report; the server credits the winner only when the two reports agree. */
  async reportDuel(matchId: string, opponent: string, winner: string): Promise<void> {
    await this.client.cloudCode.execute("nycDuelResult", { matchId, opponent, winner, name: this.courierName });
  }

  /** A server-written top list (read-only for clients). */
  async top(key: string): Promise<TopEntry[] | string> {
    const r = await this.client.titleCustomData.getPublicTitleData(false);
    if (!r.ok) return r.error ?? r.reason;
    const raw = (r.data.Runtime as Record<string, { Value?: string }> | null | undefined)?.[key]?.Value;
    let list: { u: string; n: string; s: number }[] = [];
    try {
      list = raw ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
    const me = this.userId;
    return list.slice(0, 20).map((e, i) => ({ rank: i + 1, name: String(e.n).slice(0, 20), score: Number(e.s) || 0, me: e.u === me }));
  }
}
