# QA — what was actually checked

All automated runs: Windows 10, Chrome (system install) driven by `playwright-core`. "Hosted" = the uploaded iDos build at `https://qa0x2dy9.idos.games/v/<build>/` with the production config, or the live root after deploy. Latest full pass: **2026-10-08, build v17**.

## Automated

| Suite | What it does | Result (v17) |
|---|---|---|
| `npm test` (vitest) | rules, missions, match, protocol, in-memory duel incl. 5 % loss and a transient link drop, saves + cloud merge, crates, NFT instruction bytes | 64/64 |
| `npm run typecheck` / production build | | 0 errors / OK |
| `e2e/campaign.mjs` | story → all 8 training steps with real keys/mouse → map → brief | 17/17 |
| `e2e/mission.mjs` | C01 through the UI: pickup, ambush, locked station, three runs, win, save, unlock | 20/20 |
| `e2e/missions.mjs` | C02–C05 through the UI incl. both C02 roads, convoy, station, boss | 29/29 |
| `e2e/duel.mjs` | two isolated Chrome profiles (two guest accounts), real iDos room + WebRTC: invite, ready, countdown, contested pickup, host-confirmed hits, 3 deliveries, same result on both, rematch with new matchId/sides, guest leaves → host technical win, host leaves → guest "aborted" | 20/20 |
| `e2e/relink.mjs` | real iDos room + WebRTC: mid-match the test closes the guest's RTCPeerConnection; both stay in the room | 10/10 — the transport re-linked in 4.2 s, snapshots resumed, no false abort 11 s later, guest input works again |
| `e2e/mobile.mjs` | phone viewport, touch sticks/buttons, rotate prompt, menu fit | 14/14 |
| `e2e/nft.mjs` | fake wallet records the tx it is asked to sign: mpl-core program, player = fee payer, asset pre-signed, refusal reported, metadata served | 6/6 |
| `e2e/cloud.mjs` | real iDos backend: progress written to the account, local save wiped, reload → progress restored | 2/2 |
| `e2e/smoke-hosted.mjs` | hosted: load, guest login, multiplayer available, story, training, room, two clients in lobby, countdown, running match | 9/9 (staged v17 and live) |
| `e2e/armory-hosted.mjs` | hosted: crate price from title config, 9 locked paints, server refuses a crate at 0 balance ("insufficient balance (have 0, need 50)"), both leaderboards load | 6/6 (staged v17 and live) |
| Balance probe (autopilot, 6 seeds) | every mission × weapon × difficulty, input only | Easy: all missions; Normal: every mission with its best weapon; Hard: every mission with the right weapon (see BUILD-HISTORY v15) |
| Solana `simulateTransaction` | mpl-core CreateV1 as built by the game, payer = owner wallet, sigVerify off (nothing sent) | "Create … success", 8 207 CU |
| First load (Chrome, 10 Mbit/s emulated, live) | | login screen 1.7 s, menu 3.4 s, 0.9 MB transferred |

## Not verified yet (required by the spec)

| ID | Check | Status |
|---|---|---|
| Q05 | Duel between two real machines on different networks | ❌ only two browsers on one PC (RTT 0–3 ms) |
| Q10 | Real latency 100/200 ms, loss 2/5 % on a network | ❌ loss covered only in the unit test |
| Q11 | Real phone: four screen sizes, FPS ≥ 30 | ❌ emulated viewport only |
| — | Five full human campaign runs, three human PvP matches (recorded) | ❌ |
| — | Six external playtesters (spec §10) | ❌ |
| Q13 | Wallet without token / another mint / real crate purchase / real NFT mint | ⚠️ eligible state seen live (3743.62 NYCARGO); the rest not exercised |

Debug access (`__nyc`, dev builds only) was used in some e2e steps to teleport the bike or clear enemies; it is stripped from production builds and does not replace human runs.
