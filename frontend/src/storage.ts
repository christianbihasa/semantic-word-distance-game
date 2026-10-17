/**
 * storage.ts — Game data loading (manifest + ranking worker) and session persistence.
 */

import type { Guess } from "./engine";
import type { Manifest } from "./ranking";
import type { RankRequest, RankResponse } from "./worker-rank";

export interface SessionData {
  dataVersion: string;
  targetWord: string;
  guesses: Guess[];
  latestGuess: Guess | null;
  isGameOver: boolean;
}

export type Mode = "daily" | "random";

const sessionKey = (mode: Mode) => `heat_seek_session_${mode}`;
const MODE_KEY = "heat_seek_mode";

// BASE_URL keeps asset paths working when the app is deployed under a sub-path.
const DATA_BASE_URL = `${import.meta.env.BASE_URL}data/`;

// ─── Game data ────────────────────────────────────────────────

export async function fetchManifest(): Promise<Manifest> {
  const resp = await fetch(DATA_BASE_URL + "manifest.json", { cache: "no-cache" });
  if (!resp.ok) throw new Error(`Failed to load manifest.json (HTTP ${resp.status})`);
  const m = (await resp.json()) as Manifest;
  if (!m.version || !m.count || !m.dim || !Array.isArray(m.targets) || m.targets.length === 0) {
    throw new Error("manifest.json is malformed");
  }
  return m;
}

/** Other word forms -> ranked vocabulary word. Optional: guessing falls back to suffix rules without it. */
export async function fetchAliases(manifest: Manifest): Promise<Map<string, string>> {
  if (!manifest.files.aliases) return new Map();
  const resp = await fetch(DATA_BASE_URL + manifest.files.aliases);
  if (!resp.ok) throw new Error(`Failed to load ${manifest.files.aliases} (HTTP ${resp.status})`);
  const raw: unknown = await resp.json();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("aliases.json is malformed");
  return new Map(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"));
}

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<number, { resolve: (words: string[]) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker-rank.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<RankResponse>) => {
    const request = pending.get(e.data.id);
    if (!request) return;
    pending.delete(e.data.id);
    if ("error" in e.data) request.reject(new Error(e.data.error));
    else request.resolve(e.data.words);
  };
  worker.onerror = (err) => {
    for (const request of pending.values()) request.reject(new Error(`Ranking worker error: ${err.message}`));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

/** The full vocabulary ordered by similarity to `target` (target first). */
export function rankVocabulary(manifest: Manifest, target: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, manifest, baseUrl: DATA_BASE_URL, target } satisfies RankRequest);
  });
}

// ─── Session persistence (localStorage) ───────────────────────

function isGuess(value: unknown): value is Guess {
  const g = value as Guess;
  return (
    !!g && typeof g.word === "string" && Number.isInteger(g.rank) && g.rank >= 1 && typeof g.timestamp === "number"
  );
}

function isSessionData(value: unknown): value is SessionData {
  const s = value as SessionData;
  return (
    !!s &&
    typeof s.dataVersion === "string" &&
    typeof s.targetWord === "string" &&
    typeof s.isGameOver === "boolean" &&
    Array.isArray(s.guesses) &&
    s.guesses.every(isGuess) &&
    (s.latestGuess === null || isGuess(s.latestGuess))
  );
}

export function saveSession(mode: Mode, data: SessionData): void {
  try {
    localStorage.setItem(sessionKey(mode), JSON.stringify(data));
  } catch {
    /* quota exceeded or private mode — ignore */
  }
}

/** Returns the saved session only if it was played on the same data version (ranks would differ otherwise). */
export function loadSession(mode: Mode, dataVersion: string): SessionData | null {
  try {
    const raw = localStorage.getItem(sessionKey(mode));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSessionData(parsed) && parsed.dataVersion === dataVersion ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSession(mode: Mode): void {
  try {
    localStorage.removeItem(sessionKey(mode));
  } catch {
    /* ignore */
  }
}

// ─── Preferences ──────────────────────────────────────────────

export function loadMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "random" ? "random" : "daily";
  } catch {
    return "daily";
  }
}

export function saveMode(mode: Mode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
