# Architecture

```
idosgames.com (site frame)  ──iframe──▶  qa0x2dy9.idos.games  (static build, Vite)
                                           │
                     ┌─────────────────────┴──────────────────────┐
                     │ iDos host shell (mountHost, base lobby)    │
                     │  ├─ multiplayer module (rooms UI, invites) │
                     │  └─ not-your-cargo module                  │
                     │       ├─ game/NycGame.ts   DOM UI + modes  │
                     │       ├─ game/scene.ts     Phaser renderer │
                     │       ├─ sim/*             pure rules 30 Hz│
                     │       └─ net/*             duel protocol   │
                     └────────────────────────────────────────────┘
        iDos backend: auth · rooms/signalling · Title Data · CloudCode · Lootbox · Items ·
                      Leaderboards · User Custom Data · Blockchain (linked wallets, NYCARGO)
        Solana mainnet: NYCARGO mint (balance reads via RPC) · mpl-core (player-minted souvenirs)
```

## Simulation (`sim/`)

Deterministic fixed step (`DT = 1/30`), seeded RNG, no wall clock. The same combat code (`combat.ts`: bikes, swept projectiles, splash once per target) runs the campaign (`mission.ts`, `enemies.ts`, `campaign-maps.ts`), the training ground (`tutorial.ts`) and PvP (`match.ts`). Difficulty scales enemy damage/HP (`DIFF`). Rules carry a `RULES_VERSION`; PvP refuses to start on a mismatch.

## PvP (`net/`)

- Transport: iDos `RealtimeSession` (WebRTC) from the multiplayer module, channels `rel` (reliable: loadout, ready, start, result, rematch) and `fast` (inputs, snapshots).
- Host-authoritative: the host steps `match.ts` for both bikes; the guest sends `input` (seq, matchId, move/aim/fire, edge counters for dash/interact/drop) at 30 Hz; the host sends snapshots at 15 Hz.
- Guest predicts its own bike and reconciles; the opponent is interpolated (100 ms buffer).
- Watchdogs: no input for 250 ms → the host zeroes that player's input and cancels holds; no snapshot for 10 s → the guest ends the match as aborted. Old matchId/seq packets are ignored; result is created once (`resultId`).
- Tie rule for simultaneous pickups alternates between matches.

## UI (`game/NycGame.ts`)

Modes: menu → story → training → campaign map → brief (difficulty + weapon) → mission ↔ pause → result; achievements, crates, ranking; pvp (waiting/lobby/match/result). Touch controls (`controls.ts`) with two sticks; canvas refits on resize/rotation; a rotate prompt in portrait.

## Persistence

`save.ts` validates any save object (local or cloud): weapons are derived from completed missions, stars/difficulties clamped. `cloud.ts` mirrors progress to the player's iDos account (User Custom Data, Private key `nyc_save`) and merges (union of progress, max of duel records, local device preferences).

## Token features

- `token.ts` — Steppe Trail eligibility: CloudCode `nycTrailBalance` first (server reads the signature-linked wallet), browser RPC fallback (URL from Title Data `solanaRpcUrl`). States: disconnected / loading / eligible / insufficient / error.
- `armory.ts` — crates (`cargo_crate`, priced in crypto currency `Main` = NYCARGO), paints catalog `Skin`, leaderboards `campaign_score`, `duel_wins_weekly`. Config payloads: `game/title-config/build.py`.
- `nft.ts` — mpl-core `CreateV1` instruction encoded by hand; the player's wallet signs as payer; metadata in `public/nft/`.

## Tests

`vitest` (63): movement/dash/reload, swept collisions, one hit per projectile, splash once, cargo ownership, match timer/sudden death/draw, tick order, protocol decode and stale packets, a full duel over an in-memory link incl. 5 % loss, missions C01–C05 scripts, runs, saves/merge, crates, NFT byte layout. Balance probe (`BALANCE=1 DIFF=… npx vitest run balance`): an input-only autopilot plays every mission × weapon × seed.
