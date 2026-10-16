/**
 * storage.ts — IndexedDB + LocalStorage persistence layer.
 * Lazy-fetches topk/<target>.json and caches per-target data in IDB.
 */

import type { Guess } from "./engine";
import type { TopKEntry } from "./topk-format";

export interface SessionData {
  targetWord: string;
  guesses: Guess[];
  latestGuess: Guess | null;
  isGameOver: boolean;
}

const STORAGE_KEY = "heat_seek_session_state";
const IDB_DB_NAME = "heat_seek_engine";
const IDB_STORE_NAME = "vocab_store";
const TOPK_IDB_KEY_PREFIX = "topk:";

// BASE_URL keeps asset paths working when the app is deployed under a sub-path.
const topkUrl = (file: string) => `${import.meta.env.BASE_URL}topk/${encodeURIComponent(file)}.json`;

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
  const resp = await fetch(topkUrl("targets"));
  if (!resp.ok) throw new Error("Failed to load targets.json");
  const targets: unknown = await resp.json();
  if (!Array.isArray(targets) || targets.length === 0 || !targets.every((t) => typeof t === "string")) {
    throw new Error("targets.json is empty or malformed");
  }
  return targets;
}

/** Fetches and parses a target's top-K list in a worker; rejects on any failure. */
export function fetchTopKViaWorker(target: string): Promise<TopKEntry[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker-topk.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ entries?: TopKEntry[]; error?: string }>) => {
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else if (!e.data.entries?.length) reject(new Error(`Empty top-K payload for ${target}`));
      else resolve(e.data.entries);
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(`Top-K worker error: ${err.message}`));
    };
    worker.postMessage({ target, url: topkUrl(target) });
  });
}

/** Cache-first load: IndexedDB, then network (written back to the cache). */
export async function loadTopK(target: string): Promise<TopKEntry[]> {
  const cached = await getTopKFromIDB(target);
  if (cached && cached.length > 0) return cached;

  const entries = await fetchTopKViaWorker(target);
  void saveTopKToIDB(target, entries);
  return entries;
}

// ─── Session persistence (localStorage) ───────────────────────

function isGuess(value: unknown): value is Guess {
  const g = value as Guess;
  return (
    !!g &&
    typeof g.word === "string" &&
    Number.isInteger(g.rank) &&
    g.rank >= 1 &&
    typeof g.timestamp === "number"
  );
}

function isSessionData(value: unknown): value is SessionData {
  const s = value as SessionData;
  return (
    !!s &&
    typeof s.targetWord === "string" &&
    typeof s.isGameOver === "boolean" &&
    Array.isArray(s.guesses) &&
    s.guesses.every(isGuess) &&
    (s.latestGuess === null || isGuess(s.latestGuess))
  );
}

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
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSessionData(parsed) ? parsed : null;
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
