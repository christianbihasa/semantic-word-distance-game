"""Builds the frontend's game data from word vectors.

Outputs (frontend/public/data/):
  vocab.json       every guessable, ranked word: dictionary headwords in base form, frequency order
  aliases.json     other word forms -> their vocabulary word ("held" -> "hold", "children" -> "child")
  embeddings.bin   int8 vectors (count x dim) followed by float32 inverse norms (count)
  manifest.json    content-hash version, layout, provenance and the secret-word list

Steps:
  --import-glove PATH   select the vocabulary from a local GloVe .txt (put it in raw_source/; its sha256
                        is recorded) and save its vectors to artifacts/. Needed after changing the
                        vocabulary rules in common.py.
  (always)              build frontend/public/data from artifacts/ and targets.txt

Secret words come from targets.txt, in daily-puzzle order, so rebuilding never reshuffles the daily
sequence. --reselect-targets regenerates that list (and therefore changes the sequence).
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path

import numpy as np

import common


def import_source(path: Path, scan_limit: int) -> None:
    all_words = common.read_glove_words(path, limit=None)
    surface_words = all_words[:scan_limit]
    morphology = common.Morphology()
    required = set(common.load_word_list(common.TARGETS_PATH)) if common.TARGETS_PATH.exists() else set()
    proper = common.proper_headwords()
    words, aliases = common.build_vocabulary(
        surface_words,
        common.wordnet_lemmas() | proper,
        morphology,
        required,
        in_source=set(all_words),
        never_merge=proper,
    )
    vectors = common.read_glove_for_words(path, words)
    provenance = {
        "source": path.name,
        "sha256": common.sha256_file(path),
        "imported": date.today().isoformat(),
        "scan_limit": scan_limit,
    }
    common.save_source(words, vectors, aliases, provenance)
    print(f"Imported {len(words)} words x {vectors.shape[1]} dims and {len(aliases)} aliases")


def reselect_targets(words: list[str], min_rank: int, max_rank: int) -> None:
    _, lowercase_words = common.english_words()
    headwords = lowercase_words & common.wordnet_lemmas()
    targets = common.select_targets(words, headwords, common.load_blocklist(), min_rank, max_rank)
    header = "# Secret words, in daily-puzzle order. Editing this list changes the daily sequence.\n"
    common.TARGETS_PATH.write_text(header + "\n".join(targets) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote {len(targets)} targets to {common.TARGETS_PATH.name}")


def write_fixture(words: list[str], vectors: np.ndarray, q: np.ndarray, inv_norm: np.ndarray) -> None:
    """Expected rankings the frontend test compares against, plus a quantisation-quality check."""
    index = {w: i for i, w in enumerate(words)}
    samples = [t for t in ("cheese", "ocean", "king", "music", "doctor", "microscope") if t in index]
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


def build() -> None:
    words, vectors, aliases, provenance = common.load_source()
    targets = common.load_word_list(common.TARGETS_PATH)
    missing = sorted(set(targets) - set(words))
    if missing:
        raise SystemExit(f"{len(missing)} secret words missing from the vocabulary, e.g. {missing[:5]}; re-import")

    q, inv_norm = common.quantize(vectors)
    payload = q.tobytes() + inv_norm.tobytes()
    vocab_json = json.dumps(words, separators=(",", ":")).encode("utf-8")
    aliases_json = json.dumps(aliases, separators=(",", ":"), sort_keys=True).encode("utf-8")
    version = hashlib.sha256(vocab_json + aliases_json + payload).hexdigest()[:12]

    out = common.OUTPUT_DIR
    out.mkdir(parents=True, exist_ok=True)
    (out / "vocab.json").write_bytes(vocab_json)
    (out / "aliases.json").write_bytes(aliases_json)
    (out / "embeddings.bin").write_bytes(payload)
    manifest = {
        "version": version,
        "count": len(words),
        "dim": int(vectors.shape[1]),
        "files": {"vocab": "vocab.json", "aliases": "aliases.json", "embeddings": "embeddings.bin"},
        "layout": "int8[count*dim] then float32[count] inverse norms",
        "provenance": provenance,
        "targets": targets,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    write_fixture(words, vectors, q, inv_norm)

    print(f"Wrote {out}: {len(words)} words, {len(aliases)} aliases, {len(targets)} targets, version {version}")
    print(
        f"embeddings.bin {len(payload) / 1e6:.2f} MB, vocab.json {len(vocab_json) / 1e6:.2f} MB, "
        f"aliases.json {len(aliases_json) / 1e6:.2f} MB"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--import-glove", type=Path, help="Local GloVe .txt file to import")
    parser.add_argument(
        "--scan-limit", type=int, default=common.GLOVE_SCAN_LIMIT, help="How many frequent GloVe words to consider"
    )
    parser.add_argument("--reselect-targets", action="store_true", help="Regenerate targets.txt (changes daily order)")
    parser.add_argument("--min-rank", type=int, default=400, help="--reselect-targets: skip the N most frequent words")
    parser.add_argument("--max-rank", type=int, default=12000, help="--reselect-targets: only words this common")
    args = parser.parse_args()

    if args.import_glove:
        import_source(args.import_glove, args.scan_limit)
    if args.reselect_targets:
        words, *_ = common.load_source()
        reselect_targets(words, args.min_rank, args.max_rank)
    build()


if __name__ == "__main__":
    main()
