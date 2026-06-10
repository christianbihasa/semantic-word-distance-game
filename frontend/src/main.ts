import confetti from "canvas-confetti";

interface Guess {
  word: string;
  rank: number;
  timestamp: number;
}

interface GameState {
  targetWord: string;
  wordbank: string[];
  guesses: Guess[];
  latestGuess: Guess | null;
  isGameOver: boolean;
}

const state: GameState = {
  targetWord: "apple",
  wordbank: [],
  guesses: [],
  latestGuess: null,
  isGameOver: false,
};

const wordRankMap = new Map<string, number>();

// DOM Query Elements Cache
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

const menuToggleBtn = document.getElementById(
  "menu-toggle-btn",
) as HTMLButtonElement;
const menuOptions = document.getElementById("menu-options") as HTMLDivElement;
const hintBtn = document.getElementById("hint-btn") as HTMLButtonElement;
const giveupBtn = document.getElementById("giveup-btn") as HTMLButtonElement;

function getTierClass(rank: number): "green" | "yellow" | "red" {
  if (rank >= 1 && rank <= 100) return "green";
  if (rank >= 101 && rank <= 500) return "yellow";
  return "red";
}

// Deep Morphological Root Parser (Prioritizes root conversion even if plural exists in bank)
function determineRootWord(word: string): string {
  // 1. Irregular Plural Transformations Dictionary
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
  if (irregularPlurals[word] && wordRankMap.has(irregularPlurals[word])) {
    return irregularPlurals[word];
  }

  // 2. Suffix "-ies" -> "-y" (e.g., puppies -> puppy, cities -> city)
  if (word.endsWith("ies") && word.length > 3) {
    const root = word.slice(0, -3) + "y";
    if (wordRankMap.has(root)) return root;
  }

  // 3. Suffix "-ves" -> "-f" or "-fe" fallbacks (if missing from explicit dictionary)
  if (word.endsWith("ves") && word.length > 3) {
    const rootF = word.slice(0, -3) + "f";
    if (wordRankMap.has(rootF)) return rootF;
    const rootFE = word.slice(0, -3) + "fe";
    if (wordRankMap.has(rootFE)) return rootFE;
  }

  // 4. Suffix "-es" -> strip "-es" (e.g., boxes -> box, matches -> match)
  if (word.endsWith("es") && word.length > 2) {
    const root = word.slice(0, -2);
    if (wordRankMap.has(root)) return root;
  }

  // 5. Suffix "-s" -> strip "-s" (e.g., dogs -> dog)
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 1) {
    const root = word.slice(0, -1);
    if (wordRankMap.has(root)) return root;
  }

  // 6. Suffix "-ed" -> strip "-ed" or "-d" (e.g., walked -> walk, baked -> bake)
  if (word.endsWith("ed") && word.length > 2) {
    const rootEd = word.slice(0, -2);
    if (wordRankMap.has(rootEd)) return rootEd;

    const rootD = word.slice(0, -1);
    if (wordRankMap.has(rootD)) return rootD;

    // Handle double-consonant tracking (e.g., clapped -> clap)
    if (
      rootEd.length > 2 &&
      rootEd[rootEd.length - 1] === rootEd[rootEd.length - 2]
    ) {
      const subRoot = rootEd.slice(0, -1);
      if (wordRankMap.has(subRoot)) return subRoot;
    }
  }

  // 7. Suffix "-ing" -> strip "-ing" or morph to "-e" (e.g., painting -> paint, baking -> bake)
  if (word.endsWith("ing") && word.length > 3) {
    const rootIng = word.slice(0, -3);
    if (wordRankMap.has(rootIng)) return rootIng;

    const rootE = rootIng + "e";
    if (wordRankMap.has(rootE)) return rootE;

    // Handle double-consonant tracking (e.g., running -> run)
    if (
      rootIng.length > 2 &&
      rootIng[rootIng.length - 1] === rootIng[rootIng.length - 2]
    ) {
      const subRoot = rootIng.slice(0, -1);
      if (wordRankMap.has(subRoot)) return subRoot;
    }
  }

  return word;
}

async function initGameEngine() {
  try {
    const response = await fetch("/src/wordbank.json");
    if (!response.ok)
      throw new Error("Failed to load compiled wordbank configuration asset.");

    state.wordbank = await response.json();
    state.targetWord = state.wordbank[0];

    wordRankMap.clear();
    state.wordbank.forEach((word: string, index: number) => {
      wordRankMap.set(word, index);
    });

    console.log(
      `🚀 Game Engine active with ${state.wordbank.length.toLocaleString()} words.`,
    );
    renderGame();
  } catch (error) {
    console.error("Engine Init Failure:", error);
    hintDisplayContainer.innerHTML = `<div class="hint-banner reveal-banner">⚠️ System initialization failure.</div>`;
  }
}

function renderGame(): void {
  guessCounterBadge.textContent = `#${state.guesses.length + 1}`;

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
        ${isTargetLatest ? '<span class="arrow-indicator">➔</span> ' : ""}
        <span class="word-text">${guess.word}</span>
      </div>
      <span class="rank-value">#${guess.rank}</span>
    `;
    guessListContainer.appendChild(row);
  });
}

function handleGetHint(): void {
  menuOptions.classList.add("hidden");
  if (state.isGameOver || state.wordbank.length === 0) return;

  hintDisplayContainer.innerHTML = "";

  let currentClosestRank = state.wordbank.length;
  if (state.guesses.length > 0) {
    currentClosestRank = Math.min(...state.guesses.map((g) => g.rank));
  }

  if (currentClosestRank === 1) {
    alert("The secret word has already been discovered!");
    return;
  }

  let targetRank = currentClosestRank;

  if (currentClosestRank >= 2 && currentClosestRank <= 50) {
    targetRank = currentClosestRank - (Math.floor(Math.random() * 3) + 1);
  } else if (currentClosestRank >= 51 && currentClosestRank <= 100) {
    targetRank = currentClosestRank - (Math.floor(Math.random() * 8) + 3);
  } else if (currentClosestRank >= 101 && currentClosestRank <= 1000) {
    targetRank = currentClosestRank - (Math.floor(Math.random() * 91) + 10);
  } else {
    const offset = Math.floor(currentClosestRank * 0.17 + 143);
    targetRank = currentClosestRank - offset;
  }

  if (targetRank < 1) targetRank = 1;
  if (targetRank >= currentClosestRank) targetRank = currentClosestRank - 1;

  let hintWord = state.wordbank[targetRank - 1];

  let uniqueFound = !state.guesses.some((g) => g.word === hintWord);
  while (!uniqueFound && targetRank > 1) {
    targetRank--;
    hintWord = state.wordbank[targetRank - 1];
    uniqueFound = !state.guesses.some((g) => g.word === hintWord);
  }

  const hintGuess: Guess = {
    word: hintWord,
    rank: targetRank,
    timestamp: Date.now(),
  };

  state.guesses.push(hintGuess);
  state.latestGuess = hintGuess;

  if (targetRank === 1) {
    state.isGameOver = true;
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    setTimeout(
      () => alert(`🎉 The Hint revealed the secret word! Game Over!`),
      250,
    );
  }

  renderGame();
}

function handleGiveUp(): void {
  menuOptions.classList.add("hidden");
  if (state.isGameOver) return;

  state.isGameOver = true;
  hintDisplayContainer.innerHTML = `
    <div class="hint-banner reveal-banner">
      🏳️ You surrendered! The secret word was <strong>"${state.targetWord}"</strong> (#1).
    </div>
  `;

  guessInput.disabled = true;
}

function handleGuessSubmit(event: Event): void {
  event.preventDefault();
  if (state.isGameOver || state.wordbank.length === 0) return;

  const inputWord = guessInput.value.trim().toLowerCase();
  if (!inputWord) return;

  const rawWord = determineRootWord(inputWord);

  if (!wordRankMap.has(rawWord)) {
    alert(`"${inputWord}" is not in the semantic database dictionary.`);
    guessInput.value = "";
    return;
  }

  const wordIndex = wordRankMap.get(rawWord)!;
  const computedRank = wordIndex + 1;

  const alreadyGuessed = state.guesses.some((g) => g.word === rawWord);
  if (alreadyGuessed) {
    alert(`You've already tried "${rawWord}"!`);
    guessInput.value = "";
    return;
  }

  const newGuess: Guess = {
    word: rawWord,
    rank: computedRank,
    timestamp: Date.now(),
  };

  state.guesses.push(newGuess);
  state.latestGuess = newGuess;
  guessInput.value = "";

  if (computedRank === 1) {
    state.isGameOver = true;
    hintDisplayContainer.innerHTML = "";
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    setTimeout(
      () =>
        alert(
          `🎉 Incredible! You found the secret word in ${state.guesses.length} attempts!`,
        ),
      250,
    );
  }

  renderGame();
}

guessForm.addEventListener("submit", handleGuessSubmit);
menuToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  menuOptions.classList.toggle("hidden");
});
document.addEventListener("click", () => {
  menuOptions.classList.add("hidden");
});
hintBtn.addEventListener("click", handleGetHint);
giveupBtn.addEventListener("click", handleGiveUp);

initGameEngine();
