/**
 * topk-format.ts — Single parser for topk/<target>.json payloads.
 * Shared by the worker and tests so the data contract lives in one place.
 */

// Top-K entry: [word, cosine_similarity_score]
export type TopKEntry = [string, number];

type LegacyEntry = { w: string; s?: number };

function toEntry(item: unknown): TopKEntry | null {
  if (typeof item === "string") return [item, 0];
  if (Array.isArray(item) && typeof item[0] === "string") {
    return [item[0], typeof item[1] === "number" ? item[1] : 0];
  }
  if (item && typeof item === "object" && typeof (item as LegacyEntry).w === "string") {
    const { w, s } = item as LegacyEntry;
    return [w, typeof s === "number" ? s : 0];
  }
  return null;
}

/**
 * Accepts every format the pipeline has produced:
 * ["word", ...], [["word", score], ...], [{w, s}, ...], or {entries: <any of those>}.
 * Throws on anything unrecognised or empty so callers never start a game with no vocabulary.
 */
export function parseTopKPayload(raw: unknown): TopKEntry[] {
  const list =
    raw && typeof raw === "object" && !Array.isArray(raw) && "entries" in raw
      ? (raw as { entries: unknown }).entries
      : raw;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("Top-K payload is empty or not a list");
  }
  const entries: TopKEntry[] = [];
  for (const item of list) {
    const entry = toEntry(item);
    if (!entry) throw new Error("Top-K payload contains an unrecognised entry");
    entries.push(entry);
  }
  return entries;
}
