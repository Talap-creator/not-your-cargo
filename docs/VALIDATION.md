# Validation plan (human tests)

Nothing below has been run yet. Fill in the tables as tests happen; do not invent numbers.

## 1. Two-device duel (Q05, Q10) — 30 min, 2 people

Devices: PC on home Wi-Fi + phone on mobile data (different networks). Both open https://idosgames.com/app/QA0X2DY9/.

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | PC: «Дуэль 1×1 с другом» → create room, send the code | Code shown, "waiting for opponent" | |
| 2 | Phone: «Войти в комнату по коду» | Both in the duel lobby | |
| 3 | Both pick weapons, Ready | 3 s countdown, match starts on both | |
| 4 | Play to 3 deliveries | Same score and result on both | |
| 5 | Rematch | Sides swap, new match | |
| 6 | Match to the 4:00 clock with equal score | Sudden death / draw identical on both | |
| 7 | Phone switches to airplane mode mid-match | PC: technical win within ~10 s; phone: understandable state | |

Record: build version (menu → bottom), devices, networks, the RTT shown in the HUD, bugs. Record the screen of both devices for the demo video.

## 2. Campaign runs — 5 recordings

One full human run per mission C01–C05 on Normal, screen-recorded. Note time to finish, deaths, stars.

| Mission | Player | Time | Deaths | Stars | Notes |
|---|---|---|---|---|---|
| C01 | | | | | |
| C02 | | | | | |
| C03 | | | | | |
| C04 | | | | | |
| C05 | | | | | |

## 3. Six-player check (spec §10)

Six adults outside the team; each plays C01, then three pairs play the duel. The observer doesn't explain or steer.

Thresholds for iteration (not PMF): ≥ 5/6 move and shoot within 30 s; ≥ 4/6 deliver in C01 within two attempts; ≥ 2/3 pairs finish a network match without a technical failure and understand the rules; ≥ 2/3 pairs choose a rematch on their own.

| Tester | Moved+shot ≤30 s | C01 delivered (attempts) | Pair | Match finished | Rematch | Comments |
|---|---|---|---|---|---|---|
| 1 | | | A | | | |
| 2 | | | A | | | |
| 3 | | | B | | | |
| 4 | | | B | | | |
| 5 | | | C | | | |
| 6 | | | C | | | |

## 4. Token flows (Q13)

| Flow | Steps | Result |
|---|---|---|
| Deposit | In game: Crates → «Пополнить NYCARGO» → site wallet card → deposit 60 → check «Баланс в игре» shows 60 | |
| Crate | Open one crate → a paint drops, balance −50, paint equips and shows on the bike | |
| NFT | Achievements → «Выпустить NFT» on an unlocked one → confirm in Phantom → asset on Solscan with image | |
| No token | A wallet with 0 NYCARGO linked → Steppe Trail shows "needs 1 NYCARGO" | |
