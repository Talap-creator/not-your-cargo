import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
await p.goto(pathToFileURL(path.resolve("src/modules/not-your-cargo/assets/sprites/contact-sheet.html")).href);
await p.screenshot({ path: "e2e/out/sprites.png", fullPage: true });
await b.close();
