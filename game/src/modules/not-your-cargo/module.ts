import { defineModule, type Module } from "@idosgames/module-sdk";
import bannerUrl from "./assets/banner-960.jpg";
import { NycGame } from "./game/NycGame";
import { Armory } from "./game/armory";
import { CloudSave } from "./game/cloud";
import { TokenCosmetic } from "./game/token";

export const MODE = "not-your-cargo";

// NOT YOUR CARGO: campaign mission C01 and the private 1v1 cargo duel. The duel never opens rooms
// itself: the lobby's rooms system (the `multiplayer` module) creates/joins the private room and
// hands it over in start(room); the game then plays host-authoritative over room.session (WebRTC).
export const notYourCargoModule: Module = defineModule({
  id: MODE,
  meta: { name: "NOT YOUR CARGO", type: "game", genre: "shooter", engine: "phaser" },
  setup(ctx) {
    let game: NycGame | null = null;
    let waiters: ((g: NycGame) => void)[] = [];
    const whenMounted = () => new Promise<NycGame>((resolve) => (game ? resolve(game) : waiters.push(resolve)));

    // Rooms open INSIDE the lobby, not as the host menu's window over the game: that window is not
    // closed when the room starts, and it would cover the duel. Switch to the lobby first, then ask
    // for the screen once the lobby (and its presenter) is on screen.
    const openRooms = (create: boolean): boolean => {
      if (!ctx.features.get("multiplayer")?.available) return false;
      const open = () => setTimeout(() => ctx.features.open("multiplayer", { mode: MODE, create }), 60);
      if (ctx.modes.current() === "lobby") open();
      else {
        const off = ctx.modes.subscribe(() => {
          if (ctx.modes.current() !== "lobby") return;
          off();
          open();
        });
        ctx.navigate("lobby");
      }
      return true;
    };

    const deps = {
      bannerUrl,
      openRooms,
      multiplayerAvailable: () => ctx.features.get("multiplayer")?.available === true,
      token: new TokenCosmetic(ctx.client),
      armory: new Armory(ctx.client),
      cloud: new CloudSave(ctx.client),
    };

    ctx.registerScene({
      surface: "fullbleed-canvas",
      mount({ host }) {
        game = new NycGame(host, deps);
        // Local dev only: lets a test script inspect and steer state. Stripped from production builds.
        if (import.meta.env.DEV) Object.assign(globalThis, { __nyc: game, __modes: ctx.modes });
        waiters.forEach((w) => w(game!));
        waiters = [];
      },
      activate() {
        game?.setRunning(true);
      },
      suspend() {
        game?.setRunning(false);
      },
      destroy() {
        game?.destroy();
        game = null;
      },
      capture() {
        return game ? game.capture() : Promise.resolve(null);
      },
    });

    ctx.registerRoute({ id: MODE, label: "NOT YOUR CARGO", icon: "📦" });

    ctx.multiplayer.registerGame({
      mode: MODE,
      label: "NOT YOUR CARGO — 1v1",
      topology: "Host",
      chatMode: "ServerRelay",
      maxPlayers: 2,
      joinInProgress: false,
      start: async (room) => {
        const g = await whenMounted();
        g.playOnline(room);
      },
    });

    ctx.exposeToAgent({
      state: () => (game ? game.debugState() : { mounted: false }),
      actions: {
        startMission: () => game?.startMission(),
      },
      describeActions: {
        startMission: "Start mission C01 «First Delivery» with the selected weapon",
      },
    });
  },
});
