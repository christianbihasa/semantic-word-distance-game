import * as storage from "./storage";
import * as engine from "./engine";
import * as ui from "./ui";

function init() {
  ui.bindEvents({
    onSubmitGuess: handleGuessSubmit,
    onHint: handleGetHint,
    onGiveUp: handleGiveUp,
    onReplay: startNewGameRound,
  });

  initGameEngine();
}

async function initGameEngine() {
  try {
    ui.showSystemMessage("Initializing engine...");

    const saved = storage.loadSession();
    let chosenTarget: string | null = null;
    try {
      const targets = await storage.fetchTargetsList();
      if (saved?.targetWord && targets.includes(saved.targetWord)) {
        chosenTarget = saved.targetWord;
      } else {
        chosenTarget = targets[Math.floor(Math.random() * targets.length)];
      }
    } catch (e) {
      console.warn("Failed to fetch targets list, falling back to saved session", e);
      if (saved?.targetWord) chosenTarget = saved.targetWord;
    }

    if (!chosenTarget) throw new Error("No target available");

    // Check IDB cache first
    const cachedTopK = await storage.getTopKFromIDB(chosenTarget);
    if (cachedTopK && cachedTopK.length > 0) {
      engine.hydrateTopK(chosenTarget, cachedTopK);
      ui.showSystemMessage("");
      restoreOrStart(saved, chosenTarget);
      return;
    }

    // Spawn worker to fetch and parse off-thread
    const worker = new Worker(new URL("./worker-topk.ts", import.meta.url), { type: "module" });
    worker.postMessage({ target: chosenTarget, url: `/topk/${chosenTarget}.json` });

    worker.onmessage = async (e) => {
      if (e.data.error) {
        console.error("Top-K worker failed:", e.data.error);
        ui.showSystemMessage(`<div class="hint-banner reveal-banner">⚠️ Failed to load target payload.</div>`);
        worker.terminate();
        return;
      }

      const entries = e.data.entries;
      // Persist to IDB asynchronously
      storage.saveTopKToIDB(chosenTarget!, entries);
      
      engine.hydrateTopK(chosenTarget!, entries);
      ui.showSystemMessage("");
      restoreOrStart(saved, chosenTarget!);
      worker.terminate();
    };

    worker.onerror = (err) => {
      console.error("Top-K worker error:", err);
      ui.showSystemMessage(`<div class="hint-banner reveal-banner">⚠️ System initialization failure.</div>`);
      worker.terminate();
    };
  } catch (error) {
    console.error("Engine Init Failure:", error);
    ui.showSystemMessage(`<div class="hint-banner reveal-banner">⚠️ System initialization failure.</div>`);
  }
}

function restoreOrStart(saved: storage.SessionData | null, target: string) {
  if (saved && saved.targetWord === target) {
    engine.restoreState(target, saved.guesses, saved.latestGuess, saved.isGameOver);
    ui.setInputEnabled(!saved.isGameOver);
    ui.clearInput();
    ui.showSystemMessage("");
    ui.renderGame(engine.getState());
    if (saved.isGameOver) {
      ui.showEndGameOverlay(engine.getState(), engine.isWin());
    }
  } else {
    startNewGameRound();
  }
}

function startNewGameRound(): void {
  storage.clearSession();
  const currentTarget = engine.getState().targetWord;
  engine.resetState(currentTarget);
  ui.setInputEnabled(true);
  ui.clearInput();
  ui.showSystemMessage("");
  ui.renderGame(engine.getState());
}

function handleGuessSubmit(input: string): void {
  const result = engine.submitGuess(input);

  if (result.type === "blocked") return;

  if (result.type === "not_found") {
    ui.showMessage("Error", `"${result.input}" is not in the database.`, true);
    ui.clearInput();
    return;
  }

  if (result.type === "duplicate") {
    ui.showMessage("Notice", `"${result.word}" has already been guessed!`, false);
    ui.clearInput();
    return;
  }

  ui.clearInput();
  storage.saveSession(engine.getState());
  ui.renderGame(engine.getState());
  checkWinCondition();
}

function handleGetHint(): void {
  const hint = engine.generateHint();
  if (hint) {
    storage.saveSession(engine.getState());
    ui.renderGame(engine.getState());
    checkWinCondition();
  }
}

function handleGiveUp(): void {
  if (engine.getState().isGameOver) return;
  engine.endGame(false);
  ui.showEndGameOverlay(engine.getState(), false);
  storage.saveSession(engine.getState());
}

function checkWinCondition(): void {
  if (engine.getState().isGameOver) return;
  if (engine.isWin()) {
    engine.endGame(true);
    setTimeout(() => {
      ui.showEndGameOverlay(engine.getState(), true);
      storage.saveSession(engine.getState());
    }, 250);
  }
}

init();
