// Achievements: derived from the save, never stored as "unlocked" flags of their own — the list is a
// pure function of progress, so a broken flag can't unlock anything. Local progress is untrusted:
// anything that pays out (NFT, leaderboard) must be confirmed server-side, not from this list.
import { DIFFICULTIES, type Difficulty } from "../sim/mission";
import { MISSION_ORDER, type SaveData } from "./save";

type Text = { ru: string; en: string };
export interface Achievement {
  id: string;
  name: Text;
  goal: Text;
  /** progress 0..1 */
  progress(s: SaveData): number;
}

const DIFF_NAME: Record<Difficulty, Text> = {
  easy: { ru: "Лёгкая", en: "Easy" },
  normal: { ru: "Норма", en: "Normal" },
  hard: { ru: "Хард", en: "Hard" },
};
const won = (s: SaveData, m: string, d: Difficulty) => (s.cleared[m] ?? []).includes(d);
const ratio = (n: number, of: number) => Math.min(1, n / of);

const perMission: Achievement[] = MISSION_ORDER.flatMap((m) =>
  DIFFICULTIES.map((d) => ({
    id: `${m}.${d}`,
    name: { ru: `${m} · ${DIFF_NAME[d].ru}`, en: `${m} · ${DIFF_NAME[d].en}` },
    goal: { ru: `Пройди ${m} на сложности «${DIFF_NAME[d].ru}»`, en: `Beat ${m} on ${DIFF_NAME[d].en}` },
    progress: (s: SaveData) => (won(s, m, d) ? 1 : 0),
  })),
);

const campaign: Achievement[] = DIFFICULTIES.map((d) => ({
  id: `campaign.${d}`,
  name: { ru: `Кампания · ${DIFF_NAME[d].ru}`, en: `Campaign · ${DIFF_NAME[d].en}` },
  goal: { ru: `Все 5 миссий на «${DIFF_NAME[d].ru}»`, en: `All 5 missions on ${DIFF_NAME[d].en}` },
  progress: (s: SaveData) => ratio(MISSION_ORDER.filter((m) => won(s, m, d)).length, MISSION_ORDER.length),
}));

const extra: Achievement[] = [
  {
    id: "stars.all",
    name: { ru: "Пятнадцать звёзд", en: "Fifteen stars" },
    goal: { ru: "Три звезды в каждой миссии", en: "Three stars in every mission" },
    progress: (s) => ratio(MISSION_ORDER.reduce((n, m) => n + (s.stars[m] ?? 0), 0), 15),
  },
  ...[1, 10, 50, 100].map((n) => ({
    id: `pvp.win${n}`,
    name: { ru: n === 1 ? "Первая дуэль" : `Победы в дуэлях: ${n}`, en: n === 1 ? "First duel won" : `${n} duel wins` },
    goal: { ru: `Выиграй ${n} онлайн-дуэл${n === 1 ? "ь" : "ей"}`, en: `Win ${n} online duel${n === 1 ? "" : "s"}` },
    progress: (s: SaveData) => ratio(s.pvpWins, n),
  })),
  {
    id: "pvp.play25",
    name: { ru: "Завсегдатай пустоши", en: "Wasteland regular" },
    goal: { ru: "Сыграй 25 онлайн-дуэлей", en: "Play 25 online duels" },
    progress: (s) => ratio(s.pvpMatches, 25),
  },
];

export const ACHIEVEMENTS: Achievement[] = [...campaign, ...extra, ...perMission];

export function unlocked(s: SaveData): string[] {
  return ACHIEVEMENTS.filter((a) => a.progress(s) >= 1).map((a) => a.id);
}

export { DIFF_NAME };
