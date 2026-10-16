import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as engine from "../src/engine";
import { parseTopKPayload } from "../src/topk-format";

const dir = new URL("../public/topk/", import.meta.url);
const readJson = (name: string): unknown => JSON.parse(readFileSync(new URL(name, dir), "utf8"));
const targets = readJson("targets.json") as string[];

describe("topk data", () => {
  it("has a non-empty, duplicate-free target list", () => {
    expect(targets.length).toBeGreaterThan(0);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it.each(targets)("%s parses and is winnable by typing it", (target) => {
    const entries = parseTopKPayload(readJson(`${target}.json`));
    expect(entries.length).toBeGreaterThan(0);
    engine.hydrateTopK(target, entries);
    expect(engine.stemWord(target)).toBe(target);
  });
});
