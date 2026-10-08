// Local check of the NFT souvenir flow with a FAKE wallet: it records the transaction it is asked
// to sign and refuses. Nothing is sent on-chain.
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:5180/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
let pass = 0, total = 0;
const check = (name, ok, extra = "") => { total++; if (ok) pass++; console.log(`[nft] ${ok ? "PASS" : "FAIL"} ${name} ${extra}`); };

const b = await chromium.launch({ executablePath: CHROME });
const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
await ctx.addInitScript(() => {
  const PK = "B36f3ueETWceWeDd4o2unLPDg1S8aoLqtS3Mmkj7jrME";
  globalThis.__signed = null;
  globalThis.phantom = {
    solana: {
      publicKey: { toString: () => PK },
      connect: async () => ({ publicKey: { toString: () => PK } }),
      signTransaction: async (tx) => {
        const ix = tx.instructions[0];
        globalThis.__signed = { program: ix.programId.toBase58(), payer: tx.feePayer.toBase58(), keys: ix.keys.length, sigs: tx.signatures.filter((s) => s.signature).length, blockhash: !!tx.recentBlockhash };
        throw new Error("User rejected the request.");
      },
    },
  };
});
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(URL);
await p.getByText(/Play as guest|Играть как гость/).click({ timeout: 30000 }).catch(() => {});
await p.waitForFunction(() => globalThis.__nyc, null, { timeout: 30000 });
// one achievement unlocked (C01 on Easy)
await p.evaluate(() => {
  const g = globalThis.__nyc;
  g.save = { ...g.save, completed: ["C01"], cleared: { C01: ["easy"] }, stars: { C01: 2 } };
  g.setMode("achievements");
});
await p.waitForTimeout(500);
const btn = p.getByRole("button", { name: /Выпустить NFT|Mint NFT/ });
check("unlocked achievement shows the mint button, locked ones don't", (await btn.count()) === 1);
await btn.first().click();
await p.waitForFunction(() => /Не выпущен|Not minted|✓ NFT/.test(document.querySelector(".nyc-overlay")?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
const s = await p.evaluate(() => globalThis.__signed);
check("wallet asked to sign an mpl-core create tx", s?.program === "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d" && s.keys === 8 && s.blockhash, JSON.stringify(s));
check("the player is the fee payer; the asset key already signed", s?.payer === "B36f3ueETWceWeDd4o2unLPDg1S8aoLqtS3Mmkj7jrME" && s.sigs === 1);
const msg = await p.locator(".nyc-overlay").innerText();
console.log("[nft] msg", JSON.stringify(msg.split("\n").filter((l) => /выпущен|minted|RPC|кошел/i.test(l))));
check("a refusal is reported, nothing marked minted", /Не выпущен|Not minted/.test(msg) && !/NFT ✓/.test(msg));
const meta = await (await p.request.get(new globalThis.URL("nft/C01.easy.json", URL).toString())).json().catch(() => null);
check("metadata JSON is served with the build", meta?.name === "NYC · C01 · Easy" && /C01\.easy\.png$/.test(meta.image ?? ""));
check("no page errors", errs.length === 0, errs.join(" | ").slice(0, 200));
console.log(`[nft] ${pass}/${total} passed`);
await b.close();
process.exit(pass === total ? 0 : 1);
