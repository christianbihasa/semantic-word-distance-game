import confetti from "canvas-confetti";

interface Guess {
  word: string;
  rank: number;
  timestamp: number;
  isHint?: boolean;
}

interface GameState {
  targetWord: string;
  targetIndex: number;
  wordbank: string[];
  guesses: Guess[];
  latestGuess: Guess | null;
  isGameOver: boolean;
}

const state: GameState = {
  targetWord: "",
  targetIndex: -1,
  wordbank: [],
  guesses: [],
  latestGuess: null,
  isGameOver: false,
};

// Map storing clean, uniquely assigned non-duplicate ranks per word
const wordRankMap = new Map<string, number>();

// DOM Elements Cache
const guessForm = document.getElementById("guess-form") as HTMLFormElement;
const guessInput = document.getElementById("guess-input") as HTMLInputElement;
const guessCounterBadge = document.getElementById(
  "guess-counter-badge",
) as HTMLSpanElement;
const guessListContainer = document.getElementById(
  "guess-list",
) as HTMLDivElement;
const latestGuessContainer = document.getElementById(
  "latest-guess-container",
) as HTMLDivElement;
const hintDisplayContainer = document.getElementById(
  "hint-display-container",
) as HTMLDivElement;
const guessDivider = document.getElementById("guess-divider") as HTMLHRElement;

const menuToggleBtn = document.getElementById(
  "menu-toggle-btn",
) as HTMLButtonElement;
const menuOptions = document.getElementById("menu-options") as HTMLDivElement;
const hintBtn = document.getElementById("hint-btn") as HTMLButtonElement;
const giveupBtn = document.getElementById("giveup-btn") as HTMLButtonElement;

// Persistence / Caching keys and constants
const STORAGE_KEY = "heat_seek_session_state";
const IDB_DB_NAME = "heat_seek_engine";
const IDB_STORE_NAME = "vocab_store";
// (No legacy full-vocab key; using per-target topk keys)
const TOPK_IDB_KEY_PREFIX = "topk:";
const TARGETS_JSON_PATH = "/topk/targets.json";

// --- Session Persistence Helpers (LocalStorage) ---
function saveSessionToStorage(): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        targetWord: state.targetWord,
        guesses: state.guesses,
        latestGuess: state.latestGuess,
        isGameOver: state.isGameOver,
      }),
    );
  } catch (e) {
    console.warn("Failed to save session state:", e);
  }
}

function loadSessionFromStorage(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("Failed to load session state:", e);
    return null;
  }
}

function clearSessionStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear session state:", e);
  }
}

// --- IndexedDB Helpers (Engine Cache) ---
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Legacy full vocabulary helpers removed — per-target top-K caching is used instead.

// (No explicit delete helper needed currently)

// Note: legacy full-vocab caching removed in favor of per-target top-K caching.

// Note: hydrateWordRankMap removed; use per-target hydrateTopkForTarget instead.

function hydrateTopkForTarget(target: string, entries: Array<{w: string; s?: number;}>) {
  wordRankMap.clear();
  const bank: string[] = [];
  const t = target.trim().toLowerCase();
  // target is rank 1
  wordRankMap.set(t, 1);
  bank.push(t);
  entries.forEach((it, idx) => {
    const w = (it.w || '').trim().toLowerCase();
    if (!w) return;
    const rank = idx + 2; // neighbors start from 2
    wordRankMap.set(w, rank);
    bank.push(w);
  });
  state.wordbank = bank;
}

// --- Per-target Top-K IDB helpers ---
async function getTopkFromIDB(target: string): Promise<{version?: string; data?: any} | null> {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get(TOPK_IDB_KEY_PREFIX + target);
    return await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn("getTopkFromIDB failed", e);
    return null;
  }
}

async function saveTopkToIDB(target: string, data: any, version?: string) {
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    store.put({ version: version || `${Date.now()}`, data }, TOPK_IDB_KEY_PREFIX + target);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("saveTopkToIDB failed", e);
  }
}

async function fetchTargetsList(): Promise<string[]> {
  const resp = await fetch(TARGETS_JSON_PATH);
  if (!resp.ok) throw new Error("Failed to load targets.json");
  const list = await resp.json();
  // list expected to be array of target words
  return list;
}

// Temperature Color Grading
function getTierClass(rank: number): "hot" | "warm" | "cold" {
  if (rank === 1 || (rank >= 2 && rank <= 75)) return "hot";
  if (rank >= 76 && rank <= 300) return "warm";
  return "cold";
}

// Suffix Parsing Normalization Engine
function determineRootWord(word: string): string {
  const irregularPlurals: { [key: string]: string } = {
    leaves: "leaf",
    knives: "knife",
    lives: "life",
    thieves: "thief",
    wolves: "wolf",
    halves: "half",
    calves: "calf",
    shelves: "shelf",
    elves: "elf",
    loaves: "loaf",
    children: "child",
    men: "man",
    women: "woman",
    teeth: "tooth",
    feet: "foot",
    geese: "goose",
    mice: "mouse",
    data: "datum",
    phenomena: "phenomenon",
    oxen: "ox",
    cacti: "cactus",
    fungi: "fungus",
    nuclei: "nucleus",
  };

  const normalized = word.trim().toLowerCase();
  if (irregularPlurals[normalized]) return irregularPlurals[normalized];

  if (normalized.endsWith("ies") && normalized.length > 3)
    return normalized.slice(0, -3) + "y";
  if (normalized.endsWith("ves") && normalized.length > 3) {
    const fRoot = normalized.slice(0, -3) + "f";
    return wordRankMap.has(fRoot) ? fRoot : normalized.slice(0, -3) + "fe";
  }
  if (normalized.endsWith("es") && normalized.length > 2)
    return normalized.slice(0, -2);
  if (
    normalized.endsWith("s") &&
    !normalized.endsWith("ss") &&
    normalized.length > 1
  )
    return normalized.slice(0, -1);

  if (normalized.endsWith("ed") && normalized.length > 2) {
    const rootEd = normalized.slice(0, -2);
    if (wordRankMap.has(rootEd)) return rootEd;
    const rootD = normalized.slice(0, -1);
    if (wordRankMap.has(rootD)) return rootD;
  }

  if (normalized.endsWith("ing") && normalized.length > 3) {
    const rootIng = normalized.slice(0, -3);
    if (wordRankMap.has(rootIng)) return rootIng;
    const rootE = rootIng + "e";
    if (wordRankMap.has(rootE)) return rootE;
  }

  return normalized;
}

async function initGameEngine() {
  try {
    hintDisplayContainer.innerHTML = "Initializing engine...";

    // 1) Load targets list and pick target (respect saved session if present)
    const saved = loadSessionFromStorage();
    let chosenTarget: string | null = null;
    try {
      const targets = await fetchTargetsList();
      if (saved && saved.targetWord && targets.includes(saved.targetWord)) {
        chosenTarget = saved.targetWord;
      } else {
        // pick random target from list
        chosenTarget = targets[Math.floor(Math.random() * targets.length)];
      }
    } catch (e) {
      console.warn("Failed to fetch targets list, falling back to saved session or aborting", e);
      if (saved && saved.targetWord) chosenTarget = saved.targetWord;
    }

    if (!chosenTarget) throw new Error("No target available to initialize engine");
    state.targetWord = chosenTarget;

    // 2) Try to load top-K for target from IDB
    const cachedTopk = await getTopkFromIDB(chosenTarget);
    if (cachedTopk && cachedTopk.data) {
      // hydrate from cached data immediately
      hydrateTopkForTarget(chosenTarget, cachedTopk.data);
      hintDisplayContainer.innerHTML = "";
      // restore session if present
      if (saved && saved.targetWord === chosenTarget) {
        state.guesses = saved.guesses || [];
        state.latestGuess = saved.latestGuess || null;
        state.isGameOver = Boolean(saved.isGameOver);
        renderGame();
        if (state.isGameOver) triggerEndGameOverlay(state.guesses.some((g) => g.rank === 1));
      } else {
        startNewGameRound();
      }
      return;
    }

    // 3) If not cached, spawn worker to fetch and parse top-K JSON
    const worker = new Worker(new URL("./worker-topk.ts", import.meta.url), { type: "module" });
    worker.postMessage({ target: chosenTarget, url: `/topk/${chosenTarget}.json` });
    worker.onmessage = async (e) => {
      const entries = e.data?.entries || [];
      // Persist and hydrate
      await saveTopkToIDB(chosenTarget, entries);
      hydrateTopkForTarget(chosenTarget, entries);
      hintDisplayContainer.innerHTML = "";

      if (saved && saved.targetWord === chosenTarget) {
        state.guesses = saved.guesses || [];
        state.latestGuess = saved.latestGuess || null;
        state.isGameOver = Boolean(saved.isGameOver);
        renderGame();
        if (state.isGameOver) triggerEndGameOverlay(state.guesses.some((g) => g.rank === 1));
      } else {
        startNewGameRound();
      }
      worker.terminate();
    };
    worker.onerror = (err) => {
      console.error("Top-K worker failed:", err);
      hintDisplayContainer.innerHTML = `<div class=\"hint-banner reveal-banner\">⚠️ Failed to load target payload.</div>`;
      worker.terminate();
    };
  } catch (error) {
    console.error("Engine Init Failure:", error);
    hintDisplayContainer.innerHTML = `<div class="hint-banner reveal-banner">⚠️ System initialization failure.</div>`;
  }
}

function startNewGameRound(): void {
  // Clear any previous session so replay starts fresh
  clearSessionStorage();
  if (state.wordbank.length === 0) return;
  // With precomputed top-K payloads, the first element is the secret target
  state.targetIndex = 0;
  state.targetWord = state.wordbank[0].trim().toLowerCase();

  // Create rank mapping directly from precomputed order (target -> #1)
  wordRankMap.clear();
  state.wordbank.forEach((w, i) => {
    wordRankMap.set(w.trim().toLowerCase(), i + 1);
  });

  // 3. Reset Game States
  state.guesses = [];
  state.latestGuess = null;
  state.isGameOver = false;

  guessInput.disabled = false;
  guessInput.value = "";
  hintDisplayContainer.innerHTML = "";

  renderGame();
}

function renderGame(): void {
  guessCounterBadge.textContent = `#${state.guesses.length + 1}`;

  const cardElement =
    guessForm.closest(".game-container") || guessForm.parentElement;
  if (cardElement) {
    if (state.guesses.length === 0) {
      cardElement.classList.add("game-card-empty");
      guessListContainer.style.display = "none";
      guessDivider.classList.add("hidden");
    } else {
      cardElement.classList.remove("game-card-empty");
      guessListContainer.style.display = "flex";
      guessDivider.classList.remove("hidden");
    }
  }

  if (state.latestGuess) {
    const tier = getTierClass(state.latestGuess.rank);
    latestGuessContainer.innerHTML = `
      <div class="latest-guess-box ${tier}">
        <div>
          <span class="latest-label">Latest Guess</span>
          <strong>${state.latestGuess.word}</strong>
        </div>
        <strong>#${state.latestGuess.rank}</strong>
      </div>
    `;
  } else {
    latestGuessContainer.innerHTML = "";
  }

  guessListContainer.innerHTML = "";
  const sortedGuesses = [...state.guesses].sort((a, b) => a.rank - b.rank);

  sortedGuesses.forEach((guess) => {
    const row = document.createElement("div");
    const tier = getTierClass(guess.rank);
    const isTargetLatest =
      state.latestGuess !== null && guess.word === state.latestGuess.word;

    row.className = `guess-row ${tier}`;
    row.innerHTML = `
      <div class="word-wrapper">
        ${isTargetLatest ? '<span class="arrow-indicator">➔</span>' : ""}
        ${guess.isHint ? '<span class="hint-bulb-icon">💡</span>' : ""}
        <span class="word-text">${guess.word}</span>
      </div>
      <span class="rank-value">#${guess.rank}</span>
    `;
    guessListContainer.appendChild(row);
  });
}

// Constant Fail-Safe Win Checker Function
function checkWinCondition(): void {
  if (state.isGameOver) return;

  const hasFoundTarget = state.guesses.some(
    (g) => g.rank === 1 || g.word === state.targetWord,
  );
  if (hasFoundTarget) {
    setTimeout(() => triggerEndGameOverlay(true), 250);
  }
}

function triggerEndGameOverlay(isWin: boolean): void {
  state.isGameOver = true;
  guessInput.disabled = true;

  // Persist final session state
  saveSessionToStorage();

  if (isWin) {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
  }

  const hintsUsedCount = state.guesses.filter((g) => g.isHint).length;
  const directGuessesCount = state.guesses.length - hintsUsedCount;

  const modalOverlay = document.getElementById("game-modal")!;
  const modalHeader = document.getElementById("modal-header")!;
  const targetWordDisplay = document.getElementById("modal-target-word")!;
  const guessesDisplay = document.getElementById("modal-stat-guesses")!;
  const hintsDisplay = document.getElementById("modal-stat-hints")!;

  targetWordDisplay.textContent = state.targetWord.toUpperCase();
  guessesDisplay.textContent = directGuessesCount.toString();
  hintsDisplay.textContent = hintsUsedCount.toString();

  if (isWin) {
    modalHeader.textContent = "TARGET ACQUIRED!";
    modalHeader.style.backgroundColor = "#10b981";
  } else {
    modalHeader.textContent = "MISSION ABANDONED";
    modalHeader.style.backgroundColor = "#ef4444";
  }

  modalOverlay.classList.remove("hidden");
}

function handleGetHint(): void {
  menuOptions.classList.add("hidden");
  if (state.isGameOver || state.wordbank.length === 0) return;

  let currentClosestRank = state.wordbank.length;
  if (state.guesses.length > 0) {
    currentClosestRank = Math.min(...state.guesses.map((g) => g.rank));
  }

  if (currentClosestRank === 1) return;

  // Determine dynamic approach destination rank targets
  let targetRank = currentClosestRank;
  if (currentClosestRank <= 25) {
    targetRank =
      currentClosestRank -
      (Math.floor(Math.random() * Math.min(4, currentClosestRank - 1)) + 1);
  } else if (currentClosestRank <= 100) {
    targetRank = currentClosestRank - (Math.floor(Math.random() * 12) + 4);
  } else if (currentClosestRank <= 1000) {
    targetRank = Math.floor(currentClosestRank * 0.75);
  } else {
    targetRank = Math.floor(currentClosestRank * 0.5);
  }

  if (targetRank < 1) targetRank = 1;
  if (targetRank >= currentClosestRank) targetRank = currentClosestRank - 1;

  // Extract valid unused unique word based on destination rank target
  let hintWord = "";
  let finalRank = targetRank;

  for (const [word, rank] of wordRankMap.entries()) {
    if (rank === targetRank) {
      hintWord = word;
      break;
    }
  }

  // Scan adjacent positions if preferred targeted word choice has already been tracked
  let scanOffset = 1;
  while (
    (!hintWord || state.guesses.some((g) => g.word === hintWord)) &&
    scanOffset < 100
  ) {
    let checkRank = targetRank + scanOffset;
    for (const [word, rank] of wordRankMap.entries()) {
      if (rank === checkRank) {
        hintWord = word;
        finalRank = checkRank;
        break;
      }
    }
    if (hintWord && !state.guesses.some((g) => g.word === hintWord)) break;

    checkRank = targetRank - scanOffset;
    if (checkRank >= 1) {
      for (const [word, rank] of wordRankMap.entries()) {
        if (rank === checkRank) {
          hintWord = word;
          finalRank = checkRank;
          break;
        }
      }
    }
    scanOffset++;
  }

  if (!hintWord || finalRank === 1) {
    hintWord = state.targetWord;
    finalRank = 1;
  }

  const hintGuess: Guess = {
    word: hintWord,
    rank: finalRank,
    timestamp: Date.now(),
    isHint: true,
  };

  state.guesses.push(hintGuess);
  state.latestGuess = hintGuess;

  // Save session after producing a hint
  saveSessionToStorage();

  renderGame();
  checkWinCondition(); // Constant Checker ensures overlay runs if hint hits #1
}

function handleGiveUp(): void {
  menuOptions.classList.add("hidden");
  if (state.isGameOver) return;
  triggerEndGameOverlay(false);
}

function handleGuessSubmit(event: Event): void {
  event.preventDefault();
  if (state.isGameOver || state.wordbank.length === 0) return;

  const inputWord = guessInput.value.trim().toLowerCase();
  if (!inputWord) return;

  const rawWord = determineRootWord(inputWord);

  if (!wordRankMap.has(rawWord)) {
    latestGuessContainer.innerHTML = `
      <div class="latest-guess-box warning-box animate-shake">
        <div>
          <span class="latest-label">Error</span>
          <strong>"${inputWord}"</strong> is not in the database.
        </div>
      </div>
    `;
    guessInput.value = "";
    return;
  }

  const computedRank = wordRankMap.get(rawWord)!;

  const alreadyGuessed = state.guesses.some((g) => g.word === rawWord);
  if (alreadyGuessed) {
    latestGuessContainer.innerHTML = `
      <div class="latest-guess-box warning-box animate-shake">
        <div>
          <span class="latest-label">Notice</span>
          <strong>"${rawWord}"</strong> has already been guessed!
        </div>
      </div>
    `;
    guessInput.value = "";
    return;
  }

  const newGuess: Guess = {
    word: rawWord,
    rank: computedRank,
    timestamp: Date.now(),
    isHint: false,
  };

  state.guesses.push(newGuess);
  state.latestGuess = newGuess;
  guessInput.value = "";

  // Persist session after a new guess
  saveSessionToStorage();

  renderGame();
  checkWinCondition(); // Constant win verification execution block
}

// Global UI Form & Interactivity Bindings
guessForm.addEventListener("submit", handleGuessSubmit);

menuToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  menuOptions.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!menuToggleBtn.contains(e.target as Node)) {
    menuOptions.classList.add("hidden");
  }
});

hintBtn.addEventListener("click", handleGetHint);
giveupBtn.addEventListener("click", handleGiveUp);

// Wire up replay and close modal windows safely
document.getElementById("modal-replay-btn")?.addEventListener("click", () => {
  document.getElementById("game-modal")?.classList.add("hidden");
  startNewGameRound();
});

document.getElementById("modal-close-btn")?.addEventListener("click", () => {
  document.getElementById("game-modal")?.classList.add("hidden");
});

// App Initiation
initGameEngine();
