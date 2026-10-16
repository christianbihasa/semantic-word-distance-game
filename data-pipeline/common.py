"""Shared paths, vocabulary rules, vector I/O and ranking maths for the data pipeline.

Every path is anchored to this file, so scripts work from any working directory.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import numpy as np

PIPELINE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = PIPELINE_DIR / "artifacts"
VECTORS_PATH = ARTIFACTS_DIR / "vectors.f16.npy"
WORDS_PATH = ARTIFACTS_DIR / "words.json"
PROVENANCE_PATH = ARTIFACTS_DIR / "provenance.json"
BLOCKLIST_PATH = PIPELINE_DIR / "blocklist.txt"

FRONTEND_DIR = PIPELINE_DIR.parent / "frontend"
OUTPUT_DIR = FRONTEND_DIR / "public" / "data"
FIXTURE_PATH = FRONTEND_DIR / "tests" / "fixtures" / "ranking.json"

WORD_RE = re.compile(r"^[a-z]+$")


# ─── Vocabulary rules ─────────────────────────────────────────


def english_words() -> tuple[set[str], set[str]]:
    """Returns (all words lowercased, words that appear lowercase in the corpus)."""
    import nltk

    nltk.download("words", quiet=True)
    from nltk.corpus import words

    raw = words.words()
    return {w.lower() for w in raw}, {w for w in raw if w.islower()}


def wordnet_lemmas() -> set[str]:
    """Single-word lowercase WordNet lemmas: dictionary headwords, which excludes most names."""
    import nltk

    nltk.download("wordnet", quiet=True)
    from nltk.corpus import wordnet as wn

    return {
        lemma.name()
        for synset in wn.all_synsets()
        for lemma in synset.lemmas()
        if lemma.name().isalpha() and lemma.name().islower()
    }


def is_guessable(word: str, dictionary: set[str]) -> bool:
    """Any real, plain-letter English word of playable length can be guessed."""
    return bool(WORD_RE.match(word)) and 3 <= len(word) <= 12 and word in dictionary


def load_blocklist(path: Path = BLOCKLIST_PATH) -> set[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return {ln.strip().lower() for ln in lines if ln.strip() and not ln.startswith("#")}


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


def read_glove_text(path: Path, dictionary: set[str], max_words: int) -> tuple[list[str], np.ndarray]:
    """Reads a local GloVe .txt file (frequency ordered), keeping the first `max_words` guessable words."""
    words: list[str] = []
    rows: list[np.ndarray] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip().split(" ")
            word = parts[0]
            if not is_guessable(word, dictionary):
                continue
            words.append(word)
            rows.append(np.asarray(parts[1:], dtype=np.float32))
            if len(words) >= max_words:
                break
    return words, np.vstack(rows)


def read_annoy_vectors(ann_path: Path, count: int, dim: int) -> np.ndarray:
    """Reads item vectors straight from an Annoy 'angular' index file, without the annoy package.

    Items 0..count-1 are stored first as {int32 n_descendants; int32 children[2]; float32 v[dim]}.
    """
    node = np.dtype([("n_descendants", "<i4"), ("children", "<i4", 2), ("v", "<f4", dim)])
    nodes = np.fromfile(ann_path, dtype=node, count=count)
    if len(nodes) != count or not np.all(nodes["n_descendants"] == 1):
        raise ValueError(f"{ann_path} does not start with {count} item nodes of dimension {dim}")
    return nodes["v"].copy()


def save_source(words: list[str], vectors: np.ndarray, provenance: dict) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    np.save(VECTORS_PATH, vectors.astype(np.float16))
    WORDS_PATH.write_text(json.dumps(words, separators=(",", ":")), encoding="utf-8")
    PROVENANCE_PATH.write_text(json.dumps(provenance, indent=2), encoding="utf-8")


def load_source() -> tuple[list[str], np.ndarray, dict]:
    words = json.loads(WORDS_PATH.read_text(encoding="utf-8"))
    vectors = np.load(VECTORS_PATH).astype(np.float32)
    provenance = json.loads(PROVENANCE_PATH.read_text(encoding="utf-8"))
    if len(words) != len(vectors):
        raise ValueError(f"{len(words)} words but {len(vectors)} vectors")
    return words, vectors, provenance


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
