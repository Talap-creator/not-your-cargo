import type { Module } from "@idosgames/module-sdk";
import { multiplayerModule } from "./modules/multiplayer";
import { notYourCargoModule } from "./modules/not-your-cargo";

// The modules this app is made of, on top of the base (./base — sign-in and the lobby): the systems
// shown as lobby tabs (shop, heroes, leaderboards…) and the games launched by "Play". Remove a module
// here and it is gone from the app. The platform writes this file whenever modules are installed or
// removed, so it holds only the imports and the array.
export const modules: Module[] = [multiplayerModule, notYourCargoModule];
