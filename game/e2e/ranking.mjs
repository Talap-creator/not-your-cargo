// Server-checked rankings against the real iDos CloudCode (DEV when local): two guest accounts call
// the handlers directly, including the cheating attempts the server must refuse.
import { chromium } from "playwright-core";

const URL = process.env.URL ?? "http://localhost:5180/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
let pass = 0, total = 0;
const check = (name, ok, extra = "") => { total++; if (ok) pass++; console.log(`[ranking] ${ok ? "PASS" : "FAIL"} ${name} ${extra}`); };

const b = await chromium.launch({ executablePath: CHROME });
async function player() {
  const p = await (await b.newContext()).newPage();
  await p.goto(URL);
  await p.getByText(/Play as guest|Играть как гость/).click({ timeout: 30000 });
  await p.waitForFunction(() => globalThis.__nyc?.deps?.armory?.client?.auth?.context?.userID, null, { timeout: 30000 });
  return p;
}
const cc = (p, name, args) =>
  p.evaluate(async ([n, a]) => {
    const r = await globalThis.__nyc.deps.armory.client.cloudCode.execute(n, a);
    return r.ok ? (r.data.Error ? { scriptError: r.data.Error } : r.data.FunctionResult) : { callError: r.error ?? r.reason };
  }, [name, args]);
const uid = (p) => p.evaluate(() => globalThis.__nyc.deps.armory.client.auth.context.userID);
const runtime = (p, key) =>
  p.evaluate(async (k) => {
    const r = await globalThis.__nyc.deps.armory.client.titleCustomData.getPublicTitleData(false);
    const v = r.ok ? r.data.Runtime?.[k]?.Value : null;
    return v ? JSON.parse(v) : null;
  }, key);

const A = await player();
// a freshly published CloudCode revision takes up to ~1 min to go live: wait for it (REV=n)
const MIN_REV = Number(process.env.REV ?? 0);
for (let i = 0; i < 30; i++) {
  const rev = await A.evaluate(async () => (await globalThis.__nyc.deps.armory.client.cloudCode.execute("nycMissionWon", {})).data?.Revision ?? 0);
  if (rev >= MIN_REV) break;
  await new Promise((r) => setTimeout(r, 5000));
}
const B = await player();
const a = await uid(A), bId = await uid(B);

let r = await cc(A, "nycMissionWon", { id: "C02", difficulty: "normal", time: 120, hp: 80, name: "Tester A" });
check("skipping C01 is refused", r?.ok === false && /previous/.test(r.error), JSON.stringify(r));
r = await cc(A, "nycMissionWon", { id: "C01", difficulty: "normal", time: 10, hp: 80, name: "Tester A" });
check("an impossible time is refused", r?.ok === false && /time/.test(r.error), JSON.stringify(r));
r = await cc(A, "nycMissionWon", { id: "C01", difficulty: "hard", time: 140, hp: 60, name: "Tester A", stars: 99 });
check("a valid win counts; stars computed by the server (3★ × hard 3 = 9)", r?.ok === true && r.stars === 3 && r.score === 9, JSON.stringify(r));
r = await cc(A, "nycMissionWon", { id: "C02", difficulty: "normal", time: 120, hp: 80, name: "Tester A" });
check("a second win right after the first is refused (real time must pass)", r?.ok === false && /too fast/.test(r.error), JSON.stringify(r));
const top = await runtime(A, "nyc_top_campaign");
check("the server-written campaign top lists the player", Array.isArray(top) && top.some((e) => e.u === a && e.s === 9), JSON.stringify(top?.slice(0, 3)));

const m1 = `e2e-${Date.now()}`;
r = await cc(A, "nycDuelResult", { matchId: m1, opponent: bId, winner: a, name: "Tester A" });
check("one side alone is not credited", r?.ok === true && r.credited === false && r.waiting === true, JSON.stringify(r));
r = await cc(B, "nycDuelResult", { matchId: m1, opponent: a, winner: a, name: "Tester B" });
check("the opponent confirms the same winner → credited once", r?.ok === true && r.credited === true && r.winner === a, JSON.stringify(r));
r = await cc(A, "nycDuelResult", { matchId: m1, opponent: bId, winner: a, name: "Tester A" });
check("reporting the same match again credits nothing", r?.ok === true && r.credited === false, JSON.stringify(r));
const m2 = `e2e-${Date.now()}-b`;
await cc(A, "nycDuelResult", { matchId: m2, opponent: bId, winner: a, name: "Tester A" });
r = await cc(B, "nycDuelResult", { matchId: m2, opponent: a, winner: bId, name: "Tester B" });
check("disagreeing reports credit nobody", r?.ok === true && r.credited === false, JSON.stringify(r));
const C = await player();
r = await cc(C, "nycDuelResult", { matchId: m2, opponent: a, winner: await uid(C), name: "Intruder" });
check("a third account can't report someone else's match", r?.ok === false && /not your match/.test(r.error), JSON.stringify(r));
const week = Math.floor((Date.now() - 345600000) / 604800000);
const dtop = await runtime(A, `nyc_top_duels_${week}`);
check("the weekly duel top lists the confirmed winner", Array.isArray(dtop) && dtop.some((e) => e.u === a && e.s >= 1), JSON.stringify(dtop?.slice(0, 3)));

console.log(`[ranking] ${pass}/${total} passed`);
await b.close();
process.exit(pass === total ? 0 : 1);
