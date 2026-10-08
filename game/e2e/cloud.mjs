// Cloud save round trip against the real iDos backend (DEV when local): finish C01 → wait for the
// write → wipe ONLY the local save → reload → progress comes back from the account.
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:5180/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, total = 0;
const check = (name, ok, extra = "") => { total++; if (ok) pass++; console.log(`[cloud] ${ok ? "PASS" : "FAIL"} ${name} ${extra}`); };

const b = await chromium.launch({ executablePath: CHROME });
const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
await p.goto(URL);
await p.getByText(/Play as guest|Играть как гость/).click({ timeout: 30000 });
await p.waitForFunction(() => globalThis.__nyc, null, { timeout: 30000 });
await sleep(3000);
await p.evaluate(() => {
  const g = globalThis.__nyc;
  // the same path a won mission takes (commit → local + cloud)
  g.commit({ ...g.save, completed: ["C01"], cleared: { C01: ["hard"] }, stars: { C01: 3 }, weapons: ["mg", "shotgun"], storySeen: true, trainingDone: true });
});
await sleep(4000); // debounce 1.5 s + request
check("cloud write succeeded", (await p.evaluate(() => globalThis.__nyc.deps.cloud.status)) === "synced");
await p.evaluate(() => localStorage.removeItem("nyc.save.v1"));
await p.reload();
await p.getByText(/Play as guest|Играть как гость/).click({ timeout: 8000 }).catch(() => {}); // a remembered session skips this
await p.waitForFunction(() => globalThis.__nyc, null, { timeout: 30000 });
await p.waitForFunction(() => globalThis.__nyc.save.completed.includes("C01"), null, { timeout: 15000 }).catch(() => {});
const s = await p.evaluate(() => ({ completed: globalThis.__nyc.save.completed, cleared: globalThis.__nyc.save.cleared, weapons: globalThis.__nyc.save.weapons }));
check("after wiping the local save, progress returns from the account", s.completed.includes("C01") && s.cleared.C01?.includes("hard") && s.weapons.includes("shotgun"), JSON.stringify(s));
console.log(`[cloud] ${pass}/${total} passed`);
await b.close();
process.exit(pass === total ? 0 : 1);
