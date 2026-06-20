/**
 * storage.ts — IndexedDB + LocalStorage persistence layer.
 * Lazy-fetches topk/<target>.json and caches per-target data in IDB.
 */

export interface SessionData {
  targetWord: string;
  guesses: Array<{ word: string; rank: number; timestamp: number; isHint?: boolean }>;
  latestGuess: { word: string; rank: number; timestamp: number; isHint?: boolean } | null;
  isGameOver: boolean;
}

// Top-K entry: [word, cosine_similarity_score]
export type TopKEntry = [string, number];

const STORAGE_KEY = "heat_seek_session_state";
const IDB_DB_NAME = "heat_seek_engine";
const IDB_STORE_NAME = "vocab_store";
const TOPK_IDB_KEY_PREFIX = "topk:";
const TARGETS_PATH = "/topk/targets.json";

// ─── IndexedDB ────────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase> | null = null;

function openIDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      _dbPromise = null;
      reject(req.error);
    };
  });
  return _dbPromise;
}

export async function getTopKFromIDB(target: string): Promise<TopKEntry[] | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get(TOPK_IDB_KEY_PREFIX + target);
    return await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveTopKToIDB(target: string, entries: TopKEntry[]): Promise<void> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    tx.objectStore(IDB_STORE_NAME).put(entries, TOPK_IDB_KEY_PREFIX + target);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("saveTopKToIDB failed", e);
  }
}

// ─── Network fetching ─────────────────────────────────────────

export async function fetchTargetsList(): Promise<string[]> {
  const resp = await fetch(TARGETS_PATH);
  if (!resp.ok) throw new Error("Failed to load targets.json");
  return resp.json();
}

export async function fetchTopKForTarget(target: string): Promise<TopKEntry[]> {
  const resp = await fetch(`/topk/${target}.json`);
  if (!resp.ok) throw new Error(`Failed to load topk/${target}.json`);
  const raw = await resp.json();
  // Support both old format [{w, s}] and new compact [[word, score]]
  if (Array.isArray(raw) && raw.length > 0) {
    if (Array.isArray(raw[0])) {
      return raw as TopKEntry[];
    }
    // Old {w, s} object format or {entries: [...]} wrapper
    if (raw[0].w !== undefined) {
      return raw.map((it: { w: string; s?: number }) => [it.w, it.s ?? 0] as TopKEntry);
    }
  }
  // Wrapped format: {entries: [...]}
  if (raw.entries) {
    const entries = raw.entries;
    if (Array.isArray(entries) && entries.length > 0) {
      if (Array.isArray(entries[0])) return entries as TopKEntry[];
      return entries.map((it: { w: string; s?: number }) => [it.w, it.s ?? 0] as TopKEntry);
    }
  }
  return [];
}

/**
 * Load top-K with IDB cache-first strategy.
 * Returns entries from IDB if cached, otherwise fetches, caches, then returns.
 */
export async function loadTopK(target: string): Promise<TopKEntry[]> {
  const cached = await getTopKFromIDB(target);
  if (cached && cached.length > 0) return cached;

  const entries = await fetchTopKForTarget(target);
  // Fire-and-forget cache write
  saveTopKToIDB(target, entries);
  return entries;
}

// ─── Session persistence (localStorage) ───────────────────────

export function saveSession(data: SessionData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota exceeded or private mode — ignore */
  }
}

export function loadSession(): SessionData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
