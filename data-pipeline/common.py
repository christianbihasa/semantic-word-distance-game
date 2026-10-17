"""Shared paths, vocabulary rules, vector I/O and ranking maths for the data pipeline.

Every path is anchored to this file, so scripts work from any working directory.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Callable
from pathlib import Path

import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = PIPELINE_DIR / "artifacts"
VECTORS_PATH = ARTIFACTS_DIR / "vectors.f16.npy"
WORDS_PATH = ARTIFACTS_DIR / "words.json"
ALIASES_PATH = ARTIFACTS_DIR / "aliases.json"
PROVENANCE_PATH = ARTIFACTS_DIR / "provenance.json"
BLOCKLIST_PATH = PIPELINE_DIR / "blocklist.txt"
TARGETS_PATH = PIPELINE_DIR / "targets.txt"

FRONTEND_DIR = PIPELINE_DIR.parent / "frontend"
OUTPUT_DIR = FRONTEND_DIR / "public" / "data"
FIXTURE_PATH = FRONTEND_DIR / "tests" / "fixtures" / "ranking.json"

WORD_RE = re.compile(r"^[a-z]+$")

# GloVe lists words by corpus frequency; the vocabulary is drawn from this many of the most frequent.
GLOVE_SCAN_LIMIT = 150_000

# Most two-letter dictionary entries are abbreviations (cd, ml); these are real words that
# other forms map to (was -> be, went -> go).
TWO_LETTER_WORDS = frozenset({"ad", "ax", "be", "do", "go", "ox", "tv", "up"})


# ─── Vocabulary rules ─────────────────────────────────────────


def _wordnet():
    import nltk

    nltk.download("wordnet", quiet=True)
    from nltk.corpus import wordnet as wn

    return wn


def wordnet_lemmas() -> set[str]:
    """Single-word lowercase WordNet lemmas: dictionary headwords, which excludes most names."""
    wn = _wordnet()
    return {
        lemma.name()
        for synset in wn.all_synsets()
        for lemma in synset.lemmas()
        if lemma.name().isalpha() and lemma.name().islower()
    }


class Morphology:
    """WordNet-backed answers to "what is this word's base form?" and "how common is this headword?"."""

    def __init__(self) -> None:
        self._wn = _wordnet()
        self._counts: dict[str, int] = {}

    def bases(self, word: str) -> list[tuple[str, str]]:
        """(base, part of speech) pairs for `word` (held -> hold/v, mice -> mouse/n), excluding itself."""
        out: list[tuple[str, str]] = []
        for pos in ("n", "v", "a", "r"):
            for base in self._wn._morphy(word, pos):
                if base != word and (base, pos) not in out:
                    out.append((base, pos))
        return out

    def own_count(self, word: str, pos: str | None = None) -> int:
        """How often `word` itself heads a sense in WordNet's tagged corpus, plus one.

        With `pos`, only senses of that part of speech count: "din" is common as a noun (noise) but
        almost never a verb, so as the base of "dining" it loses to "dine".
        """
        key = f"{word}/{pos}"
        if key not in self._counts:
            self._counts[key] = 1 + sum(
                lemma.count()
                for synset in self._wn.synsets(word, pos)
                for lemma in synset.lemmas()
                if lemma.name() == word
            )
        return self._counts[key]

    def has_noun_sense(self, word: str) -> bool:
        """True if `word` is itself a noun headword (saw, rose, ground), not just a form of another word."""
        return any(lemma.name() == word for synset in self._wn.synsets(word, "n") for lemma in synset.lemmas())


# A form stays its own word if it is at least this common, relative to its base, in its own right.
OWN_SENSE_RATIO = 0.1


def _best_base(known: list[tuple[str, str]], own_count: Callable[[str, str | None], int]) -> tuple[str, str]:
    """Prefer a noun base (stripes -> stripe, not strip), then the one most used in that part of speech."""
    nouns = [(b, pos) for b, pos in known if pos == "n"]
    return max(nouns or known, key=lambda bp: own_count(bp[0], bp[1]))


def _is_irregular(word: str, base: str) -> bool:
    """saw/see, rose/rise, better/good: the form does not start like its base."""
    return not word.startswith(base[:3])


def _is_playable(word: str) -> bool:
    return bool(WORD_RE.match(word)) and (len(word) >= 3 or word in TWO_LETTER_WORDS)


def build_vocabulary(
    surface_words: list[str],
    headwords: set[str],
    morph: Morphology,
    required: set[str],
    in_source: set[str] | None = None,
) -> tuple[list[str], dict[str, str]]:
    """Chooses the guessable, ranked vocabulary and an alias map for other word forms.

    `surface_words` is in frequency order. A dictionary headword joins the vocabulary unless it is
    mainly an inflection of another headword: "years" -> "year" and "scanning" -> "scan" merge, while
    forms that are words in their own right stay ("physics", "news", "building", "glasses", and
    irregular homographs such as "saw", "rose", "ground"). Any other form whose base is in the
    vocabulary becomes an alias ("held" -> "hold", "children" -> "child"). `required` words (the
    secret words) are always kept.

    A common form also pulls in its dictionary base even when the base itself is rarer ("footsteps"
    brings in "footstep"), as long as `in_source` (the words that have vectors) contains it.
    """
    candidates: list[str] = []
    candidate_set: set[str] = set()

    def add(word: str) -> None:
        if word not in candidate_set and word in headwords and _is_playable(word):
            if in_source is None or word in in_source:
                candidates.append(word)
                candidate_set.add(word)

    for word in surface_words:
        if not WORD_RE.match(word):
            continue
        add(word)
        for base, _ in morph.bases(word):
            add(base)
    vocab: list[str] = []
    merged: dict[str, str] = {}
    for word in candidates:
        known = [(b, pos) for b, pos in morph.bases(word) if b in candidate_set]
        if word not in required and known:
            best, best_pos = _best_base(known, morph.own_count)
            own = morph.own_count(word)  # 1 means no corpus evidence of its own
            # Compare against the base's use in the part of speech the form derives from: "landing"
            # vs. the verb "land", not the very common noun "land".
            own_sense = own > 1 and own >= OWN_SENSE_RATIO * morph.own_count(best, best_pos)
            homograph = _is_irregular(word, best) and morph.has_noun_sense(word)
            if not (own_sense or homograph):
                merged[word] = best
                continue
        vocab.append(word)
    vocab += sorted(required - set(vocab))
    vocab_set = set(vocab)

    def resolve(word: str) -> str | None:
        for _ in range(3):  # follow short chains, e.g. a merged form whose base was merged too
            if word in vocab_set:
                return word
            word = merged.get(word, "")
        return None

    aliases: dict[str, str] = {}
    for word in surface_words:
        if word in vocab_set or not WORD_RE.match(word):
            continue
        if word in merged:
            target = resolve(word)
        else:
            known = [(b, pos) for b, pos in morph.bases(word) if resolve(b)]
            target = resolve(_best_base(known, morph.own_count)[0]) if known else None
        if target:
            aliases[word] = target
    return vocab, aliases


def english_words() -> tuple[set[str], set[str]]:
    """Returns (all words lowercased, words that appear lowercase in the corpus)."""
    import nltk

    nltk.download("words", quiet=True)
    from nltk.corpus import words

    raw = words.words()
    return {w.lower() for w in raw}, {w for w in raw if w.islower()}


def load_word_list(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [ln.strip().lower() for ln in lines if ln.strip() and not ln.startswith("#")]


def load_blocklist(path: Path = BLOCKLIST_PATH) -> set[str]:
    return set(load_word_list(path))


def inflection_roots(word: str) -> list[str]:
    """Mirrors the frontend's stemWord candidates: roots this word could be an inflection of."""
    roots: list[str] = []
    if word.endswith("ies"):
        roots.append(word[:-3] + "y")
    if word.endswith("ves"):
        roots += [word[:-3] + "f", word[:-3] + "fe"]
    if word.endswith("es"):
        roots.append(word[:-2])
    if word.endswith("s") and not word.endswith("ss"):
        roots.append(word[:-1])
    for suffix in ("ed", "ing"):
        if word.endswith(suffix):
            root = word[: -len(suffix)]
            roots += [root, root + "e"]
            if len(root) > 1 and root[-1] == root[-2] and root[-1] not in "aeiou":
                roots.append(root[:-1])
    return [r for r in roots if len(r) >= 2]


def select_targets(
    words: list[str],
    headwords: set[str],
    blocklist: set[str],
    min_rank: int,
    max_rank: int,
) -> list[str]:
    """Picks good secret words: common, dictionary headwords (not names), base forms, not blocklisted.

    `words` is in corpus frequency order, so list position is a frequency rank. `headwords` is the
    set of acceptable lowercase dictionary entries (see `english_words` and `wordnet_lemmas`).
    """
    vocab = set(words)
    targets = []
    for rank, word in enumerate(words):
        if not (min_rank <= rank < max_rank):
            continue
        if not (4 <= len(word) <= 10) or word not in headwords or word in blocklist:
            continue
        if any(root in vocab for root in inflection_roots(word)):
            continue  # prefer "cheese" over "cheeses"
        targets.append(word)
    return targets


# ─── Vector sources ───────────────────────────────────────────


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_glove_words(path: Path, limit: int | None) -> list[str]:
    """The words of a GloVe .txt file, most frequent first (the first `limit`, or all if None)."""
    words: list[str] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            words.append(line.partition(" ")[0])
            if limit is not None and len(words) >= limit:
                break
    return words


def read_glove_for_words(path: Path, words: list[str]) -> np.ndarray:
    """Reads vectors for exactly `words` (in that order) from a local GloVe .txt file."""
    wanted = {w: i for i, w in enumerate(words)}
    rows: list[np.ndarray | None] = [None] * len(words)
    with path.open(encoding="utf-8") as f:
        for line in f:
            word, _, rest = line.partition(" ")
            i = wanted.get(word)
            if i is not None and rows[i] is None:
                rows[i] = np.asarray(rest.split(), dtype=np.float32)
    missing = [words[i] for i, row in enumerate(rows) if row is None]
    if missing:
        raise ValueError(f"{len(missing)} vocabulary words are missing from {path.name}, e.g. {missing[:5]}")
    return np.vstack(rows)  # type: ignore[arg-type]


def save_source(words: list[str], vectors: np.ndarray, aliases: dict[str, str], provenance: dict) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    np.save(VECTORS_PATH, vectors.astype(np.float16))
    WORDS_PATH.write_text(json.dumps(words, separators=(",", ":")), encoding="utf-8")
    ALIASES_PATH.write_text(json.dumps(aliases, separators=(",", ":"), sort_keys=True), encoding="utf-8")
    PROVENANCE_PATH.write_text(json.dumps(provenance, indent=2), encoding="utf-8")


def load_source() -> tuple[list[str], np.ndarray, dict[str, str], dict]:
    words = json.loads(WORDS_PATH.read_text(encoding="utf-8"))
    vectors = np.load(VECTORS_PATH).astype(np.float32)
    aliases = json.loads(ALIASES_PATH.read_text(encoding="utf-8"))
    provenance = json.loads(PROVENANCE_PATH.read_text(encoding="utf-8"))
    if len(words) != len(vectors):
        raise ValueError(f"{len(words)} words but {len(vectors)} vectors")
    return words, vectors, aliases, provenance


# ─── Quantisation and ranking (must match frontend/src/ranking.ts) ───


def quantize(vectors: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Per-row int8 quantisation. Returns (int8 rows, float32 inverse L2 norm of each int8 row)."""
    peak = np.abs(vectors).max(axis=1, keepdims=True)
    peak[peak == 0] = 1.0
    q = np.round(vectors / peak * 127).astype(np.int8)
    norms = np.linalg.norm(q.astype(np.float32), axis=1)
    norms[norms == 0] = 1.0
    return q, (1.0 / norms).astype(np.float32)


def rank_quantized(q: np.ndarray, inv_norm: np.ndarray, target: int) -> np.ndarray:
    """Word indices ordered by cosine similarity to `target` (target first), ties by index.

    Integer dot products are exact; scaling by the float32 inverse norm and rounding to float32
    reproduces the browser's Float32Array arithmetic bit for bit.
    """
    dots = q.astype(np.int32) @ q[target].astype(np.int32)
    scores = (dots.astype(np.float64) * inv_norm.astype(np.float64)).astype(np.float32)
    scores[target] = np.inf
    return np.argsort(-scores, kind="stable")


def rank_exact(vectors: np.ndarray, target: int) -> np.ndarray:
    unit = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
    scores = unit @ unit[target]
    scores[target] = np.inf
    return np.argsort(-scores, kind="stable")
