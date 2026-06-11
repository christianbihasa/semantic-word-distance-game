import os
import json
import argparse
from annoy import AnnoyIndex
import os
import json
import argparse
from annoy import AnnoyIndex
from multiprocessing import Pool
from functools import partial

ARTIFACTS_DIR = os.path.join("artifacts")
OUT_DIR = os.path.join("..", "frontend", "public", "topk")
os.makedirs(OUT_DIR, exist_ok=True)


def load_index_meta(prefix=os.path.join(ARTIFACTS_DIR, "annoy_index")):
    with open(f"{prefix}_words.json", "r", encoding="utf-8") as f:
        words = json.load(f)
    with open(f"{prefix}_meta.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
    DIM = meta.get("dim")
    return prefix, words, meta


# Worker globals (initialized per process)
_ANN_INDEX = None
_ANN_WORDS = None
_ANN_DIM = None
_ANN_PREFIX = None


def _init_worker(prefix, dim):
    global _ANN_INDEX, _ANN_WORDS, _ANN_DIM, _ANN_PREFIX
    _ANN_PREFIX = prefix
    _ANN_DIM = dim
    _ANN_INDEX = AnnoyIndex(_ANN_DIM, 'angular')
    _ANN_INDEX.load(f"{prefix}.ann")
    # load words list once per worker
    with open(f"{prefix}_words.json", "r", encoding="utf-8") as f:
        _ANN_WORDS = json.load(f)


def _process_target(idx, k, output_format, out_dir, wordbank_version=None):
    # uses global _ANN_INDEX and _ANN_WORDS
    global _ANN_INDEX, _ANN_WORDS
    if _ANN_INDEX is None or _ANN_WORDS is None:
        raise RuntimeError("Worker not initialized with ANN index")

    nns, dists = _ANN_INDEX.get_nns_by_item(idx, k + 1, include_distances=True)
    paired = []
    for nid, dist in zip(nns, dists):
        if nid == idx:
            continue
        # convert distance (angular/cosine) to similarity-like score
        score = max(0.0, 1.0 - dist)
        paired.append((_ANN_WORDS[nid], float(score)))
        if len(paired) >= k:
            break

    target_word = _ANN_WORDS[idx]
    out_path = os.path.join(out_dir, f"{target_word}.json")
    # write with metadata
    if output_format == 'words':
        payload = {
            "wordbank_version": wordbank_version or f"v{int(os.path.getmtime(f'{_ANN_PREFIX}.ann'))}",
            "entries": [w for w, s in paired]
        }
    else:
        payload = {
            "wordbank_version": wordbank_version or f"v{int(os.path.getmtime(f'{_ANN_PREFIX}.ann'))}",
            "entries": [{"w": w, "s": s} for w, s in paired]
        }

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False)

    return target_word


def compute_topk_parallel(prefix, words, meta, k=200, pool_indices=None, out_dir=OUT_DIR, workers=4, output_format='scores', wordbank_version=None):
    if pool_indices is None:
        pool_indices = list(range(len(words)))

    print(f"Computing top-{k} for {len(pool_indices)} targets using {workers} workers...")

    # start pool with initializer to avoid reloading index per task
    init = partial(_init_worker, prefix, meta.get('dim'))
    with Pool(processes=workers, initializer=init) as p:
        func = partial(_process_target, k=k, output_format=output_format, out_dir=out_dir, wordbank_version=wordbank_version)
        # map returns list of target words that were written
        results = p.map(func, pool_indices)

    # write targets.json with version
    targets_meta = {"wordbank_version": wordbank_version or str(int(os.path.getmtime(f"{prefix}.ann"))),
                    "targets": results}
    with open(os.path.join(out_dir, "targets.json"), "w", encoding='utf-8') as f:
        json.dump(targets_meta, f, ensure_ascii=False)

    print("Top-K computation complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--k", type=int, default=200, help="Top K neighbors to compute")
    parser.add_argument("--pool-size", type=int, default=1000, help="Number of targets to compute (0 = all)")
    parser.add_argument("--pool-mode", choices=["random", "frequency", "all"], default="random", help="How to select targets from index")
    parser.add_argument("--freq-file", type=str, default=None, help="Optional JSON file mapping word->frequency for frequency-based selection")
    parser.add_argument("--workers", type=int, default=max(1, os.cpu_count() or 4), help="Number of parallel worker processes")
    parser.add_argument("--output-format", choices=["scores", "words"], default="scores", help="Output entries as objects with scores or words-only")
    parser.add_argument("--version", type=str, default=None, help="Explicit wordbank_version to inject into outputs")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--prefix", type=str, default=os.path.join(ARTIFACTS_DIR, "annoy_index"), help="Annoy index prefix path")
    args = parser.parse_args()

    prefix, words, meta = load_index_meta(args.prefix)

    import random
    random.seed(args.seed)

    # Build pool indices according to mode
    if args.pool_mode == 'all':
        pool = list(range(len(words)))
    elif args.pool_mode == 'frequency' and args.freq_file:
        with open(args.freq_file, 'r', encoding='utf-8') as f:
            freq = json.load(f)
        # sort words by provided frequency descending and choose top N
        sorted_words = sorted([(i, freq.get(w, 0)) for i, w in enumerate(words)], key=lambda x: -x[1])
        pool = [i for i, _ in sorted_words[: args.pool_size or len(words)]]
    else:
        # random sample
        if args.pool_size == 0:
            pool = list(range(len(words)))
        else:
            pool = random.sample(range(len(words)), min(args.pool_size, len(words)))

    compute_topk_parallel(prefix, words, meta, k=args.k, pool_indices=pool, out_dir=OUT_DIR, workers=args.workers, output_format=args.output_format, wordbank_version=args.version)
