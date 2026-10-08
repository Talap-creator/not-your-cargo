# Прототип P0 — статус

Дата: 6 октября 2026 · rulesVersion `nyc-p0-1` · код: [game/](../game/)

P0 не является полной кампанией. Сделаны одна миссия (C01), два оружия и сетевая дуэль 1×1. Всё, что ниже не отмечено как проверенное, считается непроверенным.

## Основа и iDos

- Каркас взят из официального iDos Code MCP (`npx -y @idosgames/mcp` 0.1.28): основа проекта `get_host_scaffold`, модуль `multiplayer`. Версии пакетов: core 0.21.2, module-sdk 0.10.0, react 0.4.4, app-shell 0.12.0, wallet 0.6.2.
- Игра оформлена как модуль `src/modules/not-your-cargo` (сцена Phaser 3.90 + DOM-интерфейс). PvP регистрируется через `ctx.multiplayer.registerGame`. Комнаты, приглашения и WebRTC (`RealtimeSession`) берутся из модуля `multiplayer`, своих серверов нет.
- Тайтл: **QA0X2DY9** — с цифрой 0, в задании ошибочно была буква O. Через Title MCP (`site.idosgames.com/api/v2/mcp`, OAuth): `Published: true`, сборок 0.
- Конфигурация: Multiplayer включён в `QA0X2DY9-DEV` и (по решению владельца) в `QA0X2DY9` — Host, 2 игрока, MemberTimeout 10 с.
- Платный AI-кодер iDos и генерация ассетов не использовались, токен не выпускался. Тестовая сборка загружена, игрокам не выведена (см. ниже).

## Что реализовано

| Требование ТЗ | Реализация |
|---|---|
| G01 движение | WASD/стрелки; диагональ нормализована; 240 ед/с, с грузом ×0,85; рывок 0,18 с / 600 ед/с, перезарядка 4 с, сквозь стены не проходит; камера в фиксированном логическом окне 960×540 |
| G02 оружие | Пулемёт (8 урона, 8/с, магазин 24, перезарядка 1,4 с) и дробовой залп (5×7, 1/0,8 с, магазин 4, перезарядка 1,6 с); перезарядка R; проверка пересечения снаряда со стеной на каждом тике |
| G03 враги | Рейдеры (короткие очереди, предупреждение о появлении, не ближе 180 к игроку). Турели, дроны и босс — этап P1 |
| G04 HUD и состояния | HP, оружие и магазин, рывок, груз, цель и стрелка к ней; подсказки обучения; меню → бриф → бой → пауза → итог; Esc и потеря фокуса ставят на паузу |
| Вход в кампанию | Меню → «Кампания» → история (4 слайда, пропуск) → полигон из 8 шагов → «Маршрут курьера» (C01 открыта, C02–C05 показаны как «скоро»); прогресс истории и полигона сохраняется |
| C01 | Взять посылку (держать E 0,5 с), довезти до станции (держать E 1,5 с), две волны, первые 20 с без вражеского огня, победа, смерть, повтор, сохранение и открытие дробовика |
| P01 | Приватная комната по приглашению (`ID:код`) через лобби iDos; выбор оружия, «Готов»; один игрок видит «Ждём соперника» |
| P02–P04 | Симметричная арена 1600×1000; один груз; спорный захват по приоритету, который чередуется между матчами; бросок Q; падение груза при смерти; возрождение через 3 с со щитом 1 с; ремонт +25 раз в 20 с; 3 доставки; таймер 4:00; внезапная смерть до 60 с; ничья; порядок тика по P04; результат один и не меняется |
| N02–N05 | Расчёт на хосте; гость шлёт только ввод (seq, matchId, действия-«фронты» как счётчики); снимки 15/с, ввод 30/с; предсказание своего движения и интерполяция соперника (100 мс); тишина больше 250 мс обнуляет ввод; проверка rulesVersion; индикатор RTT и потерь; «Соединение нестабильно»; уход гостя — техническая победа хоста; уход или тишина хоста больше 10 с — «Матч прерван»; Esc не ставит сетевой матч на паузу |
| Реванш | Только при согласии обоих; стороны меняются; пакеты старого матча игнорируются |
| Настройки | RU/EN, звук (временные синтезированные тоны), тряска |

## Проверки (выполнены 6 октября 2026, Windows 10, Chrome)

| Проверка | Результат |
|---|---|
| `npm run typecheck` | 0 ошибок |
| `npm test` (vitest): правила боя, C01, полигон, матч, сеть по паре в памяти | 32/32 |
| `node e2e/campaign.mjs` — история → все 8 шагов полигона реальными клавишами и мышью → карта → бриф C01 | 17/17 |
| `npm run build` | успешно; начальная загрузка 2,34 МБ (0,64 МБ gzip) |
| `node e2e/mission.mjs` — C01 через настоящий UI, реальные клавиши и мышь | 18/18 |
| `node e2e/duel.mjs` — два изолированных профиля Chrome (два гостевых аккаунта) на DEV-тайтле, комната iDos, WebRTC | 20/20 |

Сценарий e2e дуэли: приватная комната → вход по приглашению → лобби → «Готов» только у одного не запускает матч → оба готовы → отсчёт → ввод гостя двигает байк у хоста → спорный захват (один носитель на обоих экранах) → попадания подтверждает хост → 3 доставки → одинаковый результат у обоих → реванш только по двум согласиям, новые matchId и стороны → гость закрыл вкладку: техническая победа хоста → во второй паре хост закрыл вкладку: у гостя «Матч прерван» через 0,9 с.

**Важно об ограничениях этих проверок:**
- Оба браузера запускались на одном компьютере: RTT 0–3 мс, потерь 0%. Разные устройства и сети, мобильный интернет, NAT/TURN, RTT 100/200 мс и потери 2/5% в реальной сети не проверены (Q05, Q10). Потери 5% проверены только в модульном тесте.
- Байками в e2e управляет тестовый скрипт по контрольным точкам. Живые матчи двух людей (три записи по разделу 9) не проводились.
- В e2e миссии два действия выполнены напрямую через отладочный DEV-доступ: перенос байка к посылке и на станцию, а также HP=1 для проверки поражения. Полный проезд C01 человеком не записан.
- Тест на шести игроках (раздел 10) не проводился.
- Сенсорное управление (два стика и кнопки) написано, но на телефоне не проверялось. FPS на телефоне не измерялся.
- Восстановление соединения (reconnect) не реализовано: при подтверждённом выходе матч честно завершается. Смены хоста нет.
- Сохранение только локальное (localStorage); облачной синхронизации нет.

## Найдено и исправлено во время проверки

- Пулемёт стрелял 7,5/с вместо 8: терялся остаток перезарядки между тиками.
- Отсчёт длился на один тик дольше из-за погрешности float.
- Окно «Мультиплеер» из меню хоста оставалось поверх игры после старта комнаты. Теперь комнаты открываются во вкладке лобби, и при старте экран переключается на игру.
- После реванша подписи «твоя база» и камера оставались на старой стороне.
- Сборка основы не собиралась: wagmi 3.7.2 импортирует `viem/tempo/zones`, а этот экспорт удалён в viem ≥ 2.56. viem закреплён на 2.55.19 через `overrides`; добавлены опциональные Solana-пакеты кошелька.

## Загрузка в тайтл — тестовая версия загружена (6 октября 2026)

- По решению владельца в рабочем тайтле `QA0X2DY9` включён Multiplayer (Host, 2 игрока).
- Загружена версия 1 `bld932dd1ed781d4054a7bd7f77ce402972` («P0: C01 + 1v1 duel (test)»), статус **Staged**, `deploy: false` — **игрокам не показана**.
- Тест (DEV-конфиг): https://qa0x2dy9-dev.idos.games/v/bld932dd1ed781d4054a7bd7f77ce402972/index.html
- Тест (prod-конфиг): https://qa0x2dy9.idos.games/v/bld932dd1ed781d4054a7bd7f77ce402972/index.html
- `node e2e/smoke-hosted.mjs` с prod-ссылкой — 8/8: загрузка, гостевой вход, Multiplayer доступен, старт C01, приватная комната, оба игрока в лобби дуэли, отсчёт и идущий матч у гостя, без ошибок страницы. Оба браузера на одной машине.
- Версия 2 `bld24808bcf9e8a430aa7be31caf3bf6f80` («P0.1: story → training → campaign»), Staged, игрокам не показана. Тест (prod-конфиг): https://qa0x2dy9.idos.games/v/bld24808bcf9e8a430aa7be31caf3bf6f80/index.html — smoke 9/9.
- Вывести игрокам (версию 2): `finish_build_upload {title_id: "QA0X2DY9", build_id: "bld24808bcf9e8a430aa7be31caf3bf6f80", deploy: true}` — только по отдельному решению владельца.

## Нужные ассеты (сейчас в игре только формы, нарисованные кодом)

- Спрайты сверху: байк ×2 цвета (корпус и отдельная турель), рейдер, контейнер груза, станция, база и зона доставки, ремкомплект.
- Окружение: тайлы степи и дороги, 2–3 вида стен и укрытий, декор (кусты, следы).
- Эффекты: пуля, дробь, вспышка выстрела, попадание, взрыв или гибель, пыль от рывка.
- История: 4 иллюстрации к слайдам (степь с погасшими солнечными фермами, курьер на байке, склад и запечатанная посылка, рейдеры на дороге); сейчас на слайдах только текст.
- Полигон: мишени, метка точки, ограждение.
- Интерфейс: иконки пулемёта, дробовика, рывка, груза, HP.
- Звук: пулемёт, дробовик, попадание, рывок, взятие и доставка груза, гибель, отсчёт, победа и поражение, фоновая музыка.
- Для меню уже используется уменьшенная копия баннера `assets/branding/not-your-cargo-banner-v1.png` (108 КБ).

- Версия 3 `bldc20ab6977567497c9a974583bf49ce75` («P0.2: sprites + synthesized sound»), Staged, не выведена. Тест: https://qa0x2dy9.idos.games/v/bldc20ab6977567497c9a974583bf49ce75/index.html — smoke 9/9. Спрайты (SVG) и звук (ffmpeg-синтез) сделаны через swarm на Azure.

## P1 (этап E4) — 7 октября 2026

- Миссии C02 «Засада» (развилка север/юг, выбор фиксируется на попытку), C03 «Конвой» (грузовик 250 HP едет только при курьере в радиусе 300, три засады), C04 «Станция» (данные → ядро → 30 с один раз, повторный захват не перезапускает → открытая эвакуация, победа только с ядром в зоне), C05 «Перехватчик» (погоня → босс: веер ракет и таран с линиями атаки, после 50% HP быстрее → доставка).
- Враги: рейдер, турель (линия будущей очереди, прицел фиксируется), дрон (линия рывка-тарана, одно попадание за рывок), босс.
- Оружие: лазер (18, луч до 600, первый объект останавливает) и ракеты (28, взрыв 55, каждая цель один раз). Открытие: C01 → дробовик, C02 → лазер, C03 → ракеты. В PvP открыты все четыре; rulesVersion `nyc-p1-1`.
- Сохранение: версия, пройденные миссии; оружие выводится только из пройденных миссий; повторная победа идемпотентна.
- Проверки: vitest 41/41; e2e: кампания 17/17, C01 18/18, C02–C05 29/29, дуэль 20/20.
- Тестовая версия 4 `bldb99a88d9acd04aea8413cd24f64ad2f5` («P1: campaign C01-C05, laser, rockets»), Staged, игрокам не выведена: https://qa0x2dy9.idos.games/v/bldb99a88d9acd04aea8413cd24f64ad2f5/index.html — smoke 9/9.
- Не проверено: баланс и проходимость миссий живым игроком от начала до конца (в e2e часть пути пропускается отладочным доступом), телефон, разные сети.

## P1.1 — баланс и «Степной след» (7 октября 2026)

- Автопилот (src/modules/not-your-cargo/sim/autopilot.ts, только ввод, A*): `BALANCE=1 npx vitest run balance`. Итог на 6 сидах: C01 6/6 (~29 с), C02 mg 6/6, shotgun 2/6 (бот всегда едет севером под турели), C03 mg 3/6, shotgun/laser 6/6, C04 6/6 (rocket 5/6), C05 mg 6/6, laser 6/6, rocket 0/6. Время прохождения ботом 23–46 с — до ориентира ТЗ 3–5 мин далеко: нужны длиннее карты.
- Правки: аптечки в кампании (+25, раз в 20 с), босс 480 HP и таран 20, грузовик 95 ед/с, больше врагов в волнах C01/C02; станция в C01/C02 не принимает груз, пока рядом враги.
- NYCARGO: mint `5RWFPAucUS9h4bx1ApTftAWc87jVMxzPTkZwVHSeidos` проверен в mainnet (SPL, decimals 6, supply 1 млрд, mint/freeze authority = null). Порог: 1 токен. Кошелёк — только привязанный подписью (`LinkedWallets.solana`, `IsSignatureVerified`). Состояния: не привязан / проверка / открыт / мало / ошибка (ошибка RPC ≠ ноль); повторная проверка при фокусе окна. Только окраска и след, на бой не влияет; в PvP соперник видит след через loadout.
- Блокер: публичные RPC Solana отвечают 403 на запросы из браузера (Origin). Проверка перенесена в CloudCode-обработчик `nycTrailBalance` (game/cloudcode/nyc-trail.js). Нужно от владельца: в панели iDos → Интеграции включить Outbound HTTP и добавить хост `api.mainnet-beta.solana.com`; дать право `cloudcode:write` (или вставить скрипт в «Cloud functions»). До этого игра честно показывает «не удалось проверить».
- В Blockchain.IframeConnectHosts рабочего тайтла добавлен `api.mainnet-beta.solana.com` (для браузерного пути; сейчас не помогает из-за 403).
- Проверки: vitest 46/46 (+ balance отдельно); e2e: кампания 17/17, C01 19/19, C02–C05 29/29, дуэль 20/20 (один прогон из двух упал на скриптовом проезде к базе — нестабильность тестового драйвера).
- Тестовая версия 5 `bldf3287fceb773406db5f394217eaef6a2`, Staged: https://qa0x2dy9.idos.games/v/bldf3287fceb773406db5f394217eaef6a2/index.html — smoke 9/9. Выкладка игрокам (deploy) заблокирована правами Claude Code — делает владелец.

## P1.2 — мобильная версия и «живые» миссии (7 октября 2026)

- Мобильная: двойные стики и кнопки ⚡/E/Q/R только во время боя, кнопка ⏸ вместо Esc, полноэкранная подсказка «поверни телефон» в портрете, перерасчёт canvas при повороте, компактный HUD для низких экранов. e2e на эмуляции телефона 844×390 с touch — 14/14. Реальный телефон и FPS не проверены.
- Миссии: диспетчер по рации (короткие реплики, RU/EN), C01 — засада сзади после захвата посылки; C02 юг — песчаная буря (видимость 300 у всех); C03 — грузовик глохнет на втором посту на 15 с; C04 — после данных гаснет свет; C05 — на 50% HP босс зовёт дронов. Звёзды: доставка / в норму времени / HP ≥ 50 на финише; лучший результат на карте маршрута.
- Баланс (автопилот, 6 сидов): C03 с пулемётом 2/6 (с дробовиком и лазером 6/6), грузовик 320 HP, вторая аптечка у второго поста; ракеты против босса по-прежнему 0/6.
- Проверки: vitest 48/48; e2e кампания 17/17, C01 19/19, C02–C05 29/29, mobile 14/14, дуэль 20/20.
- Тестовая версия 6 `bld927a44da9fe84c35bde904a351250801`, Staged: https://qa0x2dy9.idos.games/v/bld927a44da9fe84c35bde904a351250801/index.html — smoke 9/9.

## Выкладка и CloudCode (7 октября 2026)

- Версия 6 выведена игрокам владельцем: Live на https://qa0x2dy9.idos.games/.
- CloudCode: опубликован обработчик `nycTrailBalance` (ревизия 4, whitelist из одного обработчика). На prod для гостя возвращает `disconnected`. Находка: `server.ReadUserData` возвращает секции напрямую, без обёртки `{Success, Data}` из документации; обработчик принимает обе формы. Новая ревизия подхватывается сервером ~через 45 с.
- Исходящий HTTP: включён только в DEV (`api.mainnet-beta.solana.com`), в PROD выключен — нужно повторить в PROD. Путь «привязанный кошелёк → RPC → баланс» ещё не проверен на реальном кошельке.

## P1.3 — вход кошельком и проверка баланса (7 октября 2026)

- iDos Free: CloudCode не выполняет исходящие HTTP (только с тарифа «Старт»). Публичные RPC Solana без ключа браузеру отказывают (403/лимиты/платный план — проверены mainnet-beta, publicnode, drpc, onfinality, leorpc).
- Решение владельца: бесплатный ключ RPC-провайдера с ограничением домена. Игра читает URL из публичных Title Data (`solanaRpcUrl`), сначала спрашивает CloudCode, при его сетевой ошибке — браузер с этим URL. Пока URL не задан — честное «не удалось проверить».
- Вход кошельком Solana включён (WalletLogin.Enabled в PROD и DEV, сборка помечена web3/solana). `WALLET_LOGIN_DISABLED` больше не появляется; без кошелька в браузере — понятное сообщение. Реальный вход Phantom не проверялся.
- Проверки: vitest 49/49, e2e кампания 17/17, mobile 14/14. Тестовая версия 7 `bld7a2dd0a2cb5e4c9c92f6fee91f353aad`, Staged, smoke 9/9.

- Ключ Helius подключён через Title Data `solanaRpcUrl` (PROD+DEV), хост в IframeConnectHosts. Из origin игры getTokenAccountsByOwner отвечает 200 с реальным балансом. Ограничение по доменам в Helius не включено (чужой origin тоже работает) — включить владельцу. Тестовая версия 8 `bld3f96244de7a64017bd3c556d3a9afb1d` (чтение URL из ответа по ключу), smoke 9/9.

- `INVALID_WALLET_ADDRESS`: кнопка входа была EVM (`LazyWalletLogin`) и отдавала 0x-адрес MetaMask. Теперь для сети solana используется `LazySolanaWalletLogin`. Внутри idosgames.com берётся кошелёк сайта; при прямом заходе нужен WalletConnect/Reown Project ID. Тестовая версия 9 `bld27825662bcb3432caff9130892e744f1`, smoke 9/9. Покупка владельца подтверждена on-chain: B36f3ueETWceWeDd4o2unLPDg1S8aoLqtS3Mmkj7jrME — 3743.62 NYCARGO.

## v12 (2026-10-07) — P1.7, staged `bld844ce3a32004417ba7b6b973a58e45c7`
- Difficulty Easy/Normal/Hard per mission (enemy dmg ×0.55/1/1.25, enemy HP ×0.75/1/1.2 — Hard retuned in v14 after the probe).
- 24 achievements (per mission × difficulty, campaign per difficulty, 15 stars, duels 1/10/50/100 wins, 25 played). LOCAL ONLY — untrusted; not for NFT/leaderboard until server-confirmed (PvP is host-authoritative P2P, the server cannot verify a winner).
- Sound replaced with CC0 Kenney/OpenGameArt samples (sfx/CREDITS.md; licenses verified on OGA pages); new laser/rocket/explosion sounds.
- iDos UI theme (ui.config.ts) + index.html background recolored to the game palette — rooms screen matches.
- Build must use `vite build --base=./` for the /v/<build>/ test URL. Unit 53/53, hosted smoke 9/9.

## v13 (2026-10-07) — P1.8, staged `bld6734e88940024c4ba99e822c154e86e9`
- Crates & paints: Title config (PROD) — catalog `Skin` (9 paints), lootbox `cargo_crate` priced 50 NYCARGO (crypto currency `Main`), odds 60/28/10/2 %, pity: every 10th crate +1 Epic/Legendary. Source of truth for the payload: `game/title-config/build.py`. DEV cannot hold crypto currencies (server drops `Main`), so crates are testable only with the PROD config.
- Leaderboards (PROD): `campaign_score` (BestScore, all-time; Σ best stars × difficulty weight, max 45), `duel_wins_weekly` (Sum, weekly). Scores are CLIENT-submitted — a cheater can inflate them; no rewards attached for that reason.
- Paint is cosmetic: neutral `bike_paint` sprite tinted; in PvP the side colour stays as a ring; peer paint id validated on the wire.
- Verified: unit 57/57; hosted smoke 9/9; hosted armory 6/6 (price from config, server refuses at 0 balance "insufficient balance (have 0, need 50)", both leaderboards load). Paint render checked locally with forced ownership. A REAL paid open was not tested (needs a NYCARGO deposit).
- OPEN QUESTION: currency `Main` network `Decimals: 0` while the mint has 6 decimals on-chain — verify a small deposit credits the expected amount before advertising crates.

## v15 (2026-10-08) — P2.0, staged `bldda588891e42d42f0a3d7bd46e5fc5679`
- Longer missions: C01 = 3 runs (there → return parcel to the depot → there; waves mirrored, repeat runs half-size, 6 s grace after each hand-over, full repair/reload on each delivery), C02 = 2 runs (road chosen again), C03 truck 75 u/s, 460 HP, stall 20 s + ambush on restart, C04 hold-out 50 s (reinforcements every 12 s), C05 escort wave on the final run. PAR re-set (C01 300 s, C02 270, C03 240, C04 180, C05 210).
- Rockets ×1.6 vs boss/turrets (missions only; PvP bikes unaffected).
- Autopilot (input only, 6 seeds) avg time: C01 75 s, C02 42, C03 62, C04 65, C05 32 (was 31/21/48/45/28). Easy: all missions won by every weapon except a few rocket seeds; Normal: every mission won with its best weapon (C01 mg 6/6, C03 laser 6/6, C05 rocket 3/6 — was 0/6); Hard: every mission winnable with the right weapon but punishing.
- Verified: unit 58/58; local e2e mission 20/20, campaign 17/17, missions 29/29, duel 20/20, mobile 14/14; hosted smoke 9/9, armory 6/6.

## v16 (2026-10-08) — P2.1, staged `bldfbba9caad0d743feaf6b576f65c7a40b`
- Achievement NFT souvenirs, minted by the PLAYER from their own Solana wallet (Phantom): Metaplex Core `CreateV1` built by hand on @solana/web3.js (`game/nft.ts`), player = payer/owner/authority, no collection, no game key, the game pays nothing (~0.002 SOL rent + fee for the player). Metadata + 512px badges for all 24 achievements in `public/nft/` → `https://qa0x2dy9.idos.games/nft/<id>.json` (resolves only once a build with them is LIVE).
- Inside the idosgames.com frame without an injected wallet the button opens the game's own page `?mint=<id>` in a new tab (the frame can't sign transactions). That page offers the mint for the asked id WITHOUT checking local progress (storage is partitioned per site) — acceptable only because it's declared a souvenir.
- Honest limits: achievements are client-side; an unverified-collection asset can be minted by anyone.
- Verified: unit 60/60 (incl. byte layout of the instruction); mainnet `simulateTransaction` (sigVerify off, nothing sent) → mpl-core "Create … success", 8207 CU; local e2e with a fake wallet 6/6 (signs request = mpl-core tx, player is fee payer, asset key pre-signed, refusal reported); hosted smoke 9/9, armory 6/6; metadata/PNG served from the test build. A REAL mint was not done (needs the player's SOL).

## v17 (2026-10-08) — P2.2, LIVE `bldf1b408bdd5cc4df7b19a93b0fd06c6f2`
- Cloud save: progress in user custom data, Private key `nyc_save` (Json, 8 KB; registered in PROD and DEV config). Merge = union of missions/difficulties, best stars, max duel record (never summed), local device prefs; cloud copy validated like a local one (weapons recomputed from missions). Pull result is merged into the CURRENT save (no lost progress if a mission ends before the cloud answers).
- NFT mint offered only for achievements the account has (the site-frame → new-tab path now relies on the cloud save, not on the ?mint param).
- Verified: unit 63/63; local e2e mission 20/20, campaign 17/17, missions 29/29, duel 20/20, mobile 14/14, nft (fake wallet) 6/6, cloud round trip vs the real iDos DEV backend 2/2 (wipe local → reload → progress back); hosted (prod config) smoke 9/9, armory 6/6; deployed and re-checked live 9/9 + 6/6. The cloud e2e can't run on hosted builds (no dev hook there).
- v16 deployed earlier the same day (`bldfbba9caad0d743feaf6b576f65c7a40b`); on-chain read 2026-10-08: the owner wallet has made NO NYCARGO deposit to iDos yet (only the 2026-10-07 purchase).

## 2026-10-08 — переподключение (без новой сборки)
- Проверено на настоящем транспорте: `e2e/relink.mjs` посреди матча закрывает RTCPeerConnection гостя (оба остаются в комнате) → транспорт iDos сам восстанавливает канал за 4,2 с, снимки идут, через 11 с матч продолжается у обоих, ввод гостя снова двигает байк — 10/10.
- Дуэль уже ждёт до 10 с после `peerClose` и снимает отметку на `peerOpen`; дополнительно отметка теперь снимается и на первом снимке у гостя (страховка, поведение не меняет). Модульный тест «временный обрыв» — vitest 64/64.
