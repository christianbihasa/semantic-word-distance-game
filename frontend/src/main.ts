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
    // Show loading state
    hintDisplayContainer.innerHTML = "Initializing engine...";

    const response = await fetch("/src/wordbank.json");
    if (!response.ok)
      throw new Error("Failed to load wordbank configuration asset.");

    // Load pre-formatted object {word: rank} directly into map
    const wordRankData = await response.json();
    wordRankMap.clear();
    Object.entries(wordRankData).forEach(([word, rank]) => {
      wordRankMap.set(word, rank as number);
    });

    // Extract wordbank as array from map keys
    state.wordbank = Array.from(wordRankMap.keys());

    // Clear loading message
    hintDisplayContainer.innerHTML = "";

    console.log(
      `🚀 Heat Seek engine active with ${state.wordbank.length.toLocaleString()} words.`,
    );
    startNewGameRound();
  } catch (error) {
    console.error("Engine Init Failure:", error);
    hintDisplayContainer.innerHTML = `<div class="hint-banner reveal-banner">⚠️ System initialization failure.</div>`;
  }
}

function startNewGameRound(): void {
  if (state.wordbank.length === 0) return;

  // 1. Establish targeted secret word index
  state.targetIndex = Math.floor(
    Math.random() * Math.min(150, state.wordbank.length),
  );
  state.targetWord = state.wordbank[state.targetIndex].trim().toLowerCase();

  // 2. Clear old mappings and sort entire wordbank relative to target index to prevent duplicate ranks
  wordRankMap.clear();

  const mappedBank = state.wordbank.map((word) => {
    const cleanWord = word.trim().toLowerCase();
    const originalIdx = state.wordbank.indexOf(word);
    return {
      word: cleanWord,
      distance: Math.abs(originalIdx - state.targetIndex),
    };
  });

  // Sort ascending by distance. If tied, sort alphabetically to guarantee strict non-duplicate rank ordering
  mappedBank.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.word.localeCompare(b.word);
  });

  // Assign linear unique sequential sequential ranks starting from #1
  mappedBank.forEach((item, index) => {
    wordRankMap.set(item.word, index + 1);
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
