import * as storage from "./storage";
import { Game } from "./engine";
import * as ui from "./ui";
import { dailyTarget, localDateKey, puzzleNumber, shareText } from "./daily";
import type { Manifest } from "./ranking";

let manifest: Manifest | null = null;
let game: Game | null = null;
let aliases: Map<string, string> = new Map();
let mode: storage.Mode = storage.loadMode();
let dailyPuzzle = 0;
let isLoading = false;

function init() {
  ui.bindEvents({
    onSubmitGuess: handleGuessSubmit,
    onHint: handleGetHint,
    onGiveUp: handleGiveUp,
    onReplay: () => void (mode === "daily" ? startMode("random") : playAgain()),
    onModeChange: (next) => void startMode(next),
    onShare: () => void handleShare(),
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
  // Aliases improve guess matching but are not essential; load them alongside the first ranking.
  const aliasesLoaded = storage
    .fetchAliases(manifest)
    .then((map) => (aliases = map))
    .catch((error) => console.warn("Word-form aliases unavailable; using suffix rules only", error));
  await Promise.all([startMode(mode, true), aliasesLoaded]);
  game?.setAliases(aliases);
}

/**
 * Switches to a mode and resumes its saved round when there is one. Daily resumes even a
 * finished round (so it can be shared); random starts a new word after a finished round.
 */
async function startMode(next: storage.Mode, force = false): Promise<void> {
  if (!manifest || isLoading || (next === mode && !force)) return;
  mode = next;
  storage.saveMode(mode);

  let target: string | null;
  if (mode === "daily") {
    const today = localDateKey(new Date());
    dailyPuzzle = puzzleNumber(today);
    target = dailyTarget(manifest.targets, dailyPuzzle);
    ui.setMode(mode, `Daily #${dailyPuzzle} · ${today}`);
  } else {
    target = null;
    ui.setMode(mode, "Random word");
  }

  let saved = storage.loadSession(mode, manifest.version);
  if (saved && (mode === "daily" ? saved.targetWord !== target : saved.isGameOver)) saved = null;
  if (saved && !manifest.targets.includes(saved.targetWord)) saved = null;
  target ??= saved?.targetWord ?? pickRandomTarget();
  if (!target) return;

  const ranking = await loadRanking(target);
  if (!ranking) return;
  if (saved) restoreSession(ranking, saved);
  else beginRound(ranking);
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
  if (manifest && game) storage.saveSession(mode, { ...game.getState(), dataVersion: manifest.version });
}

function restoreSession(ranking: string[], saved: storage.SessionData) {
  game = new Game(ranking, { saved, aliases });
  ui.setInputEnabled(!saved.isGameOver);
  ui.clearInput();
  ui.renderGame(game.getState());
  if (saved.isGameOver) {
    ui.showEndGameOverlay(game.getState(), game.isWin(), false);
  } else {
    checkWinCondition();
  }
}

function beginRound(ranking: string[]): void {
  storage.clearSession(mode);
  game = new Game(ranking, { aliases });
  ui.setInputEnabled(true);
  ui.clearInput();
  ui.renderGame(game.getState());
}

/** Random mode: picks a different target, ranks it, and starts a fresh round. */
async function playAgain(): Promise<void> {
  if (isLoading || !game || mode !== "random") return;
  const next = pickRandomTarget(game.getState().targetWord) ?? game.getState().targetWord;
  storage.clearSession(mode);
  ui.showSystemMessage("Loading a new word...");
  const ranking = await loadRanking(next);
  if (ranking) beginRound(ranking);
}

/** Copies a spoiler-free daily summary; falls back to showing it if the clipboard is unavailable. */
async function handleShare(): Promise<void> {
  if (!game || mode !== "daily" || !game.getState().isGameOver) return;
  const url = new URL(import.meta.env.BASE_URL, location.origin).href;
  const text = shareText(dailyPuzzle, game.getState().guesses, game.isWin(), url);
  if (!ui.isModalOpen()) ui.showEndGameOverlay(game.getState(), game.isWin(), false);
  try {
    await navigator.clipboard.writeText(text);
    ui.showShareFeedback(text, true);
  } catch {
    ui.showShareFeedback(text, false);
  }
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
