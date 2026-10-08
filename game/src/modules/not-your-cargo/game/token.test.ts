import { describe, expect, it, vi } from "vitest";

vi.mock("@idosgames/wallet", () => ({ isEmbeddedInPlatform: () => false, linkWalletSolana: vi.fn(), linkWalletViaPlatform: vi.fn() }));
const { TokenCosmetic, formatUnits, isEligible, readMintBalance, NYCARGO_MINT } = await import("./token");

const rpc = (accounts: { mint: string; amount: string; decimals: number }[] | "error" | "http") =>
  (async () => {
    if (accounts === "http") return new Response("", { status: 503 });
    if (accounts === "error") return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "rate limited" } }));
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { value: accounts.map((a) => ({ account: { data: { parsed: { info: { mint: a.mint, tokenAmount: { amount: a.amount, decimals: a.decimals } } } } } })) },
      }),
    );
  }) as unknown as typeof fetch;

const client = (wallet: { Address?: string; IsSignatureVerified?: boolean } | null, ok = true) =>
  ({
    titleCustomData: { getPublicTitleDataKeys: async () => ({ ok: true, data: {} }), getValue: () => undefined },
    cloudCode: { execute: async () => ({ ok: true, data: { Error: { Error: "HandlerNotFound" } } }) },
    blockchain: {
      getUserState: async () => (ok ? { ok: true, data: { State: { LinkedWallets: wallet ? { solana: wallet } : {} } } } : { ok: false, reason: "connection", error: "offline" }),
    },
  }) as never;

describe("NYCARGO cosmetic", () => {
  it("server RPC failure + title RPC URL → browser path with that URL", async () => {
    let usedUrl = "";
    const fetchSpy = (async (u: string) => {
      usedUrl = u;
      return new Response(JSON.stringify({ result: { value: [{ account: { data: { parsed: { info: { mint: NYCARGO_MINT, tokenAmount: { amount: "1500000", decimals: 6 } } } } } }] } }));
    }) as unknown as typeof fetch;
    const c = {
      titleCustomData: { getPublicTitleDataKeys: async () => ({ ok: true, data: { Static: { solanaRpcUrl: { Value: "https://rpc.example.com/?key=x" } } } }), getValue: () => undefined },
      cloudCode: { execute: async () => ({ ok: true, data: { FunctionResult: { state: "error", error: "Outbound HTTP disabled" } } }) },
      blockchain: { getUserState: async () => ({ ok: true, data: { State: { LinkedWallets: { solana: { Address: "W", IsSignatureVerified: true } } } } }) },
    } as never;
    const t = new TokenCosmetic(c, fetchSpy);
    await t.refresh();
    expect(t.status).toMatchObject({ state: "eligible", balance: "1.5" });
    expect(usedUrl).toBe("https://rpc.example.com/?key=x");
  });

  it("prefers the server-side CloudCode verdict", async () => {
    const viaServer = {
      titleCustomData: { getPublicTitleDataKeys: async () => ({ ok: true, data: {} }), getValue: () => undefined },
    cloudCode: { execute: async () => ({ ok: true, data: { FunctionResult: { state: "eligible", address: "W", raw: "3000000" } } }) },
      blockchain: {
        getUserState: async () => {
          throw new Error("must not be called");
        },
      },
    } as never;
    const t = new TokenCosmetic(viaServer, rpc("http"));
    await t.refresh();
    expect(t.status).toMatchObject({ state: "eligible", balance: "3" });
    const serverErr = {
      titleCustomData: { getPublicTitleDataKeys: async () => ({ ok: true, data: {} }), getValue: () => undefined },
    cloudCode: { execute: async () => ({ ok: true, data: { FunctionResult: { state: "error", error: "RPC HTTP 429" } } }) },
      blockchain: { getUserState: async () => ({ ok: true, data: {} }) },
    } as never;
    const e = new TokenCosmetic(serverErr, rpc([]));
    await e.refresh();
    expect(e.status.state).toBe("error");
  });

  it("threshold is one whole token with 6 decimals", () => {
    expect(isEligible(999_999n)).toBe(false);
    expect(isEligible(1_000_000n)).toBe(true);
    expect(formatUnits(1_234_567n)).toBe("1.23");
    expect(formatUnits(5_000_000n)).toBe("5");
  });

  it("sums only accounts of the exact mint and refuses other decimals", async () => {
    const raw = await readMintBalance("W", rpc([
      { mint: NYCARGO_MINT, amount: "600000", decimals: 6 },
      { mint: NYCARGO_MINT, amount: "500000", decimals: 6 },
      { mint: "OtherMint1111111111111111111111111111111111", amount: "99000000", decimals: 6 },
    ]));
    expect(raw).toBe(1_100_000n);
    await expect(readMintBalance("W", rpc([{ mint: NYCARGO_MINT, amount: "1", decimals: 9 }]))).rejects.toThrow();
  });

  it("states: disconnected / eligible / insufficient / error (RPC error is not zero)", async () => {
    const verified = { Address: "Wallet111", IsSignatureVerified: true };
    const none = new TokenCosmetic(client(null), rpc([]));
    await none.refresh();
    expect(none.status.state).toBe("disconnected");
    const unverified = new TokenCosmetic(client({ Address: "W", IsSignatureVerified: false }), rpc([]));
    await unverified.refresh();
    expect(unverified.status.state).toBe("disconnected");
    const rich = new TokenCosmetic(client(verified), rpc([{ mint: NYCARGO_MINT, amount: "2000000", decimals: 6 }]));
    await rich.refresh();
    expect(rich.status).toMatchObject({ state: "eligible", balance: "2" });
    const poor = new TokenCosmetic(client(verified), rpc([{ mint: NYCARGO_MINT, amount: "10", decimals: 6 }]));
    await poor.refresh();
    expect(poor.status.state).toBe("insufficient");
    for (const bad of ["error", "http"] as const) {
      const t = new TokenCosmetic(client(verified), rpc(bad));
      await t.refresh();
      expect(t.status.state).toBe("error");
      expect(t.eligible).toBe(false);
    }
    const offline = new TokenCosmetic(client(verified, false), rpc([]));
    await offline.refresh();
    expect(offline.status.state).toBe("error");
  });

  it("a newer check wins over an older one (wallet switch)", async () => {
    let n = 0;
    const switching = { titleCustomData: { getPublicTitleDataKeys: async () => ({ ok: true, data: {} }), getValue: () => undefined }, cloudCode: { execute: async () => ({ ok: false, reason: "server" }) }, blockchain: { getUserState: async () => ({ ok: true, data: { State: { LinkedWallets: { solana: { Address: n++ === 0 ? "OLD" : "NEW", IsSignatureVerified: true } } } } }) } } as never;
    const byOwner = (async (_u: string, init: { body: string }) => {
      const owner = JSON.parse(init.body).params[0];
      if (owner === "OLD") await new Promise((r) => setTimeout(r, 30));
      const amount = owner === "OLD" ? "5000000" : "0";
      return new Response(JSON.stringify({ result: { value: [{ account: { data: { parsed: { info: { mint: NYCARGO_MINT, tokenAmount: { amount, decimals: 6 } } } } } }] } }));
    }) as unknown as typeof fetch;
    const t = new TokenCosmetic(switching, byOwner);
    const first = t.refresh(); // OLD wallet: slow RPC in flight
    await new Promise((r) => setTimeout(r, 5));
    await Promise.all([first, t.refresh()]); // NEW wallet answers first and must stay
    expect(t.status).toMatchObject({ state: "insufficient", address: "NEW" });
  });
});
