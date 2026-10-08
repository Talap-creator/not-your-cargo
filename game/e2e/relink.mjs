// E2E for the real PvP duel: two isolated browser profiles = two guest accounts on the DEV title,
// a private room through the lobby's rooms system (iDos signaling), WebRTC DataChannels between the
// two pages. Both players are driven by real keyboard events from this script (a test driver, not
// part of the game). Run: node e2e/duel.mjs  (dev server on :5180)
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.URL ?? "http://localhost:5180/";
const log = (...a) => console.log("[relink]", ...a);
const results = [];
const check = (name, ok, info = "") => {
  results.push({ name, ok });
  log(ok ? "PASS" : "FAIL", name, info);
  return ok;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
// every RTCPeerConnection the page creates, so the test can cut the real WebRTC link
const capturePcs = () => {
  const Orig = window.RTCPeerConnection;
  window.__pcs = [];
  window.RTCPeerConnection = function (...a) {
    const pc = new Orig(...a);
    window.__pcs.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = Orig.prototype;
};
async function player(name) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(capturePcs);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("console", (m) => m.text().startsWith("[duel]") && log(name, m.text()));
  await page.goto(URL);
  await page.getByText("Play as guest").click();
  await page.waitForFunction(() => !!globalThis.__nyc, null, { timeout: 30000 });
  // In-page test driver: steer the own bike through waypoints with key events.
  await page.evaluate(() => {
    const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
    const set = (code, on) => {
      if (keys[code] === on) return;
      keys[code] = on;
      window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code }));
    };
    globalThis.__me = () => {
      const v = globalThis.__nyc.lastView;
      return v ? v.bikes[v.mySide] : null;
    };
    globalThis.__stop = () => Object.keys(keys).forEach((k) => set(k, false));
    globalThis.__drive = async (points, timeoutMs = 20000) => {
      const t0 = performance.now();
      for (const p of points) {
        for (;;) {
          const me = globalThis.__me();
          if (!me || performance.now() - t0 > timeoutMs) {
            globalThis.__stop();
            return false;
          }
          const dx = p.x - me.x;
          const dy = p.y - me.y;
          if (Math.hypot(dx, dy) < 14) break;
          set("KeyD", dx > 8);
          set("KeyA", dx < -8);
          set("KeyS", dy > 8);
          set("KeyW", dy < -8);
          await new Promise((r) => setTimeout(r, 30));
        }
      }
      globalThis.__stop();
      return true;
    };
  });
  return page;
}
const duel = (p) =>
  p.evaluate(() => {
    const d = globalThis.__nyc.duel;
    const v = globalThis.__nyc.lastView;
    return d && {
      phase: d.phase, host: d.isHost, side: d.mySide, matchId: d.matchId, result: d.result, stats: d.stats(),
      view: v && { phase: v.phase, cargo: v.cargo, score: v.bikes.map((b) => b.deliveries), hp: v.bikes.map((b) => b.hp), pos: v.bikes.map((b) => [Math.round(b.x), Math.round(b.y)]) },
    };
  });
const waitFor = async (p, fn, arg, ms = 20000) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
const holdKey = async (p, code, ms) => {
  await p.evaluate((c) => window.dispatchEvent(new KeyboardEvent("keydown", { code: c })), code);
  await sleep(ms);
  await p.evaluate((c) => window.dispatchEvent(new KeyboardEvent("keyup", { code: c })), code);
};
// Route from the cargo to the base of `side` (left base for side 0, mirrored for side 1).
const homeRoute = (side) => {
  const pts = [{ x: 720, y: 500 }, { x: 660, y: 500 }, { x: 600, y: 500 }, { x: 600, y: 370 }, { x: 300, y: 365 }, { x: 165, y: 365 }, { x: 125, y: 500 }];
  return side === 0 ? pts : pts.map((p) => ({ x: 1600 - p.x, y: p.y }));
};
const toCargo = (side) => [...homeRoute(side)].reverse().concat([{ x: side === 0 ? 775 : 825, y: 500 }]);

const host = await player("host");
const guest = await player("guest");

// ── room through the lobby's rooms system ──
await host.getByRole("button", { name: /Дуэль 1×1|1v1 duel/ }).click();
await host.getByRole("button", { name: /Может войти любой|Anyone can join/ }).click({ force: true }); // → private
await host.locator("button.idos-press", { hasText: /^Создать комнату$|^Create a room$/ }).last().click({ force: true });
const inviteBtn = host.getByText(/Приглашение:|Invite:/).first();
await inviteBtn.waitFor({ timeout: 20000 });
const invite = (await inviteBtn.innerText()).split(/:\s*/).slice(1).join(":").trim();
check("host created a private room", /^[0-9a-f]+:[A-Z0-9]+$/i.test(invite), invite.replace(/:.*/, ":****"));

await guest.getByRole("button", { name: /Войти в комнату по коду|Join a room by code/ }).click();
await guest.getByRole("button", { name: /По приглашению|By invite/ }).click({ force: true });
await guest.getByPlaceholder(/Приглашение|Invite/).fill(invite);
await guest.getByRole("button", { name: /^Войти$|^Join$/ }).click({ force: true });
await guest.getByRole("button", { name: /^Готов$|^Ready$/ }).waitFor({ timeout: 20000 });
await guest.getByRole("button", { name: /^Готов$|^Ready$/ }).click({ force: true });
await sleep(1500);
await host.locator("[data-tutorial-anchor=\"multiplayer:play\"]").click({ force: true });

check("both devices switched into the game duel", (await waitFor(host, () => globalThis.__nyc?.duel?.phase === "lobby")) && (await waitFor(guest, () => globalThis.__nyc?.duel?.phase === "lobby")));
let h = await duel(host);
let g = await duel(guest);
check("exactly one authority (host) and one guest", h.host === true && g.host === false);
await guest.screenshot({ path: "e2e/out/duel-lobby-guest.png" });
await host.screenshot({ path: "e2e/out/duel-lobby-host.png" });
if (process.env.PEEK) {
  const info = (p) => p.evaluate(() => ({ hostMode: globalThis.__modes.current(), nycVisible: !!document.querySelector(".nyc-root")?.offsetParent, mode: globalThis.__nyc.mode, duel: globalThis.__nyc.duel?.phase, url: location.href }));
  log("before", JSON.stringify(await info(host)), JSON.stringify(await info(guest)));
  await host.getByRole("button", { name: /Вернуться в игру|Back to the game/ }).click({ force: true });
  await sleep(800);
  log("after resume", JSON.stringify(await info(host)));
  await host.screenshot({ path: "e2e/out/duel-after-resume.png" });
  await browser.close(); process.exit(0); }

// ── loadout + ready → countdown → match ──
await guest.getByRole("button", { name: /Дробовой залп|Scatter shot/ }).click();
await host.getByRole("button", { name: /^Готов$|^Ready$/ }).click();
await sleep(500);
check("host alone ready does not start", (await duel(host)).phase === "lobby");
await guest.getByRole("button", { name: /^Готов$|^Ready$/ }).click();
check("both ready → match starts on both", (await waitFor(host, () => globalThis.__nyc.duel.phase === "match")) && (await waitFor(guest, () => globalThis.__nyc.duel.phase === "match")));
h = await duel(host);
g = await duel(guest);
check("same matchId, opposite sides", h.matchId === g.matchId && h.side !== g.side, `${h.side}/${g.side}`);
await waitFor(guest, () => globalThis.__nyc.lastView?.phase === "play", null, 8000);
// ── cut the guest's real WebRTC connection mid-match; both stay in the room ──
await sleep(2000);
const tickBefore = await guest.evaluate(() => globalThis.__nyc.duel.lastTick ?? 0);
const cut = await guest.evaluate(() => {
  const open = window.__pcs.filter((pc) => pc.connectionState !== "closed");
  open.forEach((pc) => pc.close());
  return open.length;
});
check("guest's WebRTC connection closed by the test", cut > 0, `${cut} closed`);
const t0 = Date.now();
const relinked = await waitFor(guest, (t) => (globalThis.__nyc.duel.lastTick ?? 0) > t + 30 && globalThis.__nyc.duel.phase === "match", tickBefore, 15000);
check("snapshots flow again after the cut (transport re-linked)", relinked, `${Math.round((Date.now() - t0) / 100) / 10} s`);
await sleep(11000);
const h2 = await duel(host);
const g2 = await duel(guest);
check("11 s later the match is still running on both (no false abort)", h2.phase === "match" && g2.phase === "match", `${h2.phase}/${g2.phase} ${g2.result?.reason ?? ""}`);
const b0 = (await duel(host)).view.pos[g.side];
await holdKey(guest, "KeyW", 700);
await sleep(300);
const b1 = (await duel(host)).view.pos[g.side];
check("guest input moves its bike on the host again", Math.abs(b1[1] - b0[1]) > 60, `${b0} → ${b1}`);
const pass = results.filter((r) => r.ok).length;
console.log(`[relink] ${pass}/${results.length} passed`);
await browser.close();
process.exit(pass === results.length ? 0 : 1);
