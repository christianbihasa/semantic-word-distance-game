import * as storage from "./storage";
import { Game } from "./engine";
import * as ui from "./ui";
import type { Manifest } from "./ranking";

let manifest: Manifest | null = null;
let game: Game | null = null;
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
  if (!chosenTarget) return;
  const ranking = await loadRanking(chosenTarget);
  if (!ranking) return;

  if (saved && saved.targetWord === chosenTarget) {
    restoreSession(ranking, saved);
  } else {
    beginRound(ranking);
  }
}

function pickRandomTarget(exclude?: string): string | null {
  const targets = manifest?.targets ?? [];
  const pool = targets.length > 1 ? targets.filter((t) => t !== exclude) : targets;
  return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
}

/** The vocabulary ranked against `target` (target first), or null after showing an error. */
async function loadRanking(target: string): Promise<string[] | null> {
  if (!manifest) return null;
  isLoading = true;
  ui.setInputEnabled(false);
  try {
    const ranking = await storage.rankVocabulary(manifest, target);
    ui.showSystemMessage("");
    return ranking;
  } catch (error) {
    console.error("Engine Init Failure:", error);
    ui.showSystemMessage("⚠️ Failed to load the word list. Please refresh to try again.", true);
    return null;
  } finally {
    isLoading = false;
  }
}

function saveSession(): void {
  if (manifest && game) storage.saveSession({ ...game.getState(), dataVersion: manifest.version });
}

function restoreSession(ranking: string[], saved: storage.SessionData) {
  game = new Game(ranking, saved);
  ui.setInputEnabled(!saved.isGameOver);
  ui.clearInput();
  ui.renderGame(game.getState());
  if (saved.isGameOver) {
    ui.showEndGameOverlay(game.getState(), game.isWin());
  } else {
    checkWinCondition();
  }
}

function beginRound(ranking: string[]): void {
  storage.clearSession();
  game = new Game(ranking);
  ui.setInputEnabled(true);
  ui.clearInput();
  ui.renderGame(game.getState());
}

/** Picks a different target, ranks it, and starts a fresh round. */
async function playAgain(): Promise<void> {
  if (isLoading || !game) return;
  const next = pickRandomTarget(game.getState().targetWord) ?? game.getState().targetWord;
  storage.clearSession();
  ui.showSystemMessage("Loading a new word...");
  const ranking = await loadRanking(next);
  if (ranking) beginRound(ranking);
}

/** The active game, if it is accepting moves. */
function activeGame(): Game | null {
  return !isLoading && game && !game.getState().isGameOver ? game : null;
}

function handleGuessSubmit(input: string): void {
  const game = activeGame();
  if (!game) return;
  const result = game.submitGuess(input);

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
  ui.renderGame(game.getState());
  checkWinCondition();
}

function handleGetHint(): void {
  const game = activeGame();
  if (!game) return;
  const result = game.generateHint();
  if (result.type === "exhausted") {
    ui.showMessage("Notice", "No closer hints left: the word is right next to your best guess!", false);
    return;
  }
  if (result.type === "hint") {
    saveSession();
    ui.renderGame(game.getState());
  }
}

function handleGiveUp(): void {
  const game = activeGame();
  if (!game) return;
  game.end();
  saveSession();
  ui.showEndGameOverlay(game.getState(), false);
}

function checkWinCondition(): void {
  const game = activeGame();
  if (!game || !game.isWin()) return;
  game.end();
  // Persist before the celebratory delay so a quick reload still sees the finished game.
  saveSession();
  ui.setInputEnabled(false);
  setTimeout(() => ui.showEndGameOverlay(game.getState(), true), 250);
}

init();
