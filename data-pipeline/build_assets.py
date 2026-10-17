"""Builds the frontend's game data from word vectors.

Outputs (frontend/public/data/):
  vocab.json       every guessable word, in frequency order
  embeddings.bin   int8 vectors (count x dim) followed by float32 inverse norms (count)
  manifest.json    content-hash version, layout, provenance and the secret-word list

Vector source:
  --import-glove PATH   a local GloVe .txt you downloaded yourself (put it in raw_source/; its sha256
                        is recorded). Keeps the current artifacts/words.json vocabulary and order, so
                        secret words and the daily sequence do not change; add --rebuild-vocab to
                        re-select the vocabulary from the file instead.
  (default)             artifacts/vectors.f16.npy + artifacts/words.json from the last import
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

import numpy as np

import common


def import_source(args: argparse.Namespace) -> None:
    path: Path = args.import_glove
    if args.rebuild_vocab or not common.WORDS_PATH.exists():
        dictionary, _ = common.english_words()
        words, vectors = common.read_glove_text(path, dictionary, args.max_words)
    else:
        words = json.loads(common.WORDS_PATH.read_text(encoding="utf-8"))
        vectors = common.read_glove_for_words(path, words)
    provenance = {
        "source": path.name,
        "sha256": common.sha256_file(path),
        "imported": date.today().isoformat(),
    }
    common.save_source(words, vectors, provenance)
    print(f"Imported {len(words)} words x {vectors.shape[1]} dims into {common.ARTIFACTS_DIR}")


def write_fixture(
    words: list[str], vectors: np.ndarray, q: np.ndarray, inv_norm: np.ndarray, targets: list[str]
) -> None:
    """Expected rankings the frontend test compares against, plus a quantisation-quality check."""
    index = {w: i for i, w in enumerate(words)}
    samples = [t for t in ("cheese", "ocean", "king", "music", "doctor") if t in index] or targets[:5]
    fixture = {}
    overlaps = []
    for word in samples:
        quantized = common.rank_quantized(q, inv_norm, index[word])
        exact = common.rank_exact(vectors, index[word])
        fixture[word] = [words[i] for i in quantized[:50]]
        overlaps.append(len(set(quantized[1:21]) & set(exact[1:21])) / 20)
    common.FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    common.FIXTURE_PATH.write_text(json.dumps(fixture, indent=1), encoding="utf-8")
    print(f"int8 vs exact top-20 overlap: {np.mean(overlaps):.0%} (samples: {', '.join(samples)})")


def build(args: argparse.Namespace) -> None:
    words, vectors, provenance = common.load_source()
    _, lowercase_words = common.english_words()
    headwords = lowercase_words & common.wordnet_lemmas()
    targets = common.select_targets(words, headwords, common.load_blocklist(), args.min_rank, args.max_rank)

    q, inv_norm = common.quantize(vectors)
    payload = q.tobytes() + inv_norm.tobytes()
    vocab_json = json.dumps(words, separators=(",", ":")).encode("utf-8")
    version = hashlib.sha256(vocab_json + payload).hexdigest()[:12]

    out = common.OUTPUT_DIR
    out.mkdir(parents=True, exist_ok=True)
    (out / "vocab.json").write_bytes(vocab_json)
    (out / "embeddings.bin").write_bytes(payload)
    manifest = {
        "version": version,
        "count": len(words),
        "dim": int(vectors.shape[1]),
        "files": {"vocab": "vocab.json", "embeddings": "embeddings.bin"},
        "layout": "int8[count*dim] then float32[count] inverse norms",
        "provenance": provenance,
        "targets": targets,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    write_fixture(words, vectors, q, inv_norm, targets)

    print(f"Wrote {out}: {len(words)} words, {len(targets)} targets, version {version}")
    print(f"embeddings.bin {len(payload) / 1e6:.2f} MB, vocab.json {len(vocab_json) / 1e6:.2f} MB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--import-glove", type=Path, help="Local GloVe .txt file to import")
    parser.add_argument("--rebuild-vocab", action="store_true", help="Re-select the vocabulary from the GloVe file")
    parser.add_argument("--max-words", type=int, default=50000, help="Vocabulary size for --rebuild-vocab")
    parser.add_argument("--min-rank", type=int, default=400, help="Skip the N most frequent words as targets")
    parser.add_argument("--max-rank", type=int, default=12000, help="Only words this common can be targets")
    args = parser.parse_args()

    if args.import_glove:
        import_source(args)
    build(args)


if __name__ == "__main__":
    main()
