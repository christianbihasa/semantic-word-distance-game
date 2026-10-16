import * as storage from "./storage";
import * as engine from "./engine";
import * as ui from "./ui";
import type { Manifest } from "./ranking";

let manifest: Manifest | null = null;
let isLoading = false;

function init() {
  ui.bindEvents({
    onSubmitGuess: handleGuessSubmit,
    onHint: handleGetHint,
    onGiveUp: handleGiveUp,
    onReplay: () => void playAgain(),
  });

  void initGameEngine();
}

async function initGameEngine() {
  ui.setInputEnabled(false);
  ui.showSystemMessage("Initializing engine...");

  try {
    manifest = await storage.fetchManifest();
  } catch (error) {
    console.error("Engine Init Failure:", error);
    ui.showSystemMessage("⚠️ Failed to load game data. Please refresh to try again.", true);
    return;
  }

  const saved = storage.loadSession(manifest.version);
  const chosenTarget = saved && manifest.targets.includes(saved.targetWord) ? saved.targetWord : pickRandomTarget();
  if (!chosenTarget || !(await loadTarget(chosenTarget))) return;

  if (saved && saved.targetWord === chosenTarget) {
    restoreSession(saved);
  } else {
    beginRound();
  }
}

function pickRandomTarget(exclude?: string): string | null {
  const targets = manifest?.targets ?? [];
  const pool = targets.length > 1 ? targets.filter((t) => t !== exclude) : targets;
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
}

/** Ranks the vocabulary against a target and loads it into the engine. Returns false (and shows an error) on failure. */
async function loadTarget(target: string): Promise<boolean> {
  if (!manifest) return false;
  isLoading = true;
  ui.setInputEnabled(false);
  try {
    engine.hydrateRanking(await storage.rankVocabulary(manifest, target));
    ui.showSystemMessage("");
    return true;
  } catch (error) {
    console.error("Engine Init Failure:", error);
    ui.showSystemMessage("⚠️ Failed to load the word list. Please refresh to try again.", true);
    return false;
  } finally {
    isLoading = false;
  }
}

function saveSession(): void {
  if (manifest) storage.saveSession({ ...engine.getState(), dataVersion: manifest.version });
}

function restoreSession(saved: storage.SessionData) {
  engine.restoreState(saved.targetWord, saved.guesses, saved.latestGuess, saved.isGameOver);
  ui.setInputEnabled(!saved.isGameOver);
  ui.clearInput();
  ui.renderGame(engine.getState());
  if (saved.isGameOver) {
    ui.showEndGameOverlay(engine.getState(), engine.isWin());
  } else {
    checkWinCondition();
  }
}

/** Starts a fresh round on the currently loaded target. */
function beginRound(): void {
  storage.clearSession();
  engine.resetState(engine.getState().targetWord);
  ui.setInputEnabled(true);
  ui.clearInput();
  ui.renderGame(engine.getState());
}

/** Picks a different target, loads it, and starts a fresh round. */
async function playAgain(): Promise<void> {
  if (isLoading) return;
  const next = pickRandomTarget(engine.getState().targetWord);
  if (!next) {
    beginRound();
    return;
  }
  storage.clearSession();
  ui.showSystemMessage("Loading a new word...");
  if (await loadTarget(next)) beginRound();
}

function canPlay(): boolean {
  return !isLoading && engine.getVocabSize() > 0 && !engine.getState().isGameOver;
}

function handleGuessSubmit(input: string): void {
  if (!canPlay()) return;
  const result = engine.submitGuess(input);

  if (result.type === "blocked") return;

  if (result.type === "not_found") {
    ui.showMessage("Error", `"${result.input}" is not in the word list.`, true);
    ui.clearInput();
    return;
  }

  if (result.type === "duplicate") {
    ui.showMessage("Notice", `"${result.word}" has already been guessed!`, false);
    ui.clearInput();
    return;
  }

  ui.clearInput();
  saveSession();
  ui.renderGame(engine.getState());
  checkWinCondition();
}

function handleGetHint(): void {
  if (!canPlay()) return;
  const result = engine.generateHint();
  if (result.type === "exhausted") {
    ui.showMessage("Notice", "No closer hints left: the word is right next to your best guess!", false);
    return;
  }
  if (result.type === "hint") {
    saveSession();
    ui.renderGame(engine.getState());
  }
}

function handleGiveUp(): void {
  if (!canPlay()) return;
  engine.endGame();
  saveSession();
  ui.showEndGameOverlay(engine.getState(), false);
}

function checkWinCondition(): void {
  if (engine.getState().isGameOver || !engine.isWin()) return;
  engine.endGame();
  // Persist before the celebratory delay so a quick reload still sees the finished game.
  saveSession();
  ui.setInputEnabled(false);
  setTimeout(() => ui.showEndGameOverlay(engine.getState(), true), 250);
}

init();
