/**
 * daily.ts — Daily puzzle: one target per local calendar day, and a spoiler-free share summary.
 */

import { getTier, type Guess } from "./engine";

/** Puzzle #1 is this local date. */
export const DAILY_EPOCH = "2026-10-16";

/** Local calendar date as YYYY-MM-DD (the puzzle rolls over at the player's midnight). */
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function utcDays(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000; // UTC midnight: immune to DST shifts
}

/** 1 on DAILY_EPOCH, 2 the day after, ... (never below 1). */
export function puzzleNumber(dateKey: string): number {
  return Math.max(1, utcDays(dateKey) - utcDays(DAILY_EPOCH) + 1);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Walks the target list with a fixed stride coprime to its length, so consecutive days
 * get unrelated words and no word repeats until every target has been used.
 */
export function dailyTarget(targets: readonly string[], puzzle: number): string {
  const n = targets.length;
  if (n === 0) throw new Error("No targets available");
  let stride = 7919 % n || 1;
  while (gcd(stride, n) !== 1) stride++;
  return targets[((puzzle - 1) * stride + 104_729) % n];
}

const TIER_EMOJI = { hot: "🟩", warm: "🟨", cold: "🟥" } as const;
const MAX_SHARED_SQUARES = 40;

/** Share text with one square per guess (hints marked 💡). Never includes any word. */
export function shareText(puzzle: number, guesses: readonly Guess[], won: boolean, url: string): string {
  const hints = guesses.filter((g) => g.isHint).length;
  const direct = guesses.length - hints;
  const outcome = won
    ? `solved in ${direct} ${direct === 1 ? "guess" : "guesses"}`
    : `gave up after ${direct} ${direct === 1 ? "guess" : "guesses"}`;
  const hintNote = hints > 0 ? `, ${hints} ${hints === 1 ? "hint" : "hints"}` : "";

  const squares = guesses.map((g) => (g.isHint ? "💡" : g.rank === 1 ? "🎯" : TIER_EMOJI[getTier(g.rank)]));
  const trail =
    squares.length > MAX_SHARED_SQUARES
      ? `${squares.slice(0, MAX_SHARED_SQUARES).join("")}… +${squares.length - MAX_SHARED_SQUARES}`
      : squares.join("");

  return `Heat Seek Daily #${puzzle}: ${outcome}${hintNote}\n${trail}\n${url}`;
}
