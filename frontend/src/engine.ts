/**
 * engine.ts — Core game state machine.
 * O(1) word lookups via Map, zero sorting, zero array scanning.
 */

import type { TopKEntry } from "./topk-format";

export interface Guess {
  word: string;
  rank: number;
  timestamp: number;
  isHint?: boolean;
}

export interface GameState {
  targetWord: string;
  guesses: Guess[];
  latestGuess: Guess | null;
  isGameOver: boolean;
}

// O(1) word → rank lookup
const wordRankMap = new Map<string, number>();
// O(1) rank → word reverse lookup (for hints)
const rankWordMap = new Map<number, string>();

let totalVocabSize = 0;

export function getState(): Readonly<GameState> {
  return state;
}

const state: GameState = {
  targetWord: "",
  guesses: [],
  latestGuess: null,
  isGameOver: false,
};

// ─── Hydration ────────────────────────────────────────────────

export function hydrateTopK(target: string, entries: TopKEntry[]): void {
  wordRankMap.clear();
  rankWordMap.clear();

  const t = target.trim().toLowerCase();
  wordRankMap.set(t, 1);
  rankWordMap.set(1, t);

  for (let i = 0; i < entries.length; i++) {
    const w = (entries[i][0] || "").trim().toLowerCase();
    if (!w) continue;
    const rank = i + 2;
    wordRankMap.set(w, rank);
    rankWordMap.set(rank, w);
  }

  totalVocabSize = wordRankMap.size;
  state.targetWord = t;
}

export function getVocabSize(): number {
  return totalVocabSize;
}

export function hasWord(word: string): boolean {
  return wordRankMap.has(word);
}

export function getRank(word: string): number | undefined {
  return wordRankMap.get(word);
}

export function getWordAtRank(rank: number): string | undefined {
  return rankWordMap.get(rank);
}

// ─── Suffix stemming ──────────────────────────────────────────

const IRREGULAR_PLURALS: Record<string, string> = {
  leaves: "leaf", knives: "knife", lives: "life", thieves: "thief",
  wolves: "wolf", halves: "half", calves: "calf", shelves: "shelf",
  elves: "elf", loaves: "loaf", children: "child", men: "man",
  women: "woman", teeth: "tooth", feet: "foot", geese: "goose",
  mice: "mouse", data: "datum", phenomena: "phenomenon", oxen: "ox",
  cacti: "cactus", fungi: "fungus", nuclei: "nucleus",
};

/**
 * Maps an inflected guess to a known word. An exact match always wins, and a
 * suffix is only stripped when the resulting root is itself a known word, so a
 * target like "lotus" or "celebrated" can always be guessed as spelled.
 */
export function stemWord(word: string, has: (w: string) => boolean = (w) => wordRankMap.has(w)): string {
  const n = word.trim().toLowerCase();
  if (has(n)) return n;

  const irregular = IRREGULAR_PLURALS[n];
  if (irregular && has(irregular)) return irregular;

  for (const candidate of inflectionCandidates(n)) {
    if (has(candidate)) return candidate;
  }
  return n;
}

// "bragg" -> ["bragg", "brag"]: undo consonant doubling before -ed/-ing.
function withUndoubled(root: string): string[] {
  return /([^aeiou])\1$/.test(root) ? [root, root.slice(0, -1)] : [root];
}

function inflectionCandidates(n: string): string[] {
  const out: string[] = [];
  if (n.endsWith("ies") && n.length > 4) out.push(n.slice(0, -3) + "y");
  if (n.endsWith("ves") && n.length > 4) out.push(n.slice(0, -3) + "f", n.slice(0, -3) + "fe");
  if (n.endsWith("es") && n.length > 3) out.push(n.slice(0, -2));
  if (n.endsWith("s") && !n.endsWith("ss") && n.length > 2) out.push(n.slice(0, -1));
  if (n.endsWith("ed") && n.length > 3) out.push(...withUndoubled(n.slice(0, -2)), n.slice(0, -1));
  if (n.endsWith("ing") && n.length > 4) out.push(...withUndoubled(n.slice(0, -3)), n.slice(0, -3) + "e");
  return out;
}

// ─── Game actions ─────────────────────────────────────────────

export type GuessResult =
  | { type: "success"; guess: Guess }
  | { type: "not_found"; input: string }
  | { type: "duplicate"; word: string }
  | { type: "blocked" };

export function submitGuess(input: string): GuessResult {
  if (state.isGameOver || totalVocabSize === 0) return { type: "blocked" };

  const raw = input.trim().toLowerCase();
  if (!raw) return { type: "blocked" };

  const stemmed = stemWord(raw);
  const rank = wordRankMap.get(stemmed);
  if (rank === undefined) return { type: "not_found", input: raw };
  if (state.guesses.some((g) => g.word === stemmed)) return { type: "duplicate", word: stemmed };

  const guess: Guess = { word: stemmed, rank, timestamp: Date.now(), isHint: false };
  state.guesses.push(guess);
  state.latestGuess = guess;
  return { type: "success", guess };
}

export function isWin(): boolean {
  return state.guesses.some((g) => g.rank === 1 || g.word === state.targetWord);
}

export function endGame(): void {
  state.isGameOver = true;
}

export function resetState(target: string): void {
  state.targetWord = target;
  state.guesses = [];
  state.latestGuess = null;
  state.isGameOver = false;
}

export function restoreState(target: string, guesses: Guess[], latestGuess: Guess | null, isGameOver: boolean): void {
  state.targetWord = target;
  state.guesses = guesses;
  state.latestGuess = latestGuess;
  state.isGameOver = isGameOver;
}

// ─── Hint generation ──────────────────────────────────────────

export function generateHint(): Guess | null {
  if (state.isGameOver || totalVocabSize === 0) return null;

  let currentClosestRank = totalVocabSize;
  if (state.guesses.length > 0) {
    for (const g of state.guesses) {
      if (g.rank < currentClosestRank) currentClosestRank = g.rank;
    }
  }
  if (currentClosestRank === 1) return null;

  let targetRank: number;
  if (currentClosestRank <= 25) {
    targetRank = currentClosestRank - (Math.floor(Math.random() * Math.min(4, currentClosestRank - 1)) + 1);
  } else if (currentClosestRank <= 100) {
    targetRank = currentClosestRank - (Math.floor(Math.random() * 12) + 4);
  } else if (currentClosestRank <= 1000) {
    targetRank = Math.floor(currentClosestRank * 0.75);
  } else {
    targetRank = Math.floor(currentClosestRank * 0.5);
  }
  if (targetRank < 1) targetRank = 1;
  if (targetRank >= currentClosestRank) targetRank = currentClosestRank - 1;

  // O(1) rank→word lookup instead of O(n) iteration
  let hintWord = rankWordMap.get(targetRank) ?? "";
  let finalRank = targetRank;

  const guessedWords = new Set(state.guesses.map((g) => g.word));
  let scanOffset = 1;
  while ((!hintWord || guessedWords.has(hintWord)) && scanOffset < 100) {
    let check = targetRank + scanOffset;
    const wUp = rankWordMap.get(check);
    if (wUp && !guessedWords.has(wUp)) {
      hintWord = wUp;
      finalRank = check;
      break;
    }
    check = targetRank - scanOffset;
    if (check >= 1) {
      const wDown = rankWordMap.get(check);
      if (wDown && !guessedWords.has(wDown)) {
        hintWord = wDown;
        finalRank = check;
        break;
      }
    }
    scanOffset++;
  }

  if (!hintWord || finalRank === 1) {
    hintWord = state.targetWord;
    finalRank = 1;
  }

  const hint: Guess = { word: hintWord, rank: finalRank, timestamp: Date.now(), isHint: true };
  state.guesses.push(hint);
  state.latestGuess = hint;
  return hint;
}

// ─── Temperature tier ─────────────────────────────────────────

export type Tier = "hot" | "warm" | "cold";

export function getTier(rank: number): Tier {
  if (rank === 1 || (rank >= 2 && rank <= 75)) return "hot";
  if (rank >= 76 && rank <= 300) return "warm";
  return "cold";
}
