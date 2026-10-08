// E2E for mission C01 through the real UI on the local dev server (DEV title, guest login).
// Uses real keyboard/mouse events. Two shortcuts are taken via the DEV-only window.__nyc handle and
// are reported as such: moving the bike next to the parcel / into the station, and setting HP to 1
// for the defeat path. Run: node e2e/mission.mjs  (dev server on :5180)
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.URL ?? "http://localhost:5180/";
const log = (...a) => console.log("[mission]", ...a);
const results = [];
const check = (name, ok, info = "") => {
  results.push({ name, ok });
  log(ok ? "PASS" : "FAIL", name, info);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL);
// this test starts after the story and the training ground (covered by e2e/campaign.mjs)
await page.evaluate(() => localStorage.setItem("nyc.save.v1", JSON.stringify({ v: 1, completed: [], weapon: "mg", lang: "ru", muted: true, shake: true, storySeen: true, trainingDone: true })));
await page.reload();
await page.getByText("Play as guest").click();
await page.waitForFunction(() => !!globalThis.__nyc, null, { timeout: 30000 });
const st = () => page.evaluate(() => globalThis.__nyc.debugState());

await page.getByRole("button", { name: /Продолжить кампанию|Continue campaign/ }).click();
await page.getByRole("button", { name: /C01/ }).click();
await page.getByRole("button", { name: /В путь|Ride/ }).click();
let s = await st();
check("mission started from brief", s.mode === "mission" && s.mission.phase === "playing");

// real input: drive right 1 s, fire, dash
const x0 = s.mission.x;
await page.mouse.move(1100, 384);
await page.keyboard.down("KeyD");
await page.waitForTimeout(1000);
await page.keyboard.up("KeyD");
s = await st();
check("WASD moves the bike", s.mission.x - x0 > 150, `dx=${s.mission.x - x0}`);
await page.mouse.down();
await page.waitForTimeout(600);
await page.mouse.up();
const mag = await page.evaluate(() => globalThis.__nyc.mission.player.mag);
check("LMB fires the machine gun", mag < 24, `mag=${mag}`);
await page.keyboard.press("Space");
await page.waitForTimeout(200);
const dashCd = await page.evaluate(() => globalThis.__nyc.mission.player.dashCd);
check("Space dashes (cooldown started)", dashCd > 3, `cd=${dashCd.toFixed(2)}`);

// Esc pauses, Continue resumes
await page.keyboard.press("Escape");
s = await st();
check("Esc pauses the mission", s.mode === "paused");
const tPaused = s.mission.time;
await page.waitForTimeout(500);
check("paused world does not advance", (await st()).mission.time === tPaused);
await page.getByRole("button", { name: /Продолжить|Continue/ }).click();
check("Continue resumes", (await st()).mode === "mission");

// pick up the parcel with a real E hold (shortcut: placed next to it)
await page.evaluate(() => {
  const m = globalThis.__nyc.mission;
  m.player.x = m.cargo.x - 20;
  m.player.y = m.cargo.y;
});
await page.keyboard.down("KeyE");
await page.waitForTimeout(250);
const midHold = (await st()).mission.carried;
await page.waitForTimeout(500);
await page.keyboard.up("KeyE");
s = await st();
check("pickup needs the hold (not instant)", midHold === false);
check("parcel taken after holding E", s.mission.carried === true);
check("first wave triggered", s.mission.wave === 1);
const hud = await page.locator(".nyc-hud").innerText();
check("HUD objective switches to delivery", /доставк|deliver/i.test(hud), hud.replace(/\n/g, " | "));

// deliver (shortcut: placed inside the station)
await page.evaluate(() => {
  const m = globalThis.__nyc.mission;
  m.player.x = m.map.goal.x + 80;
  m.player.y = m.map.goal.y + 80;
  m.player.hp = 100;
});
await page.keyboard.down("KeyE");
await page.waitForTimeout(1900);
s = await st();
check("station stays shut while raiders are near", s.mission.phase === "playing" && /зачисти|clear/i.test(await page.locator(".nyc-hud").innerText()));
// clear the approach (shortcut), keep holding E
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => {
    const m = globalThis.__nyc.mission;
    m.enemies = [];
    m.warnings = [];
    m.projectiles = [];
    m.player.hp = 100;
  });
  await page.waitForTimeout(60);
}
await page.keyboard.up("KeyE");
s = await st();
{ const hud2 = await page.locator(".nyc-hud").innerText(); check("first delivery hands over the return parcel (run 2/3, full repair)", s.mission.phase === "playing" && s.mission.leg === 2 && s.mission.hp === 100 && /Обратный груз|Return parcel/.test(hud2), JSON.stringify({ phase: s.mission.phase, leg: s.mission.leg, hp: s.mission.hp, hud: hud2.slice(0, 160) })); }
// runs 2 and 3 (shortcut): fight already cleared, hold E in the current goal
for (let run = 2; run <= 3; run++) {
  await page.keyboard.down("KeyE");
  for (let i = 0; i < 45; i++) {
    await page.evaluate(() => {
      const m = globalThis.__nyc.mission;
      m.wave = 2;
      m.enemies = [];
      m.warnings = [];
      m.projectiles = [];
      m.player.hp = 100;
      m.player.x = m.map.goal.x + 80;
      m.player.y = m.map.goal.y + 80;
    });
    await page.waitForTimeout(60);
  }
  await page.keyboard.up("KeyE");
  await page.waitForTimeout(200);
}
s = await st();
check("delivery → victory screen", s.mode === "mresult" && s.mission.phase === "won");
check("C01 saved, scatter shot unlocked", s.save.completed.includes("C01") && s.save.weapons.includes("shotgun"));
await page.screenshot({ path: "e2e/out/mission-won.png" });

// retry starts clean; defeat path
await page.getByRole("button", { name: /Повторить|Retry/ }).click();
s = await st();
check("retry: fresh mission (no old cargo/raiders)", s.mission.phase === "playing" && !s.mission.carried && s.mission.enemies === 0 && s.mission.hp === 100);
await page.evaluate(() => {
  const m = globalThis.__nyc.mission;
  m.player.hp = 1;
  m.projectiles.push({ id: 1e6, owner: "r", team: 9, x: m.player.x - 40, y: m.player.y, vx: 480, vy: 0, ttl: 1, damage: 5, kind: "enemy" });
});
await page.waitForTimeout(400);
s = await st();
check("HP 0 → defeat screen", s.mode === "mresult" && s.mission.phase === "lost");
await page.screenshot({ path: "e2e/out/mission-lost.png" });
await page.getByRole("button", { name: /В меню|^Menu$/ }).click();
check("back to menu", (await st()).mode === "menu");

// brief now offers the shotgun; reload keeps progress
await page.reload();
await page.waitForFunction(() => !!globalThis.__nyc, null, { timeout: 30000 });
s = await st();
check("progress survives reload", s.save.completed.includes("C01"));
check("no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
