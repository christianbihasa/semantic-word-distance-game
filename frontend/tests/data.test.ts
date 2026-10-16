import { describe, expect, it } from "vitest";
import * as engine from "../src/engine";
import { loadGameData } from "./load-data";

const { manifest, vocab } = loadGameData();
const vocabSet = new Set(vocab);

describe("game data", () => {
  it("manifest matches the vocabulary", () => {
    expect(vocab.length).toBe(manifest.count);
    expect(vocabSet.size).toBe(vocab.length);
    expect(vocab.every((w) => /^[a-z]+$/.test(w))).toBe(true);
  });

  it("has a large, duplicate-free target list drawn from the vocabulary", () => {
    expect(manifest.targets.length).toBeGreaterThan(1000);
    expect(new Set(manifest.targets).size).toBe(manifest.targets.length);
    expect(manifest.targets.filter((t) => !vocabSet.has(t))).toEqual([]);
  });

  it("every target is winnable by typing it", () => {
    const unwinnable = manifest.targets.filter((t) => engine.stemWord(t, (w) => vocabSet.has(w)) !== t);
    expect(unwinnable).toEqual([]);
  });
});
