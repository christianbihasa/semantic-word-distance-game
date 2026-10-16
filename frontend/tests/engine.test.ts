import { beforeEach, describe, expect, it } from "vitest";
import * as engine from "../src/engine";
import type { TopKEntry } from "../src/topk-format";

const NEIGHBORS = ["pie", "cake", "sausage", "cheese", "lotus", "brag", "chin", "leaf", "knife", "city", "box", "hope", "bake"];

function hydrate(target = "cheddar", words = NEIGHBORS) {
  engine.hydrateTopK(target, words.map((w): TopKEntry => [w, 0]));
  engine.resetState(target);
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
    hydrate("celebrated", ["celebrate", "commons", "common"]);
    expect(engine.stemWord("celebrated")).toBe("celebrated");
    expect(engine.stemWord("commons")).toBe("commons");
  });
});

describe("submitGuess", () => {
  beforeEach(() => hydrate());

  it("ranks the target as #1 and neighbours from #2", () => {
    expect(engine.submitGuess("cheddar")).toMatchObject({ type: "success", guess: { rank: 1 } });
    expect(engine.submitGuess("pie")).toMatchObject({ type: "success", guess: { rank: 2 } });
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
});

describe("generateHint", () => {
  beforeEach(() => hydrate());

  it("returns a word closer than the best guess", () => {
    engine.submitGuess("bake"); // rank 14
    const hint = engine.generateHint();
    expect(hint).not.toBeNull();
    expect(hint!.rank).toBeLessThan(14);
    expect(hint!.isHint).toBe(true);
  });

  it("never repeats an already-guessed word", () => {
    for (let i = 0; i < 20 && !engine.isWin(); i++) engine.generateHint();
    const words = engine.getState().guesses.map((g) => g.word);
    expect(new Set(words).size).toBe(words.length);
  });
});
