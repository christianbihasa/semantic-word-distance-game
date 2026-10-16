/**
 * engine.ts — Core game state machine.
 * A Game owns one round: the full ranking for its target plus the player's guesses.
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

export type GuessResult =
  | { type: "success"; guess: Guess }
  | { type: "not_found"; input: string }
  | { type: "duplicate"; word: string }
  | { type: "blocked" };

export type HintResult = { type: "hint"; guess: Guess } | { type: "exhausted" } | { type: "blocked" };

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
export function stemWord(word: string, has: (w: string) => boolean): string {
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

// ─── Hints ────────────────────────────────────────────────────

/** Where to aim the next hint, given the best rank so far. Big jumps far away, small steps up close. */
function hintAim(closest: number): number {
  const r = Math.random();
  if (closest > 1000) return 300 + Math.floor(r * 700); // land somewhere warm
  if (closest > 300) return Math.floor(closest * (0.4 + r * 0.2));
  if (closest > 50) return Math.floor(closest * (0.5 + r * 0.2));
  if (closest > 10) return closest - 3 - Math.floor(r * 6);
  return closest - 1 - Math.floor(r * Math.min(2, closest - 2));
}

// ─── Game ─────────────────────────────────────────────────────

export class Game {
  private readonly rankedWords: readonly string[];
  private readonly rankOf = new Map<string, number>();
  private state: GameState;

  /** `rankedWords[0]` is the target; `rankedWords[i]` has rank i + 1. Pass `saved` to resume a round. */
  constructor(rankedWords: readonly string[], saved?: Omit<GameState, "targetWord">) {
    if (rankedWords.length === 0) throw new Error("Cannot start a game with an empty ranking");
    this.rankedWords = rankedWords;
    for (let i = 0; i < rankedWords.length; i++) this.rankOf.set(rankedWords[i], i + 1);
    this.state = {
      targetWord: rankedWords[0],
      guesses: saved ? [...saved.guesses] : [],
      latestGuess: saved?.latestGuess ?? null,
      isGameOver: saved?.isGameOver ?? false,
    };
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  get vocabSize(): number {
    return this.rankedWords.length;
  }

  getRank(word: string): number | undefined {
    return this.rankOf.get(word);
  }

  stem(word: string): string {
    return stemWord(word, (w) => this.rankOf.has(w));
  }

  submitGuess(input: string): GuessResult {
    if (this.state.isGameOver) return { type: "blocked" };

    const raw = input.trim().toLowerCase();
    if (!raw) return { type: "blocked" };

    const word = this.stem(raw);
    const rank = this.rankOf.get(word);
    if (rank === undefined) return { type: "not_found", input: raw };
    if (this.state.guesses.some((g) => g.word === word)) return { type: "duplicate", word };

    return { type: "success", guess: this.record({ word, rank, timestamp: Date.now(), isHint: false }) };
  }

  isWin(): boolean {
    return this.state.guesses.some((g) => g.rank === 1);
  }

  end(): void {
    this.state.isGameOver = true;
  }

  /**
   * Reveals an unguessed word closer than the best guess so far. Hints never reveal the
   * target itself: once the best guess is #2, there is nothing left to give ("exhausted").
   */
  generateHint(): HintResult {
    if (this.state.isGameOver) return { type: "blocked" };

    const closest = this.state.guesses.reduce((best, g) => Math.min(best, g.rank), this.vocabSize + 1);
    if (closest <= 2) return { type: "exhausted" };

    const aim = Math.min(Math.max(hintAim(closest), 2), closest - 1);
    const guessed = new Set(this.state.guesses.map((g) => g.word));

    // Search outward from the aim for an unguessed word in ranks [2, closest - 1].
    for (let offset = 0; offset < closest; offset++) {
      for (const rank of offset === 0 ? [aim] : [aim + offset, aim - offset]) {
        if (rank < 2 || rank >= closest) continue;
        const word = this.rankedWords[rank - 1];
        if (word && !guessed.has(word)) {
          return { type: "hint", guess: this.record({ word, rank, timestamp: Date.now(), isHint: true }) };
        }
      }
    }
    return { type: "exhausted" };
  }

  private record(guess: Guess): Guess {
    this.state.guesses.push(guess);
    this.state.latestGuess = guess;
    return guess;
  }
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
