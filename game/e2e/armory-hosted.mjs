// Hosted check of crates / paints / leaderboards against the live (PROD-config) title.
// A guest has 0 NYCARGO, so the crate must be REFUSED by the server (never a free drop).
import { chromium } from "playwright-core";

const URL = process.env.URL;
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, total = 0;
const check = (name, ok, extra = "") => { total++; if (ok) pass++; console.log(`[armory] ${ok ? "PASS" : "FAIL"} ${name} ${extra}`); };

const b = await chromium.launch({ executablePath: CHROME });
const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(URL);
await p.getByText(/Play as guest|Играть как гость/).click({ timeout: 30000 });
await p.getByRole("button", { name: /Кейсы|Crates/ }).waitFor({ timeout: 30000 });
await p.getByRole("button", { name: /Кейсы|Crates/ }).click();
await p.waitForFunction(() => /Открыть кейс · \d+|Open crate · \d+/.test(document.querySelector(".nyc-overlay")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
const shop = await p.locator(".nyc-overlay").innerText();
check("crate price comes from the title config", /Открыть кейс · \d+ NYCARGO|Open crate · \d+ NYCARGO/.test(shop), JSON.stringify(shop.split("\n").find((l) => /кейс|crate/i.test(l))));
check("all 9 paints listed, locked for a new player", (shop.match(/🔒/g) ?? []).length === 9);
await p.getByRole("button", { name: /Открыть кейс|Open crate/ }).click();
await p.waitForFunction(() => /Не открылся|Failed|Выпало|You got/.test(document.querySelector(".nyc-overlay")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
const after = await p.locator(".nyc-overlay").innerText();
const line = after.split("\n").find((l) => /Не открылся|Failed|Выпало|You got/.test(l)) ?? "";
check("0 NYCARGO: the server refuses the crate (no free drop)", /Не открылся|Failed/.test(line) && !/not found/i.test(line), JSON.stringify(line));
await p.getByRole("button", { name: /В меню|^Menu$/ }).click();
await p.getByRole("button", { name: /Рейтинг|Ranking/ }).click();
await p.waitForFunction(() => /Пока пусто|Empty|#\d|Не загрузилось|Failed to load/.test(document.querySelector(".nyc-overlay")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
const lb = await p.locator(".nyc-overlay").innerText();
check("campaign leaderboard loads", /Пока пусто|Empty|#\d/.test(lb) && !/Не загрузилось|Failed to load/.test(lb));
await p.getByRole("button", { name: /Дуэли|Duels/ }).click();
await sleep(3000);
const lb2 = await p.locator(".nyc-overlay").innerText();
check("weekly duel leaderboard loads", /Пока пусто|Empty|#\d/.test(lb2) && !/Не загрузилось|Failed to load/.test(lb2));
check("no page errors", errs.length === 0, errs.join(" | ").slice(0, 300));
console.log(`[armory] ${pass}/${total} passed`);
await b.close();
process.exit(pass === total ? 0 : 1);
