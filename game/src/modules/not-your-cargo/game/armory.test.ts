import { describe, expect, it, vi } from "vitest";

vi.mock("@idosgames/wallet", () => ({ isEmbeddedInPlatform: () => false, openPlatformWalletPanel: vi.fn() }));
const { Armory, campaignScore, ownedFrom } = await import("./armory");
const { decode } = await import("../net/protocol");

describe("armory", () => {
  it("owned paints come from the server inventory, any key style, amount > 0", () => {
    const o = ownedFrom({ "Skin:paint_gold": { TotalAmount: 1 }, paint_rust: { TotalAmount: 2 }, paint_neon: { TotalAmount: 0 }, "Item:iron_sword": { TotalAmount: 1 } });
    expect([...o].sort()).toEqual(["paint_gold", "paint_rust"]);
  });

  it("campaign score = best stars × best difficulty weight, max 45", () => {
    expect(campaignScore({ C01: 3 }, { C01: ["easy", "hard"] })).toBe(9);
    const all = Object.fromEntries(["C01", "C02", "C03", "C04", "C05"].map((m) => [m, ["hard"]]));
    expect(campaignScore(Object.fromEntries(Object.keys(all).map((m) => [m, 3])), all)).toBe(45);
    expect(campaignScore({}, {})).toBe(0);
  });

  it("open() reports the server's drop; a server refusal is an error, not a drop", async () => {
    const client = {
      user: { getUserInventory: async () => ({ ok: true, data: { Items: { "Skin:paint_chrome": { TotalAmount: 1 } } } }) },
      data: { user: { getCryptoCurrencyAmount: () => "40" } },
      lootbox: {
        open: vi.fn(async () => ({ ok: true, data: { Resources: { Grant: { Standard: { Entries: [{ Type: "Item", CatalogID: "Skin", ItemID: "paint_chrome", Amount: 1 }] } } } } })),
      },
    } as never;
    const a = new Armory(client);
    expect(await a.open()).toEqual({ drops: ["paint_chrome"] });
    expect(a.owned.has("paint_chrome")).toBe(true);
    expect(a.balance).toBe("40");
    const poor = new Armory({ ...(client as object), lootbox: { open: async () => ({ ok: false, reason: "server", error: "Insufficient funds" }) } } as never);
    expect(await poor.open()).toEqual({ error: "Insufficient funds" });
  });

  it("a peer's paint id is validated on the wire", () => {
    const ok = decode(new TextEncoder().encode(JSON.stringify({ t: "loadout", weapon: "mg", ready: true, paint: "paint_gold" })));
    expect(ok).toMatchObject({ paint: "paint_gold" });
    const bad = decode(new TextEncoder().encode(JSON.stringify({ t: "loadout", weapon: "mg", ready: true, paint: "<img src=x>" })));
    expect(bad && "paint" in bad).toBe(false);
  });
});

describe("server-checked rankings (client side)", () => {
  it("reads a server-written top list and marks the player; a broken value is an empty list", async () => {
    const client = (v: string | null) =>
      ({ auth: { context: { userID: "ME123" } }, titleCustomData: { getPublicTitleData: async () => ({ ok: true, data: { Runtime: v === null ? {} : { nyc_top_campaign: { Value: v } } } }) } }) as never;
    const a = new Armory(client(JSON.stringify([{ u: "X", n: "Courier-X", s: 30 }, { u: "ME123", n: "Courier-ME12", s: 9 }])));
    expect(await a.top("nyc_top_campaign")).toEqual([
      { rank: 1, name: "Courier-X", score: 30, me: false },
      { rank: 2, name: "Courier-ME12", score: 9, me: true },
    ]);
    expect(await new Armory(client("{not json")).top("nyc_top_campaign")).toEqual([]);
  });

  it("a mission report returns the server's verdict, not the client's", async () => {
    const exec = vi.fn(async () => ({ ok: true, data: { FunctionResult: { ok: false, error: "too fast after the previous report" } } }));
    const a = new Armory({ auth: { context: { userID: "ME" } }, cloudCode: { execute: exec } } as never);
    expect(await a.reportMission("C02", "hard", 61.4, 79.2)).toEqual({ ok: false, error: "too fast after the previous report" });
    expect(exec).toHaveBeenCalledWith("nycMissionWon", { id: "C02", difficulty: "hard", time: 61, hp: 80, name: "Courier-ME" });
  });
});
