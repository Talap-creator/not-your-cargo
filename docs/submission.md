# Submission texts — NOT YOUR CARGO

Drafts for the three forms (Colosseum, Superteam Earn, iDos). Check the real form fields, rules and deadlines before pasting (spec deadline note: Colosseum 12 Oct; iDos asks to submit to Colosseum before 13 Oct 11:59 Almaty). Fill every `[…]`.

## One-liner (≤ 100 chars)

> Deliver the cargo through the ambush — then steal it from a friend in a live 1v1. On Solana.

## Short description (≈ 60 words)

> NOT YOUR CARGO is a browser top-down hover-bike shooter on iDos Games. Run five courier contracts through raider ambushes, a convoy escort, a blacked-out station and a boss chase — then challenge a friend to a real-time private 1v1 over a single crate. The Solana token NYCARGO unlocks cosmetics only; no purchase is needed to play.

## Long description

> You're a courier on an armed hover-bike in a fictional steppe frontier. The parcel you picked up turns out to be an energy core, and everyone wants it.
>
> **Campaign:** story → training ground → five missions (2–4 minutes each, three difficulties, 1–3 stars): multi-run deliveries, a road choice between turrets and a sandstorm, a convoy that breaks down mid-ambush, a station blackout hold-out and a two-phase boss with telegraphed attacks. Four weapons unlock as you go.
>
> **PvP:** a private room by code, both players pick a weapon, one crate in the middle of a symmetric arena. Take it, carry it home, first to three deliveries. It's a real network match between two people (iDos rooms + WebRTC, host-authoritative), with a 4-minute clock, sudden death and rematch.
>
> **Solana:** NYCARGO (mainnet) unlocks the Steppe Trail look for holders (balance read on-chain for the wallet the player verified by signature), buys server-rolled cosmetic paint crates, and lets players mint achievement souvenirs as Metaplex Core NFTs from their own wallet. None of it changes combat.
>
> Built in three days with the official iDos SDK and MCP servers by an AI-assisted solo developer. Honest limits: PvP is unranked (the host could cheat), achievements are client-side, cross-network play and human playtests are still being verified.

## Fields

| Field | Value |
|---|---|
| Project name | NOT YOUR CARGO |
| Category | Gaming |
| Play link | https://idosgames.com/app/QA0X2DY9/ |
| Repo | [GitHub URL after publishing] |
| Token | NYCARGO · `5RWFPAucUS9h4bx1ApTftAWc87jVMxzPTkZwVHSeidos` · Solana mainnet |
| Blockchain / tools | Solana (SPL token, Metaplex Core), iDos Games SDK + MCP, Phaser 3, TypeScript, WebRTC |
| Team | [names, roles, location — Kazakhstan track] |
| Pitch video | [URL] |
| Demo video | [URL] |
| Presentation | https://claude.ai/artifact/842KG8rNYwJQWjuvnxmYCX (private until shared from its Share menu; export to PDF/PPTX there) |
| Prior work | Concept, spec, art and token prepared by the owner on 2026-10-06; all game code written 2026-10-06…08 with AI agents. See BUILD-HISTORY.md |
| Demand / distribution | [Only real data: playtest results, players, followers. Leave blank rather than guess.] |

## Pitch deck — 9 slides (EN)

1. **NOT YOUR CARGO** — "Deliver the cargo through the ambush. Then steal it from a friend." Banner, play link, QR.
2. **Players ride, fight and deliver** — short action sessions (2–4 min) and duels with friends in a browser, no install, no wallet needed. *Hypothesis, not validated demand.*
3. **Five missions through the steppe** — C01 First Delivery (three runs) · C02 Ambush (turrets vs sandstorm) · C03 Convoy · C04 Station blackout · C05 Interceptor boss. 3 difficulties, stars, 4 weapons, 24 achievements.
4. **One cargo, two rivals** — private room by code → ready → one crate → first to 3. Real two-player network match, host-authoritative, 4-min clock + sudden death + rematch. [Screenshot/clip of two clients]
5. **Solana unlocks appearance** — NYCARGO on mainnet: holder trail (on-chain balance of the signature-verified wallet), server-rolled paint crates, player-minted achievement NFTs. Zero combat effect.
6. **What players did** — [real playtest numbers only; if none: "Playtests scheduled: 6 external players, 3 duel pairs — results pending"].
7. **How it works** — iDos host + modules, Phaser scene, deterministic 30 Hz sim shared by campaign and PvP, iDos rooms + WebRTC, CloudCode, Lootbox, Leaderboards, cloud save. Honest: unranked PvP, no reconnect yet.
8. **Team and next steps** — [team]; next: cross-network duel tests, six-player playtest, real token flows, reconnect, server-validated results.
9. **Play and challenge a friend** — link, QR, repo, contacts.

## Pitch video — 150 s

| Time | Picture | Voice-over (EN) |
|---|---|---|
| 0–20 | Bike drifts out of the depot, raiders appear | "This is NOT YOUR CARGO: you're a courier on an armed hover-bike, and the parcel you're carrying is something everybody wants." |
| 20–55 | C01 delivery, C02 road choice, C04 blackout | "Five short contracts: ambushes, a sandstorm, a convoy that breaks down mid-fight, a blackout on a station. Two to four minutes each — then you're done." |
| 55–90 | Two screens side by side, the crate fight | "Then the real thing: send a friend a room code. One crate, two couriers, first to three deliveries. It's a live network match between two people — no bots." |
| 90–115 | Steppe Trail, crate opening, NFT mint | "On Solana, NYCARGO holders get the Steppe Trail look; crates and achievement souvenirs are cosmetic. The token never touches combat." |
| 115–135 | Playtest footage / team | "[What testers did — real numbers only.] Built in three days on iDos Games." |
| 135–150 | Link + QR | "Play it now on idosgames.com — and steal your friend's cargo." |

## Demo video — 150 s

| Time | Show |
|---|---|
| 0–15 | idosgames.com/app/QA0X2DY9 → game menu (RU/EN switch) |
| 15–60 | Campaign map → brief (difficulty, weapon) → C01: pickup, ambush, locked station, delivery → result with stars |
| 60–115 | Two real devices: create room, join by code, ready, countdown, contested pickup, a delivery each, result on both, rematch |
| 115–140 | Steppe Trail "✓ Unlocked · balance …", crate screen with the server-side price, achievement → "Mint NFT" |
| 140–150 | Version (v17), limits (unranked PvP, no reconnect), link |

Do not show debug tools, a bot as the second player, or simulated purchases.
