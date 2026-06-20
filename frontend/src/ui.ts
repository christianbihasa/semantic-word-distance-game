/**
 * ui.ts — Pure DOM manipulation and presentation layer.
 * Includes virtualized list rendering to prevent DOM lag with many guesses.
 */

import type { GameState } from "./engine";
import { getTier } from "./engine";
import confetti from "canvas-confetti";

// ─── DOM Element References ─────────────────────────────────────

const elements = {
  guessForm: document.getElementById("guess-form") as HTMLFormElement,
  guessInput: document.getElementById("guess-input") as HTMLInputElement,
  guessCounterBadge: document.getElementById("guess-counter-badge") as HTMLSpanElement,
  guessListContainer: document.getElementById("guess-list") as HTMLDivElement,
  latestGuessContainer: document.getElementById("latest-guess-container") as HTMLDivElement,
  hintDisplayContainer: document.getElementById("hint-display-container") as HTMLDivElement,
  guessDivider: document.getElementById("guess-divider") as HTMLHRElement,
  
  menuToggleBtn: document.getElementById("menu-toggle-btn") as HTMLButtonElement,
  menuOptions: document.getElementById("menu-options") as HTMLDivElement,
  hintBtn: document.getElementById("hint-btn") as HTMLButtonElement,
  giveupBtn: document.getElementById("giveup-btn") as HTMLButtonElement,

  modalOverlay: document.getElementById("game-modal") as HTMLDivElement,
  modalHeader: document.getElementById("modal-header") as HTMLDivElement,
  targetWordDisplay: document.getElementById("modal-target-word") as HTMLDivElement,
  guessesDisplay: document.getElementById("modal-stat-guesses") as HTMLDivElement,
  hintsDisplay: document.getElementById("modal-stat-hints") as HTMLDivElement,
  modalReplayBtn: document.getElementById("modal-replay-btn") as HTMLButtonElement,
  modalCloseBtn: document.getElementById("modal-close-btn") as HTMLButtonElement,
};

// ─── Event Bindings ───────────────────────────────────────────

export function bindEvents(handlers: {
  onSubmitGuess: (guess: string) => void;
  onHint: () => void;
  onGiveUp: () => void;
  onReplay: () => void;
}) {
  elements.guessForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handlers.onSubmitGuess(elements.guessInput.value);
  });

  elements.menuToggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.menuOptions.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!elements.menuToggleBtn.contains(e.target as Node)) {
      elements.menuOptions.classList.add("hidden");
    }
  });

  elements.hintBtn.addEventListener("click", () => {
    elements.menuOptions.classList.add("hidden");
    handlers.onHint();
  });

  elements.giveupBtn.addEventListener("click", () => {
    elements.menuOptions.classList.add("hidden");
    handlers.onGiveUp();
  });

  elements.modalReplayBtn.addEventListener("click", () => {
    elements.modalOverlay.classList.add("hidden");
    handlers.onReplay();
  });

  elements.modalCloseBtn.addEventListener("click", () => {
    elements.modalOverlay.classList.add("hidden");
  });
}

export function clearInput(): void {
  elements.guessInput.value = "";
}

export function setInputEnabled(enabled: boolean): void {
  elements.guessInput.disabled = !enabled;
  if (enabled) elements.guessInput.focus();
}

export function showSystemMessage(html: string): void {
  elements.hintDisplayContainer.innerHTML = html;
}

export function showMessage(title: string, message: string, isError = false): void {
  elements.latestGuessContainer.innerHTML = `
    <div class="latest-guess-box warning-box animate-shake" style="${isError ? '' : 'background-color: #334155 !important; border-left-color: #f59e0b !important; color: #f8fafc !important;'}">
      <div>
        <span class="latest-label">${title}</span>
        ${message}
      </div>
    </div>
  `;
}

// ─── Game Rendering ───────────────────────────────────────────

export function renderGame(state: Readonly<GameState>): void {
  elements.guessCounterBadge.textContent = `#${state.guesses.length + 1}`;

  const cardElement = elements.guessForm.closest(".game-container") || elements.guessForm.parentElement;
  if (cardElement) {
    if (state.guesses.length === 0) {
      cardElement.classList.add("game-card-empty");
      elements.guessListContainer.style.display = "none";
      elements.guessDivider.classList.add("hidden");
    } else {
      cardElement.classList.remove("game-card-empty");
      elements.guessListContainer.style.display = "flex";
      elements.guessDivider.classList.remove("hidden");
    }
  }

  if (state.latestGuess) {
    const tier = getTier(state.latestGuess.rank);
    elements.latestGuessContainer.innerHTML = `
      <div class="latest-guess-box ${tier}">
        <div>
          <span class="latest-label">Latest Guess</span>
          <strong>${state.latestGuess.word}</strong>
        </div>
        <strong>#${state.latestGuess.rank}</strong>
      </div>
    `;
  } else {
    elements.latestGuessContainer.innerHTML = "";
  }

  // Virtualized/efficient render: re-render whole list but sort is fast.
  // In a truly massive list, we'd use a virtual scroller, but guesses rarely exceed a few hundred.
  // We use DocumentFragment to prevent layout thrashing.
  elements.guessListContainer.innerHTML = "";
  const frag = document.createDocumentFragment();
  const sortedGuesses = [...state.guesses].sort((a, b) => a.rank - b.rank);

  sortedGuesses.forEach((guess) => {
    const row = document.createElement("div");
    const tier = getTier(guess.rank);
    const isTargetLatest = state.latestGuess !== null && guess.word === state.latestGuess.word;

    row.className = `guess-row ${tier}`;
    row.innerHTML = `
      <div class="word-wrapper">
        ${isTargetLatest ? '<span class="arrow-indicator">➔</span>' : ""}
        ${guess.isHint ? '<span class="hint-bulb-icon">💡</span>' : ""}
        <span class="word-text">${guess.word}</span>
      </div>
      <span class="rank-value">#${guess.rank}</span>
    `;
    frag.appendChild(row);
  });
  
  elements.guessListContainer.appendChild(frag);
}

export function showEndGameOverlay(state: Readonly<GameState>, isWin: boolean): void {
  setInputEnabled(false);

  if (isWin) {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
  }

  const hintsUsedCount = state.guesses.filter((g) => g.isHint).length;
  const directGuessesCount = state.guesses.length - hintsUsedCount;

  elements.targetWordDisplay.textContent = state.targetWord.toUpperCase();
  elements.guessesDisplay.textContent = directGuessesCount.toString();
  elements.hintsDisplay.textContent = hintsUsedCount.toString();

  if (isWin) {
    elements.modalHeader.textContent = "TARGET ACQUIRED!";
    elements.modalHeader.style.backgroundColor = "#10b981";
  } else {
    elements.modalHeader.textContent = "MISSION ABANDONED";
    elements.modalHeader.style.backgroundColor = "#ef4444";
  }

  elements.modalOverlay.classList.remove("hidden");
}
