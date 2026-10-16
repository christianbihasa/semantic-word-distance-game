import { beforeEach, describe, expect, it } from "vitest";
import * as engine from "../src/engine";

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

function hydrate(words = RANKED) {
  engine.hydrateRanking(words);
  engine.resetState(words[0]);
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
    expect(engine.stemWord(input)).toBe(expected);
  });

  it("leaves unknown words untouched", () => {
    expect(engine.stemWord("zebras")).toBe("zebras");
  });

  it("never rewrites a known word, even one that looks inflected", () => {
    hydrate(["celebrated", "celebrate", "commons", "common"]);
    expect(engine.stemWord("celebrated")).toBe("celebrated");
    expect(engine.stemWord("commons")).toBe("commons");
  });

  it("accepts an external dictionary", () => {
    const dict = new Set(["horse"]);
    expect(engine.stemWord("horses", (w) => dict.has(w))).toBe("horse");
  });
});

describe("submitGuess", () => {
  beforeEach(() => hydrate());

  it("ranks the target as #1 and the rest in order", () => {
    expect(engine.submitGuess("cheddar")).toMatchObject({ type: "success", guess: { rank: 1 } });
    expect(engine.submitGuess("pie")).toMatchObject({ type: "success", guess: { rank: 2 } });
    expect(engine.submitGuess("bake")).toMatchObject({ type: "success", guess: { rank: 14 } });
  });

  it("reports duplicates after stemming", () => {
    engine.submitGuess("cake");
    expect(engine.submitGuess("cakes")).toEqual({ type: "duplicate", word: "cake" });
  });

  it("reports words outside the vocabulary", () => {
    expect(engine.submitGuess("zzzz")).toEqual({ type: "not_found", input: "zzzz" });
  });

  it("blocks guesses once the game is over", () => {
    engine.endGame();
    expect(engine.submitGuess("pie")).toEqual({ type: "blocked" });
  });

  it("only rank 1 wins", () => {
    engine.submitGuess("pie");
    expect(engine.isWin()).toBe(false);
    engine.submitGuess("cheddar");
    expect(engine.isWin()).toBe(true);
  });
});

describe("generateHint", () => {
  beforeEach(() => hydrate());

  it("returns an unguessed word closer than the best guess", () => {
    engine.submitGuess("bake"); // rank 14
    const result = engine.generateHint();
    expect(result.type).toBe("hint");
    if (result.type !== "hint") return;
    expect(result.guess.rank).toBeLessThan(14);
    expect(result.guess.rank).toBeGreaterThanOrEqual(2);
    expect(result.guess.isHint).toBe(true);
  });

  it("never reveals the target and never repeats a word", () => {
    for (let i = 0; i < 50; i++) {
      if (engine.generateHint().type !== "hint") break;
    }
    const guesses = engine.getState().guesses;
    expect(guesses.some((g) => g.rank === 1)).toBe(false);
    expect(engine.isWin()).toBe(false);
    expect(new Set(guesses.map((g) => g.word)).size).toBe(guesses.length);
    expect(Math.min(...guesses.map((g) => g.rank))).toBe(2);
  });

  it("is exhausted once the best guess is #2", () => {
    engine.submitGuess("pie");
    expect(engine.generateHint()).toEqual({ type: "exhausted" });
  });

  it("aims for the warm band on a large vocabulary with no guesses", () => {
    hydrate(Array.from({ length: 5000 }, (_, i) => `w${i}`));
    const result = engine.generateHint();
    expect(result.type === "hint" && result.guess.rank >= 300 && result.guess.rank < 1000).toBe(true);
  });
});

describe("getTier", () => {
  it.each([
    [1, "hot"],
    [engine.HOT_MAX_RANK, "hot"],
    [engine.HOT_MAX_RANK + 1, "warm"],
    [engine.WARM_MAX_RANK, "warm"],
    [engine.WARM_MAX_RANK + 1, "cold"],
    [49_000, "cold"],
  ] as const)("rank %i is %s", (rank, tier) => {
    expect(engine.getTier(rank)).toBe(tier);
  });
});
