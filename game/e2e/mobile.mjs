// Mobile E2E: phone emulation (844×390 landscape, touch, mobile UA). Drives the twin-stick layout
// with real touch pointer events. Emulation, not a real device — FPS and feel still need a phone.
// Run: node e2e/mobile.mjs (dev server :5180)
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.URL ?? "http://localhost:5180/";
const results = [];
const check = (name, ok, info = "") => {
  results.push(ok);
  console.log("[mobile]", ok ? "PASS" : "FAIL", name, info);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL);
await page.getByText("Play as guest").tap();
await page.waitForFunction(() => !!globalThis.__nyc, null, { timeout: 30000 });
check("coarse pointer detected → touch layout built", await page.evaluate(() => !!document.querySelector(".nyc-touch")));
check("touch layout hidden in the menu", !(await page.locator(".nyc-stick-left").isVisible()));
await page.screenshot({ path: "e2e/out/mobile-menu.png" });

await page.getByRole("button", { name: /^Кампания$|^Campaign$/ }).tap();
await page.getByRole("button", { name: /Пропустить|Skip/ }).tap();
await sleep(800);
check("training starts, sticks visible", (await page.evaluate(() => globalThis.__nyc.mode)) === "training" && (await page.locator(".nyc-stick-left").isVisible()));

// touch helper: press at a stick centre, drag by (dx,dy), hold, release
const drag = (sel, dx, dy, ms, id) =>
  page.evaluate(
    async ({ sel, dx, dy, ms, id }) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const ev = (type, cx, cy) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: cx, clientY: cy, bubbles: true, isPrimary: id === 1 }));
      ev("pointerdown", x, y);
      for (let i = 1; i <= 5; i++) ev("pointermove", x + (dx * i) / 5, y + (dy * i) / 5);
      await new Promise((r) => setTimeout(r, ms));
      ev("pointerup", x + dx, y + dy);
    },
    { sel, dx, dy, ms, id },
  );
const pos = () => page.evaluate(() => ({ x: globalThis.__nyc.training.player.x, y: globalThis.__nyc.training.player.y, mag: globalThis.__nyc.training.player.mag }));

const p0 = await pos();
await drag(".nyc-stick-left", 60, 0, 900, 1);
const p1 = await pos();
check("left stick drives the bike", p1.x - p0.x > 120, `dx=${Math.round(p1.x - p0.x)}`);
await drag(".nyc-stick-right", 60, -10, 700, 2);
const p2 = await pos();
check("right stick aims and fires", p2.mag < p1.mag, `mag ${p1.mag}→${p2.mag}`);

// both sticks at once (two fingers)
const both = Promise.all([drag(".nyc-stick-left", 0, 60, 700, 3), drag(".nyc-stick-right", -60, 0, 700, 4)]);
await both;
const p3 = await pos();
check("two fingers: move + fire together", p3.y - p2.y > 60 && p3.mag <= p2.mag, `dy=${Math.round(p3.y - p2.y)}`);

// buttons: dash, E hold, Q, R, pause
const btn = (label) => page.locator(".nyc-tbtn", { hasText: label });
await page.evaluate(() => {
  const t = globalThis.__nyc.training;
  t.step = "dash";
});
await drag(".nyc-stick-left", 0, -60, 50, 5).then(() => btn("⚡").dispatchEvent("pointerdown"));
await sleep(150);
check("⚡ button dashes", (await page.evaluate(() => globalThis.__nyc.training.player.dashCd)) > 3);
await page.evaluate(() => {
  const t = globalThis.__nyc.training;
  t.step = "take";
  t.player.x = t.cargo.x - 20;
  t.player.y = t.cargo.y;
});
await btn("E").dispatchEvent("pointerdown");
await sleep(700);
await btn("E").dispatchEvent("pointerup");
check("E button (hold) picks up the cargo", await page.evaluate(() => globalThis.__nyc.training.cargo.carried));
await btn("Q").dispatchEvent("pointerdown");
await sleep(100);
check("Q button drops it", !(await page.evaluate(() => globalThis.__nyc.training.cargo.carried)));
await btn("⏸").dispatchEvent("pointerdown");
await sleep(100);
check("⏸ pauses (no Esc on phones)", (await page.evaluate(() => globalThis.__nyc.mode)) === "paused" && !(await page.locator(".nyc-stick-left").isVisible()));
await page.screenshot({ path: "e2e/out/mobile-paused.png" });
await page.getByRole("button", { name: /Продолжить|Continue/ }).tap();
await sleep(300);
await page.screenshot({ path: "e2e/out/mobile-play.png" });

// portrait → rotate prompt over the game, landscape → gone
await page.setViewportSize({ width: 390, height: 844 });
await sleep(400);
check("portrait shows the rotate prompt", await page.locator(".nyc-rotate").isVisible());
await page.screenshot({ path: "e2e/out/mobile-portrait.png" });
await page.setViewportSize({ width: 844, height: 390 });
await sleep(400);
check("landscape hides it", !(await page.locator(".nyc-rotate").isVisible()));
const box = await page.locator(".nyc-stage canvas").boundingBox();
check("canvas fits the screen", !!box && box.width <= 845 && box.height <= 391, JSON.stringify(box));
check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log("[mobile]", `${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
