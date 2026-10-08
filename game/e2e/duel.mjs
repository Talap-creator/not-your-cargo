// E2E for the real PvP duel: two isolated browser profiles = two guest accounts on the DEV title,
// a private room through the lobby's rooms system (iDos signaling), WebRTC DataChannels between the
// two pages. Both players are driven by real keyboard events from this script (a test driver, not
// part of the game). Run: node e2e/duel.mjs  (dev server on :5180)
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.URL ?? "http://localhost:5180/";
const log = (...a) => console.log("[duel]", ...a);
const results = [];
const check = (name, ok, info = "") => {
  results.push({ name, ok });
  log(ok ? "PASS" : "FAIL", name, info);
  return ok;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
async function player(name) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
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

// ── guest input travels to the authority ──
const gSide = g.side;
const before = (await duel(host)).view.pos[gSide];
await holdKey(guest, "KeyS", 700);
await sleep(300);
const after = (await duel(host)).view.pos[gSide];
check("guest input moves its bike on the host", after[1] - before[1] > 80, `${before} → ${after}`);
const hp = (await duel(host)).view.pos[gSide];
const gv = (await duel(guest)).view.pos[gSide];
check("guest prediction matches authority (±40)", Math.hypot(hp[0] - gv[0], hp[1] - gv[1]) < 40);

// ── contest the cargo: both drive in and hold E ──
await Promise.all([host.evaluate((pts) => globalThis.__drive(pts), toCargo(h.side)), guest.evaluate((pts) => globalThis.__drive(pts), toCargo(g.side))]);
await Promise.all([holdKey(host, "KeyE", 900), holdKey(guest, "KeyE", 900)]);
await sleep(400);
h = await duel(host);
g = await duel(guest);
check("one cargo, one carrier — same on both screens", h.view.cargo.carrier !== null && h.view.cargo.carrier === g.view.cargo.carrier, `carrier=${h.view.cargo.carrier}`);

// ── combat over the network: the non-carrier shoots the carrier ──
const carrier = h.view.cargo.carrier;
const shooter = carrier === h.side ? guest : host;
const target = carrier;
const hpBefore = (await duel(host)).view.hp[target];
await shooter.evaluate(() => {
  const v = globalThis.__nyc.lastView;
  const me = v.bikes[v.mySide];
  const op = v.bikes[1 - v.mySide];
  const r = document.querySelector(".nyc-stage canvas").getBoundingClientRect();
  const cam = globalThis.__nyc.cam;
  const cx = r.left + ((op.x - cam.x) / 960) * r.width;
  const cy = r.top + ((op.y - cam.y) / 540) * r.height;
  window.__aim = { cx, cy, me };
  document.querySelector(".nyc-root").dispatchEvent(new MouseEvent("mousemove", { clientX: cx, clientY: cy, bubbles: true }));
  document.querySelector(".nyc-root").dispatchEvent(new MouseEvent("mousedown", { button: 0, clientX: cx, clientY: cy, bubbles: true }));
});
await sleep(450);
await shooter.evaluate(() => window.dispatchEvent(new MouseEvent("mouseup", { button: 0 })));
await sleep(300);
const hpAfterHost = (await duel(host)).view.hp[target];
const hpAfterGuest = (await duel(guest)).view.hp[target];
check("hits confirmed by the host and shown to both", hpAfterHost < hpBefore && Math.abs(hpAfterHost - hpAfterGuest) <= 16, `${hpBefore} → host ${hpAfterHost} / guest ${hpAfterGuest}`);

// ── deliveries until someone wins with 3 ──
const carrierPage = () => duel(host).then((d) => (d.view.cargo.carrier === d.side ? host : d.view.cargo.carrier === null ? null : guest));
for (let k = 0; k < 6; k++) {
  const st = await duel(host);
  if (st.phase !== "match") break;
  let cp = await carrierPage();
  if (!cp) {
    // nobody carries: the host fetches it (guest stays home)
    await waitFor(host, () => globalThis.__nyc.lastView?.cargo.away <= 0, null, 6000);
    const hs = (await duel(host)).side;
    await host.evaluate((pts) => globalThis.__drive(pts), toCargo(hs));
    await holdKey(host, "KeyE", 800);
    cp = await carrierPage();
    if (!cp) continue;
  }
  const side = (await duel(cp)).side;
  await cp.evaluate((pts) => globalThis.__drive(pts, 25000), homeRoute(side));
  await holdKey(cp, "KeyE", 1800);
  await sleep(300);
}
check("match ends on both", (await waitFor(host, () => globalThis.__nyc.duel.phase === "result", null, 10000)) && (await waitFor(guest, () => globalThis.__nyc.duel.phase === "result", null, 10000)));
h = await duel(host);
g = await duel(guest);
check("identical result on both clients", JSON.stringify(h.result) === JSON.stringify(g.result), `${h.result?.outcome} winner=${h.result?.winner} ${h.result?.reason} ${h.result?.deliveries}`);
check("won by 3 deliveries", h.result?.reason === "deliveries" && Math.max(...h.result.deliveries) === 3);
log("net stats host", JSON.stringify(h.stats), "guest", JSON.stringify(g.stats));
await host.screenshot({ path: "e2e/out/duel-result-host.png" });
await guest.screenshot({ path: "e2e/out/duel-result-guest.png" });

// ── rematch by both → new match, sides swapped ──
const oldMatch = h.matchId;
const oldSide = h.side;
await guest.getByRole("button", { name: /^Реванш$|^Rematch$/ }).click();
await sleep(500);
check("one consent is not enough", (await duel(host)).phase === "result");
await host.getByRole("button", { name: /^Реванш$|^Rematch$/ }).click();
check("rematch starts on both", (await waitFor(host, () => globalThis.__nyc.duel.phase === "match")) && (await waitFor(guest, () => globalThis.__nyc.duel.phase === "match")));
h = await duel(host);
check("new matchId and swapped sides", h.matchId !== oldMatch && h.side !== oldSide);
await sleep(600);
const labels = await host.evaluate(() => globalThis.__nyc.phaser.scene.scenes[0].labels.map((l) => [Math.round(l.x), l.text]));
const mine = labels.find((l) => /ТВОЯ|YOUR/.test(l[1]));
check("after the swap, 'your base' label is on the new side", !!mine && (h.side === 1 ? mine[0] > 800 : mine[0] < 800), JSON.stringify(labels));
await host.screenshot({ path: "e2e/out/duel-rematch-host.png" });

// ── guest closes the tab mid-match → host technical win, no hang ──
await sleep(4000);
await guest.close();
const ended = await waitFor(host, () => globalThis.__nyc.duel.phase === "result", null, 25000);
h = await duel(host);
check("guest tab closed → host ends the match (technical win)", ended && h.result?.winner === h.side, h.result?.reason);
check("no page errors", host.errors.length === 0 && guest.errors.length === 0, [...host.errors, ...guest.errors].join(" | "));

// ── second pair: the HOST closes its tab mid-match → the guest sees "aborted", no hang ──
{
  const h2 = await player("host2");
  const g2 = await player("guest2");
  await h2.getByRole("button", { name: /Дуэль 1×1|1v1 duel/ }).click();
  await h2.getByRole("button", { name: /Может войти любой|Anyone can join/ }).click({ force: true });
  await h2.locator("button.idos-press", { hasText: /^Создать комнату$|^Create a room$/ }).last().click({ force: true });
  const ib = h2.getByText(/Приглашение:|Invite:/).first();
  await ib.waitFor({ timeout: 20000 });
  const inv = (await ib.innerText()).split(/:s*/).slice(1).join(":").trim();
  await g2.getByRole("button", { name: /Войти в комнату по коду|Join a room by code/ }).click();
  await g2.getByRole("button", { name: /По приглашению|By invite/ }).click({ force: true });
  await g2.getByPlaceholder(/Приглашение|Invite/).fill(inv);
  await g2.getByRole("button", { name: /^Войти$|^Join$/ }).click({ force: true });
  await g2.getByRole("button", { name: /^Готов$|^Ready$/ }).waitFor({ timeout: 20000 });
  await g2.getByRole("button", { name: /^Готов$|^Ready$/ }).click({ force: true });
  await sleep(1500);
  await h2.locator('[data-tutorial-anchor="multiplayer:play"]').click({ force: true });
  await waitFor(h2, () => globalThis.__nyc?.duel?.phase === "lobby");
  await waitFor(g2, () => globalThis.__nyc?.duel?.phase === "lobby");
  await h2.getByRole("button", { name: /^Готов$|^Ready$/ }).click();
  await g2.getByRole("button", { name: /^Готов$|^Ready$/ }).click();
  await waitFor(g2, () => globalThis.__nyc.lastView?.phase === "play", null, 15000);
  const t0 = Date.now();
  await h2.close();
  const ok = await waitFor(g2, () => globalThis.__nyc.duel.phase === "result", null, 15000);
  const r = (await duel(g2)).result;
  check("host tab closed → guest shows aborted within 10 s", ok && r?.outcome === "aborted" && Date.now() - t0 < 12000, `${r?.reason} in ${Date.now() - t0} ms`);
  await g2.screenshot({ path: "e2e/out/duel-host-left-guest.png" });
}

await browser.close();
const failed = results.filter((r) => !r.ok);
log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
