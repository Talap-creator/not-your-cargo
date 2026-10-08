# Build history

## Before the hackathon

- The owner wrote the concept, the spec ([TZ-STEPPE-RAIDERS.md](TZ-STEPPE-RAIDERS.md)) and the branding art (`assets/branding/`) and created the iDos title `QA0X2DY9` with the NYCARGO token on the iDos bonding curve (2026-10-06). An earlier concept (Steppe Orbit) and another project (PM Sim) are separate and not part of this submission.
- No game code existed before 2026-10-06.

## During the hackathon (2026-10-06 → 2026-10-08)

All code was written by AI agents under the owner's direction:

- **Claude Code** (Anthropic) — game design implementation, simulation, networking, UI, tests, title configuration and builds.
- **Official iDos MCP servers** — `npx -y @idosgames/mcp` (code MCP: host scaffold, `multiplayer` module, SDK skills) and the Title MCP `https://site.idosgames.com/api/v2/mcp` (OAuth; multiplayer config, Title Data, CloudCode, items, lootbox, leaderboards, user-data schema, build uploads and deploys).
- **Azure-hosted agent swarm** (owner's credits) — SVG sprites; finding and converting CC0 sound effects.
- The paid iDos AI Coder was **not** used; the token was not re-issued.

| Version | Date | What changed |
|---|---|---|
| v1 | 10-06 | P0: C01 + real 1v1 duel over iDos rooms/WebRTC |
| v2 | 10-06 | Story → training ground → campaign order |
| v3 | 10-06 | SVG sprites, sound |
| v4–v8 | 10-07 | C02–C05, enemies (turret, drone, boss), laser/rockets, stars, radio, mobile layout, fog/storm |
| v9–v10 | 10-07 | Steppe Trail cosmetic (CloudCode + RPC), Solana wallet login, compact menu |
| v11–v12 | 10-07 | Difficulties, 24 achievements, CC0 audio (Kenney/OpenGameArt), themed rooms UI |
| v13 | 10-07 | NYCARGO crates, bike paints, leaderboards |
| v14 | 10-08 | Hard retuned after an autopilot balance probe |
| v15 | 10-08 | Longer missions (multi-run contracts), rocket anti-armour bonus |
| v16 | 10-08 | Achievement NFT souvenirs (player-minted) — first version deployed live |
| v17 | 10-08 | Cloud save |
| v18 | 10-08 | Pixel-art sprites (Azure swarm, `assets/pixel/gen_pixel.py`), server-checked rankings (CloudCode `nycMissionWon`, `nycDuelResult`) — live |

The day-by-day engineering log with every check is in [P0-STATUS.md](P0-STATUS.md) (Russian).

## Third-party

iDos SDK and modules (scaffold, `multiplayer`), Phaser 3, @solana/web3.js, Metaplex Core program (on-chain, unmodified). Audio: CC0 packs from Kenney.nl and OpenGameArt — per-file sources in `game/src/modules/not-your-cargo/assets/sfx/CREDITS.md`. Full list: [assets/ATTRIBUTION.md](../assets/ATTRIBUTION.md).
