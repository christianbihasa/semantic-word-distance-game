/**
 * worker-topk.ts — Dedicated Web Worker for off-thread top-K fetching and parsing.
 * Prevents main-thread blocking during initial payload load and JSON parsing.
 */

self.addEventListener("message", async (e) => {
  const { target, url } = e.data || {};
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch topk for ${target}`);
    
    // Parsing ~1-2MB JSON off main thread
    const raw = await resp.json();
    
    let entries: [string, number][] = [];
    
    if (Array.isArray(raw) && raw.length > 0) {
      if (Array.isArray(raw[0])) {
        entries = raw as [string, number][];
      } else if (raw[0].w !== undefined) {
        entries = raw.map((it: any) => [it.w, it.s ?? 0]);
      }
    } else if (raw.entries) {
      if (Array.isArray(raw.entries) && raw.entries.length > 0) {
        if (Array.isArray(raw.entries[0])) {
          entries = raw.entries as [string, number][];
        } else {
          entries = raw.entries.map((it: any) => [it.w, it.s ?? 0]);
        }
      }
    }

    self.postMessage({ target, entries });
  } catch (err) {
    self.postMessage({ error: String(err) });
  }
});
