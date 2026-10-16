/**
 * worker-topk.ts — Dedicated Web Worker for off-thread top-K fetching and parsing.
 * Keeps payload download and JSON parsing off the main thread.
 */

import { parseTopKPayload } from "./topk-format";

self.addEventListener("message", async (e: MessageEvent<{ target: string; url: string }>) => {
  const { target, url } = e.data;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch topk for ${target} (HTTP ${resp.status})`);
    const entries = parseTopKPayload(await resp.json());
    self.postMessage({ target, entries });
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
});
