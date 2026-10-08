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
