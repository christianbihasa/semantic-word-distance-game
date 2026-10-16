import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEmbeddings, rankByIndex } from "../src/ranking";
import { loadGameData } from "./load-data";

const { vocab, embeddings } = loadGameData();
const index = new Map(vocab.map((w, i) => [w, i]));
// Written by data-pipeline/build_assets.py from the Python implementation.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/ranking.json", import.meta.url), "utf8")) as Record<
  string,
  string[]
>;

describe("rankByIndex", () => {
  it.each(Object.keys(fixture))("matches the pipeline's ranking for %s", (word) => {
    const order = rankByIndex(embeddings, index.get(word)!);
    expect(Array.from(order.subarray(0, 50), (i) => vocab[i])).toEqual(fixture[word]);
  });

  it("ranks every word exactly once, target first", () => {
    const target = index.get("cheese")!;
    const order = rankByIndex(embeddings, target);
    expect(order.length).toBe(vocab.length);
    expect(order[0]).toBe(target);
    expect(new Set(order).size).toBe(vocab.length);
  });

  it("rejects a buffer of the wrong size", () => {
    expect(() => parseEmbeddings(new ArrayBuffer(10), 2, 4)).toThrow(/expected/);
  });
});
