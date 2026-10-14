/** Levels, rewards, streaks and adaptive difficulty — pure functions. */

const TITLES: [number, string][] = [[13, "Expert"], [10, "Specialist"], [7, "Practitioner"], [4, "Apprentice"], [1, "Novice"]];

/** Level grows with the square root of XP: L = floor(sqrt(xp / 50)) + 1. */
export function levelFromXp(xp: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
  const floor = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, title: TITLES.find(([min]) => level >= min)![1], xpIntoLevel: xp - floor, xpForLevel: next - floor, xpToNext: next };
}

/** Base reward requires a passing score (≥60); partial credit below that. Bonus rewards efficiency above 60. */
export function computeReward(taskReward: number, taskSuccess: number, efficiency: number) {
  const reward = taskSuccess >= 60 ? taskReward : Math.round((taskReward * taskSuccess) / 200);
  const bonus = taskSuccess >= 60 ? Math.round((taskReward * Math.max(0, efficiency - 60)) / 100) : 0;
  return { reward, bonus };
}

export function xpForAttempt(taskSuccess: number, efficiency: number) {
  return Math.round(taskSuccess * 0.6 + efficiency * 0.4);
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Daily streak: +1 for activity on the next calendar day (UTC), reset after a missed day. */
export function nextStreak(prev: { currentStreak: number; longestStreak: number; lastActiveDay: string | null }, now = new Date()) {
  const today = dayKey(now);
  if (prev.lastActiveDay === today) return { ...prev };
  const yesterday = dayKey(new Date(now.getTime() - 864e5));
  const current = prev.lastActiveDay === yesterday ? prev.currentStreak + 1 : 1;
  return { currentStreak: current, longestStreak: Math.max(prev.longestStreak, current), lastActiveDay: today };
}

/**
 * Elo-style adaptive rating (an IRT-lite stand-in): a learner "beats" a task in proportion to
 * their score. Learner rating moves fast (K=32); task difficulty calibrates slowly (K=4).
 */
export function updateRatings(userRating: number, taskRating: number, taskSuccess: number) {
  const expected = 1 / (1 + 10 ** ((taskRating - userRating) / 400));
  const actual = taskSuccess / 100;
  return { user: userRating + 32 * (actual - expected), task: taskRating - 4 * (actual - expected), expected };
}
