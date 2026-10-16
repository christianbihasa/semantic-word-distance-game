import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, dailyTarget, localDateKey, puzzleNumber, shareText } from "../src/daily";
import type { Guess } from "../src/engine";

const g = (word: string, rank: number, isHint = false): Guess => ({ word, rank, timestamp: 0, isHint });

describe("puzzleNumber", () => {
  it("starts at 1 on the epoch and counts calendar days", () => {
    expect(puzzleNumber(DAILY_EPOCH)).toBe(1);
    expect(puzzleNumber("2026-10-17")).toBe(2);
    expect(puzzleNumber("2027-10-16")).toBe(366);
  });

  it("is unaffected by daylight-saving transitions", () => {
    expect(puzzleNumber("2027-03-15") - puzzleNumber("2027-03-13")).toBe(2);
    expect(puzzleNumber("2026-11-02") - puzzleNumber("2026-10-31")).toBe(2);
  });

  it("never goes below 1", () => {
    expect(puzzleNumber("2020-01-01")).toBe(1);
  });
});

describe("localDateKey", () => {
  it("formats the local calendar date", () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("dailyTarget", () => {
  const targets = Array.from({ length: 7345 }, (_, i) => `t${i}`);

  it("is deterministic", () => {
    expect(dailyTarget(targets, 42)).toBe(dailyTarget(targets, 42));
  });

  it("does not repeat until every target has been used", () => {
    const seen = new Set(Array.from({ length: targets.length }, (_, i) => dailyTarget(targets, i + 1)));
    expect(seen.size).toBe(targets.length);
  });

  it("works for list sizes sharing factors with the stride", () => {
    const small = Array.from({ length: 7919 * 2 }, (_, i) => `s${i}`);
    const seen = new Set(Array.from({ length: 500 }, (_, i) => dailyTarget(small, i + 1)));
    expect(seen.size).toBe(500);
  });
});

describe("shareText", () => {
  const guesses = [g("apple", 2820), g("orange", 640), g("strengthen", 300, true), g("lemon", 40), g("lime", 1)];
  const text = shareText(7, guesses, true, "https://example.test/");

  it("summarises the result", () => {
    expect(text).toBe("Heat Seek Daily #7: solved in 4 guesses, 1 hint\n🟥🟨💡🟩🎯\nhttps://example.test/");
  });

  it("never leaks a guessed word", () => {
    for (const { word } of guesses) expect(text).not.toContain(word);
  });

  it("reports giving up and truncates long trails", () => {
    const many = Array.from({ length: 45 }, (_, i) => g(`w${i}`, 5000));
    const lost = shareText(1, many, false, "u");
    expect(lost.startsWith("Heat Seek Daily #1: gave up after 45 guesses\n")).toBe(true);
    expect(lost).toContain("… +5");
  });
});
