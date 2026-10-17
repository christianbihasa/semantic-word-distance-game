"""Scores word-embedding models against golden.json, using the game's vocabulary and ranking rules.

Usage:
  python evaluate.py [MODEL ...] [--pca N ...] [--detail] [--report PATH]

MODEL is NAME=SOURCE, where SOURCE is:
  current             artifacts/vectors.f16.npy (what the game ships now; the default)
  path/to/file        a GloVe .txt, fastText .vec or ConceptNet Numberbatch .txt, optionally .gz
  a+b                 a blend of two models named earlier (ranks by their average cosine)

Examples:
  python evaluate.py
  python evaluate.py glove=current nb=raw_source/numberbatch-en-19.08.txt.gz blend=glove+nb --pca 128

Metrics, per target and averaged:
  hit@100   share of the golden words the model ranks in its top 100 (what players see as hot)
  hit@1000  share ranked in the top 1,000 (hot or warm)
  median    median rank of the golden words (lower is better)
  spearman  rank correlation with a full reference list, where golden.json has one (1.0 = same order)
Golden words are resolved the way a guess is (exact word, then aliases.json); words the game cannot
accept at all are listed as vocabulary gaps and left out of the scores.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

import common
from common import normalise, read_text_vectors

GOLDEN_PATH = common.PIPELINE_DIR / "golden.json"


# ─── Models ───────────────────────────────────────────────────


@dataclass
class Model:
    name: str
    words: list[str]  # game-vocabulary words this model has vectors for
    unit: np.ndarray  # L2-normalised vectors, one row per word
    index: dict[str, int] = field(init=False)

    def __post_init__(self) -> None:
        self.index = {w: i for i, w in enumerate(self.words)}

    @property
    def dim(self) -> int:
        return self.unit.shape[1]


def load_model(name: str, source: str, vocab: list[str]) -> Model:
    if source == "current":
        words, vectors, _, _ = common.load_source()
        return Model(name, words, normalise(vectors))
    found = read_text_vectors(Path(source), set(vocab))
    words = [w for w in vocab if w in found]
    if not words:
        raise SystemExit(f"{source}: none of the game's words were found")
    return Model(name, words, normalise(np.vstack([found[w] for w in words])))


def blend(name: str, a: Model, b: Model) -> Model:
    """Concatenating unit vectors scaled by 1/sqrt(2) makes cosine = mean of the two models' cosines."""
    words = [w for w in a.words if w in b.index]
    ua = a.unit[[a.index[w] for w in words]]
    ub = b.unit[[b.index[w] for w in words]]
    return Model(name, words, np.hstack([ua, ub]) / np.sqrt(2))


def reduce_pca(model: Model, dims: int) -> Model:
    centred = model.unit - model.unit.mean(axis=0)
    _, _, components = np.linalg.svd(centred, full_matrices=False)
    return Model(f"{model.name}@pca{dims}", model.words, normalise(centred @ components[:dims].T))


# ─── Scoring ──────────────────────────────────────────────────


def ranks_for(model: Model, target: str) -> dict[str, int]:
    """Rank of every word (target = 1), exactly as the game orders them."""
    sims = model.unit @ model.unit[model.index[target]]
    sims[model.index[target]] = np.inf
    order = np.argsort(-sims, kind="stable")
    return {model.words[i]: r + 1 for r, i in enumerate(order)}


def spearman(xs: list[float], ys: list[float]) -> float:
    """Spearman rank correlation (average ranks for ties)."""

    def to_ranks(values: list[float]) -> np.ndarray:
        arr = np.asarray(values, dtype=float)
        order = arr.argsort(kind="stable")
        ranks = np.empty(len(arr))
        ranks[order] = np.arange(1, len(arr) + 1)
        for v in np.unique(arr):  # average tied ranks
            mask = arr == v
            ranks[mask] = ranks[mask].mean()
        return ranks

    rx, ry = to_ranks(xs), to_ranks(ys)
    if rx.std() == 0 or ry.std() == 0:
        return float("nan")
    return float(np.corrcoef(rx, ry)[0, 1])


@dataclass
class TargetScore:
    target: str
    hit100: float
    hit1000: float
    median: float
    spearman: float | None
    worst: list[tuple[str, int]]  # golden words this model ranks furthest away


def resolve(word: str, vocab: set[str], aliases: dict[str, str]) -> str | None:
    """What the game counts a typed word as (exact, then alias), or None if it rejects it."""
    if word in vocab:
        return word
    alias = aliases.get(word)
    return alias if alias in vocab else None


def score_target(model: Model, target: str, near: list[str], reference: dict[str, int] | None) -> TargetScore:
    ranks = ranks_for(model, target)
    worst_rank = len(model.words) + 1
    golden = [ranks.get(w, worst_rank) for w in near]
    worst = sorted(zip(near, golden, strict=True), key=lambda p: -p[1])[:5]
    rho = None
    if reference:
        pairs = [(r, ranks.get(w, worst_rank)) for w, r in reference.items() if w != target]
        rho = spearman([p[0] for p in pairs], [p[1] for p in pairs])
    present = [w in ranks for w in near]  # a word the model has no vector for is never a hit
    return TargetScore(
        target,
        hit100=float(np.mean([ok and r <= 100 for ok, r in zip(present, golden, strict=True)])),
        hit1000=float(np.mean([ok and r <= 1000 for ok, r in zip(present, golden, strict=True)])),
        median=float(np.median(golden)),
        spearman=rho,
        worst=worst,
    )


def load_golden(vocab: set[str], aliases: dict[str, str]):
    """Golden targets resolved through the game's own guess handling, plus the words it rejects."""
    raw = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))["targets"]
    golden, gaps = {}, {}
    for target, spec in raw.items():
        resolved, missing = [], []
        for word in spec["near"]:
            r = resolve(word, vocab, aliases)
            if r is None:
                missing.append(word)
            elif r != target and r not in resolved:
                resolved.append(r)
        reference = None
        if "reference" in spec:
            reference = {}
            for word, rank in spec["reference"].items():
                r = resolve(word, vocab, aliases)
                if r and r not in reference:
                    reference[r] = rank
        golden[target] = (resolved, reference)
        if missing:
            gaps[target] = missing
    return golden, gaps


# ─── Report ───────────────────────────────────────────────────


def summarise(model: Model, scores: list[TargetScore]) -> dict:
    rhos = [s.spearman for s in scores if s.spearman is not None]
    return {
        "model": model.name,
        "dim": model.dim,
        "coverage": len(model.words),
        "hit100": np.mean([s.hit100 for s in scores]),
        "hit1000": np.mean([s.hit1000 for s in scores]),
        "median": float(np.median([s.median for s in scores])),
        "spearman": float(np.mean(rhos)) if rhos else None,
    }


def render(summaries: list[dict], per_model: dict[str, list[TargetScore]], gaps: dict, vocab_size: int, detail: bool):
    lines = ["| model | dims | words covered | hit@100 | hit@1000 | median rank | spearman (ref) |"]
    lines.append("|---|---:|---:|---:|---:|---:|---:|")
    for s in summaries:
        rho = f"{s['spearman']:.2f}" if s["spearman"] is not None else "-"
        lines.append(
            f"| {s['model']} | {s['dim']} | {s['coverage']:,}/{vocab_size:,} | {s['hit100']:.0%} | "
            f"{s['hit1000']:.0%} | {s['median']:,.0f} | {rho} |"
        )
    if detail:
        for name, scores in per_model.items():
            lines += ["", f"### {name}", "", "| target | hit@100 | hit@1000 | median | furthest golden words |"]
            lines.append("|---|---:|---:|---:|---|")
            for s in scores:
                far = ", ".join(f"{w} #{r:,}" for w, r in s.worst)
                lines.append(f"| {s.target} | {s.hit100:.0%} | {s.hit1000:.0%} | {s.median:,.0f} | {far} |")
    if gaps:
        lines += ["", "Golden words the game rejects (vocabulary gaps, not scored):", ""]
        lines += [f"- {t}: {', '.join(ws)}" for t, ws in gaps.items()]
    return "\n".join(lines)


def parse_models(specs: list[str]) -> list[tuple[str, str]]:
    out = []
    for spec in specs or ["current=current"]:
        name, sep, source = spec.partition("=")
        out.append((name, source) if sep else (Path(spec).stem, spec))
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("models", nargs="*", help="NAME=SOURCE (see above); default: current=current")
    parser.add_argument("--pca", type=int, action="append", default=[], help="Also score PCA-reduced variants")
    parser.add_argument("--detail", action="store_true", help="Per-target breakdown")
    parser.add_argument("--report", type=Path, help="Also write the results to this Markdown file")
    args = parser.parse_args()

    vocab = json.loads(common.WORDS_PATH.read_text(encoding="utf-8"))
    aliases = json.loads(common.ALIASES_PATH.read_text(encoding="utf-8"))
    golden, gaps = load_golden(set(vocab), aliases)

    models: dict[str, Model] = {}
    for name, source in parse_models(args.models):
        if "+" in source and not Path(source).exists():
            a, b = source.split("+", 1)
            models[name] = blend(name, models[a], models[b])
        else:
            print(f"loading {name} from {source} ...", flush=True)
            models[name] = load_model(name, source, vocab)
    for dims in args.pca:
        for base in list(models.values()):
            if dims < base.dim and "@pca" not in base.name:
                reduced = reduce_pca(base, dims)
                models[reduced.name] = reduced

    per_model, summaries = {}, []
    for model in models.values():
        scores = []
        for target, (near, reference) in golden.items():
            if target in model.index:
                scores.append(score_target(model, target, near, reference))
            else:
                print(f"  {model.name}: no vector for target '{target}', skipped")
        per_model[model.name] = scores
        summaries.append(summarise(model, scores))

    report = render(summaries, per_model, gaps, len(vocab), args.detail)
    print()
    print(report)
    if args.report:
        args.report.write_text(report + "\n", encoding="utf-8")
        print(f"\nWrote {args.report}")


if __name__ == "__main__":
    main()
