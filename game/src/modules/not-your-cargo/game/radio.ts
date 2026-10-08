// Dispatcher lines (dark humour, short). Key "C01.start" = mission-specific, "*.lowhp" = any mission.
type T = { ru: string; en: string };

export const RADIO: Record<string, T> = {
  "*.pickup": { ru: "Груз у тебя. Получатель всё ещё надеется.", en: "Cargo's yours. The recipient is still hoping." },
  "*.lowhp": { ru: "Курьер, ты дымишься. Это не входит в тариф.", en: "Courier, you're smoking. That's not in the fare." },
  "*.locked": { ru: "Станция не откроет ворота, пока у порога стреляют. Зачисти.", en: "The station won't open while there's shooting at the door. Clear it." },

  "C01.start": { ru: "Посылка на складе. Не открывать, не трясти, не задавать вопросов.", en: "Parcel's at the depot. Don't open it, don't shake it, don't ask." },
  "C01.pickup": { ru: "Взял? Отлично. Теперь ты — самая интересная цель в степи.", en: "Got it? Great. Now you're the most interesting target in the steppe." },
  "C01.behind": { ru: "Сзади гости! Склад был не таким уж заброшенным.", en: "Company behind you! The depot wasn't that abandoned." },
  "C01.leg2": { ru: "Доставлено. А вот и обратка: получатель шлёт посылку назад. Не спрашивай, что внутри.", en: "Delivered. And here's the return: the recipient sends a parcel back. Don't ask what's in it." },
  "C01.leg3": { ru: "Склад принял. Станция снова ждёт. Рейдеры, кажется, тоже — и с дронами.", en: "Depot signed. The station wants another one. So do the raiders — with drones now." },
  "C01.wave2": { ru: "Станция тебя видит. И рейдеров. Много рейдеров.", en: "The station sees you. And the raiders. Lots of raiders." },

  "C02.start": { ru: "Две дороги. Север короче, но там турели. Юг длиннее, и там тоже кто-то есть.", en: "Two roads. North is shorter but has turrets. South is longer, and someone's there too." },
  "C02.leg2": { ru: "Сдано. Обратный рейс на склад — дорогу выбираешь заново.", en: "Signed off. Return run to the depot — pick your road again." },
  "C02.north": { ru: "Север. Смело. Турель рисует линию перед очередью — не стой на ней.", en: "North. Bold. A turret draws a line before it fires — don't stand on it." },
  "C02.storm": { ru: "Буря на юге. Ты их не видишь, они тебя тоже. Почти честно.", en: "Sandstorm in the south. You can't see them, they can't see you. Almost fair." },

  "C03.start": { ru: "Грузовик едет, только если ты рядом. Он трусливее тебя.", en: "The truck only moves with you nearby. It's more of a coward than you." },
  "C03.truckhurt": { ru: "Грузовик горит. Напоминаю: ядро внутри.", en: "The truck is burning. Reminder: the core is inside." },
  "C03.stall": { ru: "Мотор заглох. Водитель чинит, ты держишь оборону. Пятнадцать секунд.", en: "Engine's dead. The driver fixes, you defend. Fifteen seconds." },
  "C03.restart": { ru: "Завелись! Не спрашивай как.", en: "We're running! Don't ask how." },

  "C04.start": { ru: "Сначала данные с терминала, потом ядро. В таком порядке. Не импровизируй.", en: "Data from the terminal first, then the core. In that order. Don't improvise." },
  "C04.blackout": { ru: "Свет отключили. Кто-то знает, что ты здесь.", en: "Lights are out. Someone knows you're here." },
  "C04.pickup": { ru: "Ядро у тебя. Эвакуация через тридцать секунд. Постарайся дожить.", en: "You have the core. Evac in thirty seconds. Try to live that long." },
  "C04.evac": { ru: "Эвакуация открыта! Заезжай с ядром — без ядра не считается.", en: "Evac is open! Drive in with the core — without it, it doesn't count." },

  "C05.start": { ru: "Последняя дорога. За тобой вышел перехватчик. Он не любит курьеров.", en: "The last road. An interceptor is after you. It hates couriers." },
  "C05.boss": { ru: "Вот он. Линия — значит атака. Уходи с линии.", en: "There it is. A line means an attack. Get off the line." },
  "C05.enraged": { ru: "Он в ярости и зовёт дронов. Значит, ты всё делаешь правильно.", en: "It's furious and calling drones. So you're doing it right." },
  "C05.bossdown": { ru: "Перехватчику всё. Довези ядро. Получатель, кажется, жив.", en: "The interceptor is done. Deliver the core. The recipient seems alive." },
};

export function radioText(key: string, lang: "ru" | "en"): string | null {
  const own = RADIO[key];
  if (own) return own[lang];
  const generic = RADIO[`*.${key.split(".")[1] ?? ""}`];
  return generic ? generic[lang] : null;
}
