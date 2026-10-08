import { defineUiConfig } from "@idosgames/react/ui";

// The game's interface in ONE place: colours, animations and sounds of every module built on
// @idosgames/react/ui (shop, inventory, heroes, rewards, marketplace, …). Change them here — never in
// a module: an edited catalog module is marked "customized" and stops getting catalog updates.
//
// Everything is optional; what you leave out keeps its default. Uncomment and edit.
export default defineUiConfig({
  // NOT YOUR CARGO palette (same as the game's own menus in not-your-cargo/game/styles.ts):
  // dark graphite, rust-orange accents, warm white.
  theme: {
    bgTop: "#2a201b",
    bgBottom: "#120e0c",
    panel: "#241c18",
    panelDeep: "#1a1411",
    panelEdge: "#ff7a1a",
    text: "#f4ead8",
    textDim: "#b3a594",
    gold: "#ffc24a",
    goldDeep: "#b9821c",
    green: "#ff7a1a",
    greenDeep: "#a8480a",
    onGreen: "#1d1714",
    blue: "#5a4a40",
    blueDeep: "#3a2e28",
    onBlue: "#f4ead8",
    red: "#d9452b",
    redDeep: "#8c2414",
    line: "#5a4a40",
    well: "#120e0c",
    radius: 10,
    buttonRadius: 7,
    font: "'Segoe UI', Arial, sans-serif",
    // rarity: { Mythic: "#ff3df5" },   // frame colour of a rarity id (adds to Common…Legendary)
  },
  motion: {
    // enabled: true,             // false — no animations at all
    // speed: 1,                  // 2 — twice as fast, 0.5 — twice as slow
    // intensity: 1,              // bounce/overshoot strength: 0 none … 2 cartoonish
    // rewardFlight: true,        // reward icons fly to the balance counters
    // particles: true,           // particle bursts on claims and purchases
    // stagger: true,             // lists appear item by item
    // respectReducedMotion: true,// follow the system "reduce motion" setting
  },
  sound: {
    // enabled: true,             // false — a silent interface
    // volume: 0.6,               // master volume 0..1 (the player's own volume multiplies it)
    events: {
      // Built-in sounds are synthesized in code (no files). Per event:
      //   "coin"                         — the built-in sound of another event
      //   { url: "https://…/click.mp3" } — your own file (optional volume: 0..1)
      //   { synth: { notes: [{ freq: 880, dur: 0.08, wave: "triangle" }] } } — your own synth
      //   false                          — silence
      // Events: click, tab, open, close, reward, coin, purchase, claim, error, notify, lootbox,
      // levelUp, countTick.
      // click: "tab",
      // countTick: false,
    },
  },
});
