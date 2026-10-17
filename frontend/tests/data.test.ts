import { describe, expect, it } from "vitest";
import { stemWord } from "../src/engine";
import { loadGameData } from "./load-data";

const { manifest, vocab, aliases } = loadGameData();
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

  it("every alias points at a ranked word and is not one itself", () => {
    expect(aliases.size).toBeGreaterThan(1000);
    expect([...aliases.keys()].filter((k) => vocabSet.has(k))).toEqual([]);
    expect([...aliases.values()].filter((v) => !vocabSet.has(v))).toEqual([]);
  });

  it.each([
    ["held", "hold"],
    ["children", "child"],
    ["was", "be"],
    ["went", "go"],
    ["years", "year"],
    ["microscopes", "microscope"],
    ["tweezers", "tweezer"],
    ["magnification", "magnification"],
    ["wavelength", "wavelength"],
    ["internet", "internet"],
    ["physics", "physics"],
    ["building", "building"],
    ["december", "december"],
    ["christmas", "christmas"],
    ["atlantic", "atlantic"],
    ["parmesan", "parmesan"],
    ["paris", "paris"],
  ])("guessing %s counts as %s", (guess, expected) => {
    expect(stemWord(guess, (w) => vocabSet.has(w), aliases)).toBe(expected);
  });

  it.each(["einstein", "shakespeare", "mozart", "lincoln"])("people's names stay out: %s", (name) => {
    expect(vocabSet.has(name)).toBe(false);
    expect(aliases.has(name)).toBe(false);
  });

  it("every target is winnable by typing it", () => {
    const unwinnable = manifest.targets.filter((t) => stemWord(t, (w) => vocabSet.has(w)) !== t);
    expect(unwinnable).toEqual([]);
  });
});
