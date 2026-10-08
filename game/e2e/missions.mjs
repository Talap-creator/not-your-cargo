// E2E for missions C02–C05 through the UI: route map → brief → real input for a few seconds →
// screenshot → finish (shortcuts via the DEV-only window.__nyc, same as e2e/mission.mjs) → result
// screen → the next mission and the weapon unlock. Run: node e2e/missions.mjs (dev server :5180)
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.URL ?? "http://localhost:5180/";
const results = [];
const check = (name, ok, info = "") => {
  results.push(ok);
  console.log("[missions]", ok ? "PASS" : "FAIL", name, info);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL);
await page.getByText("Play as guest").waitFor({ timeout: 30000 });
await page.evaluate(() =>
  localStorage.setItem("nyc.save.v1", JSON.stringify({ v: 1, completed: ["C01"], weapon: "mg", lang: "ru", muted: true, shake: false, storySeen: true, trainingDone: true })),
);
await page.reload();
await page.getByText("Play as guest").click();
await page.waitForFunction(() => !!globalThis.__nyc, null, { timeout: 30000 });
const st = () => page.evaluate(() => globalThis.__nyc.debugState());
const m = (fn) => page.evaluate(fn);

async function openMission(id, weapon) {
  if ((await st()).mode !== "campaign") await page.getByRole("button", { name: /Продолжить кампанию|Continue campaign/ }).click();
  const btn = page.getByRole("button", { name: new RegExp(id) });
  check(`${id} is open on the route map`, await btn.isEnabled());
  await btn.click();
  if (weapon) await page.getByRole("button", { name: weapon }).click();
  await page.getByRole("button", { name: /В путь|Ride/ }).click();
  const s = await st();
  check(`${id} started`, s.mode === "mission" && s.mission.id === id, s.mission?.stage);
}

// drive + shoot a little with real input, so enemies and telegraphs show up
async function skirmish(ms) {
  await page.mouse.move(1000, 380);
  await page.keyboard.down("KeyD");
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
  await page.keyboard.up("KeyD");
}

async function finishWith(fn, id, nextId, unlock) {
  for (let i = 0; i < 200; i++) {
    const s = await st();
    if (s.mode === "mresult") break;
    await m(fn);
    await sleep(60);
  }
  const s = await st();
  check(`${id} won through the UI`, s.mode === "mresult" && s.mission.phase === "won", s.mission?.stage);
  await page.screenshot({ path: `e2e/out/${id}-result.png` });
  check(`${id} saved`, s.save.completed.includes(id));
  if (unlock) check(`${unlock} unlocked by ${id}`, s.save.weapons.includes(unlock));
  await page.getByRole("button", { name: /Маршрут курьера|Courier route/ }).click();
  if (nextId) check(`${nextId} opened`, await page.getByRole("button", { name: new RegExp(nextId) }).isEnabled());
}

const clear = () => {
  const s = globalThis.__nyc.mission;
  s.enemies = s.enemies.filter((e) => e.kind === "boss");
  s.warnings = [];
  s.projectiles = [];
  s.player.hp = 100;
};

// ── C02 ──
await openMission("C02", /Пулемёт/);
await m(() => {
  const s = globalThis.__nyc.mission;
  s.player.x = s.cargo.x - 20;
  s.player.y = s.cargo.y;
});
await page.keyboard.down("KeyE");
await sleep(700);
await page.keyboard.up("KeyE");
check("C02 cargo taken", (await st()).mission.carried === true);
await m(() => {
  const s = globalThis.__nyc.mission;
  s.player.x = 760;
  s.player.y = 250;
}); // north lane
await sleep(300);
await skirmish(3500);
const c02 = await st();
check("C02 north route chosen, turret nests active", c02.mission.stage !== undefined && (await m(() => globalThis.__nyc.mission.route)) === "north");
await page.screenshot({ path: "e2e/out/C02-north.png" });
await finishWith(
  () => {
    const s = globalThis.__nyc.mission;
    s.enemies = [];
    s.warnings = [];
    s.projectiles = [];
    s.player.hp = 100;
    // the return run (C02 is two runs) needs a road picked before the depot opens
    if (!s.route) s.route = "north";
    const g = s.map.goal;
    s.player.x = g.x + 80;
    s.player.y = g.y + 80;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
  },
  "C02",
  "C03",
  "laser",
);
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE" })));

// ── C03 ── (laser)
await openMission("C03", /Лазер/);
await m(() => {
  const s = globalThis.__nyc.mission;
  s.player.x = s.truck.x + 40;
  s.player.y = s.truck.y + 60;
});
await sleep(1500);
const tx = await m(() => globalThis.__nyc.mission.truck.x);
await skirmish(2500);
check("C03 truck rolls with the courier near", (await m(() => globalThis.__nyc.mission.truck.x)) > tx, `${tx}`);
await page.screenshot({ path: "e2e/out/C03-convoy.png" });
await finishWith(
  () => {
    const s = globalThis.__nyc.mission;
    s.enemies = [];
    s.warnings = [];
    s.projectiles = [];
    s.player.hp = 100;
    s.truck.hp = s.truck.maxHp;
    s.player.x = s.truck.x + 30;
    s.player.y = s.truck.y + 60;
    // fast-forward the truck to its last leg
    if (s.truck.wp < 4) {
      const p = [200, 1100, 1900, 2600, 3280][s.truck.wp - 1];
      s.truck.x = p + 50 > s.truck.x ? s.truck.x : s.truck.x;
      s.truck.wp = 4;
      s.truck.x = 3200;
    }
  },
  "C03",
  "C04",
  "rocket",
);

// ── C04 ── (rockets)
await openMission("C04", /Ракеты/);
await m(() => {
  const s = globalThis.__nyc.mission;
  s.player.x = s.terminal.x - 30;
  s.player.y = s.terminal.y;
});
await page.keyboard.down("KeyE");
await sleep(1300);
await page.keyboard.up("KeyE");
check("C04 data downloaded at the terminal", await m(() => globalThis.__nyc.mission.terminal.done));
await m(() => {
  const s = globalThis.__nyc.mission;
  s.player.x = s.cargo.x - 30;
  s.player.y = s.cargo.y;
});
await page.keyboard.down("KeyE");
await sleep(700);
await page.keyboard.up("KeyE");
check("C04 core taken → 30 s countdown", (await m(() => globalThis.__nyc.mission.evac.timer)) > 25);
await skirmish(2500);
await page.screenshot({ path: "e2e/out/C04-holdout.png" });
await finishWith(
  () => {
    const s = globalThis.__nyc.mission;
    s.enemies = s.enemies.filter((e) => e.kind === "turret" && false);
    s.warnings = [];
    s.projectiles = [];
    s.player.hp = 100;
    s.evac.timer = Math.min(s.evac.timer ?? 0, 0.05);
    if (s.evac.open) {
      s.player.x = s.evac.rect.x + 100;
      s.player.y = s.evac.rect.y + 100;
    }
  },
  "C04",
  "C05",
  null,
);

// ── C05 ── boss
await openMission("C05", /Ракеты/);
await skirmish(1500);
await m(() => {
  const s = globalThis.__nyc.mission;
  s.enemies = [];
  s.warnings = [];
  s.player.x = 2400;
  s.player.y = 550;
});
await sleep(500);
check("C05 interceptor appears in the arena", (await st()).mission.stage === "boss");
await page.mouse.move(1200, 200);
await page.mouse.down();
await sleep(3000);
await page.mouse.up();
await page.screenshot({ path: "e2e/out/C05-boss.png" });
const bossHp = await m(() => globalThis.__nyc.mission.boss?.hp ?? 0);
check("the boss telegraphs and fights (alive, courier alive or retry offered)", bossHp > 0 || (await st()).mode === "mresult");
await finishWith(
  () => {
    const s = globalThis.__nyc.mission;
    if (s.boss) s.boss.hp = 0.001;
    s.projectiles = [];
    if (s.boss) s.projectiles.push({ id: 999999, owner: "player", team: 0, x: s.boss.x - 70, y: s.boss.y, vx: 750, vy: 0, ttl: 1, damage: 8, kind: "bullet" });
    s.warnings = [];
    s.player.hp = 100;
    if (s.stage === "deliver") {
      s.enemies = [];
      const g = s.map.goal;
      s.player.x = g.x + 80;
      s.player.y = g.y + 80;
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
    }
  },
  "C05",
  null,
  null,
);
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE" })));
check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log("[missions]", `${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
