// «Степной след» — a cosmetic bike paint + engine trail for holders of the NYCARGO token (spec §7).
// The wallet is the one the iDos server verified by signature (LinkedWallets.solana); the balance is
// read on-chain for the exact mint every session. Nothing here changes speed, HP, weapons or damage.
// An RPC error is "error", never "insufficient"; localStorage never proves ownership.
import type { IDosGamesClient } from "@idosgames/core";
import { isEmbeddedInPlatform, linkWalletSolana, linkWalletViaPlatform } from "@idosgames/wallet";

export const NYCARGO_MINT = "5RWFPAucUS9h4bx1ApTftAWc87jVMxzPTkZwVHSeidos";
export const NYCARGO_DECIMALS = 6; // verified on mainnet 2026-10-07 (getTokenSupply)
export const TRAIL_THRESHOLD = 1; // whole tokens
export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const NETWORK_ID = "solana";

export type TokenState = "disconnected" | "loading" | "eligible" | "insufficient" | "error";
export interface TokenStatus {
  state: TokenState;
  address?: string;
  /** whole tokens as a decimal string */
  balance?: string;
  error?: string;
}

type Fetch = typeof fetch;

/** Sum of the owner's token accounts for the mint, raw units. Throws on any RPC problem. */
/** Title data key holding the browser RPC URL (a domain-restricted provider key, set by the owner). */
export const RPC_TITLE_KEY = "solanaRpcUrl";

export async function readMintBalance(owner: string, doFetch: Fetch = fetch, rpc: string = SOLANA_RPC): Promise<bigint> {
  const res = await doFetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner", params: [owner, { mint: NYCARGO_MINT }, { encoding: "jsonParsed" }] }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const j = (await res.json()) as { error?: { message?: string }; result?: { value?: { account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } } } } }[] } };
  if (j.error || !j.result || !Array.isArray(j.result.value)) throw new Error(j.error?.message ?? "bad RPC response");
  let sum = 0n;
  for (const acc of j.result.value) {
    const info = acc.account?.data?.parsed?.info;
    if (info?.mint !== NYCARGO_MINT) continue;
    if (info.tokenAmount?.decimals !== NYCARGO_DECIMALS) throw new Error("unexpected decimals");
    sum += BigInt(info.tokenAmount.amount ?? "0");
  }
  return sum;
}

export function formatUnits(raw: bigint, decimals = NYCARGO_DECIMALS): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 2)}` : `${whole}`;
}

export function isEligible(raw: bigint): boolean {
  return raw >= BigInt(TRAIL_THRESHOLD) * 10n ** BigInt(NYCARGO_DECIMALS);
}

interface SolanaProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array } | Uint8Array>;
}

export class TokenCosmetic {
  status: TokenStatus = { state: "disconnected" };
  private seq = 0;
  private listeners = new Set<() => void>();

  constructor(
    private client: IDosGamesClient,
    private doFetch: Fetch = (...a) => fetch(...a),
  ) {}

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private set(s: TokenStatus): void {
    this.status = s;
    this.listeners.forEach((f) => f());
  }
  /** Browser RPC URL from title data (also used for NFT mints). */
  async rpcUrl(): Promise<string | null> {
    try {
      const svc = this.client.titleCustomData;
      // getValue() is filled only by the full getPublicTitleData(); read the keyed response itself.
      const r = await svc.getPublicTitleDataKeys([RPC_TITLE_KEY]);
      const fromResponse = r.ok ? (r.data.Static as Record<string, { Value?: string }> | null | undefined)?.[RPC_TITLE_KEY]?.Value : undefined;
      let url = fromResponse ?? svc.getValue(RPC_TITLE_KEY);
      if (!url) {
        // a keyed read can come back without values (cached version) — load the whole public store
        const all = await svc.getPublicTitleData(false);
        url = (all.ok ? (all.data.Static as Record<string, { Value?: string }> | null | undefined)?.[RPC_TITLE_KEY]?.Value : undefined) ?? svc.getValue(RPC_TITLE_KEY);
      }
      return url && url.startsWith("https://") ? url : null;
    } catch {
      return null;
    }
  }
  get eligible(): boolean {
    return this.status.state === "eligible";
  }

  /**
   * Re-read the verified wallet and its balance. A newer call cancels an older one (wallet switch).
   * First choice: the title's CloudCode handler "nycTrailBalance" (server-side wallet + RPC; public
   * Solana RPCs refuse browser origins). Fallback: the browser path, for hosts that allow it.
   */
  async refresh(): Promise<void> {
    const my = ++this.seq;
    this.set({ ...this.status, state: "loading" });
    try {
      const cc = await this.client.cloudCode.execute("nycTrailBalance");
      if (my !== this.seq) return;
      const v = cc.ok && !cc.data.Error ? (cc.data.FunctionResult as { state?: string; address?: string; raw?: string; error?: string } | null) : null;
      if (v?.state === "eligible" || v?.state === "insufficient")
        return this.set({ state: v.state, address: v.address, balance: formatUnits(BigInt(v.raw ?? "0")) });
      if (v?.state === "disconnected") return this.set({ state: "disconnected" });
      // A server-side RPC failure (e.g. no outbound HTTP on the plan) falls back to the browser path
      // when the title provides an RPC URL; otherwise it is reported as an error, never as zero.
      const rpc = await this.rpcUrl();
      if (my !== this.seq) return;
      if (v?.state === "error" && !rpc) return this.set({ state: "error", error: `server: ${v.error}` });
      const r = await this.client.blockchain.getUserState();
      if (my !== this.seq) return;
      if (!r.ok) return this.set({ state: "error", error: r.error ?? r.reason });
      const w = r.data.State?.LinkedWallets?.[NETWORK_ID];
      if (!w?.Address || !w.IsSignatureVerified) return this.set({ state: "disconnected" });
      const via = rpc ?? SOLANA_RPC;
      const raw = await readMintBalance(w.Address, this.doFetch, via).catch((e: unknown) => {
        throw new Error(`${new URL(via).host}: ${e instanceof Error ? e.message : String(e)}`);
      });
      if (my !== this.seq) return;
      this.set({ state: isEligible(raw) ? "eligible" : "insufficient", address: w.Address, balance: formatUnits(raw) });
    } catch (e) {
      if (my === this.seq) this.set({ state: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Link a Solana wallet by signature: the site's wallet inside idosgames.com, a browser wallet outside. */
  async link(): Promise<string | null> {
    try {
      if (isEmbeddedInPlatform()) {
        const r = await linkWalletViaPlatform({ client: this.client, networkID: NETWORK_ID, family: "solana" });
        if (!r.ok) return r.error;
      } else {
        const w = globalThis as { phantom?: { solana?: SolanaProvider }; solana?: SolanaProvider };
        const provider = w.phantom?.solana ?? w.solana;
        if (!provider) return "no-wallet";
        const { publicKey } = await provider.connect();
        const r = await linkWalletSolana({
          client: this.client,
          networkID: NETWORK_ID,
          walletAddress: publicKey.toString(),
          signMessage: async (msg) => {
            const s = await provider.signMessage(msg, "utf8");
            return s instanceof Uint8Array ? s : s.signature;
          },
        });
        if (!r.ok) return r.error;
      }
      await this.refresh();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
}
