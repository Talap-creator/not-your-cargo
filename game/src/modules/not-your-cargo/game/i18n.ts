export type Lang = "ru" | "en";

const dict = {
  subtitle: { ru: "Груз не ваш · получатель ещё жив?", en: "Recipient still alive?" },
  mission: { ru: "Миссия 1: Первая доставка", en: "Mission 1: First Delivery" },
  campaign: { ru: "Кампания", en: "Campaign" },
  continueCampaign: { ru: "Продолжить кампанию", en: "Continue campaign" },
  story: { ru: "История", en: "Story" },
  training: { ru: "Полигон (обучение)", en: "Training ground" },
  next: { ru: "Дальше", en: "Next" },
  skip: { ru: "Пропустить", en: "Skip" },
  toTraining: { ru: "На полигон", en: "To the training ground" },
  campaignMap: { ru: "Маршрут курьера", en: "Courier route" },
  soon: { ru: "скоро", en: "coming soon" },
  lockedMission: { ru: "откроется после предыдущей миссии", en: "unlocks after the previous mission" },
  play: { ru: "Играть", en: "Play" },
  trainDone: { ru: "Полигон пройден", en: "Training complete" },
  trainDoneText: { ru: "Руки помнят. Теперь — настоящий заказ. Склад на западе, посылка ждёт.", en: "Your hands remember. Now — a real job. The depot in the west, the parcel is waiting." },
  toCampaign: { ru: "К кампании", en: "To the campaign" },
  trainTitle: { ru: "Полигон", en: "Training" },
  duel: { ru: "Дуэль 1×1 с другом", en: "1v1 duel with a friend" },
  join: { ru: "Войти в комнату по коду", en: "Join a room by code" },
  noMp: { ru: "Сетевой режим недоступен на этом тайтле", en: "Online play is off on this title" },
  sound: { ru: "Звук", en: "Sound" },
  on: { ru: "вкл", en: "on" },
  off: { ru: "выкл", en: "off" },
  shake: { ru: "Тряска", en: "Shake" },
  controlsHelp: {
    ru: "WASD — ехать · мышь — прицел · ЛКМ — огонь · Space — рывок · E (держать) — взять/доставить · Q — бросить · R — перезарядка · Esc — меню",
    en: "WASD — drive · mouse — aim · LMB — fire · Space — dash · E (hold) — take/deliver · Q — drop · R — reload · Esc — menu",
  },
  briefTitle: { ru: "Первая доставка", en: "First Delivery" },
  brief: {
    ru: "На заброшенном складе тебя ждёт запечатанная посылка. Забери её и довези до станции связи на востоке. Говорят, по дороге шастают рейдеры. Посылка тяжёлая — с ней байк медленнее. Что внутри, не твоё дело.",
    en: "A sealed parcel waits at the abandoned depot. Pick it up and drive it to the relay station in the east. Raiders roam the road. The parcel is heavy and slows the bike. What's inside is none of your business.",
  },
  weapon: { ru: "Оружие", en: "Weapon" },
  mg: { ru: "Пулемёт", en: "Machine gun" },
  shotgun: { ru: "Дробовой залп", en: "Scatter shot" },
  laser: { ru: "Лазер", en: "Laser" },
  rocket: { ru: "Ракеты", en: "Rockets" },
  convoyLost: { ru: "Грузовик уничтожен", en: "The truck is destroyed" },
  convoyLostText: { ru: "Конвой сгорел вместе с ядром. Держись ближе и прикрывай грузовик.", en: "The convoy burned with the core. Stay close and cover the truck." },
  unlocked: { ru: "Открыто", en: "Unlocked" },
  finale: { ru: "Финал", en: "The end" },
  locked: { ru: "откроется после миссии 1", en: "unlocks after mission 1" },
  start: { ru: "В путь", en: "Ride" },
  back: { ru: "Назад", en: "Back" },
  paused: { ru: "Пауза", en: "Paused" },
  cont: { ru: "Продолжить", en: "Continue" },
  restart: { ru: "Начать заново", en: "Restart" },
  toMenu: { ru: "В меню", en: "Menu" },
  won: { ru: "Груз доставлен", en: "Cargo delivered" },
  wonText: {
    ru: "Станция приняла ядро — да, это было энергоядро. Теперь за ним охотятся все. Дробовой залп открыт.",
    en: "The station took the core — yes, it was a power core. Now everyone hunts it. Scatter shot unlocked.",
  },
  lost: { ru: "Байк уничтожен", en: "Bike destroyed" },
  lostText: { ru: "Посылка осталась в пыли. Попробуй ещё раз.", en: "The parcel stays in the dust. Try again." },
  retry: { ru: "Повторить", en: "Retry" },
  time: { ru: "Время", en: "Time" },
  kills: { ru: "Сбито", en: "Kills" },
  tutMove: { ru: "Двигайся: WASD или стрелки", en: "Move: WASD or arrows" },
  tutFire: { ru: "Целься мышью, стреляй ЛКМ", en: "Aim with the mouse, fire with LMB" },
  tutDash: { ru: "Рывок: Space (перезарядка 4 с)", en: "Dash: Space (4 s cooldown)" },
  quiet: { ru: "Рейдеры откроют огонь через", en: "Raiders open fire in" },
  // pvp
  room: { ru: "Комната", en: "Room" },
  waiting: { ru: "Ждём соперника… Отправь другу код комнаты из лобби.", en: "Waiting for an opponent… Send your friend the room code from the lobby." },
  opponent: { ru: "Соперник", en: "Opponent" },
  ready: { ru: "Готов", en: "Ready" },
  notReady: { ru: "не готов", en: "not ready" },
  youAreHost: { ru: "Ты хост: симуляция боя идёт на твоём устройстве", en: "You are the host: the fight is simulated on your device" },
  rules: {
    ru: "Один груз в центре. Довези его на свою базу 3 раза — победа. 4 минуты, при равенстве — внезапная смерть до 60 с, затем ничья. Убийства очков не дают.",
    en: "One cargo in the middle. Deliver it to your base 3 times to win. 4 minutes; on a tie, sudden death up to 60 s, then a draw. Kills give no points.",
  },
  leave: { ru: "Выйти из комнаты", en: "Leave room" },
  versionError: { ru: "Версия правил у игроков отличается — обновите страницу", en: "Players run different rules versions — reload the page" },
  countdown: { ru: "Старт через", en: "Starting in" },
  suddenDeath: { ru: "ВНЕЗАПНАЯ СМЕРТЬ", en: "SUDDEN DEATH" },
  unstable: { ru: "Соединение нестабильно", en: "Unstable connection" },
  fightGoesOn: { ru: "Бой продолжается — пауза в сетевом матче невозможна", en: "The fight goes on — an online match cannot pause" },
  forfeit: { ru: "Покинуть матч (поражение)", en: "Leave the match (forfeit)" },
  resume: { ru: "Вернуться в бой", en: "Back to the fight" },
  victory: { ru: "Победа", en: "Victory" },
  defeat: { ru: "Поражение", en: "Defeat" },
  draw: { ru: "Ничья", en: "Draw" },
  aborted: { ru: "Матч прерван", en: "Match aborted" },
  deliveries: { ru: "Доставки", en: "Deliveries" },
  you: { ru: "Ты", en: "You" },
  them: { ru: "Соперник", en: "Opponent" },
  rematch: { ru: "Реванш", en: "Rematch" },
  rematchWait: { ru: "Ждём согласия соперника…", en: "Waiting for the opponent…" },
  peerWantsRematch: { ru: "Соперник хочет реванш", en: "The opponent wants a rematch" },
  decline: { ru: "В комнату", en: "Back to room" },
  quality: { ru: "Сеть", en: "Network" },
  focusLost: { ru: "Окно не в фокусе — управление сброшено", en: "Window lost focus — controls released" },
  takeCargo: { ru: "Возьми груз в центре (держи E)", en: "Take the cargo in the middle (hold E)" },
  bringHome: { ru: "Вези груз на свою базу и держи E", en: "Bring the cargo to your base and hold E" },
  stopCarrier: { ru: "Соперник везёт груз — перехвати!", en: "The opponent carries the cargo — intercept!" },
  cargoReturns: { ru: "Груз возвращается в центр", en: "Cargo returns to the middle" },
  respawn: { ru: "Возрождение через", en: "Respawn in" },
  hostTrust: {
    ru: "Частный нерейтинговый режим: результат считает устройство хоста, защиты от изменённого клиента хоста нет.",
    en: "Private unranked mode: the host device computes the result; there is no protection against a modified host.",
  },
  reasons: {
    ru: {
      deliveries: "3 доставки",
      time: "по истечении времени",
      "sudden-death": "доставка во внезапной смерти",
      "sudden-death-timeout": "никто не доставил за 60 с",
      "opponent-left": "соперник вышел — техническая победа",
      "opponent-lost": "соперник потерял связь — техническая победа",
      "opponent-silent": "соперник не отвечает — техническая победа",
      "host-left": "хост вышел",
      "host-lost": "связь с хостом потеряна",
      "host-silent": "хост перестал отвечать",
      "host-quit": "хост покинул матч",
    } as Record<string, string>,
    en: {
      deliveries: "3 deliveries",
      time: "time ran out",
      "sudden-death": "delivery in sudden death",
      "sudden-death-timeout": "no delivery in 60 s",
      "opponent-left": "opponent left — technical win",
      "opponent-lost": "opponent lost connection — technical win",
      "opponent-silent": "opponent stopped responding — technical win",
      "host-left": "the host left",
      "host-lost": "connection to the host lost",
      "host-silent": "the host stopped responding",
      "host-quit": "the host left the match",
    } as Record<string, string>,
  },
};

export const STORY: { ru: string; en: string }[] = [
  { ru: "Степь. Двадцать лет назад погасли солнечные фермы, и вместе с ними — связь. Теперь письма, лекарства и запчасти возят курьеры.", en: "The steppe. Twenty years ago the solar farms went dark, and the networks with them. Now couriers carry letters, medicine and spare parts." },
  { ru: "Ты — курьер на ховербайке. Правило у курьеров одно: не открывай груз. Он не твой.", en: "You are a hover-bike courier. Couriers have one rule: never open the cargo. It is not yours." },
  { ru: "Сегодня заказ со старого склада: запечатанная посылка, двойной тариф, никаких вопросов. Доставить на станцию связи на востоке.", en: "Today's job comes from the old depot: a sealed parcel, double fare, no questions. Deliver it to the relay station in the east." },
  { ru: "Двойной тариф всегда значит одно: кто-то ещё хочет эту посылку. По дороге шастают рейдеры. Получатель ещё жив?", en: "Double fare always means one thing: someone else wants this parcel. Raiders roam the road. Is the recipient still alive?" },
];

export const TRAIN_TEXT: Record<string, { ru: string; en: string }> = {
  move: { ru: "Доедь до метки: WASD или стрелки", en: "Drive to the marker: WASD or arrows" },
  shoot: { ru: "Целься мышью и сбей три мишени (ЛКМ)", en: "Aim with the mouse and knock down three targets (LMB)" },
  dash: { ru: "Рывок: двигайся и нажми Space", en: "Dash: move and press Space" },
  reload: { ru: "Перезарядись: R (пустой магазин перезарядится сам)", en: "Reload: R (an empty magazine reloads itself)" },
  take: { ru: "Подъедь к грузу и держи E", en: "Get to the cargo and hold E" },
  drop: { ru: "С грузом байк медленнее. Брось груз: Q", en: "The cargo slows you down. Drop it: Q" },
  retake: { ru: "Подбери груз снова: держи E", en: "Pick it up again: hold E" },
  deliver: { ru: "Довези груз в зону доставки и держи E", en: "Bring the cargo into the delivery zone and hold E" },
  done: { ru: "Готово!", en: "Done!" },
};

export const MISSION_TEXT: Record<string, { title: { ru: string; en: string }; brief: { ru: string; en: string }; win: { ru: string; en: string } }> = {
  C01: {
    title: { ru: "Первая доставка", en: "First Delivery" },
    brief: { ru: "На заброшенном складе ждёт запечатанная посылка. Забери её и довези до станции связи на востоке. По дороге шастают рейдеры. Посылка тяжёлая — с ней байк медленнее. Контракт на три рейса: туда, обратный груз на склад и снова туда. Что внутри, не твоё дело.", en: "A sealed parcel waits at the abandoned depot. Pick it up and drive it to the relay station in the east. Raiders roam the road. The parcel is heavy and slows the bike. The contract is three runs: there, a return parcel to the depot, and there again. What's inside is none of your business." },
    win: { ru: "Станция приняла посылку — это было энергоядро. Теперь за ним охотятся все. Дробовой залп открыт.", en: "The station took the parcel — it was a power core. Now everyone hunts it. Scatter shot unlocked." },
  },
  C02: {
    title: { ru: "Засада", en: "Ambush" },
    brief: { ru: "Станция отдаёт ядро обратно тебе: довези его до следующего пункта. Дорога раздваивается. Север короче, но там гнёзда турелей. Юг — длинная петля с рейдерами. Выбор действует на один рейс; потом обратный рейс на склад — и снова выбирай дорогу.", en: "The station hands the core back to you: take it to the next post. The road forks. The north is shorter but guarded by turret nests. The south is a long loop with raiders. Your choice holds for one run; then a return run to the depot — pick the road again." },
    win: { ru: "Ядро передано конвою. Лазер открыт.", en: "The core is with the convoy now. Laser unlocked." },
  },
  C03: {
    title: { ru: "Конвой", en: "Convoy" },
    brief: { ru: "Ядро едет грузовиком. Конвой двигается, только когда ты рядом, и ждёт, если отстанешь. Проведи его через три поста до терминала. Грузовик не должен сгореть.", en: "The core rides in a truck. The convoy moves only while you are near and waits if you fall behind. Lead it through three posts to the terminal. The truck must not burn." },
    win: { ru: "Терминал принял ядро на подзарядку. Ракеты открыты.", en: "The terminal took the core to recharge. Rockets unlocked." },
  },
  C04: {
    title: { ru: "Станция", en: "Station" },
    brief: { ru: "Сначала скачай навигационные данные у терминала, потом забери ядро. С ядром в руках — 50 секунд до эвакуации. Потом зона откроется: въезжай в неё с ядром.", en: "First download the nav data at the terminal, then take the core. Once you hold it, 50 seconds until evacuation. Then the zone opens: drive in with the core." },
    win: { ru: "Данные и ядро у тебя. Осталась последняя дорога.", en: "You have the data and the core. One road left." },
  },
  C05: {
    title: { ru: "Перехватчик", en: "Interceptor" },
    brief: { ru: "За ядром вышел перехватчик. Прорвись по коридору, уничтожь его и доставь ядро в конечную точку. Следи за линиями атаки: веер ракет и таран.", en: "An interceptor came for the core. Break through the corridor, destroy it and deliver the core to the final point. Watch the attack lines: a rocket fan and a ram." },
    win: { ru: "Ядро доставлено. Получатель жив. Что внутри — по-прежнему не твоё дело.", en: "The core is delivered. The recipient is alive. What's inside is still none of your business." },
  },
};

export type Key = Exclude<keyof typeof dict, "reasons">;

export function tr(lang: Lang, key: Key): string {
  return dict[key][lang];
}

export function reason(lang: Lang, r: string): string {
  const base = r.split(":")[0] ?? r;
  return dict.reasons[lang][base] ?? r;
}
