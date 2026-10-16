/**
 * asset-cache.ts — IndexedDB cache for versioned game data (usable from the main thread or a worker).
 * Keys are data versions, so a new pipeline build never reuses stale vectors.
 */

export interface CachedAssets {
  vocab: string[];
  embeddings: ArrayBuffer;
}

const DB_NAME = "heat_seek_engine";
const DB_VERSION = 2; // v1 held per-target top-K lists in "vocab_store"
const STORE = "assets";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("vocab_store")) db.deleteObjectStore("vocab_store");
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAssets(version: string): Promise<CachedAssets | null> {
  try {
    const db = await openDB();
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(version);
    return await new Promise((resolve) => {
      req.onsuccess = () => resolve((req.result as CachedAssets | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Stores this version's assets and drops every other version. */
export async function putAssets(version: string, assets: CachedAssets): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.put(assets, version);
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      for (const key of keys.result) if (key !== version) store.delete(key);
    };
    await done(tx);
  } catch (e) {
    console.warn("Caching game data failed", e);
  }
}
