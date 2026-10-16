/**
 * ui.ts — Pure DOM manipulation and presentation layer.
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
  newWordBtn: document.getElementById("newword-btn") as HTMLButtonElement,

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
    setMenuOpen(elements.menuOptions.classList.contains("hidden"));
  });

  document.addEventListener("click", (e) => {
    if (!elements.menuToggleBtn.contains(e.target as Node)) setMenuOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!elements.modalOverlay.classList.contains("hidden")) closeModal();
    else setMenuOpen(false);
  });

  elements.hintBtn.addEventListener("click", () => {
    setMenuOpen(false);
    handlers.onHint();
  });

  elements.giveupBtn.addEventListener("click", () => {
    setMenuOpen(false);
    handlers.onGiveUp();
  });

  elements.newWordBtn.addEventListener("click", () => {
    setMenuOpen(false);
    handlers.onReplay();
  });

  elements.modalReplayBtn.addEventListener("click", () => {
    closeModal();
    handlers.onReplay();
  });

  elements.modalCloseBtn.addEventListener("click", closeModal);

  elements.modalOverlay.addEventListener("click", (e) => {
    if (e.target === elements.modalOverlay) closeModal();
  });
}

function setMenuOpen(open: boolean): void {
  elements.menuOptions.classList.toggle("hidden", !open);
  elements.menuToggleBtn.setAttribute("aria-expanded", String(open));
}

function closeModal(): void {
  elements.modalOverlay.classList.add("hidden");
  elements.menuToggleBtn.focus();
}

/** In-game actions (hint, give up) vs. the post-game "New Word" action. */
function syncMenu(isGameOver: boolean): void {
  elements.hintBtn.hidden = isGameOver;
  elements.giveupBtn.hidden = isGameOver;
  elements.newWordBtn.hidden = !isGameOver;
}

const formatRank = (rank: number) => `#${rank.toLocaleString("en-US")}`;

export function clearInput(): void {
  elements.guessInput.value = "";
}

export function setInputEnabled(enabled: boolean): void {
  elements.guessInput.disabled = !enabled;
  if (enabled) elements.guessInput.focus();
}

// All dynamic text goes through textContent so guesses and data words are never parsed as HTML.
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function showSystemMessage(text: string, isError = false): void {
  const container = elements.hintDisplayContainer;
  if (!text) {
    container.replaceChildren();
  } else if (isError) {
    container.replaceChildren(el("div", "hint-banner reveal-banner", text));
  } else {
    container.textContent = text;
  }
}

export function showMessage(title: string, message: string, isError = false): void {
  const box = el("div", `latest-guess-box ${isError ? "warning-box" : "notice-box"} animate-shake`);
  const body = el("div", "");
  body.append(el("span", "latest-label", title), message);
  box.append(body);
  elements.latestGuessContainer.replaceChildren(box);
}

// ─── Game Rendering ───────────────────────────────────────────

export function renderGame(state: Readonly<GameState>): void {
  elements.guessCounterBadge.textContent = `#${state.guesses.length + 1}`;
  syncMenu(state.isGameOver);

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
    const box = el("div", `latest-guess-box ${getTier(state.latestGuess.rank)}`);
    const label = el("div", "");
    label.append(el("span", "latest-label", "Latest Guess"), el("strong", "", state.latestGuess.word));
    box.append(label, el("strong", "", formatRank(state.latestGuess.rank)));
    elements.latestGuessContainer.replaceChildren(box);
  } else {
    elements.latestGuessContainer.replaceChildren();
  }

  // Full re-render on each guess: lists stay in the hundreds, so sorting and
  // rebuilding in a DocumentFragment is cheap and avoids layout thrashing.
  const frag = document.createDocumentFragment();
  const sortedGuesses = [...state.guesses].sort((a, b) => a.rank - b.rank);

  for (const guess of sortedGuesses) {
    const row = el("div", `guess-row ${getTier(guess.rank)}`);
    const wrapper = el("div", "word-wrapper");
    if (state.latestGuess !== null && guess.word === state.latestGuess.word) {
      wrapper.append(el("span", "arrow-indicator", "➔"));
    }
    if (guess.isHint) wrapper.append(el("span", "hint-bulb-icon", "💡"));
    wrapper.append(el("span", "word-text", guess.word));
    row.append(wrapper, el("span", "rank-value", formatRank(guess.rank)));
    frag.appendChild(row);
  }

  elements.guessListContainer.replaceChildren(frag);
}

export function showEndGameOverlay(state: Readonly<GameState>, isWin: boolean): void {
  setInputEnabled(false);
  syncMenu(true);

  if (isWin) {
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, disableForReducedMotion: true });
  }

  const hintsUsedCount = state.guesses.filter((g) => g.isHint).length;
  const directGuessesCount = state.guesses.length - hintsUsedCount;

  elements.targetWordDisplay.textContent = state.targetWord.toUpperCase();
  elements.guessesDisplay.textContent = directGuessesCount.toString();
  elements.hintsDisplay.textContent = hintsUsedCount.toString();

  if (isWin) {
    elements.modalHeader.textContent = "TARGET ACQUIRED!";
    elements.modalHeader.style.backgroundColor = "var(--heat-hot)";
  } else {
    elements.modalHeader.textContent = "MISSION ABANDONED";
    elements.modalHeader.style.backgroundColor = "var(--heat-cold)";
  }

  elements.modalOverlay.classList.remove("hidden");
  elements.modalReplayBtn.focus();
}
