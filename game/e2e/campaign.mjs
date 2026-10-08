// E2E: first launch → «Кампания» → story slides → training ground (every step with real keys and
// mouse; the bike is steered by key events to each marker) → route map → C01 brief.
// Run: node e2e/campaign.mjs  (dev server on :5180)
import { chromium } from "playwright-core";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = process.env.URL ?? "http://localhost:5180/";
const results = [];
const check = (name, ok, info = "") => {
  results.push(ok);
  console.log("[campaign]", ok ? "PASS" : "FAIL", name, info);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL);
await page.getByText("Play as guest").click();
await page.waitForFunction(() => !!globalThis.__nyc, null, { timeout: 30000 });
const st = () => page.evaluate(() => ({ mode: globalThis.__nyc.mode, save: globalThis.__nyc.save, step: globalThis.__nyc.training?.step }));

check("first launch shows «Кампания»", await page.getByRole("button", { name: /^Кампания$|^Campaign$/ }).isVisible());
await page.getByRole("button", { name: /^Кампания$|^Campaign$/ }).click();
check("story opens first", (await st()).mode === "story");
await page.screenshot({ path: "e2e/out/story-1.png" });
for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Дальше$|^Next$/ }).click();
await page.screenshot({ path: "e2e/out/story-4.png" });
await page.getByRole("button", { name: /На полигон|To the training ground/ }).click();
let s = await st();
check("story → training ground", s.mode === "training" && s.save.storySeen === true && s.step === "move");

// steering helper: hold WASD toward a point until reached
await page.evaluate(() => {
  const keys = { KeyW: false, KeyA: false, KeyS: false, KeyD: false };
  const set = (c, on) => {
    if (keys[c] === on) return;
    keys[c] = on;
    window.dispatchEvent(new KeyboardEvent(on ? "keydown" : "keyup", { code: c }));
  };
  globalThis.__goto = async (x, y, ms = 15000) => {
    const t0 = performance.now();
    for (;;) {
      const p = globalThis.__nyc.training.player;
      const dx = x - p.x;
      const dy = y - p.y;
      if (Math.hypot(dx, dy) < 14 || performance.now() - t0 > ms) break;
      set("KeyD", dx > 8);
      set("KeyA", dx < -8);
      set("KeyS", dy > 8);
      set("KeyW", dy < -8);
      await new Promise((r) => setTimeout(r, 30));
    }
    Object.keys(keys).forEach((k) => set(k, false));
  };
  // aim the mouse at a world point and press/release LMB
  globalThis.__shootAt = async (x, y, ms) => {
    const c = document.querySelector(".nyc-stage canvas").getBoundingClientRect();
    const cam = globalThis.__nyc.cam;
    const cx = c.left + ((x - cam.x) / 960) * c.width;
    const cy = c.top + ((y - cam.y) / 540) * c.height;
    const root = document.querySelector(".nyc-root");
    root.dispatchEvent(new MouseEvent("mousemove", { clientX: cx, clientY: cy, bubbles: true }));
    root.dispatchEvent(new MouseEvent("mousedown", { button: 0, clientX: cx, clientY: cy, bubbles: true }));
    await new Promise((r) => setTimeout(r, ms));
    window.dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
  };
});
const hud = () => page.locator(".nyc-hud").innerText().catch(() => "");
check("HUD shows the step text", /метки|marker/i.test(await hud()), (await hud()).replace(/\n/g, " | "));
await page.evaluate(() => globalThis.__goto(420, 380));
await sleep(100);
check("step 1 move → shoot", (await st()).step === "shoot");
for (const t of [{ x: 560, y: 220 }, { x: 610, y: 380 }, { x: 560, y: 540 }]) {
  await page.evaluate(({ x, y }) => globalThis.__shootAt(x, y, 700), t);
  await sleep(150);
}
s = await st();
check("step 2 shoot three targets → dash", s.step === "dash", s.step);
await page.keyboard.down("KeyD");
await page.keyboard.press("Space");
await sleep(200);
await page.keyboard.up("KeyD");
check("step 3 dash → reload", (await st()).step === "reload");
await sleep(1600); // let an automatic reload finish if the magazine ran dry
await page.evaluate(() => globalThis.__shootAt(700, 380, 200));
await page.keyboard.press("KeyR");
await sleep(100);
check("step 4 reload → take", (await st()).step === "take");
await page.evaluate(() => globalThis.__goto(1000, 380));
await page.keyboard.down("KeyE");
await sleep(700);
await page.keyboard.up("KeyE");
check("step 5 take (hold E) → drop", (await st()).step === "drop");
await page.keyboard.press("KeyQ");
await sleep(100);
check("step 6 drop (Q) → retake", (await st()).step === "retake");
const cargo = await page.evaluate(() => globalThis.__nyc.training.cargo);
await page.evaluate(({ x, y }) => globalThis.__goto(x, y), cargo);
await page.keyboard.down("KeyE");
await sleep(700);
await page.keyboard.up("KeyE");
check("step 7 retake → deliver", (await st()).step === "deliver");
await page.evaluate(() => globalThis.__goto(1440, 380));
await page.keyboard.down("KeyE");
await sleep(1800);
await page.keyboard.up("KeyE");
s = await st();
check("step 8 deliver → training complete", s.mode === "tresult" && s.save.trainingDone === true);
await page.screenshot({ path: "e2e/out/training-done.png" });

await page.getByRole("button", { name: /К кампании|To the campaign/ }).click();
check("route map opens", (await st()).mode === "campaign");
await page.screenshot({ path: "e2e/out/campaign-map.png" });
const c02 = page.getByRole("button", { name: /C02/ });
check("C02–C05 shown but locked", await c02.isDisabled());
await page.getByRole("button", { name: /C01/ }).click();
check("C01 → briefing", (await st()).mode === "brief");

await page.reload();
await page.waitForFunction(() => !!globalThis.__nyc, null, { timeout: 30000 });
await page.getByRole("button", { name: /Продолжить кампанию|Continue campaign/ }).click();
check("after reload «Continue» goes straight to the route map", (await st()).mode === "campaign");
check("no page errors", errors.length === 0, errors.join(" | "));
await browser.close();
console.log("[campaign]", `${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
