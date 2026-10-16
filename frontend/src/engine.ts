/**
 * engine.ts — Core game state machine.
 * Every vocabulary word has a rank (1 = target); lookups are O(1) in both directions.
 */

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

// word → rank (1-based)
const wordRankMap = new Map<string, number>();
// rank → word: rankedWords[rank - 1]
let rankedWords: string[] = [];

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

/** Loads a full ranking: `words[0]` is the target, `words[i]` has rank i + 1. */
export function hydrateRanking(words: string[]): void {
  if (words.length === 0) throw new Error("Cannot start a game with an empty ranking");
  wordRankMap.clear();
  rankedWords = words;
  for (let i = 0; i < words.length; i++) wordRankMap.set(words[i], i + 1);
  totalVocabSize = words.length;
  state.targetWord = words[0];
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
  return rankedWords[rank - 1];
}

// ─── Suffix stemming ──────────────────────────────────────────

const IRREGULAR_PLURALS: Record<string, string> = {
  leaves: "leaf",
  knives: "knife",
  lives: "life",
  thieves: "thief",
  wolves: "wolf",
  halves: "half",
  calves: "calf",
  shelves: "shelf",
  elves: "elf",
  loaves: "loaf",
  children: "child",
  men: "man",
  women: "woman",
  teeth: "tooth",
  feet: "foot",
  geese: "goose",
  mice: "mouse",
  data: "datum",
  phenomena: "phenomenon",
  oxen: "ox",
  cacti: "cactus",
  fungi: "fungus",
  nuclei: "nucleus",
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
  return state.guesses.some((g) => g.rank === 1);
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

export type HintResult = { type: "hint"; guess: Guess } | { type: "exhausted" } | { type: "blocked" };

/** Where to aim the next hint, given the best rank so far. Big jumps far away, small steps up close. */
function hintAim(closest: number): number {
  const r = Math.random();
  if (closest > 1000) return 300 + Math.floor(r * 700); // land somewhere warm
  if (closest > 300) return Math.floor(closest * (0.4 + r * 0.2));
  if (closest > 50) return Math.floor(closest * (0.5 + r * 0.2));
  if (closest > 10) return closest - 3 - Math.floor(r * 6);
  return closest - 1 - Math.floor(r * Math.min(2, closest - 2));
}

/**
 * Reveals an unguessed word closer than the best guess so far. Hints never reveal the
 * target itself: once the best guess is #2, there is nothing left to give ("exhausted").
 */
export function generateHint(): HintResult {
  if (state.isGameOver || totalVocabSize === 0) return { type: "blocked" };

  const closest = state.guesses.reduce((best, g) => Math.min(best, g.rank), totalVocabSize + 1);
  if (closest <= 2) return { type: "exhausted" };

  const aim = Math.min(Math.max(hintAim(closest), 2), closest - 1);
  const guessed = new Set(state.guesses.map((g) => g.word));

  // Search outward from the aim for an unguessed word in ranks [2, closest - 1].
  for (let offset = 0; offset < closest; offset++) {
    for (const rank of offset === 0 ? [aim] : [aim + offset, aim - offset]) {
      if (rank < 2 || rank >= closest) continue;
      const word = rankedWords[rank - 1];
      if (word && !guessed.has(word)) {
        const hint: Guess = { word, rank, timestamp: Date.now(), isHint: true };
        state.guesses.push(hint);
        state.latestGuess = hint;
        return { type: "hint", guess: hint };
      }
    }
  }
  return { type: "exhausted" };
}

// ─── Temperature tier ─────────────────────────────────────────

export type Tier = "hot" | "warm" | "cold";

export const HOT_MAX_RANK = 100;
export const WARM_MAX_RANK = 1000;

export function getTier(rank: number): Tier {
  if (rank <= HOT_MAX_RANK) return "hot";
  if (rank <= WARM_MAX_RANK) return "warm";
  return "cold";
}
