import { beforeEach, describe, expect, it } from "vitest";
import { Game, HOT_MAX_RANK, WARM_MAX_RANK, getTier, stemWord } from "../src/engine";

// Ranked list: index 0 is the target (rank 1), index i has rank i + 1.
const RANKED = [
  "cheddar",
  "pie",
  "cake",
  "sausage",
  "cheese",
  "lotus",
  "brag",
  "chin",
  "leaf",
  "knife",
  "city",
  "box",
  "hope",
  "bake",
];

let game: Game;

function hydrate(words = RANKED) {
  game = new Game(words);
}

describe("stemWord", () => {
  beforeEach(() => hydrate());

  it.each([
    ["cheese", "cheese"],
    ["cheeses", "cheese"],
    ["pies", "pie"],
    ["cakes", "cake"],
    ["sausages", "sausage"],
    ["lotus", "lotus"],
    ["bragging", "brag"],
    ["bragged", "brag"],
    ["chinned", "chin"],
    ["leaves", "leaf"],
    ["knives", "knife"],
    ["cities", "city"],
    ["boxes", "box"],
    ["hoped", "hope"],
    ["baking", "bake"],
    ["  CAKES ", "cake"],
  ])("%s -> %s", (input, expected) => {
    expect(game.stem(input)).toBe(expected);
  });

  it("leaves unknown words untouched", () => {
    expect(game.stem("zebras")).toBe("zebras");
  });

  it("never rewrites a known word, even one that looks inflected", () => {
    hydrate(["celebrated", "celebrate", "commons", "common"]);
    expect(game.stem("celebrated")).toBe("celebrated");
    expect(game.stem("commons")).toBe("commons");
  });

  it("accepts an external dictionary", () => {
    const dict = new Set(["horse"]);
    expect(stemWord("horses", (w) => dict.has(w))).toBe("horse");
  });
});

describe("submitGuess", () => {
  beforeEach(() => hydrate());

  it("ranks the target as #1 and the rest in order", () => {
    expect(game.submitGuess("cheddar")).toMatchObject({ type: "success", guess: { rank: 1 } });
    expect(game.submitGuess("pie")).toMatchObject({ type: "success", guess: { rank: 2 } });
    expect(game.submitGuess("bake")).toMatchObject({ type: "success", guess: { rank: 14 } });
  });

  it("reports duplicates after stemming", () => {
    game.submitGuess("cake");
    expect(game.submitGuess("cakes")).toEqual({ type: "duplicate", word: "cake" });
  });

  it("reports words outside the vocabulary", () => {
    expect(game.submitGuess("zzzz")).toEqual({ type: "not_found", input: "zzzz" });
  });

  it("blocks guesses once the game is over", () => {
    game.end();
    expect(game.submitGuess("pie")).toEqual({ type: "blocked" });
  });

  it("only rank 1 wins", () => {
    game.submitGuess("pie");
    expect(game.isWin()).toBe(false);
    game.submitGuess("cheddar");
    expect(game.isWin()).toBe(true);
  });
});

describe("generateHint", () => {
  beforeEach(() => hydrate());

  it("returns an unguessed word closer than the best guess", () => {
    game.submitGuess("bake"); // rank 14
    const result = game.generateHint();
    expect(result.type).toBe("hint");
    if (result.type !== "hint") return;
    expect(result.guess.rank).toBeLessThan(14);
    expect(result.guess.rank).toBeGreaterThanOrEqual(2);
    expect(result.guess.isHint).toBe(true);
  });

  it("never reveals the target and never repeats a word", () => {
    for (let i = 0; i < 50; i++) {
      if (game.generateHint().type !== "hint") break;
    }
    const guesses = game.getState().guesses;
    expect(guesses.some((g) => g.rank === 1)).toBe(false);
    expect(game.isWin()).toBe(false);
    expect(new Set(guesses.map((g) => g.word)).size).toBe(guesses.length);
    expect(Math.min(...guesses.map((g) => g.rank))).toBe(2);
  });

  it("is exhausted once the best guess is #2", () => {
    game.submitGuess("pie");
    expect(game.generateHint()).toEqual({ type: "exhausted" });
  });

  it("aims for the warm band on a large vocabulary with no guesses", () => {
    hydrate(Array.from({ length: 5000 }, (_, i) => `w${i}`));
    const result = game.generateHint();
    expect(result.type === "hint" && result.guess.rank >= 300 && result.guess.rank < 1000).toBe(true);
  });
});

describe("Game construction", () => {
  it("rejects an empty ranking", () => {
    expect(() => new Game([])).toThrow();
  });

  it("resumes a saved round without aliasing its guesses", () => {
    const guesses = [{ word: "pie", rank: 2, timestamp: 0 }];
    const resumed = new Game(RANKED, { saved: { guesses, latestGuess: guesses[0], isGameOver: false } });
    resumed.submitGuess("cake");
    expect(resumed.getState().guesses).toHaveLength(2);
    expect(guesses).toHaveLength(1);
    expect(resumed.submitGuess("pie")).toEqual({ type: "duplicate", word: "pie" });
  });
});

describe("aliases", () => {
  const aliases = new Map([
    ["held", "hold"],
    ["children", "child"],
    ["was", "be"],
    ["pies", "nonexistent"],
  ]);
  const words = ["cheddar", "hold", "child", "be", "pie"];

  it("maps other word forms onto ranked words", () => {
    const game = new Game(words, { aliases });
    expect(game.submitGuess("held")).toMatchObject({ type: "success", guess: { word: "hold", rank: 2 } });
    expect(game.submitGuess("Children")).toMatchObject({ type: "success", guess: { word: "child" } });
    expect(game.submitGuess("was")).toMatchObject({ type: "success", guess: { word: "be" } });
  });

  it("treats an alias and its base as the same guess", () => {
    const game = new Game(words, { aliases });
    game.submitGuess("hold");
    expect(game.submitGuess("held")).toEqual({ type: "duplicate", word: "hold" });
  });

  it("falls back to suffix rules when an alias points nowhere", () => {
    expect(new Game(words, { aliases }).stem("pies")).toBe("pie");
  });

  it("accepts aliases that arrive after the round started", () => {
    const game = new Game(words);
    expect(game.submitGuess("held")).toEqual({ type: "not_found", input: "held" });
    game.setAliases(aliases);
    expect(game.submitGuess("held")).toMatchObject({ type: "success", guess: { word: "hold" } });
  });
});

describe("getTier", () => {
  it.each([
    [1, "hot"],
    [HOT_MAX_RANK, "hot"],
    [HOT_MAX_RANK + 1, "warm"],
    [WARM_MAX_RANK, "warm"],
    [WARM_MAX_RANK + 1, "cold"],
    [49_000, "cold"],
  ] as const)("rank %i is %s", (rank, tier) => {
    expect(getTier(rank)).toBe(tier);
  });
});
