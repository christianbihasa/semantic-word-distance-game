import os
import json
import argparse
from annoy import AnnoyIndex

ARTIFACTS_DIR = os.path.join("artifacts")
OUT_DIR = os.path.join("..", "frontend", "public", "topk")
os.makedirs(OUT_DIR, exist_ok=True)


def load_index_and_words(prefix=os.path.join(ARTIFACTS_DIR, "annoy_index")):
    with open(f"{prefix}_words.json", "r", encoding="utf-8") as f:
        words = json.load(f)
    with open(f"{prefix}_meta.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
    DIM = meta.get("dim")
    index = AnnoyIndex(DIM, 'angular')
    index.load(f"{prefix}.ann")
    return index, words, meta


def compute_topk(index, words, k=200, pool=None, out_dir=OUT_DIR):
    # pool: list of target indices to compute for
    if pool is None:
        pool = list(range(len(words)))
    print(f"Computing top-{k} for {len(pool)} targets...")
    targets_meta = []
    for idx in pool:
        nns, dists = index.get_nns_by_item(idx, k+1, include_distances=True)
        # remove the target itself from results
        paired = []
        for nid, dist in zip(nns, dists):
            if nid == idx:
                continue
            paired.append((words[nid], float(1.0 - dist)))
            if len(paired) >= k:
                break
        # write compact file
        out_path = os.path.join(out_dir, f"{words[idx]}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump([{"w": w, "s": s} for w, s in paired], f, ensure_ascii=False)
        targets_meta.append(words[idx])
    # write targets list
    with open(os.path.join(out_dir, "targets.json"), "w", encoding="utf-8") as f:
        json.dump(targets_meta, f, ensure_ascii=False)
    print("Top-K computation complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--k", type=int, default=200, help="Top K neighbors to compute")
    parser.add_argument("--pool-size", type=int, default=1000, help="Number of random targets to compute (0 = all)")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    index, words, meta = load_index_and_words()
    import random
    random.seed(args.seed)
    if args.pool_size == 0:
        pool = list(range(len(words)))
    else:
        pool = random.sample(range(len(words)), min(args.pool_size, len(words)))

    compute_topk(index, words, k=args.k, pool=pool)
